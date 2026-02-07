/**
 * TOOLS-007 (#43) -- Email integration
 *
 * Provider interface and types for email operations (send, read, search,
 * mark-as-read). Implementations may wrap IMAP/SMTP, Gmail API, Microsoft
 * Graph, or other backends.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Attachment
// ---------------------------------------------------------------------------

/** An email attachment. */
export type EmailAttachment = {
  /** Original filename (e.g. `"report.pdf"`). */
  filename: string;

  /** MIME type (e.g. `"application/pdf"`). */
  content_type: string;

  /** Size in bytes. */
  size_bytes: number;

  /**
   * Base-64 encoded content.
   * May be `undefined` when listing attachments without downloading them.
   */
  data_base64?: string;
};

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/** A single email message. */
export type Email = {
  /** Provider-specific message ID (e.g. Gmail message ID, IMAP UID). */
  id: string;

  /** Sender address. */
  from: string;

  /** Recipient address(es). */
  to: string[];

  /** CC recipients. */
  cc?: string[];

  /** BCC recipients (only visible on sent messages). */
  bcc?: string[];

  /** Subject line. */
  subject: string;

  /** Plain-text body. */
  body_text: string;

  /** HTML body (may be empty for plain-text-only messages). */
  body_html?: string;

  /** File attachments. */
  attachments: EmailAttachment[];

  /** ISO-8601 timestamp of when the email was sent / received. */
  date: string;

  /** Whether the message has been read. */
  is_read: boolean;

  /** Provider-specific labels / folder names. */
  labels?: string[];

  /** Message-ID header (RFC 2822). */
  message_id?: string;

  /** In-Reply-To header (for threading). */
  in_reply_to?: string;
};

// ---------------------------------------------------------------------------
// Search options
// ---------------------------------------------------------------------------

/** Options for searching emails. */
export type EmailSearchOptions = {
  /** Free-text query string. */
  query?: string;

  /** Filter by sender. */
  from?: string;

  /** Filter by recipient. */
  to?: string;

  /** Filter by subject (substring match). */
  subject?: string;

  /** Only return emails after this date (ISO-8601). */
  after?: string;

  /** Only return emails before this date (ISO-8601). */
  before?: string;

  /** Whether to include unread messages only. */
  unread_only?: boolean;

  /** Maximum number of results to return. */
  limit?: number;
};

// ---------------------------------------------------------------------------
// Send options
// ---------------------------------------------------------------------------

/** Options for composing and sending an email. */
export type EmailSendOptions = {
  /** Recipient address(es). */
  to: string[];

  /** CC recipients. */
  cc?: string[];

  /** BCC recipients. */
  bcc?: string[];

  /** Subject line. */
  subject: string;

  /** Plain-text body. */
  body_text: string;

  /** HTML body (optional; plain text is always required). */
  body_html?: string;

  /** Attachments to include. */
  attachments?: EmailAttachment[];

  /** Message-ID of the email being replied to (for threading). */
  in_reply_to?: string;
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Email provider interface.
 *
 * Implementations wrap a specific email backend (IMAP/SMTP, Gmail API,
 * Microsoft Graph, etc.) and expose a uniform API for the Clawdbot
 * tool runner.
 */
export type EmailProvider = {
  /** Human-readable name of the provider (e.g. `"Gmail"`, `"Outlook"`). */
  readonly name: string;

  /**
   * Send an email.
   *
   * @returns The provider-specific message ID of the sent email.
   */
  send(options: EmailSendOptions): Promise<string>;

  /**
   * Read a single email by its provider-specific ID.
   *
   * @returns The full email, or `null` if not found.
   */
  read(messageId: string): Promise<Email | null>;

  /**
   * Search for emails matching the given criteria.
   *
   * @returns An array of matching emails (limited by `options.limit`).
   */
  search(options: EmailSearchOptions): Promise<Email[]>;

  /**
   * Mark one or more messages as read.
   *
   * @param messageIds Provider-specific message IDs to mark.
   */
  markRead(messageIds: string[]): Promise<void>;
};
