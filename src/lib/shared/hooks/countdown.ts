// Pure countdown math — intentionally free of any React import so it can be unit-tested
// (with fake timers) in a node test env, where react is only a peer dependency.

export interface Countdown {
  /** Remaining time as "MM:SS" (clamped at "00:00"). */
  mmss: string;
  /** True once the deadline has passed (or when no deadline is given). */
  expired: boolean;
  /** True while not expired and under 60s remain. */
  urgent: boolean;
  /** Remaining milliseconds, clamped at 0. */
  remainingMs: number;
}

const URGENT_THRESHOLD_MS = 60_000;

/**
 * Compute the countdown from a server-provided ISO deadline. Reads the wall clock
 * (`Date.now()`) at call time — never a client-started elapsed timer — so the value is
 * anchored to the server timestamp and stays correct across re-mounts and reconnects.
 */
export function countdownFrom(deadlineIso: string | null | undefined): Countdown {
  const expiredResult: Countdown = { mmss: "00:00", expired: true, urgent: false, remainingMs: 0 };
  if (!deadlineIso) return expiredResult;
  const deadlineMs = new Date(deadlineIso).getTime();
  if (Number.isNaN(deadlineMs)) return expiredResult;

  const remainingMs = Math.max(0, deadlineMs - Date.now());
  const expired = remainingMs <= 0;
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return {
    mmss: `${mm}:${ss}`,
    expired,
    urgent: !expired && remainingMs < URGENT_THRESHOLD_MS,
    remainingMs,
  };
}
