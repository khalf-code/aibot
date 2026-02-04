import type { Command } from "commander";

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

type ListChannelsContext = {
  logger: Logger;
  channelAllowlist?: string[];
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

export function registerListChannelsCommand(root: Command, ctx: ListChannelsContext): void {
  const { logger, channelAllowlist, renderTable } = ctx;

  root
    .command("list-channels")
    .description("List channels configured in the allowlist")
    .action(async () => {
      if (!channelAllowlist || channelAllowlist.length === 0) {
        logger.info("No channels configured in allowlist.");
        logger.info("");
        logger.info("Without an allowlist, sync will scan ALL channels the bot has joined.");
        logger.info("");
        logger.info("To configure specific channels:");
        logger.info(
          '  openclaw config set extensions.slack-inbox.channelAllowlist \'["C01234567", "#general"]\'',
        );
        return;
      }

      const rows = channelAllowlist.map((entry) => {
        const isId = /^[CG][A-Z0-9]+$/i.test(entry);
        return {
          entry,
          type: isId ? "ID" : "name/pattern",
        };
      });

      const output = renderTable({
        columns: [
          { key: "entry", header: "Allowlist Entry", flex: true },
          { key: "type", header: "Type", minWidth: 12 },
        ],
        rows,
      });

      logger.info(`\nConfigured channel allowlist (${channelAllowlist.length} entries):\n`);
      logger.info(output);
      logger.info("");
      logger.info("To modify the allowlist:");
      logger.info(
        '  openclaw config set extensions.slack-inbox.channelAllowlist \'["C01234567", "#general"]\'',
      );
    });
}
