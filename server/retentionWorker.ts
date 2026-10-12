import { db } from "./db";
import { sql } from "drizzle-orm";
import { dataLake } from "./dataLake";

/**
 * Data retention worker — Task #52 (Data integrity).
 *
 * Runs on a recurring interval (default 6h) and:
 *   - Deletes vault confessions whose expires_at has passed
 *   - Prunes raw messages older than MESSAGE_RETENTION_DAYS (default 365)
 *   - Prunes emotional_states older than EMOTIONAL_STATE_RETENTION_DAYS (default 180)
 *   - Archives a daily aggregate snapshot to the Supabase data lake before
 *     pruning so analytics history is preserved offline.
 *   - Prunes data-lake `analytics/` and `reports/` objects older than
 *     ANALYTICS_RETENTION_DAYS / REPORTS_RETENTION_DAYS (defaults 365 / 730).
 *
 * All thresholds are env-configurable; setting any value to 0 disables that
 * stream (operator escape hatch).
 */

const DEFAULT_INTERVAL_HOURS = 6;
const DEFAULT_MESSAGE_DAYS = 365;
const DEFAULT_EMOTION_DAYS = 180;
const DEFAULT_ANALYTICS_DAYS = 365;
const DEFAULT_REPORTS_DAYS = 730;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

interface RetentionResult {
  vaultExpired: number;
  messagesPruned: number;
  emotionalStatesPruned: number;
  analyticsArchived: number;
  reportsArchived: number;
  archivePath: string | null;
  errors: string[];
}

type CountRow = { c: number } & Record<string, unknown>;
interface PgExecResult { count?: number }

function rowsAffected(r: unknown): number {
  if (r && typeof r === "object" && "count" in r) {
    return Number((r as PgExecResult).count) || 0;
  }
  return 0;
}

async function archiveSnapshot(messageDays: number, emotionDays: number): Promise<string | null> {
  try {
    const msgRows = await db.execute<CountRow>(
      sql`SELECT COUNT(*)::int AS c FROM messages WHERE created_at < NOW() - (${messageDays}::int * INTERVAL '1 day')`,
    );
    const emoRows = await db.execute<CountRow>(
      sql`SELECT COUNT(*)::int AS c FROM emotional_states WHERE created_at < NOW() - (${emotionDays}::int * INTERVAL '1 day')`,
    );
    const vaultRows = await db.execute<CountRow>(
      sql`SELECT COUNT(*)::int AS c FROM vault_confessions WHERE expires_at IS NOT NULL AND expires_at < NOW()`,
    );

    const msgCount = (msgRows as unknown as CountRow[])[0]?.c ?? 0;
    const emoCount = (emoRows as unknown as CountRow[])[0]?.c ?? 0;
    const vaultCount = (vaultRows as unknown as CountRow[])[0]?.c ?? 0;

    return await dataLake.storeAnalytics("retention", {
      runAt: new Date().toISOString(),
      windows: { messageDays, emotionDays },
      candidates: {
        messages: msgCount,
        emotionalStates: emoCount,
        vaultExpired: vaultCount,
      },
    });
  } catch (err) {
    console.warn("[retention] archiveSnapshot failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function runRetentionPass(): Promise<RetentionResult> {
  const messageDays = parseInt(process.env.MESSAGE_RETENTION_DAYS || String(DEFAULT_MESSAGE_DAYS), 10);
  const emotionDays = parseInt(process.env.EMOTIONAL_STATE_RETENTION_DAYS || String(DEFAULT_EMOTION_DAYS), 10);
  const analyticsDays = parseInt(process.env.ANALYTICS_RETENTION_DAYS || String(DEFAULT_ANALYTICS_DAYS), 10);
  const reportsDays = parseInt(process.env.REPORTS_RETENTION_DAYS || String(DEFAULT_REPORTS_DAYS), 10);

  const result: RetentionResult = {
    vaultExpired: 0,
    messagesPruned: 0,
    emotionalStatesPruned: 0,
    analyticsArchived: 0,
    reportsArchived: 0,
    archivePath: null,
    errors: [],
  };

  result.archivePath = await archiveSnapshot(messageDays, emotionDays);

  // Vault expirations are unconditional — always honor explicit expires_at.
  // FK cascades on vault_reactions and vault_spotlights ensure dependent
  // rows go with the parent.
  try {
    const r = await db.execute(
      sql`DELETE FROM vault_confessions WHERE expires_at IS NOT NULL AND expires_at < NOW()`,
    );
    result.vaultExpired = rowsAffected(r);
  } catch (err) {
    result.errors.push(`vault: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (messageDays > 0) {
    try {
      // emotional_states.message_id and signals.message_id both ON DELETE
      // SET NULL, so deleting messages no longer trips FK violations.
      const r = await db.execute(
        sql`DELETE FROM messages WHERE created_at < NOW() - (${messageDays}::int * INTERVAL '1 day')`,
      );
      result.messagesPruned = rowsAffected(r);
    } catch (err) {
      result.errors.push(`messages: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (emotionDays > 0) {
    try {
      const r = await db.execute(
        sql`DELETE FROM emotional_states WHERE created_at < NOW() - (${emotionDays}::int * INTERVAL '1 day')`,
      );
      result.emotionalStatesPruned = rowsAffected(r);
    } catch (err) {
      result.errors.push(`emotional_states: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Data-lake lifecycle. Analytics and reports both live under date-
  // partitioned prefixes; we sweep anything older than the configured
  // window. Defaults are intentionally generous (1y / 2y) — operators
  // can shorten via env.
  if (analyticsDays > 0) {
    try {
      result.analyticsArchived = await dataLake.pruneOlderThan("analytics", analyticsDays);
    } catch (err) {
      result.errors.push(`analytics-lake: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (reportsDays > 0) {
    try {
      result.reportsArchived = await dataLake.pruneOlderThan("reports", reportsDays);
    } catch (err) {
      result.errors.push(`reports-lake: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(
    `[retention] pass complete vaultExpired=${result.vaultExpired} messages=${result.messagesPruned} emotions=${result.emotionalStatesPruned} analyticsLake=${result.analyticsArchived} reportsLake=${result.reportsArchived} archive=${result.archivePath ?? "none"} errors=${result.errors.length}`,
  );
  return result;
}

export function startRetentionWorker(): void {
  if (timer) return;
  if (process.env.RETENTION_WORKER_DISABLED === "true") {
    console.log("[retention] worker disabled via RETENTION_WORKER_DISABLED");
    return;
  }
  const intervalHours = Math.max(
    1,
    parseInt(process.env.RETENTION_INTERVAL_HOURS || String(DEFAULT_INTERVAL_HOURS), 10) || DEFAULT_INTERVAL_HOURS,
  );
  const intervalMs = intervalHours * 60 * 60 * 1000;
  console.log(`[retention] worker scheduled every ${intervalHours}h`);

  // Run once shortly after boot so any expired vault rows clear quickly,
  // then on the regular cadence.
  setTimeout(() => {
    if (running) return;
    running = true;
    runRetentionPass()
      .catch((e) => console.warn("[retention] initial pass error", e instanceof Error ? e.message : String(e)))
      .finally(() => {
        running = false;
      });
  }, 60 * 1000);

  timer = setInterval(() => {
    if (running) return;
    running = true;
    runRetentionPass()
      .catch((e) => console.warn("[retention] pass error", e instanceof Error ? e.message : String(e)))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
}

export function stopRetentionWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
