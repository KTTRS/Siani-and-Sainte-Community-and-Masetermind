/**
 * Shared Siani Turn pipeline — used by BOTH /api/chat (text) and
 * /api/voice/chat (voice) so a single conversational turn is enriched,
 * reasoned, and persisted identically regardless of input modality.
 *
 * One function, one source of truth. Voice in = voice out, text in = text
 * out, but the brain in the middle (engines, memory, resources, referrals,
 * signals, escalations, goal extraction) is identical.
 */

import { storage } from "./storage";
import {
  generateSianiResponse,
  analyzeGoalIntents,
  type AvailableResource,
} from "./siani";
import { detectNeeds } from "./engines/needs";
import { smartMatcher } from "./engines/smart-matching";
import {
  getConversationContext,
  updateConversationContext,
  buildContextPrompt,
} from "./services/conversationMemory";
import { eventBus, EventTypes } from "./supabase";
import { logError, logWarn, logInfo } from "./lib/logger";
import { classifyAcceptance } from "./services/acceptanceClassifier";
import type { ProsodyAnalysis } from "./engines/types";
import type { User } from "@shared/schema";

export interface SianiTurnInput {
  user: User;
  message: string;
  conversationId?: string;
  prosody?: ProsodyAnalysis; // populated by voice route from Whisper analysis
  /** Where this turn originated. Used for events + diagnostic logging. */
  modality: "text" | "voice";
}

export interface SianiTurnResult {
  effectiveConversationId: string;
  assistantMessageId: string;
  sianiResponse: Awaited<ReturnType<typeof generateSianiResponse>>;
  matchedResources?: AvailableResource[];
  detectedNeeds?: ReturnType<typeof generateSianiResponse> extends Promise<infer R>
    ? R extends { detectedNeeds?: infer D }
      ? D
      : undefined
    : undefined;
  shouldEscalate?: boolean;
  shouldOfferResources?: boolean;
  referralCreated?: { id: string; resourceId: string; resourceName: string } | null;
  goalsCreated?: { id: string; title: string }[];
  /** Voice-only: capped copy of sianiResponse.message intended for TTS only. */
  spokenMessage?: string;
}

/**
 * Trim a Siani reply down to a spoken-word friendly length. Prefers a
 * sentence boundary (. ? !) at or before the limit; falls back to a clean
 * word boundary if the first sentence is itself too long.
 */
function capForVoice(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  const window = trimmed.slice(0, limit + 40);
  const sentenceRe = /[\.\?!]\s/g;
  let cut = -1;
  let m: RegExpExecArray | null;
  while ((m = sentenceRe.exec(window)) !== null) {
    const idx = m.index + 1;
    if (idx > 0 && idx <= limit) cut = idx;
  }
  if (cut > 60) return trimmed.slice(0, cut).trim();
  // No good sentence boundary — fall back to last space ≤ limit
  const slice = trimmed.slice(0, limit);
  const space = slice.lastIndexOf(" ");
  return (space > 60 ? slice.slice(0, space) : slice).trim() + "…";
}

/**
 * Strict affirmative — high-signal phrases that clearly mean "yes, hand it
 * over." These auto-confirm without invoking the GPT-5 classifier.
 *
 * Excludes bare "ok" / "sure" / "yeah" — those land in AMBIGUOUS_AFFIRMATIVE
 * because they're often pure social acknowledgement ("yeah, my week's been
 * rough") rather than acceptance of a specific offer.
 */
export const STRICT_AFFIRMATIVE =
  /\b(hook me up|hit me up|send (it|me|that|the (info|details|number|address))|share (it|that|them|the (info|details|number))|give me (it|that|the (info|details|number|address))|let'?s do it|i'?m down|do it|sign me up|please (do|share|send)|go for it|i'?ll try (it|that)|yes please|yeah please)\b/i;

/**
 * Ambiguous affirmative — could be a "yes" or could be a polite "I'm still
 * listening." Bare "ok / sure / yeah / mm-hmm / alright / fine" land here.
 * For these we require BOTH (a) Siani's previous turn named a known
 * resource, AND (b) the GPT-5 minimal-reasoning classifier returns true.
 */
export const AMBIGUOUS_AFFIRMATIVE =
  /\b(yes|yeah|yep|yup|yea|sure|okay|ok|alright|all right|fine|sounds good|cool|word|bet|aight|mm-?hmm|mhm|go ahead)\b/i;

/**
 * Run a full Siani conversational turn. Same logic for text and voice.
 *
 * Steps:
 *   1. Resolve / create conversation
 *   2. Pull recent message history
 *   3. Pull cross-session memory + user goals (Bag context)
 *   4. Pre-detect needs → SmartMatcher → real Michigan resources
 *   5. Load active referrals (so Siani can naturally follow up)
 *   6. Auto-create a referral if user just said "yes" to a prior offer
 *   7. Call generateSianiResponse (this runs ALL 12+ engines)
 *   8. Persist user msg, assistant msg, emotional state, signals, escalations
 *   9. Update cross-session memory
 *  10. Background: extract goals into the Bag
 */
export async function runSianiTurn(input: SianiTurnInput): Promise<SianiTurnResult> {
  const { user, message, conversationId, prosody, modality } = input;
  const effectiveUserId = user.id;

  // 1. Conversation
  let effectiveConversationId = conversationId;
  if (!effectiveConversationId) {
    const conversation = await storage.createConversation({
      userId: effectiveUserId,
      title: message.slice(0, 50) + (message.length > 50 ? "..." : ""),
    });
    effectiveConversationId = conversation.id;
  } else {
    // Defense-in-depth: verify the supplied conversationId belongs to this user
    // before reading history or writing new messages into it.
    const existingConv = await storage.getConversation(effectiveConversationId);
    if (existingConv && existingConv.userId !== effectiveUserId) {
      const err = new Error("Conversation does not belong to the calling user");
      (err as NodeJS.ErrnoException).code = "FORBIDDEN";
      throw err;
    }
  }

  // 2. Recent history
  const messageHistory = await storage.getMessagesByConversation(
    effectiveConversationId,
    10
  );
  const conversationHistory = messageHistory.reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // 3. Cross-session memory + goals
  const memoryContext = await getConversationContext(effectiveUserId);
  const memoryPrompt = buildContextPrompt(memoryContext);
  const goals = await storage.getGoalsByUser(effectiveUserId);

  // 4. Real Michigan resources (drives the Resource / Referral engines)
  const preDetectedNeeds = detectNeeds(message, conversationHistory);
  let availableResources: AvailableResource[] = [];
  if (preDetectedNeeds.hasNeeds && preDetectedNeeds.needsDetected.length > 0) {
    try {
      const matchResult = await smartMatcher.match({
        userId: effectiveUserId,
        message,
        limit: 3,
      });
      availableResources = matchResult.resources.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        description: r.description,
        contact: r.contact,
        matchReason: r.matchReason,
      }));
    } catch (matchErr) {
      logError("siani.turn.smartMatcher", matchErr, {
        modality,
        userId: effectiveUserId,
        nonBlocking: true,
      });
    }
  }

  // 5. Active referrals (so the Referral Follow-up engine has something to work with)
  let activeReferrals: Awaited<ReturnType<typeof storage.getActiveReferralsForUser>> = [];
  try {
    activeReferrals = await storage.getActiveReferralsForUser(effectiveUserId);
  } catch (refErr) {
    logError("siani.turn.getActiveReferrals", refErr, {
      modality,
      userId: effectiveUserId,
      nonBlocking: true,
    });
  }

  // 6. Auto-referral on acceptance ("yes hook me up" → tracked referral)
  let createdReferralPayload:
    | { id: string; resourceId: string; resourceName: string }
    | null = null;
  const trimmedMsg = message.trim();
  const isStrictYes =
    trimmedMsg.length > 0 &&
    trimmedMsg.length < 80 &&
    STRICT_AFFIRMATIVE.test(trimmedMsg);
  const isAmbiguousYes =
    !isStrictYes &&
    trimmedMsg.length > 0 &&
    trimmedMsg.length < 40 && // "yeah it's been rough" should NOT count — keep this tight
    AMBIGUOUS_AFFIRMATIVE.test(trimmedMsg);
  const isShortAcceptance =
    (isStrictYes || isAmbiguousYes) && availableResources.length === 0;
  if (isShortAcceptance) {
    const lastAssistant = [...conversationHistory]
      .reverse()
      .find((m) => m.role === "assistant");
    if (lastAssistant?.content) {
      const lowerLast = lastAssistant.content.toLowerCase();
      const offeredFromPrior = await smartMatcher
        .match({
          userId: effectiveUserId,
          message: lastAssistant.content,
          limit: 5,
        })
        .catch((e) => {
          logWarn("siani.turn.priorMatch", "smartMatcher failed", {
            modality,
            userId: effectiveUserId,
            errMessage: e?.message || String(e),
          });
          return null;
        });
      const candidates = offeredFromPrior?.resources || [];
      const accepted = candidates.find((r) => {
        const tokens = r.name
          .toLowerCase()
          .split(/[\s,\-()]+/)
          .filter((w) => w.length >= 6);
        if (tokens.length === 0) return false;
        const longest = tokens.sort((a, b) => b.length - a.length)[0];
        return lowerLast.includes(longest);
      });
      // Ambiguous replies require a second-stage GPT-5 confirmation that the
      // user is actually accepting the offer — not just murmuring agreement
      // about the topic. Strict matches skip this round-trip.
      let confirmed = !!accepted;
      if (accepted && isAmbiguousYes) {
        confirmed = await classifyAcceptance({
          userMessage: trimmedMsg,
          lastAssistantMessage: lastAssistant.content,
          offeredResourceName: accepted.name,
        });
        logInfo("siani.turn.ambiguousAcceptance", confirmed ? "confirmed" : "rejected", {
          modality,
          userId: effectiveUserId,
          resourceName: accepted.name,
          replySnippet: trimmedMsg,
        });
      }
      if (accepted && confirmed) {
        const alreadyActive = activeReferrals.some(
          (r) => r.resourceId === accepted.id
        );
        if (!alreadyActive) {
          try {
            const newRef = await storage.createReferral({
              userId: effectiveUserId,
              resourceId: accepted.id,
              source: "siani",
              state: "pending",
              priority: accepted.matchScore >= 80 ? "high" : "normal",
              notes: `Auto-created when user accepted Siani's offer of ${accepted.name} (via ${modality})`,
            });
            createdReferralPayload = {
              id: newRef.id,
              resourceId: accepted.id,
              resourceName: accepted.name,
            };
            logInfo("siani.turn.autoReferral", "created", {
              modality,
              userId: effectiveUserId,
              referralId: newRef.id,
              resourceId: accepted.id,
              resourceName: accepted.name,
            });
          } catch (createErr) {
            logError("siani.turn.autoReferral", createErr, {
              modality,
              userId: effectiveUserId,
              resourceId: accepted.id,
              nonBlocking: true,
            });
          }
        }
      }
    }
  }

  // 7. Call Siani — this is where ALL the engines fire (trauma-aware,
  // emotional attunement, capacity, relief, behavioral, joy induction, etc.)
  // Voice mode gets a different register: short, spoken, no markdown, no
  // lists, no headers — like a friend on the phone, not a wiki entry read
  // aloud.
  const voiceRegisterNote =
    modality === "voice"
      ? [
          "VOICE_MODE: Output will be spoken aloud, not read.",
          "- Reply in 1-2 short sentences (~40 words max).",
          "- Plain spoken English. No lists, no markdown, no headers, no emoji.",
          "- Don't read URLs, codes, or 'Resource:' style labels out loud.",
          "- Sound like a friend on the phone, not a chat log.",
        ].join("\n")
      : undefined;

  const userContext = {
    recentBagItems: goals.slice(0, 3).map((g) => g.title),
    rhythms: memoryContext.recentTopics,
    memoryContext: voiceRegisterNote
      ? `${memoryPrompt}\n\n${voiceRegisterNote}`
      : memoryPrompt,
    activeReferrals,
    availableResources,
  };
  const sianiResponse = await generateSianiResponse(
    message,
    conversationHistory,
    userContext,
    prosody
  );

  // Cap the spoken copy only; persist + return the full reply unchanged.
  let spokenMessage: string | undefined;
  if (modality === "voice" && sianiResponse.message) {
    spokenMessage = capForVoice(sianiResponse.message, 360);
  }

  // 8a. Save user message
  await storage.createMessage({
    conversationId: effectiveConversationId,
    role: "user",
    content: message,
  });

  // 8b. Save assistant message
  const assistantMessage = await storage.createMessage({
    conversationId: effectiveConversationId,
    role: "assistant",
    content: sianiResponse.message,
    emotionalState: sianiResponse.emotionalState || null,
  });

  // 8c. Save emotional state
  if (sianiResponse.emotionalState) {
    await storage.createEmotionalState({
      userId: effectiveUserId,
      messageId: assistantMessage.id,
      overallSentiment: sianiResponse.emotionalState.overallSentiment,
      arousalLevel: sianiResponse.emotionalState.arousalLevel,
    });
  }

  // 8d. Save signals + create escalations for T2/T3 safety tiers
  const savedSignalIds: string[] = [];
  if (sianiResponse.detectedSignals?.length) {
    for (const signal of sianiResponse.detectedSignals) {
      const savedSignal = await storage.createSignal({
        userId: effectiveUserId,
        messageId: assistantMessage.id,
        signalType: signal.type,
        severity: signal.severity,
        confidence: signal.confidence,
        triggerText: message.slice(0, 200),
      });
      savedSignalIds.push(savedSignal.id);
    }
    if (sianiResponse.userState?.safetyState && savedSignalIds.length > 0) {
      const tier = sianiResponse.userState.safetyState.tier;
      if (tier === "T2_risk" || tier === "T3_critical") {
        storage
          .createEscalation({
            signalId: savedSignalIds[0],
            level: tier === "T3_critical" ? "urgent" : "priority",
            state: "open",
            notes: `Auto-escalated from ${tier} (${modality}). Signals: ${sianiResponse.detectedSignals
              .map((s) => s.type)
              .join(", ")}`,
          })
          .catch((err) =>
            logError("siani.turn.escalation", err, {
              modality,
              userId: effectiveUserId,
              tier,
              signalId: savedSignalIds[0],
            })
          );
      }
    }
  }

  // 9. Cross-session memory update (background)
  updateConversationContext(
    effectiveUserId,
    message,
    undefined,
    sianiResponse.emotionalState
      ? {
          sentiment: sianiResponse.emotionalState.overallSentiment,
          arousal: sianiResponse.emotionalState.arousalLevel,
        }
      : undefined
  ).catch((err) =>
    logError("siani.turn.memoryUpdate", err, {
      modality,
      userId: effectiveUserId,
    })
  );

  // 10. Goal extraction → The Bag (background, non-blocking)
  const createdGoals: { id: string; title: string }[] = [];
  try {
    const extractedGoals = await analyzeGoalIntents(message, conversationHistory);
    for (const extracted of extractedGoals) {
      const existing = await storage.findSimilarGoal(
        effectiveUserId,
        extracted.title
      );
      if (!existing) {
        const newGoal = await storage.createGoal({
          userId: effectiveUserId,
          title: extracted.title,
          description: extracted.description,
          category: extracted.category,
        });
        createdGoals.push({ id: newGoal.id, title: newGoal.title });
        logInfo("siani.turn.goalExtraction", "auto-created goal", {
          modality,
          userId: effectiveUserId,
          goalId: newGoal.id,
          goalTitle: newGoal.title,
        });
      }
    }
  } catch (goalError) {
    logError("siani.turn.goalExtraction", goalError, {
      modality,
      userId: effectiveUserId,
      nonBlocking: true,
    });
  }

  // Crisis surface — publish CRISIS_SIGNAL on T2/T3 so the in-process
  // broadcaster (and any future care-team UI) can react in realtime
  // instead of polling. T0/T1 don't need to wake up on-call.
  const safetyTier = sianiResponse.userState?.safetyState?.tier;
  if (safetyTier === "T2_risk" || safetyTier === "T3_critical") {
    eventBus
      .publish(EventTypes.CRISIS_SIGNAL, {
        type: EventTypes.CRISIS_SIGNAL,
        userId: effectiveUserId,
        data: {
          tier: safetyTier,
          modality,
          conversationId: effectiveConversationId,
          messageSnippet: trimmedMsg.slice(0, 200),
          attunementMode: sianiResponse.attunementMode,
        },
      })
      .catch((err) =>
        logError("siani.turn.eventBus.CRISIS_SIGNAL", err, {
          modality,
          userId: effectiveUserId,
          nonBlocking: true,
        })
      );
  }

  // SIANI_RESPONSE for every turn (text + voice) so consumers see the full
  // pipeline, not just voice. The in-process audit logger reads this; the
  // remote channel echoes it to live UI surfaces.
  eventBus
    .publish(EventTypes.SIANI_RESPONSE, {
      type: EventTypes.SIANI_RESPONSE,
      userId: effectiveUserId,
      data: {
        response: sianiResponse.message,
        conversationId: effectiveConversationId,
        emotionalState: sianiResponse.emotionalState,
        modality,
        attunementMode: sianiResponse.attunementMode,
        detectedNeeds: sianiResponse.detectedNeeds,
        shouldEscalate: sianiResponse.shouldEscalate,
        referralCreated: createdReferralPayload?.id,
      },
    })
    .catch((err) =>
      logError("siani.turn.eventBus.SIANI_RESPONSE", err, {
        modality,
        userId: effectiveUserId,
        nonBlocking: true,
      })
    );

  return {
    effectiveConversationId,
    assistantMessageId: assistantMessage.id,
    sianiResponse,
    matchedResources:
      availableResources.length > 0 ? availableResources : undefined,
    detectedNeeds: sianiResponse.detectedNeeds as any,
    shouldEscalate: sianiResponse.shouldEscalate || undefined,
    shouldOfferResources: sianiResponse.shouldOfferResources || undefined,
    referralCreated: createdReferralPayload,
    goalsCreated: createdGoals.length > 0 ? createdGoals : undefined,
    spokenMessage,
  };
}
