/**
 * UI-005 (#66) -- Approval queue UI
 *
 * Type definitions for the human-in-the-loop approval queue. Operators
 * use this view to review, approve, or reject pending approval gates
 * before high-risk steps execute.
 */

// ---------------------------------------------------------------------------
// Approval status
// ---------------------------------------------------------------------------

/** Possible states of an approval queue item. */
export type ApprovalItemStatus = "pending" | "approved" | "rejected" | "expired";

/** Urgency level for an approval request. */
export type ApprovalUrgency = "low" | "normal" | "high" | "critical";

// ---------------------------------------------------------------------------
// Approval queue item
// ---------------------------------------------------------------------------

/** A single item in the approval queue. */
export type ApprovalQueueItem = {
  /** Unique identifier for this approval request. */
  id: string;
  /** ID of the run this approval belongs to. */
  runId: string;
  /** Name of the skill requesting approval. */
  skillName: string;
  /** Index of the step that requires approval within the run. */
  stepIndex: number;
  /** Human-readable explanation of why approval is needed. */
  reason: string;
  /** Current status of the approval request. */
  status: ApprovalItemStatus;
  /** Urgency level (influences sort order and visual treatment). */
  urgency: ApprovalUrgency;
  /** List of user/role identifiers permitted to approve this item. */
  allowedApprovers: string[];
  /** ISO-8601 timestamp when the approval request was created. */
  createdAt: string;
  /** ISO-8601 deadline after which the request expires (undefined = no expiry). */
  expiresAt?: string;
  /** Summary of the step input to help the approver make a decision. */
  stepSummary?: string;
  /** Who or what triggered the run that needs approval. */
  triggeredBy: string;
};

// ---------------------------------------------------------------------------
// Approval actions
// ---------------------------------------------------------------------------

/** An action an operator can take on an approval queue item. */
export type ApprovalAction = {
  /** The kind of action. */
  type: "approve" | "reject";
  /** ID of the approval queue item being acted on. */
  itemId: string;
  /** ID of the user performing the action. */
  userId: string;
  /** Optional free-text comment from the operator. */
  comment?: string;
  /** ISO-8601 timestamp when the action was taken. */
  timestamp: string;
};

/** Result of processing an approval action. */
export type ApprovalActionResult = {
  /** Whether the action was successfully applied. */
  success: boolean;
  /** Error message when the action failed. */
  error?: string;
  /** Updated item after the action (undefined on failure). */
  updatedItem?: ApprovalQueueItem;
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** Filter criteria for the approval queue. */
export type ApprovalQueueFilter = {
  /** Only show items with these statuses. Empty = all statuses. */
  statuses: ApprovalItemStatus[];
  /** Only show items for these skills. Empty = all skills. */
  skillNames: string[];
  /** Only show items with at least this urgency level. */
  minUrgency?: ApprovalUrgency;
  /** Free-text search (matched against reason, skill name, run ID). */
  search?: string;
};

// ---------------------------------------------------------------------------
// Queue configuration
// ---------------------------------------------------------------------------

/** Configuration state for the approval queue view. */
export type ApprovalQueueConfig = {
  /** Active filter criteria. */
  filter: ApprovalQueueFilter;
  /** Number of items per page. */
  pageSize: number;
  /** Whether to auto-refresh the queue. */
  autoRefresh: boolean;
  /** Auto-refresh interval in seconds. */
  refreshIntervalSec: number;
  /**
   * Whether to play a notification sound for new critical approvals.
   * Requires browser notification permission.
   */
  soundEnabled: boolean;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default approval queue filter (pending items only). */
export const DEFAULT_APPROVAL_FILTER: ApprovalQueueFilter = {
  statuses: ["pending"],
  skillNames: [],
};

/** Default approval queue configuration. */
export const DEFAULT_APPROVAL_QUEUE_CONFIG: ApprovalQueueConfig = {
  filter: DEFAULT_APPROVAL_FILTER,
  pageSize: 20,
  autoRefresh: true,
  refreshIntervalSec: 5,
  soundEnabled: false,
};
