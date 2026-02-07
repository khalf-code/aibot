/**
 * WF-009 (#60) — Gap analysis
 *
 * Tools for analysing the current set of workflow templates against
 * desired automation coverage. The gap report highlights areas where
 * new templates or node integrations are needed.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Priority = "critical" | "high" | "medium" | "low";

export type EffortEstimate = "small" | "medium" | "large" | "xlarge";

/** A single identified gap between current and desired workflow coverage. */
export type WorkflowGap = {
  /** Business area the gap belongs to (e.g. "sales", "support", "finance", "ops"). */
  area: string;
  /** Description of what currently exists (may be "none"). */
  currentState: string;
  /** Description of the desired end-state. */
  desiredState: string;
  /** How urgent it is to close this gap. */
  priority: Priority;
  /** Rough t-shirt estimate of effort to close the gap. */
  effortEstimate: EffortEstimate;
  /** Optional notes or links to related issues / templates. */
  notes?: string;
};

/**
 * Minimal template descriptor used as input to gap analysis.
 * This mirrors the metadata embedded in each template JSON file.
 */
export type WorkflowTemplate = {
  /** Template display name. */
  name: string;
  /** Business area tag. */
  area: string;
  /** Short description of what the template automates. */
  description: string;
  /** n8n node types used in the template. */
  nodeTypes: string[];
};

// ---------------------------------------------------------------------------
// Known coverage targets
// ---------------------------------------------------------------------------

/**
 * The set of automation areas and capabilities we aim to cover.
 * Each entry represents a desired template or integration.
 */
const DESIRED_CAPABILITIES: Array<{
  area: string;
  capability: string;
  priority: Priority;
  effort: EffortEstimate;
}> = [
  {
    area: "sales",
    capability: "Lead intake and enrichment",
    priority: "critical",
    effort: "medium",
  },
  { area: "sales", capability: "Outbound sequence automation", priority: "high", effort: "large" },
  {
    area: "sales",
    capability: "CRM sync (Salesforce / HubSpot)",
    priority: "high",
    effort: "large",
  },
  {
    area: "support",
    capability: "Ticket triage and routing",
    priority: "critical",
    effort: "medium",
  },
  { area: "support", capability: "Auto-response drafting", priority: "medium", effort: "medium" },
  { area: "support", capability: "SLA escalation alerts", priority: "high", effort: "small" },
  {
    area: "finance",
    capability: "Invoice processing and matching",
    priority: "critical",
    effort: "large",
  },
  {
    area: "finance",
    capability: "Expense report approval flow",
    priority: "medium",
    effort: "medium",
  },
  {
    area: "ops",
    capability: "Health check / uptime monitoring",
    priority: "high",
    effort: "small",
  },
  { area: "ops", capability: "Credential rotation reminders", priority: "medium", effort: "small" },
  { area: "ops", capability: "Onboarding checklists", priority: "low", effort: "medium" },
];

// ---------------------------------------------------------------------------
// Gap report generator (stub)
// ---------------------------------------------------------------------------

/**
 * Compare the set of existing templates against the desired capabilities
 * and return a list of gaps. Currently uses simple keyword matching;
 * a future version could use embeddings or an LLM to do semantic matching.
 */
export function generateGapReport(workflows: WorkflowTemplate[]): WorkflowGap[] {
  const gaps: WorkflowGap[] = [];

  for (const desired of DESIRED_CAPABILITIES) {
    // Naive match: check if any existing template in the same area
    // has a name or description that overlaps with the capability.
    const capabilityLower = desired.capability.toLowerCase();
    const covered = workflows.some(
      (w) =>
        w.area === desired.area &&
        (w.name.toLowerCase().includes(capabilityLower) ||
          w.description.toLowerCase().includes(capabilityLower) ||
          capabilityLower.includes(w.name.toLowerCase())),
    );

    if (!covered) {
      gaps.push({
        area: desired.area,
        currentState: "none",
        desiredState: desired.capability,
        priority: desired.priority,
        effortEstimate: desired.effort,
      });
    }
  }

  return gaps;
}
