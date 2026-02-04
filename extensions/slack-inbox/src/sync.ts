import type { SlackInboxConfig } from "./config.js";
import type { InboxMessage } from "./types.js";
import { allowListMatches } from "../../../src/slack/monitor/allow-list.js";
import {
  createSlackClient,
  fetchChannelMessages,
  getMessageType,
  listBotChannels,
  messageContainsMention,
  slackMessageToInbox,
  type SlackChannel,
} from "./api/slack.js";
import { appendMessages, countMessages } from "./store/messages.js";
import { loadSyncState, updateSyncState } from "./store/sync-state.js";

export type SyncResult = {
  success: boolean;
  newMessages: number;
  totalMessages: number;
  unreadCount: number;
  channelsScanned: number;
  error?: string;
};

export type SyncContext = {
  config: SlackInboxConfig;
  storeDir: string;
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
};

/**
 * Run a full sync: fetch messages from channels and filter for mentions.
 */
export async function runSync(ctx: SyncContext): Promise<SyncResult> {
  const { config, storeDir, logger } = ctx;

  if (!config.botToken) {
    return {
      success: false,
      newMessages: 0,
      totalMessages: 0,
      unreadCount: 0,
      channelsScanned: 0,
      error: "No bot token configured",
    };
  }

  if (!config.memberId) {
    return {
      success: false,
      newMessages: 0,
      totalMessages: 0,
      unreadCount: 0,
      channelsScanned: 0,
      error: "No member ID configured (your Slack user ID to watch for mentions)",
    };
  }

  const client = createSlackClient(config.botToken);

  // Load sync state to get last sync timestamp
  const state = loadSyncState(storeDir);
  const oldestTs = state.lastSyncTs ? String(state.lastSyncTs / 1000) : undefined;

  logger?.info(`[slack-inbox] Syncing mentions for member ${config.memberId}`);

  // Get channels to scan
  let channels: SlackChannel[];

  if (config.channelAllowlist && config.channelAllowlist.length > 0) {
    // Use allowlist directly - extract channel IDs without API call
    // Channel IDs start with C (public) or G (private/group) and contain digits
    // The lookahead (?=.*\d) ensures at least one digit to avoid matching words like "general"
    channels = config.channelAllowlist
      .filter((entry) => /^[CG](?=.*\d)[A-Z0-9]+$/i.test(entry))
      .map((id) => ({
        id: id.toUpperCase(),
        name: id, // Name unknown when using allowlist directly
        is_member: true,
        is_private: id.toUpperCase().startsWith("G"),
        is_im: false,
        is_mpim: false,
      }));
    logger?.info(`[slack-inbox] Using ${channels.length} channels from allowlist`);
  } else {
    // No allowlist - fetch all channels from API
    channels = await listBotChannels(client);
    logger?.info(`[slack-inbox] Found ${channels.length} channels`);
  }

  if (channels.length === 0) {
    return {
      success: true,
      newMessages: 0,
      totalMessages: countMessages(storeDir).unread,
      unreadCount: countMessages(storeDir).unread,
      channelsScanned: 0,
      error: "Bot is not a member of any channels. Add the bot to channels to monitor.",
    };
  }

  const messages: InboxMessage[] = [];

  // Scan each channel for mentions
  for (const channel of channels) {
    try {
      const channelMessages = await fetchChannelMessages(client, channel.id, {
        limit: 100,
        oldest: oldestTs,
      });

      // Filter for messages mentioning the configured member ID
      for (const msg of channelMessages) {
        if (messageContainsMention(msg.text, config.memberId)) {
          const type = getMessageType(channel);
          messages.push(slackMessageToInbox(msg, channel, type));
        }
      }
    } catch (err) {
      logger?.warn(
        `[slack-inbox] Failed to fetch channel ${channel.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  logger?.info(`[slack-inbox] Found ${messages.length} mentions`);

  // Dedupe by ID before storing
  const uniqueMessages = dedupeMessages(messages);

  // Store messages
  const newCount = appendMessages(storeDir, uniqueMessages);
  logger?.info(`[slack-inbox] Stored ${newCount} new messages`);

  // Update sync state
  const counts = countMessages(storeDir);
  updateSyncState(storeDir, {
    lastSyncTs: Date.now(),
    unreadCount: counts.unread,
    userId: config.memberId,
  });

  return {
    success: true,
    newMessages: newCount,
    totalMessages: counts.unread + counts.read + counts.archived,
    unreadCount: counts.unread,
    channelsScanned: channels.length,
  };
}

/**
 * Dedupe messages by ID, keeping the first occurrence.
 */
function dedupeMessages(messages: InboxMessage[]): InboxMessage[] {
  const seen = new Set<string>();
  const result: InboxMessage[] = [];

  for (const message of messages) {
    if (!seen.has(message.id)) {
      seen.add(message.id);
      result.push(message);
    }
  }

  return result;
}

/**
 * Validate the bot token by attempting to authenticate.
 */
export async function validateToken(
  token: string,
): Promise<{ valid: boolean; botUserId?: string; error?: string }> {
  try {
    const client = createSlackClient(token);
    const result = await client.auth.test();

    if (!result.ok) {
      return { valid: false, error: "Authentication failed" };
    }

    return {
      valid: true,
      botUserId: result.user_id,
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
