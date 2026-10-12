/**
 * Realtime Broadcaster — server-side event-bus consumers.
 *
 * The eventBus has had publishers (siani.ts → NEED_DETECTED, sianiTurn.ts →
 * SIANI_RESPONSE / CRISIS_SIGNAL, voice route → VOICE_TRANSCRIPTION) but
 * zero in-process subscribers, which means:
 *   - No structured audit log of what fired when.
 *   - The Supabase realtime channel forwards correctly to remote clients
 *     (live UI surfaces) but local services like the care-team router
 *     never see crisis events to enrich them or persist them.
 *
 * This module wires a small set of consumers onto the bus at server boot.
 * Each consumer is failure-isolated — a thrown handler does not affect any
 * other consumer or the publish path (see `publish` in supabase.ts).
 *
 * What it does NOT do (yet — those land in the downstream "Real-time crisis
 * escalation + care-team UI" task already on the board): write to a
 * push-notification fan-out, page on-call CHWs, or paint care-team
 * dashboards. This is the substrate those features will hang from.
 */

import { eventBus, EventTypes, type EventPayload } from "../supabase";
import { logInfo, logWarn, logError } from "../lib/logger";
import { storage } from "../storage";

let wired = false;

/**
 * Map a safety tier onto the escalations table's `level` enum so on-call
 * dashboards can sort/filter without a join. T3 (critical) → urgent so
 * paging surfaces it immediately; T2 (risk) → priority; everything else
 * falls back to info.
 */
function tierToEscalationLevel(tier: unknown): "info" | "priority" | "urgent" {
  if (tier === "T3_critical") return "urgent";
  if (tier === "T2_risk") return "priority";
  return "info";
}

export function wireRealtimeBroadcaster(): void {
  if (wired) return;
  wired = true;

  // Audit / structured log for every Siani turn (success path) — useful for
  // post-hoc analysis of which engines + attunements actually fired in
  // production, decoupled from /api/chat or /api/voice/chat.
  eventBus.subscribe(EventTypes.SIANI_RESPONSE, (payload: EventPayload) => {
    logInfo("eventBus.siani.response", "turn complete", {
      userId: payload.userId,
      modality: payload.data?.modality,
      attunementMode: payload.data?.attunementMode,
      detectedNeeds: payload.data?.detectedNeeds,
      shouldEscalate: payload.data?.shouldEscalate,
      referralCreated: !!payload.data?.referralCreated,
    });
  });

  // Need-detection fan-out (food / housing / mental-health / etc) — the
  // Signal feed surface and any future smart-prefetch code can subscribe
  // here directly. We just log + count for now.
  //
  // Schema is set by the publisher in server/siani.ts: a single primary
  // need with category/confidence/urgency + needCount + triggerPhrases.
  eventBus.subscribe(EventTypes.NEED_DETECTED, (payload: EventPayload) => {
    const data = payload.data ?? {};
    const category = data.category as string | undefined;
    if (!category) return;
    logInfo("eventBus.need.detected", "need surfaced", {
      userId: payload.userId,
      category,
      confidence: data.confidence,
      urgency: data.urgency,
      needCount: data.needCount,
      shouldEscalate: data.shouldEscalate,
    });
  });

  // Dedupe key → expiry timestamp. runSianiTurn ALSO writes an escalation
  // row when it detects T2/T3 signals, so without this guard a single
  // crisis turn produced two dashboard rows (one from the turn pipeline,
  // one from this fan-out subscriber). The guard tolerates the race in
  // either order: whichever path wins seeds the key, the loser logs and
  // skips. Window is intentionally short (60s) so legitimately repeated
  // crisis turns in the same conversation still surface.
  const ESCALATION_DEDUPE_WINDOW_MS = 60_000;
  const recentEscalations = new Map<string, number>();
  const seenRecently = (key: string): boolean => {
    const now = Date.now();
    // Opportunistic GC so the map can't grow without bound.
    if (recentEscalations.size > 256) {
      for (const [k, exp] of recentEscalations) {
        if (exp <= now) recentEscalations.delete(k);
      }
    }
    const exp = recentEscalations.get(key);
    if (exp && exp > now) return true;
    recentEscalations.set(key, now + ESCALATION_DEDUPE_WINDOW_MS);
    return false;
  };

  // Crisis signal — log loudly AND enrich-and-persist as an escalation row
  // so on-call CHWs see the event in the dashboard the moment it fires,
  // not only in the live process tail. Persistence runs in a fire-and-
  // forget try/catch so a DB hiccup never breaks the publish path.
  eventBus.subscribe(EventTypes.CRISIS_SIGNAL, (payload: EventPayload) => {
    const data = payload.data ?? {};
    const tier = data.tier;
    const snippet =
      typeof data.messageSnippet === "string"
        ? data.messageSnippet.slice(0, 120)
        : undefined;

    logWarn("eventBus.crisis.signal", "T2/T3 detected", {
      userId: payload.userId,
      tier,
      modality: data.modality,
      conversationId: data.conversationId,
      messageIdSnippet: snippet,
    });

    const dedupeKey = `${String(payload.userId ?? "system")}:${String(
      data.conversationId ?? "no-conv"
    )}:${String(tier ?? "unknown")}`;
    if (seenRecently(dedupeKey)) {
      logInfo("eventBus.crisis.dedupe", "suppressed duplicate escalation", {
        userId: payload.userId,
        tier,
        conversationId: data.conversationId,
      });
      return;
    }

    void (async () => {
      try {
        // signalId / threadId / assignedTo are nullable references that the
        // care-team UI populates when triaging — leave them off here so the
        // insert schema treats them as omitted rather than a forced null
        // cast. Only level / state / notes are intrinsic to the auto-row.
        await storage.createEscalation({
          level: tierToEscalationLevel(tier),
          state: "open",
          notes: [
            `Auto-escalated from CRISIS_SIGNAL`,
            `tier=${String(tier ?? "unknown")}`,
            `modality=${String(data.modality ?? "text")}`,
            `userId=${String(payload.userId ?? "system")}`,
            snippet ? `snippet="${snippet}"` : undefined,
          ]
            .filter(Boolean)
            .join(" · "),
        });
      } catch (err) {
        logError("eventBus.crisis.persist", err as Error, {
          userId: payload.userId,
          tier,
        });
      }
    })();
  });

  logInfo(
    "eventBus.broadcaster",
    "wired (siani.response audit · need.detected fan-out · crisis.signal → escalations)"
  );
}

/** Idempotent — calling twice is a no-op so HMR / test reloads stay safe. */
export function isRealtimeBroadcasterWired(): boolean {
  return wired;
}

/** Test-only reset hook. */
export function _resetForTests(): void {
  wired = false;
}
