/**
 * generate-follow-up-tasks -- Generate structured follow-up tasks from a
 * sales call summary or email thread to keep deals moving forward.
 *
 * BIZ-021 to BIZ-024 (#113-#116)
 */

// -- Types ------------------------------------------------------------------

/** A generated follow-up task. */
export interface FollowUpTask {
  /** Short title for the task. */
  title: string;
  /** Longer description with context. */
  description: string;
  /** Who should own this task (e.g. "sales rep", "lead", "engineering"). */
  owner: string;
  /** Task priority: low, medium, or high. */
  priority: "low" | "medium" | "high";
  /** Suggested due date (ISO 8601 date string). */
  dueDate: string;
  /** Category: "email", "call", "internal", "document", "meeting". */
  category: "email" | "call" | "internal" | "document" | "meeting";
}

/** Input payload for the generate-follow-up-tasks skill. */
export interface SkillInput {
  /** Free-form summary text (call notes, email thread, or meeting recap). */
  summary: string;
  /** Name of the sales rep / task owner. */
  ownerName: string;
  /** Name of the lead or contact. */
  leadName: string;
  /** Company name (optional). */
  company?: string;
  /** Deal stage for context (e.g. "discovery", "proposal", "negotiation"). */
  dealStage?: string;
  /** Base date for due-date calculations (ISO 8601). Defaults to now. */
  baseDate?: string;
}

/** Output payload returned by the generate-follow-up-tasks skill. */
export interface SkillOutput {
  /** Whether the skill completed successfully. */
  success: boolean;
  /** Human-readable error message when success is false. */
  error?: string;
  /** Generated follow-up tasks. */
  tasks: FollowUpTask[];
  /** Total number of tasks generated. */
  taskCount: number;
  /** ISO 8601 timestamp of when the generation ran. */
  generatedAt: string;
}

// -- Helpers ----------------------------------------------------------------

/** Add N business days to a date, skipping weekends. */
function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

/** Format a date as ISO 8601 date-only string (YYYY-MM-DD). */
function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Keyword-based task extraction from summary text. */
function extractTasks(
  summary: string,
  ownerName: string,
  leadName: string,
  company: string | null,
  dealStage: string | null,
  baseDate: Date,
): FollowUpTask[] {
  const tasks: FollowUpTask[] = [];
  const lower = summary.toLowerCase();
  const companyLabel = company ?? "their team";

  // Proposal / pricing follow-up
  if (lower.includes("proposal") || lower.includes("pricing") || lower.includes("quote")) {
    tasks.push({
      title: `Send proposal to ${leadName}`,
      description: `Prepare and send the pricing proposal to ${leadName} at ${companyLabel} based on the discussed requirements.`,
      owner: ownerName,
      priority: "high",
      dueDate: formatDate(addBusinessDays(baseDate, 2)),
      category: "document",
    });
  }

  // Demo / presentation follow-up
  if (lower.includes("demo") || lower.includes("presentation")) {
    tasks.push({
      title: `Schedule demo for ${companyLabel}`,
      description: `Set up a personalized demo session for ${leadName} covering the features discussed.`,
      owner: ownerName,
      priority: "high",
      dueDate: formatDate(addBusinessDays(baseDate, 3)),
      category: "meeting",
    });
  }

  // Follow-up call
  if (
    lower.includes("follow up") ||
    lower.includes("follow-up") ||
    lower.includes("check in") ||
    lower.includes("check-in")
  ) {
    tasks.push({
      title: `Follow-up call with ${leadName}`,
      description: `Reach out to ${leadName} to continue the conversation and address any remaining questions.`,
      owner: ownerName,
      priority: "medium",
      dueDate: formatDate(addBusinessDays(baseDate, 3)),
      category: "call",
    });
  }

  // Documentation / technical info
  if (
    lower.includes("documentation") ||
    lower.includes("technical") ||
    lower.includes("api") ||
    lower.includes("integration")
  ) {
    tasks.push({
      title: `Share technical documentation with ${leadName}`,
      description: `Send relevant technical docs, API references, or integration guides to ${leadName} at ${companyLabel}.`,
      owner: ownerName,
      priority: "medium",
      dueDate: formatDate(addBusinessDays(baseDate, 2)),
      category: "document",
    });
  }

  // Internal sync
  if (lower.includes("engineering") || lower.includes("product") || lower.includes("internal")) {
    tasks.push({
      title: `Internal sync on ${companyLabel} deal`,
      description: `Align with internal team (engineering/product) on ${companyLabel} requirements and feasibility.`,
      owner: ownerName,
      priority: "medium",
      dueDate: formatDate(addBusinessDays(baseDate, 1)),
      category: "internal",
    });
  }

  // Thank-you / recap email (always generate one)
  tasks.push({
    title: `Send recap email to ${leadName}`,
    description: `Send a thank-you and recap email to ${leadName} summarizing key points and agreed next steps.`,
    owner: ownerName,
    priority: "high",
    dueDate: formatDate(addBusinessDays(baseDate, 1)),
    category: "email",
  });

  // If in negotiation stage, add contract-related task
  if (dealStage === "negotiation") {
    tasks.push({
      title: `Prepare contract draft for ${companyLabel}`,
      description: `Draft contract terms based on negotiation discussion with ${leadName}.`,
      owner: ownerName,
      priority: "high",
      dueDate: formatDate(addBusinessDays(baseDate, 3)),
      category: "document",
    });
  }

  return tasks;
}

// -- Implementation ---------------------------------------------------------

/**
 * Execute the generate-follow-up-tasks skill.
 *
 * @param input - Call summary and context for task generation.
 * @returns A list of structured follow-up tasks.
 */
export async function execute(input: SkillInput): Promise<SkillOutput> {
  if (!input.summary || typeof input.summary !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'summary' in input.",
      tasks: [],
      taskCount: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  if (!input.ownerName || typeof input.ownerName !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'ownerName' in input.",
      tasks: [],
      taskCount: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  try {
    const baseDate = input.baseDate ? new Date(input.baseDate) : new Date();
    const tasks = extractTasks(
      input.summary,
      input.ownerName,
      input.leadName ?? "the lead",
      input.company ?? null,
      input.dealStage ?? null,
      baseDate,
    );

    // TODO: integrate with LLM for more sophisticated task extraction
    // TODO: integrate with task management tools (Asana, Jira, Trello)

    return {
      success: true,
      tasks,
      taskCount: tasks.length,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      tasks: [],
      taskCount: 0,
      generatedAt: new Date().toISOString(),
    };
  }
}
