/**
 * TOOLS-008 (#44) -- Calendar integration
 *
 * Provider interface and types for calendar operations (list, create,
 * update, delete events). Implementations may wrap Google Calendar,
 * Microsoft Outlook, CalDAV, or other backends.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Attendee
// ---------------------------------------------------------------------------

/** A calendar event attendee. */
export type CalendarAttendee = {
  /** Email address. */
  email: string;

  /** Display name (may be absent if the calendar only stores emails). */
  name?: string;

  /** RSVP status. */
  status: "accepted" | "declined" | "tentative" | "needs_action";

  /** Whether this attendee is optional. */
  optional?: boolean;
};

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

/**
 * RFC 5545 recurrence rule (simplified).
 *
 * For complex rules the raw `rrule` string is preserved; the parsed
 * fields cover common cases.
 */
export type RecurrenceRule = {
  /** Raw RRULE string (e.g. `"RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"`). */
  rrule: string;

  /** Parsed frequency for convenience. */
  frequency?: "daily" | "weekly" | "monthly" | "yearly";

  /** Interval between occurrences (e.g. `2` for every other week). */
  interval?: number;

  /** ISO-8601 date after which the recurrence stops. */
  until?: string;

  /** Maximum number of occurrences. */
  count?: number;
};

// ---------------------------------------------------------------------------
// CalendarEvent
// ---------------------------------------------------------------------------

/** A single calendar event. */
export type CalendarEvent = {
  /** Provider-specific event ID. */
  id: string;

  /** Event title / summary. */
  title: string;

  /** ISO-8601 start time. */
  start: string;

  /** ISO-8601 end time. */
  end: string;

  /**
   * Whether this is an all-day event.
   * When `true`, `start` and `end` are date-only strings (`YYYY-MM-DD`).
   */
  all_day?: boolean;

  /** Attendees. */
  attendees: CalendarAttendee[];

  /** Location (physical address or video-call URL). */
  location?: string;

  /** Long-form description / notes. */
  description?: string;

  /** Recurrence rule (if this is a recurring event). */
  recurrence?: RecurrenceRule;

  /** The calendar this event belongs to (e.g. `"Work"`, `"Personal"`). */
  calendar_id?: string;

  /** ISO-8601 creation timestamp. */
  created_at?: string;

  /** ISO-8601 last-updated timestamp. */
  updated_at?: string;

  /** User's RSVP status for this event. */
  status?: "confirmed" | "tentative" | "cancelled";

  /** URL to the event in the calendar provider's web UI. */
  html_link?: string;
};

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

/** Options for listing / searching calendar events. */
export type CalendarListOptions = {
  /** Only return events starting on or after this ISO-8601 time. */
  time_min?: string;

  /** Only return events starting before this ISO-8601 time. */
  time_max?: string;

  /** Free-text search query. */
  query?: string;

  /** Limit to a specific calendar ID. */
  calendar_id?: string;

  /** Maximum number of results. */
  limit?: number;
};

// ---------------------------------------------------------------------------
// Create / update payloads
// ---------------------------------------------------------------------------

/** Fields for creating a new calendar event. */
export type CalendarEventCreate = Omit<CalendarEvent, "id" | "created_at" | "updated_at">;

/** Fields for updating an existing event (all optional except `id`). */
export type CalendarEventUpdate = { id: string } & Partial<
  Omit<CalendarEvent, "id" | "created_at" | "updated_at">
>;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Calendar provider interface.
 *
 * Implementations wrap a specific calendar backend and expose a uniform
 * API for the Clawdbot tool runner.
 */
export type CalendarProvider = {
  /** Human-readable name (e.g. `"Google Calendar"`, `"Outlook"`). */
  readonly name: string;

  /** List events matching the given criteria. */
  listEvents(options?: CalendarListOptions): Promise<CalendarEvent[]>;

  /**
   * Create a new calendar event.
   *
   * @returns The created event (with provider-assigned `id`).
   */
  createEvent(event: CalendarEventCreate): Promise<CalendarEvent>;

  /**
   * Update an existing calendar event.
   *
   * @returns The updated event.
   * @throws {Error} If no event with the given `id` exists.
   */
  updateEvent(event: CalendarEventUpdate): Promise<CalendarEvent>;

  /**
   * Delete a calendar event by ID.
   *
   * @throws {Error} If no event with the given `id` exists.
   */
  deleteEvent(eventId: string): Promise<void>;
};
