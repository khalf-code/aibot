/**
 * Support approval gate types — Business Skill Packs
 *
 * Covers:
 *   - BIZ-055 (#145) Ticket triage and routing approval gate
 *   - BIZ-058 (#148) Auto-response drafting approval gate
 *   - BIZ-061 (#151) SLA escalation alert approval gate
 *
 * Each gate configuration defines the approval parameters for its
 * corresponding Support workflow. Gates are evaluated by the Clawdbot
 * Approval Gate node (WF-005) at runtime.
 */

import type { ApprovalStatus } from "../approval-node.js";

// ---------------------------------------------------------------------------
// Shared Support gate types
// ---------------------------------------------------------------------------

/** Ticket priority levels. */
export type TicketPriority = "low" | "normal" | "high" | "urgent";

/** Support channels through which tickets arrive. */
export type SupportChannel = "email" | "chat" | "phone" | "web_form" | "social" | "api";

/** Common fields shared by all Support approval gate configurations. */
export type SupportGateBase = {
  /** Unique gate identifier (scoped to the workflow instance). */
  gateId: string;
  /** The workflow run ID this gate belongs to. */
  workflowRunId: string;
  /** Role or user required to approve (empty = any authorised Support user). */
  approverRole: string;
  /** Minutes before the gate auto-expires if no decision is made. */
  timeoutMinutes: number;
  /** Current status of the gate. */
  status: ApprovalStatus;
  /** ISO-8601 timestamp when the gate was created. */
  createdAt: string;
};

// ---------------------------------------------------------------------------
// BIZ-055 (#145) — Ticket triage and routing approval gate
// ---------------------------------------------------------------------------

/** Proposed routing destination for a ticket. */
export type TicketRouting = {
  /** Target team or queue name. */
  teamOrQueue: string;
  /** Specific agent to assign to (if applicable). */
  assignedAgent?: string;
  /** Reason for the routing decision. */
  routingReason: string;
  /** Confidence score of the AI-based routing (0-1). */
  confidence: number;
};

/** Ticket details for the triage gate. */
export type TriageTicket = {
  /** Ticket ID in the helpdesk system. */
  ticketId: string;
  /** Customer name or identifier. */
  customerName: string;
  /** Customer tier (e.g. "free", "pro", "enterprise"). */
  customerTier: string;
  /** Subject line of the ticket. */
  subject: string;
  /** Truncated body text (first 500 characters). */
  bodyPreview: string;
  /** Channel the ticket was submitted through. */
  channel: SupportChannel;
  /** AI-detected priority. */
  detectedPriority: TicketPriority;
  /** AI-detected category (e.g. "billing", "technical", "feature_request"). */
  detectedCategory: string;
  /** ISO-8601 timestamp of ticket creation. */
  createdAt: string;
};

/**
 * Gate configuration for the ticket triage and routing workflow.
 * The workflow analyses incoming tickets using NLP to determine
 * priority, category, and optimal routing. The gate pauses so a
 * support lead can review the AI's triage decisions before tickets
 * are routed to agents or auto-responded.
 */
export type TicketTriageGate = SupportGateBase & {
  kind: "ticket_triage";
  /** Tickets being triaged in this batch. */
  tickets: TriageTicket[];
  /** Proposed routing for each ticket (parallel array). */
  routings: TicketRouting[];
  /** Number of tickets in the batch. */
  batchSize: number;
  /** Whether any ticket was flagged as urgent. */
  hasUrgentTickets: boolean;
};

// ---------------------------------------------------------------------------
// BIZ-058 (#148) — Auto-response drafting approval gate
// ---------------------------------------------------------------------------

/** A drafted auto-response for a support ticket. */
export type AutoResponseDraft = {
  /** Ticket ID this response targets. */
  ticketId: string;
  /** Customer name. */
  customerName: string;
  /** Original ticket subject. */
  ticketSubject: string;
  /** Drafted response body (Markdown). */
  responseBodyMarkdown: string;
  /** Knowledge base articles referenced in the response. */
  referencedArticles: string[];
  /** Confidence score of the generated response (0-1). */
  confidence: number;
  /** Whether the response includes a suggested resolution. */
  includesResolution: boolean;
  /** Suggested follow-up action (e.g. "close", "escalate", "follow_up_3d"). */
  suggestedAction: string;
};

/**
 * Gate configuration for the auto-response drafting workflow.
 * The workflow generates draft responses for common support queries
 * using the knowledge base and historical resolutions. The gate
 * pauses so a support agent can review tone, accuracy, and
 * completeness before the response is sent to the customer.
 */
export type AutoResponseGate = SupportGateBase & {
  kind: "auto_response";
  /** Draft responses for review. */
  drafts: AutoResponseDraft[];
  /** Number of drafts in the batch. */
  batchSize: number;
  /** Average confidence across all drafts. */
  averageConfidence: number;
  /** Whether any drafts have confidence below the auto-send threshold. */
  hasLowConfidenceDrafts: boolean;
};

// ---------------------------------------------------------------------------
// BIZ-061 (#151) — SLA escalation alert approval gate
// ---------------------------------------------------------------------------

/** SLA breach status. */
export type SlaBreachStatus = "at_risk" | "breached" | "critical_breach";

/** A ticket at risk of or already in SLA breach. */
export type SlaEscalationItem = {
  /** Ticket ID. */
  ticketId: string;
  /** Customer name. */
  customerName: string;
  /** Customer tier. */
  customerTier: string;
  /** Ticket priority. */
  priority: TicketPriority;
  /** SLA target response time in minutes. */
  slaTargetMinutes: number;
  /** Elapsed time since ticket creation in minutes. */
  elapsedMinutes: number;
  /** Breach status. */
  breachStatus: SlaBreachStatus;
  /** Currently assigned agent (if any). */
  assignedAgent?: string;
  /** Proposed escalation action. */
  proposedEscalation: string;
};

/**
 * Gate configuration for the SLA escalation alert workflow.
 * The workflow monitors open tickets against SLA targets and
 * triggers escalation when thresholds are breached. The gate
 * pauses so a support manager can review the escalation plan
 * and decide which actions to take (reassign, page on-call, etc.).
 */
export type SlaEscalationGate = SupportGateBase & {
  kind: "sla_escalation";
  /** Tickets at risk or in breach. */
  escalations: SlaEscalationItem[];
  /** Number of tickets in the escalation batch. */
  batchSize: number;
  /** Number of tickets already breached. */
  breachedCount: number;
  /** Number of tickets at risk but not yet breached. */
  atRiskCount: number;
  /** Whether any enterprise/VIP customers are affected. */
  hasVipCustomers: boolean;
};

// ---------------------------------------------------------------------------
// Discriminated union of all Support gates
// ---------------------------------------------------------------------------

/** Union of all Support approval gate configurations. */
export type SupportApprovalGate = TicketTriageGate | AutoResponseGate | SlaEscalationGate;
