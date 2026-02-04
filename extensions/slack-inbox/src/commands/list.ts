import type { Command } from "commander";
import type { InboxMessageStatus } from "../types.js";
import { loadMessages, countMessages } from "../store/messages.js";

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

type ListContext = {
  storeDir: string;
  logger: Logger;
  renderTable: (opts: {
    columns: Array<{
      key: string;
      header: string;
      align?: "left" | "right" | "center";
      minWidth?: number;
      maxWidth?: number;
      flex?: boolean;
    }>;
    rows: Array<Record<string, string>>;
    width?: number;
  }) => string;
};

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  return str.slice(0, maxLen - 1) + "…";
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

export function registerListCommand(root: Command, ctx: ListContext): void {
  const { storeDir, logger, renderTable } = ctx;

  root
    .command("list")
    .description("List inbox messages")
    .option("-s, --status <status>", "Filter by status (unread, read, archived)")
    .option("-l, --limit <n>", "Maximum messages to show", "20")
    .option("--json", "Output as JSON")
    .option("--count", "Show only message counts")
    .action(
      async (options: { status?: string; limit?: string; json?: boolean; count?: boolean }) => {
        const limit = Math.max(1, Math.min(100, Number(options.limit ?? 20)));

        if (options.count) {
          const counts = countMessages(storeDir);
          if (options.json) {
            // eslint-disable-next-line no-console
            console.log(JSON.stringify(counts, null, 2));
          } else {
            logger.info(`Unread: ${counts.unread}`);
            logger.info(`Read: ${counts.read}`);
            logger.info(`Archived: ${counts.archived}`);
          }
          return;
        }

        const status = options.status as InboxMessageStatus | undefined;
        if (status && !["unread", "read", "archived"].includes(status)) {
          logger.error("Invalid status. Use: unread, read, or archived");
          process.exit(1);
        }

        const messages = loadMessages(storeDir, { status, limit });

        if (options.json) {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(messages, null, 2));
          return;
        }

        if (messages.length === 0) {
          logger.info(status ? `No ${status} messages.` : "No messages in inbox.");
          return;
        }

        const termWidth = process.stdout.columns || 80;
        const rows = messages.map((m) => ({
          status: statusIcon(m.status),
          id: m.id.split(":")[1]?.slice(-6) || m.id.slice(-6),
          type: m.type,
          from: truncate(m.senderName || m.senderId, 15),
          channel: truncate(m.channelName || m.channelId, 12),
          time: formatTimestamp(m.receivedAt),
          preview: truncate(m.text.replace(/\n/g, " "), 40),
        }));

        const output = renderTable({
          columns: [
            { key: "status", header: "", minWidth: 1, maxWidth: 1 },
            { key: "id", header: "ID", minWidth: 6, maxWidth: 8 },
            { key: "type", header: "Type", minWidth: 4, maxWidth: 7 },
            { key: "from", header: "From", minWidth: 8, maxWidth: 16 },
            { key: "channel", header: "Channel", minWidth: 8, maxWidth: 14 },
            { key: "time", header: "Time", minWidth: 8, maxWidth: 10 },
            { key: "preview", header: "Preview", flex: true, minWidth: 10 },
          ],
          rows,
          width: termWidth,
        });

        // eslint-disable-next-line no-console
        console.log(output);
      },
    );
}
