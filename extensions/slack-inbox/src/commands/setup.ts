import type { Command } from "commander";
import { validateToken } from "../sync.js";

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

type SetupContext = {
  logger: Logger;
  botToken?: string;
  saveMemberId: (memberId: string) => Promise<void>;
};

export function registerSetupCommand(root: Command, ctx: SetupContext): void {
  const { logger, botToken, saveMemberId } = ctx;

  root
    .command("setup")
    .description("Configure your member ID for inbox monitoring (uses channels.slack.botToken)")
    .requiredOption(
      "-m, --member-id <id>",
      "Your Slack member ID to watch for mentions (e.g., U02T6CMF0)",
    )
    .action(async (options: { memberId: string }) => {
      const memberId = options.memberId.trim().toUpperCase();

      if (!botToken) {
        logger.error("No Slack bot token configured.");
        logger.info(
          "Configure Slack channel first: openclaw config set channels.slack.botToken <xoxb-...>",
        );
        process.exit(1);
      }

      if (!memberId.startsWith("U")) {
        logger.error("Invalid member ID format. Slack user IDs start with U");
        logger.info("Find your member ID: Click your profile → ⋮ → Copy member ID");
        process.exit(1);
      }

      logger.info("Validating bot token from channels.slack...");
      const result = await validateToken(botToken);

      if (!result.valid) {
        logger.error(`Token validation failed: ${result.error}`);
        process.exit(1);
      }

      logger.info(`Bot token valid. Bot user ID: ${result.botUserId}`);
      logger.info(`Will monitor mentions of: ${memberId}`);

      try {
        await saveMemberId(memberId);
        logger.info("Configuration saved successfully.");
        logger.info("");
        logger.info("Required bot scopes:");
        logger.info("  - channels:history (read public channel messages)");
        logger.info("  - channels:read (list channels)");
        logger.info("  - groups:history (read private channel messages, optional)");
        logger.info("  - groups:read (list private channels, optional)");
        logger.info("");
        logger.info("Add the bot to channels you want to monitor, then run:");
        logger.info("  openclaw inbox sync");
      } catch (err) {
        logger.error(`Failed to save config: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
