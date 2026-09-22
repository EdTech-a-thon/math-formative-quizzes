// A quiz's time limit, in seconds.
//
// Quizzes saved before the limit became seconds carry `timeLimitMinutes`
// instead, so nothing reads either field directly — every reader comes through
// `resolveTimeLimitSeconds`, which makes an old quiz and a new one behave the
// same. Quizzes convert themselves the first time the editor saves them.
//
// A second copy of this file lives at `pb_hooks/time_limit.js`, because
// PocketBase hooks cannot import from `$lib`. The duplication is deliberate and
// the two copies must agree: `driver.mjs time-limits` runs both over the same
// table of settings and fails if they ever differ.

export type TimeLimitSettings = { timeLimitSeconds?: unknown; timeLimitMinutes?: unknown };

export const MAX_TIME_LIMIT_SECONDS = 3600;
// 15-second steps up to five minutes, one-minute steps above it.
const FINE_STEP = 15;
const COARSE_STEP = 60;
const FINE_LIMIT = 300;

function clampSeconds(seconds: number): number {
  return Math.min(MAX_TIME_LIMIT_SECONDS, Math.max(0, Math.round(seconds)));
}

// The limit a quiz's saved settings actually mean.
export function resolveTimeLimitSeconds(settings: TimeLimitSettings | null | undefined): number {
  const storedSeconds = settings ? settings.timeLimitSeconds : undefined;
  // A stored zero means untimed, so it has to win over any legacy minutes
  // still sitting beside it — hence presence, not truthiness.
  if (storedSeconds !== undefined && storedSeconds !== null && storedSeconds !== "") {
    const seconds = Number(storedSeconds);
    if (isFinite(seconds) && seconds >= 0) return clampSeconds(seconds);
  }
  const minutes = Number(settings ? settings.timeLimitMinutes : undefined);
  if (isFinite(minutes) && minutes > 0) return clampSeconds(minutes * 60);
  return 0;
}

// "45 sec" under a minute, "1:30" at a minute and over, and nothing at all when
// the quiz is untimed.
export function formatTimeLimit(seconds: number): string {
  if (!(seconds > 0)) return "";
  if (seconds < 60) return seconds + " sec";
  const remainder = seconds % 60;
  return Math.floor(seconds / 60) + ":" + (remainder < 10 ? "0" : "") + remainder;
}

// The same thing, for the places that have to say something when a quiz is untimed.
export function timeLimitLabel(seconds: number): string {
  return formatTimeLimit(seconds) || "No limit";
}

// One press of the stepper. Stepping below fifteen seconds reaches zero, which
// is a real setting: it means the quiz is untimed.
export function stepTimeLimitSeconds(seconds: number, direction: number): number {
  const from = clampSeconds(seconds);
  const step = from < FINE_LIMIT || (direction < 0 && from <= FINE_LIMIT) ? FINE_STEP : COARSE_STEP;
  const next = direction > 0 ? (Math.floor(from / step) + 1) * step : (Math.ceil(from / step) - 1) * step;
  return clampSeconds(next);
}
