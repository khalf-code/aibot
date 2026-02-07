/**
 * CORE-008 (#24) — Run cancellation + timeout
 *
 * Configuration and signalling types for per-step and global run
 * timeouts, plus cooperative cancellation.
 */

export type TimeoutConfig = {
  /** Maximum wall-clock time allowed for a single step (ms). */
  perStepMs: number;
  /** Maximum wall-clock time allowed for the entire run (ms). */
  globalRunMs: number;
  /** Grace period after cancellation signal before force-kill (ms). */
  cancelGraceMs: number;
};

export type CancellationReason = "timeout" | "user" | "policy" | "error";

export type CancellationSignal = {
  runId: string;
  reason: CancellationReason;
  /** Who or what initiated the cancellation (e.g. "user:abc", "system"). */
  initiatedBy: string;
  /** Unix epoch ms when the signal was created. */
  timestamp: number;
};
