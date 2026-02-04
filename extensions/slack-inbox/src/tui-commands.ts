import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { SlackInboxConfig } from "./config.js";
import type { InboxMessage, InboxMessageStatus } from "./types.js";
import {
  loadMessages,
  getMessage,
  updateMessageStatus,
  countMessages,
  loadAllMessages,
} from "./store/messages.js";
import { runSync } from "./sync.js";

type TuiCommandContext = {
  api: OpenClawPluginApi;
  config: SlackInboxConfig;
  storeDir: string;
};

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  return str.slice(0, maxLen - 1) + "…";
}

function statusIcon(status: InboxMessageStatus): string {
  switch (status) {
    case "unread":
      return "●";
    case "read":
      return "○";
    case "archived":
      return "◌";
  }
}

function formatInboxTable(messages: InboxMessage[]): string {
  if (messages.length === 0) {
    return "No messages in inbox.";
  }

  const lines: string[] = [];
  lines.push("| St | ID     | Type    | From           | Preview");
  lines.push("|----+--------+---------+----------------+--------------------");

  for (const m of messages) {
    const st = statusIcon(m.status);
    const id = m.id.split(":")[1]?.slice(-6) || m.id.slice(-6);
    const type = m.type.padEnd(7);
    const from = truncate(m.senderName || m.senderId, 14).padEnd(14);
    const preview = truncate(m.text.replace(/\n/g, " "), 40);
    lines.push(`| ${st}  | ${id} | ${type} | ${from} | ${preview}`);
  }

  return lines.join("\n");
}

function formatMessageDetail(m: InboxMessage): string {
  const date = new Date(m.receivedAt);
  const lines: string[] = [];

  lines.push(`**ID:** ${m.id}`);
  lines.push(`**Type:** ${m.type}`);
  lines.push(`**Status:** ${m.status}`);
  lines.push(`**From:** ${m.senderName || m.senderId}`);
  lines.push(`**Channel:** ${m.channelName || m.channelId}`);
  lines.push(`**Time:** ${date.toLocaleString()}`);

  if (m.permalink) {
    lines.push(`**Link:** ${m.permalink}`);
  }

  lines.push("");
  lines.push("---");
  lines.push(m.text);
  lines.push("---");

  return lines.join("\n");
}

/**
 * Find a message by ID or partial ID match.
 */
function findMessageById(storeDir: string, idQuery: string): InboxMessage | undefined {
  // Try exact match first
  let message = getMessage(storeDir, idQuery);
  if (message) {
    return message;
  }

  // Try to match by timestamp suffix
  const all = loadAllMessages(storeDir);

  for (const [fullId, msg] of all) {
    const ts = fullId.split(":")[1] || "";
    if (ts.endsWith(idQuery) || ts.slice(-6) === idQuery) {
      return msg;
    }
    if (ts === idQuery) {
      return msg;
    }
  }

  return undefined;
}

export function registerTuiCommands(ctx: TuiCommandContext): void {
  const { api, config, storeDir } = ctx;

  // /inbox - List unread messages
  api.registerCommand({
    name: "inbox",
    description: "List unread Slack inbox messages",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (cmdCtx) => {
      const args = cmdCtx.args?.trim() || "";
      let status: InboxMessageStatus | undefined = "unread";
      let limit = 10;

      // Parse args: /inbox [status] [limit]
      const parts = args.split(/\s+/).filter(Boolean);
      for (const part of parts) {
        if (["unread", "read", "archived", "all"].includes(part)) {
          status = part === "all" ? undefined : (part as InboxMessageStatus);
        } else if (/^\d+$/.test(part)) {
          limit = Math.min(50, Math.max(1, parseInt(part, 10)));
        }
      }

      const messages = loadMessages(storeDir, { status, limit });
      const counts = countMessages(storeDir);

      let text = formatInboxTable(messages);
      text += `\n\n📬 Unread: ${counts.unread} | Read: ${counts.read} | Archived: ${counts.archived}`;

      return { text };
    },
  });

  // /inbox-sync - Sync messages from Slack
  api.registerCommand({
    name: "inbox-sync",
    description: "Sync messages from Slack",
    acceptsArgs: false,
    requireAuth: true,
    handler: async () => {
      if (!config.botToken || !config.memberId) {
        return {
          text: "❌ Not configured.\nRun `openclaw inbox setup --token <xoxb-...> --member-id <U...>` to configure.",
        };
      }

      const result = await runSync({
        config,
        storeDir,
        logger: api.logger,
      });

      if (!result.success) {
        return { text: `❌ Sync failed: ${result.error}` };
      }

      return {
        text: `✅ Sync complete!\n📊 Channels: ${result.channelsScanned} | New: ${result.newMessages} | Unread: ${result.unreadCount}`,
      };
    },
  });

  // /inbox-read <id> - Read a message
  api.registerCommand({
    name: "inbox-read",
    description: "Read a Slack inbox message",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (cmdCtx) => {
      const id = cmdCtx.args?.trim();
      if (!id) {
        return { text: "Usage: /inbox-read <message-id>" };
      }

      const message = findMessageById(storeDir, id);
      if (!message) {
        return { text: `❌ Message not found: ${id}` };
      }

      // Mark as read
      if (message.status === "unread") {
        updateMessageStatus(storeDir, message.id, "read");
        message.status = "read";
      }

      return { text: formatMessageDetail(message) };
    },
  });

  // /inbox-archive <id> - Archive a message
  api.registerCommand({
    name: "inbox-archive",
    description: "Archive a Slack inbox message",
    acceptsArgs: true,
    requireAuth: true,
    handler: async (cmdCtx) => {
      const id = cmdCtx.args?.trim();
      if (!id) {
        return { text: "Usage: /inbox-archive <message-id>" };
      }

      const message = findMessageById(storeDir, id);
      if (!message) {
        return { text: `❌ Message not found: ${id}` };
      }

      if (message.status === "archived") {
        return { text: `Message ${id} is already archived.` };
      }

      updateMessageStatus(storeDir, message.id, "archived");

      return { text: `✅ Archived message: ${message.id}` };
    },
  });
}
