/**
 * WF-004 (#55) — Branching patterns
 *
 * Types for conditional branching, switch routing, and merge
 * operations within n8n workflows. These types document how the
 * Clawdbot dashboard exposes IF/Switch/Merge patterns to users
 * and map to underlying n8n node configurations.
 */

// ---------------------------------------------------------------------------
// Condition operators
// ---------------------------------------------------------------------------

/**
 * Comparison operators supported in branch conditions.
 *
 * - String operators: equals, not_equals, contains, starts_with, ends_with, regex
 * - Numeric operators: equals, not_equals, gt, gte, lt, lte
 * - Presence operators: exists, not_exists
 * - Collection operators: in, not_in
 */
export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "regex"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "exists"
  | "not_exists"
  | "in"
  | "not_in";

// ---------------------------------------------------------------------------
// Branch condition
// ---------------------------------------------------------------------------

/** A single predicate evaluated against a data field in the workflow payload. */
export type BranchCondition = {
  /** Dot-notation path into the payload (e.g. "lead.score", "ticket.priority"). */
  field: string;
  /** The comparison to apply. */
  operator: ConditionOperator;
  /**
   * The value to compare against. Omitted for unary operators like
   * "exists" / "not_exists". For "in" / "not_in" this should be an array.
   */
  value?: unknown;
};

// ---------------------------------------------------------------------------
// Workflow branch
// ---------------------------------------------------------------------------

/** A branch edge connecting a branching node to a downstream target node. */
export type WorkflowBranch = {
  /**
   * Conditions that must ALL be true for this branch to activate
   * (logical AND). Use multiple branches for OR semantics.
   */
  conditions: BranchCondition[];
  /** The node ID to route execution to when conditions are met. */
  targetNode: string;
  /** Human-readable label shown in the editor (e.g. "High priority", "VIP lead"). */
  label: string;
};

// ---------------------------------------------------------------------------
// Branching node types (documentation / discriminated union)
// ---------------------------------------------------------------------------

/**
 * IF node — two outputs: "true" branch and "false" branch.
 *
 * Maps to n8n's built-in IF node. The Clawdbot dashboard renders
 * this with a simplified condition builder UI.
 */
export type IfNodeConfig = {
  nodeType: "if";
  /** Conditions evaluated for the "true" output. */
  conditions: BranchCondition[];
  /** Node ID for the "true" path. */
  trueBranch: string;
  /** Node ID for the "false" path. */
  falseBranch: string;
};

/**
 * Switch node — multiple named outputs based on value matching.
 *
 * Maps to n8n's Switch node. Each case is a WorkflowBranch; an
 * optional fallback catches unmatched values.
 */
export type SwitchNodeConfig = {
  nodeType: "switch";
  /** The dot-notation field to switch on. */
  switchField: string;
  /** Ordered list of branch cases; first match wins. */
  cases: WorkflowBranch[];
  /** Optional fallback node ID when no case matches. */
  fallbackNode?: string;
};

/**
 * Merge node — joins two or more branches back into one.
 *
 * Maps to n8n's Merge node. The merge mode controls how incoming
 * data sets are combined.
 */
export type MergeMode = "append" | "keep_first" | "keep_last" | "combine_by_key";

export type MergeNodeConfig = {
  nodeType: "merge";
  /** How to combine data from incoming branches. */
  mode: MergeMode;
  /** Key field used when mode is "combine_by_key". */
  combineKey?: string;
  /** Node IDs of the branches feeding into this merge. */
  inputNodes: string[];
};

/** Discriminated union of all branching node configurations. */
export type BranchingNodeConfig = IfNodeConfig | SwitchNodeConfig | MergeNodeConfig;
