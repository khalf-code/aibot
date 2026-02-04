import type { Command } from "commander";
import type { SlackInboxConfig } from "../config.js";
import { runSync } from "../sync.js";

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

type SyncContext = {
  config: SlackInboxConfig;
  storeDir: string;
  logger: Logger;
};

export function registerSyncCommand(root: Command, ctx: SyncContext): void {
  const { config, storeDir, logger } = ctx;

  root
    .command("sync")
    .description("Sync messages from Slack")
    .option("--json", "Output result as JSON")
    .action(async (options: { json?: boolean }) => {
      if (!config.botToken) {
        logger.error("No Slack bot token configured.");
        logger.info(
          "Configure Slack channel first: openclaw config set channels.slack.botToken <xoxb-...>",
        );
        process.exit(1);
      }

      if (!config.memberId) {
        logger.error("No member ID configured.");
        logger.info("Run 'openclaw inbox setup --member-id <U...>' first.");
        process.exit(1);
      }

      const result = await runSync({ config, storeDir, logger });

      if (options.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (!result.success) {
        logger.error(`Sync failed: ${result.error}`);
        process.exit(1);
      }

      logger.info(`Sync complete:`);
      logger.info(`  Channels scanned: ${result.channelsScanned}`);
      logger.info(`  New messages: ${result.newMessages}`);
      logger.info(`  Unread: ${result.unreadCount}`);
      logger.info(`  Total: ${result.totalMessages}`);
    });
}
