import fs from "node:fs";
import path from "node:path";
import {
  InboxMessageSchema,
  type InboxMessage,
  type InboxMessageStatus,
  type ListMessagesOptions,
} from "../types.js";

const MESSAGES_FILENAME = "messages.jsonl";

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getMessagesPath(storeDir: string): string {
  return path.join(storeDir, MESSAGES_FILENAME);
}

/**
 * Load all messages from the JSONL file into memory.
 * Returns a Map keyed by message ID for deduplication.
 */
export function loadAllMessages(storeDir: string): Map<string, InboxMessage> {
  const filePath = getMessagesPath(storeDir);
  const messages = new Map<string, InboxMessage>();

  if (!fs.existsSync(filePath)) {
    return messages;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        const message = InboxMessageSchema.parse(data);
        // Later entries override earlier ones (for updates)
        messages.set(message.id, message);
      } catch {
        // Skip invalid lines
      }
    }
  } catch {
    // File read error, return empty map
  }

  return messages;
}

/**
 * List messages with optional filtering and pagination.
 */
export function loadMessages(storeDir: string, options: ListMessagesOptions = {}): InboxMessage[] {
  const { status, limit = 50, offset = 0 } = options;
  const allMessages = loadAllMessages(storeDir);

  let messages = Array.from(allMessages.values());

  // Filter by status if specified
  if (status) {
    messages = messages.filter((m) => m.status === status);
  }

  // Sort by receivedAt descending (newest first)
  messages.sort((a, b) => b.receivedAt - a.receivedAt);

  // Apply pagination
  return messages.slice(offset, offset + limit);
}

/**
 * Get a single message by ID.
 */
export function getMessage(storeDir: string, messageId: string): InboxMessage | undefined {
  const allMessages = loadAllMessages(storeDir);
  return allMessages.get(messageId);
}

/**
 * Append a new message or update to the JSONL file.
 * Returns true if the message was new, false if it was an update.
 */
export function appendMessage(storeDir: string, message: InboxMessage): boolean {
  ensureDir(storeDir);
  const filePath = getMessagesPath(storeDir);

  // Check if message already exists
  const existing = loadAllMessages(storeDir);
  const isNew = !existing.has(message.id);

  // Append to JSONL
  const line = JSON.stringify(message) + "\n";
  fs.appendFileSync(filePath, line, "utf8");

  return isNew;
}

/**
 * Append multiple messages with deduplication.
 * Returns the count of new messages added.
 */
export function appendMessages(storeDir: string, messages: InboxMessage[]): number {
  if (messages.length === 0) {
    return 0;
  }

  ensureDir(storeDir);
  const filePath = getMessagesPath(storeDir);

  // Load existing for deduplication
  const existing = loadAllMessages(storeDir);
  const newMessages = messages.filter((m) => !existing.has(m.id));

  if (newMessages.length === 0) {
    return 0;
  }

  // Append all new messages at once
  const lines = newMessages.map((m) => JSON.stringify(m)).join("\n") + "\n";
  fs.appendFileSync(filePath, lines, "utf8");

  return newMessages.length;
}

/**
 * Update a message's status.
 * Appends a new entry with the updated status.
 */
export function updateMessageStatus(
  storeDir: string,
  messageId: string,
  status: InboxMessageStatus,
): InboxMessage | undefined {
  const message = getMessage(storeDir, messageId);
  if (!message) {
    return undefined;
  }

  const updated = { ...message, status };
  appendMessage(storeDir, updated);
  return updated;
}

/**
 * Count messages by status.
 */
export function countMessages(storeDir: string): Record<InboxMessageStatus, number> {
  const allMessages = loadAllMessages(storeDir);
  const counts: Record<InboxMessageStatus, number> = {
    unread: 0,
    read: 0,
    archived: 0,
  };

  for (const message of allMessages.values()) {
    counts[message.status]++;
  }

  return counts;
}

/**
 * Compact the JSONL file by removing duplicate entries.
 * Keeps only the latest version of each message.
 */
export function compactMessages(storeDir: string): void {
  const filePath = getMessagesPath(storeDir);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const messages = loadAllMessages(storeDir);
  const sorted = Array.from(messages.values()).toSorted((a, b) => a.receivedAt - b.receivedAt);

  // Write compacted file
  const lines = sorted.map((m) => JSON.stringify(m)).join("\n") + "\n";
  fs.writeFileSync(filePath, lines, "utf8");
}
