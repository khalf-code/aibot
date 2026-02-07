/**
 * escalate-sla-breach — Detect SLA breaches and auto-escalate tickets.
 *
 * BIZ-033 (#125) Skeleton
 * BIZ-034 (#126) Implementation
 * BIZ-035 (#127) Sandbox fixture
 * BIZ-036 (#128) Observability
 *
 * This skill checks a support ticket against configured SLA thresholds
 * (first-response time, resolution time, update cadence) and triggers
 * an escalation when any threshold is breached. Escalation actions
 * include re-assigning to a higher tier, notifying a manager, and
 * tagging the ticket with the breach type.
 */

// ── Types ────────────────────────────────────────────────────────

/** Severity levels that determine escalation urgency. */
export type TicketPriority = "low" | "medium" | "high" | "critical";

/** Supported SLA breach categories. */
export type BreachType = "first_response" | "resolution" | "update_cadence";

/** SLA thresholds in minutes for each priority level. */
export interface SlaThresholds {
  /** Maximum minutes before first agent response is required. */
  firstResponseMinutes: number;
  /** Maximum minutes before the ticket must be resolved. */
  resolutionMinutes: number;
  /** Maximum minutes allowed between successive updates. */
  updateCadenceMinutes: number;
}

/** Default SLA thresholds per priority tier. */
export const DEFAULT_SLA_THRESHOLDS: Record<TicketPriority, SlaThresholds> = {
  critical: { firstResponseMinutes: 15, resolutionMinutes: 240, updateCadenceMinutes: 30 },
  high: { firstResponseMinutes: 60, resolutionMinutes: 480, updateCadenceMinutes: 60 },
  medium: { firstResponseMinutes: 240, resolutionMinutes: 1440, updateCadenceMinutes: 240 },
  low: { firstResponseMinutes: 480, resolutionMinutes: 2880, updateCadenceMinutes: 480 },
};

/** Input payload for the escalate-sla-breach skill. */
export interface EscalateSlaInput {
  /** Unique ticket identifier in the external ticketing system. */
  ticketId: string;
  /** Ticket priority level. */
  priority: TicketPriority;
  /** ISO-8601 timestamp of when the ticket was created. */
  createdAt: string;
  /** ISO-8601 timestamp of the first agent response, or null if none yet. */
  firstResponseAt: string | null;
  /** ISO-8601 timestamp of the most recent update from any agent. */
  lastUpdateAt: string | null;
  /** Whether the ticket is already resolved. */
  resolved: boolean;
  /** ISO-8601 timestamp of resolution, or null if still open. */
  resolvedAt: string | null;
  /** Current assignee identifier. */
  assignee: string;
  /** Optional custom SLA overrides (e.g. per-customer SLA). */
  customThresholds?: Partial<SlaThresholds>;
}

/** A single detected SLA breach. */
export interface SlaBreachDetail {
  /** Which SLA threshold was breached. */
  type: BreachType;
  /** The configured threshold in minutes. */
  thresholdMinutes: number;
  /** How many minutes past the threshold the ticket is. */
  overshootMinutes: number;
}

/** Escalation action determined by the skill. */
export interface EscalationAction {
  /** New tier to assign the ticket to (e.g. "tier-2", "tier-3"). */
  newTier: string;
  /** Whether a manager notification should be sent. */
  notifyManager: boolean;
  /** Tags to apply to the ticket for tracking. */
  tags: string[];
  /** Human-readable summary of the escalation. */
  summary: string;
}

/** Output payload returned by the skill. */
export interface EscalateSlaOutput {
  /** Whether the skill completed successfully. */
  success: boolean;
  /** Error message when success is false. */
  error?: string;
  /** The ticket ID that was evaluated. */
  ticketId: string;
  /** List of detected breaches (empty if SLA is healthy). */
  breaches: SlaBreachDetail[];
  /** Escalation action to take, or null if no breach detected. */
  escalation: EscalationAction | null;
  /** ISO-8601 timestamp of when the check ran. */
  checkedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Calculate the difference in minutes between two ISO-8601 timestamps.
 * Returns positive when `to` is after `from`.
 */
function diffMinutes(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
}

/**
 * Determine the escalation tier based on breach severity.
 * Critical/high breaches push to tier-3; medium to tier-2.
 */
function determineTier(priority: TicketPriority, breachCount: number): string {
  if (priority === "critical" || breachCount >= 2) return "tier-3";
  if (priority === "high") return "tier-2";
  return "tier-2";
}

// ── Implementation ───────────────────────────────────────────────

/**
 * Evaluate a support ticket for SLA breaches and return an escalation plan.
 *
 * @param input - Ticket data and optional custom thresholds.
 * @returns Breach details and escalation action (or null if healthy).
 */
export async function execute(input: EscalateSlaInput): Promise<EscalateSlaOutput> {
  const now = new Date().toISOString();

  // Validate required fields
  if (!input.ticketId || typeof input.ticketId !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'ticketId' in input.",
      ticketId: "",
      breaches: [],
      escalation: null,
      checkedAt: now,
    };
  }

  try {
    const thresholds: SlaThresholds = {
      ...DEFAULT_SLA_THRESHOLDS[input.priority],
      ...input.customThresholds,
    };

    const breaches: SlaBreachDetail[] = [];

    // Check first-response SLA
    if (!input.firstResponseAt && !input.resolved) {
      const elapsed = diffMinutes(input.createdAt, now);
      if (elapsed > thresholds.firstResponseMinutes) {
        breaches.push({
          type: "first_response",
          thresholdMinutes: thresholds.firstResponseMinutes,
          overshootMinutes: Math.round(elapsed - thresholds.firstResponseMinutes),
        });
      }
    }

    // Check resolution SLA
    if (!input.resolved) {
      const elapsed = diffMinutes(input.createdAt, now);
      if (elapsed > thresholds.resolutionMinutes) {
        breaches.push({
          type: "resolution",
          thresholdMinutes: thresholds.resolutionMinutes,
          overshootMinutes: Math.round(elapsed - thresholds.resolutionMinutes),
        });
      }
    }

    // Check update cadence SLA
    if (!input.resolved && input.lastUpdateAt) {
      const sinceLastUpdate = diffMinutes(input.lastUpdateAt, now);
      if (sinceLastUpdate > thresholds.updateCadenceMinutes) {
        breaches.push({
          type: "update_cadence",
          thresholdMinutes: thresholds.updateCadenceMinutes,
          overshootMinutes: Math.round(sinceLastUpdate - thresholds.updateCadenceMinutes),
        });
      }
    }

    // Build escalation action if any breaches detected
    let escalation: EscalationAction | null = null;
    if (breaches.length > 0) {
      const newTier = determineTier(input.priority, breaches.length);
      const breachTypes = breaches.map((b) => b.type).join(", ");
      escalation = {
        newTier,
        notifyManager: input.priority === "critical" || breaches.length >= 2,
        tags: [`sla-breach`, ...breaches.map((b) => `breach:${b.type}`)],
        summary: `Ticket ${input.ticketId} breached SLA on: ${breachTypes}. Escalating to ${newTier}.`,
      };
    }

    return {
      success: true,
      ticketId: input.ticketId,
      breaches,
      escalation,
      checkedAt: now,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      ticketId: input.ticketId,
      breaches: [],
      escalation: null,
      checkedAt: now,
    };
  }
}
