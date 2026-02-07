/**
 * CORE-009 (#25) — Cost estimator
 *
 * Types for estimating and summarising the monetary cost of a run,
 * covering model token usage and tool invocation charges.
 */

export type ToolCost = {
  toolName: string;
  invocations: number;
  estimatedCostUsd: number;
};

export type CostEstimate = {
  /** Number of input (prompt) tokens billed. */
  modelTokensIn: number;
  /** Number of output (completion) tokens billed. */
  modelTokensOut: number;
  /** Estimated cost for this step in USD. */
  estimatedCostUsd: number;
  /** Per-tool cost breakdown for this step. */
  toolCosts: ToolCost[];
};

export type RunCostSummary = {
  runId: string;
  /** Per-step cost estimates in execution order. */
  steps: CostEstimate[];
  /** Sum of all step estimates. */
  totalEstimatedUsd: number;
};
