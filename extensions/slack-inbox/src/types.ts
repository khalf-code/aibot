import { z } from "zod";

export const InboxMessageStatusSchema = z.enum(["unread", "read", "archived"]);
export type InboxMessageStatus = z.infer<typeof InboxMessageStatusSchema>;

export const InboxMessageTypeSchema = z.enum(["dm", "mention", "thread"]);
export type InboxMessageType = z.infer<typeof InboxMessageTypeSchema>;

export const InboxMessageSchema = z.object({
  /** Unique ID: channelId:ts */
  id: z.string(),
  /** Slack message timestamp */
  ts: z.string(),
  /** Channel ID where the message was posted */
  channelId: z.string(),
  /** Channel name (if resolved) */
  channelName: z.string().optional(),
  /** Message type */
  type: InboxMessageTypeSchema,
  /** Sender's Slack user ID */
  senderId: z.string(),
  /** Sender's display name (if resolved) */
  senderName: z.string().optional(),
  /** Message text content */
  text: z.string(),
  /** Message status */
  status: InboxMessageStatusSchema,
  /** Permalink to the message */
  permalink: z.string().optional(),
  /** Unix timestamp when the message was received/synced */
  receivedAt: z.number(),
});

export type InboxMessage = z.infer<typeof InboxMessageSchema>;

export const SyncStateSchema = z.object({
  /** Unix timestamp of last successful sync */
  lastSyncTs: z.number().optional(),
  /** Cached unread count */
  unreadCount: z.number().default(0),
  /** Slack user ID of the authenticated user */
  userId: z.string().optional(),
});

export type SyncState = z.infer<typeof SyncStateSchema>;

export type ListMessagesOptions = {
  status?: InboxMessageStatus;
  limit?: number;
  offset?: number;
};
