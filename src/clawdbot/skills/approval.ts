/**
 * SK-005 (#31) -- Approval policy hooks
 *
 * Types and logic for gating skill execution on human approval.
 * Skills that declare `approval_required: true` in their manifest
 * pause before execution so an operator can approve or reject the run.
 *
 * Step-level approval gates can also be inserted by policy when a
 * particular tool type is considered high-risk (e.g. `email-runner`).
 */

import type { ManifestV1 } from "./manifest-schema.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An approval gate inserted into a run's execution plan. */
export type ApprovalGate = {
  /** Name of the skill being gated. */
  skill_name: string;
  /** Index of the step within the run that requires approval. */
  step_index: number;
  /** Human-readable explanation of why approval is needed. */
  reason: string;
  /** List of user/role identifiers that can approve this gate. */
  required_approvers: string[];
};

/** The outcome of an approval decision. */
export type ApprovalDecision = {
  /** Whether the gate was approved or rejected. */
  outcome: "approved" | "rejected";
  /** Identifier of the user who made the decision. */
  approver: string;
  /** ISO-8601 timestamp of when the decision was made. */
  timestamp: string;
  /** Optional free-text comment from the approver. */
  comment?: string;
};

// ---------------------------------------------------------------------------
// Policy helpers
// ---------------------------------------------------------------------------

/**
 * Step types that always require human approval, regardless of the
 * manifest's `approval_required` flag.
 *
 * These represent "commit-step" actions with real-world side effects.
 */
const HIGH_RISK_STEP_TYPES: ReadonlySet<string> = new Set([
  "email-runner",
  "payment-runner",
  "form-submit-runner",
  "delete-runner",
]);

/**
 * Determine whether a given step type requires approval for a skill.
 *
 * Approval is required when:
 *   1. The manifest declares `approval_required: true`, OR
 *   2. The step type is in the high-risk set (side-effect actions).
 *
 * @param manifest - The validated skill manifest.
 * @param stepType - The tool/runner type about to be executed.
 * @returns `true` if the runtime should pause for human approval.
 */
export function checkApprovalRequired(manifest: ManifestV1, stepType: string): boolean {
  // Manifest-level gate -- skill author opted in to approval for all steps.
  if (manifest.approval_required) {
    return true;
  }

  // Policy-level gate -- certain step types are unconditionally gated.
  if (HIGH_RISK_STEP_TYPES.has(stepType)) {
    return true;
  }

  return false;
}
