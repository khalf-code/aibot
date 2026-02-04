import type { Command } from "commander";
import { getMessage, updateMessageStatus, loadAllMessages } from "../store/messages.js";

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

type ArchiveContext = {
  storeDir: string;
  logger: Logger;
};

export function registerArchiveCommand(root: Command, ctx: ArchiveContext): void {
  const { storeDir, logger } = ctx;

  root
    .command("archive <id>")
    .description("Archive a message")
    .option("--json", "Output as JSON")
    .action(async (id: string, options: { json?: boolean }) => {
      // Try to find message by partial ID match
      const message = findMessageById(storeDir, id);

      if (!message) {
        logger.error(`Message not found: ${id}`);
        logger.info("Use 'openclaw inbox list' to see available messages.");
        process.exit(1);
      }

      if (message.status === "archived") {
        logger.info(`Message ${id} is already archived.`);
        return;
      }

      const updated = updateMessageStatus(storeDir, message.id, "archived");

      if (options.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(updated, null, 2));
        return;
      }

      logger.info(`Archived message: ${message.id}`);
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
