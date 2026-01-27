import type { AgentMailClient, AgentMail } from "agentmail";

import { formatAttachments } from "./attachment.js";
import { formatUtcDate } from "./utils.js";

type Thread = AgentMail.threads.Thread;
type Message = AgentMail.messages.Message;

/**
 * Extracts the body text from a message, preferring extractedText.
 * extractedText contains only new content (excluding quoted replies).
 */
export function extractMessageBody(
  msg: Pick<Message, "extractedText" | "extractedHtml" | "text" | "html">
): string {
  return msg.extractedText ?? msg.extractedHtml ?? msg.text ?? msg.html ?? "";
}

/**
 * Formats thread-level metadata.
 */
function formatThreadHeader(thread: Thread): string {
  const lines: string[] = [];

  if (thread.subject) {
    lines.push(`Subject: ${thread.subject}`);
  }

  lines.push(`Senders: ${thread.senders.join(", ")}`);
  lines.push(`Recipients: ${thread.recipients.join(", ")}`);
  lines.push(`Messages: ${thread.messageCount}`);

  return lines.join("\n");
}

/**
 * Formats recipients for a message (to, cc, bcc).
 */
function formatMessageRecipients(msg: Message): string {
  const parts: string[] = [`To: ${msg.to.join(", ")}`];

  if (msg.cc?.length) {
    parts.push(`Cc: ${msg.cc.join(", ")}`);
  }

  if (msg.bcc?.length) {
    parts.push(`Bcc: ${msg.bcc.join(", ")}`);
  }

  return parts.join("\n");
}

/**
 * Formats a single message for context display.
 */
function formatMessage(msg: Message): string {
  const recipients = formatMessageRecipients(msg);
  const attachments = formatAttachments(msg.attachments);
  const body = extractMessageBody(msg);
  const timestamp = formatUtcDate(msg.createdAt);

  const parts = [
    `--- ${timestamp} ---`,
    `From: ${msg.from}`,
    recipients,
  ];

  if (attachments) {
    parts.push(attachments);
  }

  parts.push("", body);

  return parts.join("\n");
}

/**
 * Fetches and formats the thread as context for the agent.
 * Returns empty string if fetch fails.
 */
export async function fetchFormattedThread(
  client: AgentMailClient,
  inboxId: string,
  threadId: string
): Promise<string> {
  try {
    const thread = await client.inboxes.threads.get(inboxId, threadId);

    if (thread.messages.length === 0) {
      return "";
    }

    const header = formatThreadHeader(thread);
    const messages = thread.messages.map(formatMessage).join("\n\n");

    return `${header}\n\n${messages}`;
  } catch {
    // Caller handles fallback to webhook payload
    return "";
  }
}
