/**
 * Tool-call contract v1 for Clawdbot.
 *
 * Defines the request/response shape for all tool invocations within the
 * Clawdbot agent runtime. Every tool runner (CLI, browser, email, voice,
 * webhook) speaks this contract so skills and workflows can compose tools
 * without coupling to runner internals.
 *
 * Versioned as `TOOL_CONTRACT_VERSION = 1`. Backward-compatible additions
 * (new optional fields) do NOT bump the version; breaking changes do.
 *
 * @see https://docs.openclaw.ai/clawdbot/core/tool-contract
 * @module
 */

// ---------------------------------------------------------------------------
// Contract version
// ---------------------------------------------------------------------------

/** Increment only on breaking changes to the contract shape. */
export const TOOL_CONTRACT_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// ToolType
// ---------------------------------------------------------------------------

/**
 * The category of tool being invoked.
 *
 * - `cli`     -- shell command execution (allowlisted)
 * - `browser` -- Playwright-driven web automation
 * - `email`   -- email send / read / draft operations
 * - `voice`   -- outbound or inbound voice calls
 * - `webhook` -- HTTP request to an external webhook endpoint
 */
export type ToolType = "cli" | "browser" | "email" | "voice" | "webhook";

// ---------------------------------------------------------------------------
// RedactionRule
// ---------------------------------------------------------------------------

/**
 * Describes how a secret or sensitive value should be masked in tool output,
 * logs, and stored artifacts.
 *
 * The runtime applies redaction rules **before** persisting any data so
 * secrets never leak into the audit trail or dashboard UI.
 */
export type RedactionRule = {
  /** Unique identifier for this rule (e.g. `"api-key-acme"`). */
  id: string;

  /**
   * What kind of matching to apply.
   *
   * - `exact`  -- literal string replacement
   * - `regex`  -- ECMAScript regex pattern (flags in `pattern`)
   * - `jsonpath` -- mask values at a JSON path (e.g. `$.headers.Authorization`)
   */
  kind: "exact" | "regex" | "jsonpath";

  /**
   * The pattern to match.
   *
   * For `exact`: the literal secret value.
   * For `regex`: a valid ECMAScript regular expression (as a string).
   * For `jsonpath`: a JSONPath expression.
   */
  pattern: string;

  /**
   * Replacement string inserted where the match was found.
   *
   * Defaults to `"[REDACTED]"` when omitted.
   */
  replacement?: string;

  /** Human-readable label shown in audit logs (e.g. `"Acme API key"`). */
  label?: string;
};

// ---------------------------------------------------------------------------
// ArtifactRef
// ---------------------------------------------------------------------------

/**
 * A lightweight reference to a stored artifact produced during a tool call
 * (screenshot, transcript, PDF export, etc.).
 *
 * The actual bytes live in the artifact store; this ref is safe to embed in
 * responses and audit records.
 */
export type ArtifactRef = {
  /** Stable, unique artifact identifier (UUID v4). */
  id: string;

  /**
   * The kind of artifact.
   *
   * - `screenshot` -- browser/desktop screenshot (PNG or JPEG)
   * - `transcript` -- voice call or meeting transcript (text)
   * - `file`       -- generic file (PDF, CSV, etc.)
   * - `log`        -- structured log output
   */
  type: "screenshot" | "transcript" | "file" | "log";

  /** MIME type of the stored content (e.g. `"image/png"`, `"text/plain"`). */
  mimeType: string;

  /**
   * Storage URI understood by the artifact store.
   *
   * Examples:
   * - `artifact://local/<id>`
   * - `s3://clawdbot-artifacts/<id>`
   */
  uri: string;

  /** Byte size of the stored artifact. */
  sizeBytes?: number;

  /** ISO-8601 timestamp when the artifact was created. */
  createdAt?: string;

  /** Optional human-readable label (e.g. `"Login page screenshot"`). */
  label?: string;

  /** SHA-256 hex digest for integrity verification. */
  sha256?: string;
};

// ---------------------------------------------------------------------------
// CostInfo
// ---------------------------------------------------------------------------

/**
 * Optional cost/resource-usage metadata attached to a tool call response.
 *
 * Enables the dashboard to surface per-run cost breakdowns and lets policy
 * engines enforce budget limits.
 */
export type CostInfo = {
  /** Wall-clock duration of the tool execution in milliseconds. */
  durationMs: number;

  /**
   * Estimated monetary cost in USD (micro-dollars, i.e. 1 = $0.000001).
   *
   * Use micro-dollars to avoid floating-point rounding in aggregations.
   */
  estimatedCostMicroUsd?: number;

  /**
   * Number of LLM tokens consumed (if the tool made model calls internally).
   */
  tokensUsed?: number;

  /** Number of retries the runner attempted before returning. */
  retryCount?: number;
};

// ---------------------------------------------------------------------------
// ToolCallRequest
// ---------------------------------------------------------------------------

/**
 * Input payload sent to a tool runner.
 *
 * The agent runtime constructs a `ToolCallRequest`, validates it against the
 * skill manifest's tool allowlist, applies redaction rules, then dispatches
 * it to the appropriate runner.
 */
export type ToolCallRequest = {
  /** Contract version this request conforms to. */
  version: typeof TOOL_CONTRACT_VERSION;

  /** Globally unique request ID (UUID v4). Used for tracing and deduplication. */
  requestId: string;

  /**
   * Client-supplied idempotency key.
   *
   * If the runtime has already processed a request with this key, it returns
   * the cached response instead of re-executing. Callers should generate a
   * deterministic key from the logical operation (e.g. hash of skill +
   * step + input).
   */
  idempotencyKey: string;

  /** Tool category. Determines which runner handles the request. */
  toolType: ToolType;

  /**
   * Fully qualified tool name within the runner namespace.
   *
   * Examples: `"cli:git-status"`, `"browser:navigate"`, `"email:send"`.
   */
  toolName: string;

  /**
   * Runner-specific arguments.
   *
   * Shape varies by tool type. Validated by the runner, not the contract.
   */
  arguments: Record<string, unknown>;

  /**
   * Redaction rules to apply to outputs, logs, and artifacts produced by
   * this tool call. Merged with global redaction rules at runtime.
   */
  redactionRules?: RedactionRule[];

  /**
   * Maximum time the runner may spend on this call (milliseconds).
   *
   * Overrides the runner's default timeout. The runtime will abort the call
   * and return a timeout error if exceeded.
   */
  timeoutMs?: number;

  /** ID of the run this tool call belongs to (for audit trail grouping). */
  runId?: string;

  /** ID of the skill that initiated this tool call. */
  skillId?: string;

  /**
   * Whether this call requires human approval before execution.
   *
   * When `true`, the runtime enqueues the call in the approval queue and
   * waits for a dashboard user to approve or reject it.
   */
  requiresApproval?: boolean;

  /**
   * Opaque metadata forwarded to the runner. Runners may use this for
   * internal bookkeeping (e.g. session IDs, correlation tokens).
   */
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// ToolCallResponse
// ---------------------------------------------------------------------------

/**
 * Output payload returned by a tool runner.
 *
 * Every runner must return a `ToolCallResponse` regardless of success or
 * failure. The runtime persists this in the audit log and makes it available
 * to downstream skill steps.
 */
export type ToolCallResponse = {
  /** Contract version this response conforms to. */
  version: typeof TOOL_CONTRACT_VERSION;

  /** Echoed from `ToolCallRequest.requestId` for correlation. */
  requestId: string;

  /** Whether the tool call completed successfully. */
  success: boolean;

  /**
   * Runner-specific result data.
   *
   * Present when `success` is `true`. Shape varies by tool type.
   * Already redacted per the request's `redactionRules`.
   */
  result?: Record<string, unknown>;

  /**
   * Error details when `success` is `false`.
   */
  error?: {
    /**
     * Machine-readable error code.
     *
     * Well-known codes:
     * - `TIMEOUT`         -- execution exceeded `timeoutMs`
     * - `NOT_ALLOWED`     -- tool not in skill's allowlist
     * - `APPROVAL_DENIED` -- human rejected the approval request
     * - `RUNNER_ERROR`    -- runner-internal failure
     * - `VALIDATION`      -- invalid arguments
     * - `ABORTED`         -- caller cancelled the request
     */
    code: string;

    /** Human-readable error message (already redacted). */
    message: string;

    /**
     * Whether the caller should retry this request.
     *
     * Runners set this to `true` for transient failures (network blips,
     * rate limits) and `false` for permanent ones (validation, auth).
     */
    retryable?: boolean;
  };

  /** References to artifacts produced during execution. */
  artifacts?: ArtifactRef[];

  /** Cost and resource-usage information for this call. */
  cost?: CostInfo;

  /** ISO-8601 timestamp when the runner started execution. */
  startedAt?: string;

  /** ISO-8601 timestamp when the runner finished execution. */
  completedAt?: string;

  /**
   * Opaque metadata returned by the runner. May include runner-specific
   * diagnostics, session state, or pagination cursors.
   */
  metadata?: Record<string, unknown>;
};
