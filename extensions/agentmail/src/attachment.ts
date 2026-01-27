import type { AgentMail } from "agentmail";

import { formatUtcDate } from "./utils.js";

type Attachment = AgentMail.Attachment;
type AttachmentResponse = AgentMail.AttachmentResponse;

/** Formats file size in human-readable format. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Formats a single attachment metadata for display.
 */
export function formatAttachment(att: Attachment): string {
  const name = att.filename ?? "unnamed";
  const type = att.contentType ?? "unknown";
  const size = formatFileSize(att.size);
  return `  - ${name} (${type}, ${size}, id: ${att.attachmentId})`;
}

/**
 * Formats attachments list for a message.
 */
export function formatAttachments(attachments: Attachment[] | undefined): string {
  if (!attachments?.length) return "";
  return `Attachments:\n${attachments.map(formatAttachment).join("\n")}`;
}

/**
 * Formats an attachment response (with download URL) for display.
 */
export function formatAttachmentResponse(att: AttachmentResponse): string {
  return [
    `Attachment: ${att.filename ?? "unnamed"}`,
    `Type: ${att.contentType ?? "unknown"}`,
    `Size: ${formatFileSize(att.size)}`,
    `Download URL: ${att.downloadUrl}`,
    `Expires: ${formatUtcDate(att.expiresAt)}`,
  ].join("\n");
}
