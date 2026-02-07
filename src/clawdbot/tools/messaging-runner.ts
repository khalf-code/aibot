/**
 * TOOLS-009 (#45) -- Messaging integration
 *
 * Provider interface and types for messaging operations (send, receive,
 * list channels). Implementations may wrap Slack, Discord, Telegram,
 * Microsoft Teams, or other messaging backends.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Attachment
// ---------------------------------------------------------------------------

/** An attachment on a message (file, image, link preview, etc.). */
export type MessageAttachment = {
  /** Original filename. */
  filename?: string;

  /** MIME type (e.g. `"image/png"`, `"application/pdf"`). */
  content_type: string;

  /** URL to download or preview the attachment. */
  url: string;

  /** File size in bytes (if known). */
  size_bytes?: number;

  /** Human-readable title or alt text. */
  title?: string;
};

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

/** A single message in a channel or conversation. */
export type Message = {
  /** Provider-specific message ID. */
  id: string;

  /** Channel or conversation identifier this message belongs to. */
  channel: string;

  /** Display name or user ID of the sender. */
  sender: string;

  /** Plain-text message body. */
  text: string;

  /** ISO-8601 timestamp of when the message was sent. */
  timestamp: string;

  /** File or media attachments. */
  attachments: MessageAttachment[];

  /** Provider-specific thread ID (for threaded conversations). */
  thread_id?: string;

  /** Whether this message was sent by the bot / current user. */
  is_own?: boolean;

  /** Whether this message has been edited. */
  is_edited?: boolean;

  /**
   * Reactions on the message (emoji -> count).
   * May be absent if the provider does not support reactions.
   */
  reactions?: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

/** A messaging channel or conversation. */
export type MessagingChannel = {
  /** Provider-specific channel ID. */
  id: string;

  /** Human-readable channel name. */
  name: string;

  /** Whether this is a direct / private message conversation. */
  is_dm: boolean;

  /** Number of members in the channel (if known). */
  member_count?: number;

  /** Short description or topic. */
  topic?: string;
};

// ---------------------------------------------------------------------------
// Send options
// ---------------------------------------------------------------------------

/** Options for sending a message. */
export type MessageSendOptions = {
  /** Target channel or conversation ID. */
  channel: string;

  /** Plain-text message body. */
  text: string;

  /** Thread ID to reply to (for threaded conversations). */
  thread_id?: string;

  /** Attachments to include. */
  attachments?: MessageAttachment[];
};

// ---------------------------------------------------------------------------
// Receive options
// ---------------------------------------------------------------------------

/** Options for receiving / fetching messages. */
export type MessageReceiveOptions = {
  /** Channel or conversation to fetch from. */
  channel: string;

  /** Only return messages after this ISO-8601 timestamp. */
  after?: string;

  /** Maximum number of messages to return. */
  limit?: number;

  /** Thread ID to scope to (for threaded conversations). */
  thread_id?: string;
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Messaging provider interface.
 *
 * Implementations wrap a specific messaging backend (Slack, Discord,
 * Telegram, Teams, etc.) and expose a uniform API for the Clawdbot
 * tool runner.
 */
export type MessagingProvider = {
  /** Human-readable name (e.g. `"Slack"`, `"Discord"`). */
  readonly name: string;

  /**
   * Send a message to a channel or conversation.
   *
   * @returns The provider-specific message ID of the sent message.
   */
  send(options: MessageSendOptions): Promise<string>;

  /**
   * Fetch recent messages from a channel or conversation.
   *
   * @returns An array of messages in chronological order.
   */
  receive(options: MessageReceiveOptions): Promise<Message[]>;

  /**
   * List available channels / conversations the bot has access to.
   *
   * @returns An array of channel descriptors.
   */
  listChannels(): Promise<MessagingChannel[]>;
};
