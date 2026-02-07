/**
 * Support workflow wrapper types — Business Skill Packs
 *
 * Covers:
 *   - BIZ-056 (#146) Ticket triage and routing workflow wrapper
 *   - BIZ-059 (#149) Auto-response drafting workflow wrapper
 *   - BIZ-062 (#152) SLA escalation alert workflow wrapper
 *
 * Each wrapper type defines the orchestration shape for its Support
 * workflow, including inputs, outputs, step definitions, and execution state.
 */

import type {
  TicketPriority,
  SupportChannel,
  TriageTicket,
  TicketRouting,
  AutoResponseDraft,
  SlaEscalationItem,
} from "../gates/support-gates.js";
import type { RetryPolicy, ErrorHandler } from "../retry-policy.js";
import type { WorkflowTrigger } from "../trigger.js";

// ---------------------------------------------------------------------------
// Shared wrapper types
// ---------------------------------------------------------------------------

/** Execution status for a workflow run. */
export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

/** Common fields shared by all Support workflow wrappers. */
export type SupportWrapperBase = {
  /** Workflow definition ID (template). */
  workflowId: string;
  /** Unique execution / run ID. */
  runId: string;
  /** Current execution status. */
  status: WorkflowRunStatus;
  /** Trigger that initiated this run. */
  trigger: WorkflowTrigger;
  /** Retry policy applied to recoverable steps. */
  retryPolicy: RetryPolicy;
  /** Error handler for unrecoverable failures. */
  errorHandler: ErrorHandler;
  /** ISO-8601 timestamp when the run started. */
  startedAt: string;
  /** ISO-8601 timestamp when the run completed (if finished). */
  completedAt?: string;
  /** Wall-clock duration in milliseconds (set on completion). */
  durationMs?: number;
};

// ---------------------------------------------------------------------------
// BIZ-056 (#146) — Ticket triage and routing workflow wrapper
// ---------------------------------------------------------------------------

/** Step identifiers for the ticket triage workflow. */
export type TicketTriageStep =
  | "fetch_new_tickets"
  | "analyse_content"
  | "detect_priority"
  | "categorise_ticket"
  | "propose_routing"
  | "approval_gate"
  | "route_tickets"
  | "notify_agents"
  | "update_metrics";

/** Input parameters for the ticket triage workflow. */
export type TicketTriageInput = {
  /** Helpdesk system to fetch tickets from. */
  helpdeskSystem: string;
  /** Maximum number of tickets to process per batch. */
  batchSize: number;
  /** Channels to include (empty = all). */
  channels: SupportChannel[];
  /** Minimum confidence threshold for auto-routing (0-1). */
  autoRouteConfidenceThreshold: number;
  /** Notification channel for support agents. */
  notificationChannel: string;
};

/** Output produced by the ticket triage workflow. */
export type TicketTriageOutput = {
  /** Tickets processed. */
  tickets: TriageTicket[];
  /** Routing decisions made. */
  routings: TicketRouting[];
  /** Number of tickets auto-routed (above confidence threshold). */
  autoRoutedCount: number;
  /** Number of tickets requiring manual review. */
  manualReviewCount: number;
  /** Average routing confidence. */
  averageConfidence: number;
  /** Summary message for support lead notification. */
  summaryMessage: string;
};

/**
 * Workflow wrapper for ticket triage and routing.
 * Orchestrates fetching new tickets, analysing content with NLP,
 * detecting priority and category, proposing routing, gating on
 * support lead approval (for low-confidence decisions), routing
 * tickets, and notifying assigned agents.
 */
export type TicketTriageWrapper = SupportWrapperBase & {
  kind: "ticket_triage";
  input: TicketTriageInput;
  output?: TicketTriageOutput;
  currentStep: TicketTriageStep;
};

// ---------------------------------------------------------------------------
// BIZ-059 (#149) — Auto-response drafting workflow wrapper
// ---------------------------------------------------------------------------

/** Step identifiers for the auto-response drafting workflow. */
export type AutoResponseStep =
  | "fetch_tickets_for_response"
  | "search_knowledge_base"
  | "generate_draft"
  | "score_confidence"
  | "approval_gate"
  | "send_responses"
  | "track_resolution"
  | "notify_agents";

/** Input parameters for the auto-response drafting workflow. */
export type AutoResponseInput = {
  /** Ticket IDs to generate responses for (empty = auto-select). */
  ticketIds: string[];
  /** Maximum number of drafts to generate per batch. */
  batchSize: number;
  /** Minimum confidence to include a draft (0-1). */
  minConfidence: number;
  /** Knowledge base URL or identifier. */
  knowledgeBaseId: string;
  /** Brand voice / tone guidance. */
  toneGuidance: string;
  /** Notification channel for agents. */
  notificationChannel: string;
};

/** Output produced by the auto-response drafting workflow. */
export type AutoResponseOutput = {
  /** Generated draft responses. */
  drafts: AutoResponseDraft[];
  /** Number of drafts sent to customers. */
  sentCount: number;
  /** Number of drafts held for agent review. */
  heldForReviewCount: number;
  /** Average confidence across all drafts. */
  averageConfidence: number;
  /** Summary message for agent notification. */
  summaryMessage: string;
};

/**
 * Workflow wrapper for auto-response drafting.
 * Orchestrates fetching tickets eligible for auto-response,
 * searching the knowledge base for relevant articles, generating
 * draft responses with AI, scoring confidence, gating on agent
 * approval, sending approved responses, and tracking resolution.
 */
export type AutoResponseWrapper = SupportWrapperBase & {
  kind: "auto_response";
  input: AutoResponseInput;
  output?: AutoResponseOutput;
  currentStep: AutoResponseStep;
};

// ---------------------------------------------------------------------------
// BIZ-062 (#152) — SLA escalation alert workflow wrapper
// ---------------------------------------------------------------------------

/** Step identifiers for the SLA escalation workflow. */
export type SlaEscalationStep =
  | "fetch_open_tickets"
  | "check_sla_targets"
  | "identify_breaches"
  | "calculate_severity"
  | "propose_escalations"
  | "approval_gate"
  | "execute_escalations"
  | "notify_managers"
  | "update_sla_dashboard";

/** Input parameters for the SLA escalation workflow. */
export type SlaEscalationInput = {
  /** Minutes before SLA breach to trigger "at risk" alerts. */
  atRiskThresholdMinutes: number;
  /** Ticket priorities to monitor (empty = all). */
  priorities: TicketPriority[];
  /** Whether to include VIP/enterprise customers only. */
  vipOnly: boolean;
  /** On-call notification channel. */
  oncallChannel: string;
  /** Manager notification channel. */
  managerChannel: string;
};

/** Output produced by the SLA escalation workflow. */
export type SlaEscalationOutput = {
  /** Tickets escalated. */
  escalations: SlaEscalationItem[];
  /** Number of tickets breached. */
  breachedCount: number;
  /** Number of tickets at risk. */
  atRiskCount: number;
  /** Escalation actions executed. */
  actionsExecuted: string[];
  /** Whether VIP customers were affected. */
  vipCustomersAffected: boolean;
  /** SLA dashboard URL. */
  dashboardUrl: string;
  /** Summary message for manager notification. */
  summaryMessage: string;
};

/**
 * Workflow wrapper for SLA escalation alerts.
 * Orchestrates fetching open tickets, checking SLA targets,
 * identifying breaches and at-risk tickets, calculating severity,
 * proposing escalation actions, gating on support manager approval,
 * executing escalations (reassign, page on-call, etc.), and
 * notifying managers.
 */
export type SlaEscalationWrapper = SupportWrapperBase & {
  kind: "sla_escalation";
  input: SlaEscalationInput;
  output?: SlaEscalationOutput;
  currentStep: SlaEscalationStep;
};

// ---------------------------------------------------------------------------
// Discriminated union of all Support wrappers
// ---------------------------------------------------------------------------

/** Union of all Support workflow wrapper configurations. */
export type SupportWorkflowWrapper =
  | TicketTriageWrapper
  | AutoResponseWrapper
  | SlaEscalationWrapper;
