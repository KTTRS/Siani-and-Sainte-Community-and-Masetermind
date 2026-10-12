/**
 * Tiny structured logger.
 *
 * One reason to exist: stop swallowing background errors with bare
 * `console.error` / empty `.catch(() => {})`. Every entry goes out as a
 * single JSON line so log aggregators (Datadog, Logtail, Replit logs)
 * can parse + alert on it.
 *
 * Usage:
 *   logError("siani.turn", err, { modality, userId, stage: "smartMatcher" });
 *   logWarn("siani.turn", "empty content", { finish, usage });
 *   logInfo("siani.turn", "auto-referral created", { referralId });
 */

type Level = "info" | "warn" | "error";

function emit(level: Level, scope: string, message: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    msg: message,
    ...(meta || {}),
  };
  const line = (() => {
    try {
      return JSON.stringify(entry);
    } catch {
      return JSON.stringify({ ts: entry.ts, level, scope, msg: message, meta: "[unserializable]" });
    }
  })();
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function errMeta(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { errName: err.name, errMessage: err.message, stack: err.stack };
  }
  if (typeof err === "object" && err !== null) {
    return { err: err as Record<string, unknown> };
  }
  return { err: String(err) };
}

export function logError(scope: string, err: unknown, meta?: Record<string, unknown>) {
  emit("error", scope, "error", { ...errMeta(err), ...(meta || {}) });
}

export function logWarn(scope: string, message: string, meta?: Record<string, unknown>) {
  emit("warn", scope, message, meta);
}

export function logInfo(scope: string, message: string, meta?: Record<string, unknown>) {
  emit("info", scope, message, meta);
}
