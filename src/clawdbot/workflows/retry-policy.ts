/**
 * WF-003 (#54) — Retry policies and error handling
 *
 * Configurable retry strategies and error-handling behaviour for
 * workflow nodes. Each workflow type can declare its own default
 * policy; individual nodes can override it.
 */

// ---------------------------------------------------------------------------
// Backoff strategies
// ---------------------------------------------------------------------------

export type BackoffType = "linear" | "exponential";

// ---------------------------------------------------------------------------
// Retry policy
// ---------------------------------------------------------------------------

/** Defines how many times and how aggressively to retry a failed node. */
export type RetryPolicy = {
  /** Maximum number of retry attempts (0 = no retries). */
  maxAttempts: number;
  /** How the delay between retries grows. */
  backoffType: BackoffType;
  /** Delay before the first retry in milliseconds. */
  initialDelayMs: number;
  /** Upper bound on retry delay in milliseconds. */
  maxDelayMs: number;
  /**
   * Optional jitter factor (0-1). When set, a random percentage of the
   * computed delay is added/subtracted to spread out concurrent retries.
   */
  jitterFactor?: number;
};

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

export type ErrorAction = "retry" | "skip" | "fail" | "notify";

/** What to do when a node encounters an error. */
export type ErrorHandler = {
  /** The action to take on error. */
  onError: ErrorAction;
  /** Channel to notify on error (e.g. "slack:#ops-alerts", "email:oncall@example.com"). */
  notificationChannel?: string;
  /** Retry policy applied when `onError` is "retry". */
  retryPolicy?: RetryPolicy;
  /**
   * If true, mark the entire workflow run as failed when this node fails
   * (even if `onError` is "skip").
   */
  failWorkflow?: boolean;
};

// ---------------------------------------------------------------------------
// Default policies per workflow type
// ---------------------------------------------------------------------------

/** Sensible retry defaults for common workflow categories. */
export const DEFAULT_RETRY_POLICIES: Record<string, RetryPolicy> = {
  /** API calls, webhooks — moderate retries with exponential backoff. */
  api: {
    maxAttempts: 3,
    backoffType: "exponential",
    initialDelayMs: 1_000,
    maxDelayMs: 30_000,
    jitterFactor: 0.2,
  },

  /** Browser / scraping steps — fewer retries, longer initial delay. */
  browser: {
    maxAttempts: 2,
    backoffType: "linear",
    initialDelayMs: 5_000,
    maxDelayMs: 15_000,
  },

  /** Email / notification sends — retry once; avoid duplicate sends. */
  notification: {
    maxAttempts: 1,
    backoffType: "linear",
    initialDelayMs: 2_000,
    maxDelayMs: 2_000,
  },

  /** Data processing / ETL — aggressive retries for transient failures. */
  data: {
    maxAttempts: 5,
    backoffType: "exponential",
    initialDelayMs: 500,
    maxDelayMs: 60_000,
    jitterFactor: 0.3,
  },

  /** Approval / human-in-the-loop — no automatic retry (human must re-trigger). */
  approval: {
    maxAttempts: 0,
    backoffType: "linear",
    initialDelayMs: 0,
    maxDelayMs: 0,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the delay (in ms) for a given retry attempt number.
 * Attempt numbering is 1-based (first retry = attempt 1).
 */
export function computeDelay(policy: RetryPolicy, attempt: number): number {
  let delay: number;

  if (policy.backoffType === "exponential") {
    delay = policy.initialDelayMs * 2 ** (attempt - 1);
  } else {
    // linear
    delay = policy.initialDelayMs * attempt;
  }

  delay = Math.min(delay, policy.maxDelayMs);

  if (policy.jitterFactor && policy.jitterFactor > 0) {
    const jitter = delay * policy.jitterFactor * (Math.random() * 2 - 1);
    delay = Math.max(0, delay + jitter);
  }

  return Math.round(delay);
}
