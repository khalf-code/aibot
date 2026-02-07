/**
 * log-call-notes-crm -- Log structured call notes to a CRM system
 * after a sales or intro call.
 *
 * BIZ-017 to BIZ-020 (#109-#112)
 */

// -- Types ------------------------------------------------------------------

/** A single action item captured during the call. */
export interface ActionItem {
  /** Description of the action to take. */
  description: string;
  /** Who is responsible (e.g. "sales rep", "lead", "engineering"). */
  owner: string;
  /** Optional due date (ISO 8601). */
  dueDate?: string;
}

/** Input payload for the log-call-notes-crm skill. */
export interface SkillInput {
  /** CRM contact or lead ID to associate the notes with. */
  contactId: string;
  /** CRM deal/opportunity ID (optional). */
  dealId?: string;
  /** Call date/time (ISO 8601). */
  callDate: string;
  /** Duration of the call in minutes. */
  durationMinutes: number;
  /** Names of participants on the call. */
  participants: string[];
  /** Free-form call summary or transcript excerpt. */
  summary: string;
  /** Structured action items from the call. */
  actionItems: ActionItem[];
  /** Overall call sentiment: positive, neutral, or negative. */
  sentiment?: "positive" | "neutral" | "negative";
  /** Next step agreed upon during the call. */
  nextStep?: string;
  /** Target CRM system: "hubspot" or "salesforce" (default: "hubspot"). */
  crmProvider?: "hubspot" | "salesforce";
}

/** Output payload returned by the log-call-notes-crm skill. */
export interface SkillOutput {
  /** Whether the skill completed successfully. */
  success: boolean;
  /** Human-readable error message when success is false. */
  error?: string;
  /** The CRM activity/note ID created. */
  activityId: string | null;
  /** The CRM contact ID the note was logged against. */
  contactId: string | null;
  /** The CRM deal ID the note was associated with (if provided). */
  dealId: string | null;
  /** Formatted note body that was submitted to the CRM. */
  formattedNote: string | null;
  /** Number of action items logged. */
  actionItemCount: number;
  /** ISO 8601 timestamp of when the logging ran. */
  loggedAt: string;
}

// -- Helpers ----------------------------------------------------------------

/**
 * Format call notes into a structured plain-text note for CRM submission.
 */
function formatCallNote(input: SkillInput): string {
  const lines: string[] = [];

  lines.push(`## Call Notes`);
  lines.push(`**Date:** ${input.callDate}`);
  lines.push(`**Duration:** ${input.durationMinutes} minutes`);
  lines.push(`**Participants:** ${input.participants.join(", ")}`);

  if (input.sentiment) {
    lines.push(`**Sentiment:** ${input.sentiment}`);
  }

  lines.push("");
  lines.push("### Summary");
  lines.push(input.summary);

  if (input.actionItems.length > 0) {
    lines.push("");
    lines.push("### Action Items");
    for (const item of input.actionItems) {
      const due = item.dueDate ? ` (due: ${item.dueDate})` : "";
      lines.push(`- [ ] ${item.description} -- Owner: ${item.owner}${due}`);
    }
  }

  if (input.nextStep) {
    lines.push("");
    lines.push("### Next Step");
    lines.push(input.nextStep);
  }

  return lines.join("\n");
}

/**
 * Generate a stub activity ID.
 * Production would return the real CRM record ID.
 */
function generateStubActivityId(provider: string): string {
  const prefix = provider === "salesforce" ? "SF" : "HS";
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-ACT-${rand}`;
}

// -- Implementation ---------------------------------------------------------

/**
 * Execute the log-call-notes-crm skill.
 *
 * @param input - Call details, summary, and action items to log.
 * @returns CRM activity record details.
 */
export async function execute(input: SkillInput): Promise<SkillOutput> {
  if (!input.contactId || typeof input.contactId !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'contactId' in input.",
      activityId: null,
      contactId: null,
      dealId: null,
      formattedNote: null,
      actionItemCount: 0,
      loggedAt: new Date().toISOString(),
    };
  }

  if (!input.summary || typeof input.summary !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'summary' in input.",
      activityId: null,
      contactId: input.contactId,
      dealId: null,
      formattedNote: null,
      actionItemCount: 0,
      loggedAt: new Date().toISOString(),
    };
  }

  try {
    const provider = input.crmProvider ?? "hubspot";
    const formattedNote = formatCallNote(input);
    const activityId = generateStubActivityId(provider);

    // TODO: integrate with HubSpot API to create engagement/note
    // TODO: integrate with Salesforce API to create Task/Activity
    // TODO: attach action items as CRM tasks linked to the activity
    // TODO: update deal stage if sentiment/next-step warrants it

    return {
      success: true,
      activityId,
      contactId: input.contactId,
      dealId: input.dealId ?? null,
      formattedNote,
      actionItemCount: input.actionItems?.length ?? 0,
      loggedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      activityId: null,
      contactId: input.contactId,
      dealId: null,
      formattedNote: null,
      actionItemCount: 0,
      loggedAt: new Date().toISOString(),
    };
  }
}
