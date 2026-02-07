/**
 * WF-005 (#56) — Custom approval node
 *
 * Types and n8n custom node specification for the Clawdbot Approval
 * Gate node. When a workflow reaches this node it pauses execution,
 * creates an approval request visible in the dashboard, and resumes
 * only after an authorised user approves or rejects it.
 */

// ---------------------------------------------------------------------------
// Approval request
// ---------------------------------------------------------------------------

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

/** An approval request created when the workflow reaches the Approval Gate node. */
export type ApprovalRequest = {
  /** Unique identifier for this request. */
  id: string;
  /** The n8n workflow ID that generated this request. */
  workflowId: string;
  /** The n8n node ID within the workflow (identifies which gate). */
  nodeId: string;
  /** Snapshot of the data available at the approval point (for reviewer context). */
  dataSnapshot: Record<string, unknown>;
  /** Who or what initiated the request (e.g. the trigger user or "system"). */
  requester: string;
  /** ISO-8601 timestamp of when the request was created. */
  requestedAt: string;
  /** Current status of the request. */
  status: ApprovalStatus;
  /** Optional deadline after which the request auto-expires. */
  expiresAt?: string;
  /** Role or user ID required to approve (empty = any authorised user). */
  approverRole?: string;
};

// ---------------------------------------------------------------------------
// Approval response
// ---------------------------------------------------------------------------

/** A decision recorded against an approval request. */
export type ApprovalResponse = {
  /** Whether the request was approved. */
  approved: boolean;
  /** The user ID or name of the person who made the decision. */
  approver: string;
  /** ISO-8601 timestamp of the decision. */
  decidedAt: string;
  /** Optional reviewer comment explaining the decision. */
  comment?: string;
};

// ---------------------------------------------------------------------------
// n8n custom node specification
// ---------------------------------------------------------------------------

/**
 * Specification object describing the Clawdbot Approval Gate as an
 * n8n community node. This structure follows the n8n INodeTypeDescription
 * shape and is consumed by the n8n-nodes-clawdbot package at build time.
 */
export const n8nApprovalNodeSpec = {
  displayName: "Clawdbot Approval Gate",
  name: "clawdbotApprovalGate",
  group: ["transform"],
  version: 1,
  description:
    "Pause workflow execution until a human approves or rejects via the Clawdbot dashboard.",
  defaults: {
    name: "Approval Gate",
  },
  inputs: ["main"],
  outputs: ["main"],
  properties: [
    {
      displayName: "Approver Role",
      name: "approverRole",
      type: "string",
      default: "",
      placeholder: "e.g. manager, finance-lead",
      description: "Role required to approve this gate. Leave empty to allow any authorised user.",
    },
    {
      displayName: "Timeout (minutes)",
      name: "timeoutMinutes",
      type: "number",
      default: 1440,
      description: "Minutes before the request auto-expires. Defaults to 24 hours.",
    },
    {
      displayName: "Include Data Snapshot",
      name: "includeSnapshot",
      type: "boolean",
      default: true,
      description:
        "When enabled, a snapshot of the current item data is attached to the approval request for reviewer context.",
    },
    {
      displayName: "On Rejection",
      name: "onRejection",
      type: "options",
      default: "stop",
      options: [
        { name: "Stop Workflow", value: "stop" },
        { name: "Continue (mark rejected)", value: "continue" },
        { name: "Route to Error Branch", value: "error" },
      ],
      description: "What happens when the request is rejected.",
    },
    {
      displayName: "On Timeout",
      name: "onTimeout",
      type: "options",
      default: "stop",
      options: [
        { name: "Stop Workflow", value: "stop" },
        { name: "Auto-Approve", value: "approve" },
        { name: "Auto-Reject", value: "reject" },
      ],
      description: "What happens when the approval request expires.",
    },
  ],
} as const;
