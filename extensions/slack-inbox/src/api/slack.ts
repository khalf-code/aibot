import { WebClient, type RetryOptions } from "@slack/web-api";
import type { InboxMessage, InboxMessageType } from "../types.js";

const SLACK_RETRY_OPTIONS: RetryOptions = {
  retries: 2,
  factor: 2,
  minTimeout: 500,
  maxTimeout: 3000,
  randomize: true,
};

export type SlackChannel = {
  id: string;
  name: string;
  is_member: boolean;
  is_private: boolean;
  is_im: boolean;
  is_mpim: boolean;
};

export type SlackMessage = {
  ts: string;
  user?: string;
  text: string;
  type: string;
  channel?: string;
};

export function createSlackClient(botToken: string): WebClient {
  return new WebClient(botToken, {
    retryConfig: SLACK_RETRY_OPTIONS,
  });
}

/**
 * Get the bot's own user ID.
 */
export async function getBotUserId(client: WebClient): Promise<string | undefined> {
  try {
    const result = await client.auth.test();
    return result.user_id;
  } catch {
    return undefined;
  }
}

/**
 * List channels the bot is a member of.
 */
export async function listBotChannels(client: WebClient): Promise<SlackChannel[]> {
  const channels: SlackChannel[] = [];

  try {
    // Get public channels
    let cursor: string | undefined;
    do {
      const result = await client.conversations.list({
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: 200,
        cursor,
      });

      if (result.channels) {
        for (const ch of result.channels) {
          if (ch.is_member && ch.id && ch.name) {
            channels.push({
              id: ch.id,
              name: ch.name,
              is_member: true,
              is_private: ch.is_private ?? false,
              is_im: ch.is_im ?? false,
              is_mpim: ch.is_mpim ?? false,
            });
          }
        }
      }

      cursor = result.response_metadata?.next_cursor;
    } while (cursor);
  } catch {
    // Return what we have
  }

  return channels;
}

/**
 * Fetch recent messages from a channel.
 */
export async function fetchChannelMessages(
  client: WebClient,
  channelId: string,
  options: {
    limit?: number;
    oldest?: string;
  } = {},
): Promise<SlackMessage[]> {
  const { limit = 100, oldest } = options;

  try {
    const result = await client.conversations.history({
      channel: channelId,
      limit,
      oldest,
    });

    if (!result.ok || !result.messages) {
      return [];
    }

    return result.messages.map((m) => ({
      ts: m.ts ?? "",
      user: m.user,
      text: m.text ?? "",
      type: m.type ?? "message",
      channel: channelId,
    }));
  } catch {
    return [];
  }
}

/**
 * Check if a message mentions the given member ID.
 */
export function messageContainsMention(text: string, memberId: string): boolean {
  // Slack mentions format: <@U02T6CMF0> or <@U02T6CMF0|username>
  const mentionPattern = new RegExp(`<@${memberId}(\\|[^>]*)?>`, "i");
  return mentionPattern.test(text);
}

/**
 * Determine message type based on channel info.
 */
export function getMessageType(channel: SlackChannel): InboxMessageType {
  if (channel.is_im) {
    return "dm";
  }
  if (channel.is_mpim) {
    return "dm";
  }
  return "mention";
}

/**
 * Convert a Slack message to an InboxMessage.
 */
export function slackMessageToInbox(
  msg: SlackMessage,
  channel: SlackChannel,
  type: InboxMessageType,
): InboxMessage {
  const id = `${channel.id}:${msg.ts}`;

  return {
    id,
    ts: msg.ts,
    channelId: channel.id,
    channelName: channel.name,
    type,
    senderId: msg.user ?? "unknown",
    senderName: undefined, // Can be resolved later
    text: msg.text,
    status: "unread",
    permalink: undefined,
    receivedAt: Date.now(),
  };
}

/**
 * Resolve user info for a list of user IDs.
 */
export async function resolveUserNames(
  client: WebClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const uniqueIds = [...new Set(userIds)];

  for (const userId of uniqueIds) {
    try {
      const result = await client.users.info({ user: userId });
      if (result.ok && result.user) {
        const user = result.user as {
          real_name?: string;
          display_name?: string;
          name?: string;
        };
        names.set(userId, user.real_name || user.display_name || user.name || userId);
      }
    } catch {
      // Skip on error
    }
  }

  return names;
}

/**
 * Get permalink for a message.
 */
export async function getMessagePermalink(
  client: WebClient,
  channelId: string,
  messageTs: string,
): Promise<string | undefined> {
  try {
    const result = await client.chat.getPermalink({
      channel: channelId,
      message_ts: messageTs,
    });
    return result.permalink;
  } catch {
    return undefined;
  }
}
