/**
 * WF-010 (#61) — Dry-run / simulation mode
 *
 * Configuration and result types for running workflows without
 * side effects. In dry-run mode every external action (API calls,
 * emails, writes) is intercepted, logged, and replaced with fixture
 * data so users can validate logic safely.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Settings that control a dry-run execution. */
export type DryRunConfig = {
  /** When true, nodes load responses from fixture files instead of calling real services. */
  useFixtures: boolean;
  /** Directory containing fixture JSON files (keyed by node name). */
  fixtureDir: string;
  /**
   * Banner text shown in the dashboard while the dry-run is active.
   * Defaults to "DRY RUN — No side effects executed."
   */
  bannerText: string;
  /** When true, every intercepted action is written to the run log. */
  logActions: boolean;
};

/** Sensible defaults for dry-run configuration. */
export const DEFAULT_DRY_RUN_CONFIG: DryRunConfig = {
  useFixtures: true,
  fixtureDir: "workflows/fixtures",
  bannerText: "DRY RUN \u2014 No side effects executed.",
  logActions: true,
};

// ---------------------------------------------------------------------------
// Step recording
// ---------------------------------------------------------------------------

/** A single step captured during dry-run execution. */
export type DryRunStep = {
  /** The n8n node name that executed. */
  nodeName: string;
  /** The n8n node type (e.g. "n8n-nodes-base.httpRequest"). */
  nodeType: string;
  /** Input data the node received. */
  input: unknown;
  /** Output returned (fixture data or passthrough). */
  output: unknown;
  /** Whether this step's side effects were blocked. */
  sideEffectBlocked: boolean;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
};

/** A side effect that was intercepted and prevented during the dry run. */
export type BlockedSideEffect = {
  /** Node that attempted the action. */
  nodeName: string;
  /** Category of blocked action (e.g. "http_request", "email_send", "db_write"). */
  category: string;
  /** Human-readable description of what was blocked. */
  description: string;
};

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/** Summary of a completed dry-run execution. */
export type DryRunResult = {
  /** Ordered list of every step that executed. */
  stepsExecuted: DryRunStep[];
  /** Side effects that were intercepted and prevented. */
  sideEffectsBlocked: BlockedSideEffect[];
  /** Total wall-clock duration of the dry run in milliseconds. */
  durationMs: number;
  /** Whether all steps completed without error (logic errors still surface). */
  success: boolean;
  /** Error message if the dry run itself failed. */
  error?: string;
};
