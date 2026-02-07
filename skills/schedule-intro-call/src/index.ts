/**
 * schedule-intro-call -- Schedule an introductory call with a sales lead
 * by checking calendar availability and creating an event.
 *
 * BIZ-013 to BIZ-016 (#105-#108)
 */

// -- Types ------------------------------------------------------------------

/** A proposed time slot for the intro call. */
export interface TimeSlot {
  /** ISO 8601 start time. */
  start: string;
  /** ISO 8601 end time. */
  end: string;
}

/** Input payload for the schedule-intro-call skill. */
export interface SkillInput {
  /** Lead's display name. */
  leadName: string;
  /** Lead's email address (for calendar invite). */
  leadEmail: string;
  /** Host/sales rep's email address. */
  hostEmail: string;
  /** Host's display name. */
  hostName: string;
  /** Preferred duration in minutes (default: 30). */
  durationMinutes?: number;
  /** Optional IANA timezone for the lead (e.g. "America/New_York"). */
  leadTimezone?: string;
  /** Optional preferred date range start (ISO 8601). */
  preferredAfter?: string;
  /** Optional preferred date range end (ISO 8601). */
  preferredBefore?: string;
  /** Optional meeting title override. */
  title?: string;
}

/** Output payload returned by the schedule-intro-call skill. */
export interface SkillOutput {
  /** Whether the skill completed successfully. */
  success: boolean;
  /** Human-readable error message when success is false. */
  error?: string;
  /** Proposed available time slots (up to 3). */
  proposedSlots: TimeSlot[];
  /** The slot that was booked (null if only proposing). */
  bookedSlot: TimeSlot | null;
  /** Calendar event ID if an event was created. */
  eventId: string | null;
  /** Calendar invite link or URL. */
  eventLink: string | null;
  /** Meeting title used for the event. */
  title: string;
  /** ISO 8601 timestamp of when the scheduling ran. */
  scheduledAt: string;
}

// -- Helpers ----------------------------------------------------------------

/**
 * Generate candidate time slots starting from a given date.
 * Returns slots during business hours (9am-5pm) in 30-min increments.
 * This is a stub -- production would query a real calendar API.
 */
function generateCandidateSlots(
  afterDate: Date,
  durationMinutes: number,
  count: number,
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const current = new Date(afterDate);

  // Advance to next business hour if needed
  if (current.getHours() < 9) {
    current.setHours(9, 0, 0, 0);
  } else if (current.getHours() >= 17) {
    // Move to next day 9am
    current.setDate(current.getDate() + 1);
    current.setHours(9, 0, 0, 0);
  }

  let attempts = 0;
  while (slots.length < count && attempts < 100) {
    attempts++;
    const day = current.getDay();

    // Skip weekends
    if (day === 0 || day === 6) {
      current.setDate(current.getDate() + 1);
      current.setHours(9, 0, 0, 0);
      continue;
    }

    // Check within business hours
    if (current.getHours() >= 9 && current.getHours() < 17) {
      const start = new Date(current);
      const end = new Date(current);
      end.setMinutes(end.getMinutes() + durationMinutes);

      // Only add if end is still within business hours
      if (end.getHours() <= 17) {
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
        });
      }
    }

    // Advance by duration + 30 min buffer
    current.setMinutes(current.getMinutes() + durationMinutes + 30);

    // If past business hours, move to next day
    if (current.getHours() >= 17) {
      current.setDate(current.getDate() + 1);
      current.setHours(9, 0, 0, 0);
    }
  }

  return slots;
}

/** Build a meeting title from inputs. */
function buildTitle(leadName: string, hostName: string, customTitle?: string): string {
  if (customTitle) return customTitle;
  return `Intro Call: ${hostName} <> ${leadName}`;
}

// -- Implementation ---------------------------------------------------------

/**
 * Execute the schedule-intro-call skill.
 *
 * @param input - Lead and host details for scheduling.
 * @returns Proposed time slots and optional booked event details.
 */
export async function execute(input: SkillInput): Promise<SkillOutput> {
  if (!input.leadName || typeof input.leadName !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'leadName' in input.",
      proposedSlots: [],
      bookedSlot: null,
      eventId: null,
      eventLink: null,
      title: "",
      scheduledAt: new Date().toISOString(),
    };
  }

  if (!input.leadEmail || typeof input.leadEmail !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'leadEmail' in input.",
      proposedSlots: [],
      bookedSlot: null,
      eventId: null,
      eventLink: null,
      title: "",
      scheduledAt: new Date().toISOString(),
    };
  }

  if (!input.hostEmail || typeof input.hostEmail !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'hostEmail' in input.",
      proposedSlots: [],
      bookedSlot: null,
      eventId: null,
      eventLink: null,
      title: "",
      scheduledAt: new Date().toISOString(),
    };
  }

  try {
    const duration = input.durationMinutes ?? 30;
    const afterDate = input.preferredAfter ? new Date(input.preferredAfter) : new Date();

    const title = buildTitle(input.leadName, input.hostName ?? "Sales Team", input.title);
    const proposedSlots = generateCandidateSlots(afterDate, duration, 3);

    // TODO: integrate with Google Calendar / Microsoft Graph API to check real availability
    // TODO: create actual calendar event with invite link
    // TODO: send calendar invite email to lead via email-runner

    return {
      success: true,
      proposedSlots,
      bookedSlot: null,
      eventId: null,
      eventLink: null,
      title,
      scheduledAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      proposedSlots: [],
      bookedSlot: null,
      eventId: null,
      eventLink: null,
      title: "",
      scheduledAt: new Date().toISOString(),
    };
  }
}
