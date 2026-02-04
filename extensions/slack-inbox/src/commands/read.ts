import type { Command } from "commander";
import { getMessage, updateMessageStatus } from "../store/messages.js";

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

type ReadContext = {
  storeDir: string;
  logger: Logger;
};

function formatMessage(m: {
  id: string;
  type: string;
  status: string;
  senderId: string;
  senderName?: string;
  channelId: string;
  channelName?: string;
  text: string;
  permalink?: string;
  receivedAt: number;
}): string {
  const lines: string[] = [];
  const date = new Date(m.receivedAt);

  lines.push(`ID: ${m.id}`);
  lines.push(`Type: ${m.type}`);
  lines.push(`Status: ${m.status}`);
  lines.push(`From: ${m.senderName || m.senderId}`);
  lines.push(`Channel: ${m.channelName || m.channelId}`);
  lines.push(`Time: ${date.toLocaleString()}`);

  if (m.permalink) {
    lines.push(`Link: ${m.permalink}`);
  }

  lines.push("");
  lines.push("Message:");
  lines.push("─".repeat(40));
  lines.push(m.text);
  lines.push("─".repeat(40));

  return lines.join("\n");
}

export function registerReadCommand(root: Command, ctx: ReadContext): void {
  const { storeDir, logger } = ctx;

  root
    .command("read <id>")
    .description("Read a message and mark it as read")
    .option("--no-mark", "Don't mark the message as read")
    .option("--json", "Output as JSON")
    .action(async (id: string, options: { mark?: boolean; json?: boolean }) => {
      // Try to find message by partial ID match
      const message = findMessageById(storeDir, id);

      if (!message) {
        logger.error(`Message not found: ${id}`);
        logger.info("Use 'openclaw inbox list' to see available messages.");
        process.exit(1);
      }

      // Mark as read unless --no-mark
      if (options.mark !== false && message.status === "unread") {
        updateMessageStatus(storeDir, message.id, "read");
        message.status = "read";
      }

      if (options.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(message, null, 2));
        return;
      }

      // eslint-disable-next-line no-console
      console.log(formatMessage(message));
    });
}

/**
 * Find a message by ID or partial ID match.
 */
function findMessageById(storeDir: string, idQuery: string): ReturnType<typeof getMessage> {
  // Try exact match first
  let message = getMessage(storeDir, idQuery);
  if (message) {
    return message;
  }

  // Try to match by timestamp suffix
  const { loadAllMessages } = require("../store/messages.js");
  const all = loadAllMessages(storeDir);

  for (const [fullId, msg] of all) {
    // Match by last 6 chars of timestamp
    const ts = fullId.split(":")[1] || "";
    if (ts.endsWith(idQuery) || ts.slice(-6) === idQuery) {
      return msg;
    }
    // Also match full timestamp
    if (ts === idQuery) {
      return msg;
    }
  }

  return undefined;
}
