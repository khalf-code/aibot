import type { Command } from "commander";
import type { SlackInboxConfig } from "./config.js";
import { registerArchiveCommand } from "./commands/archive.js";
import { registerListChannelsCommand } from "./commands/list-channels.js";
import { registerListCommand } from "./commands/list.js";
import { registerReadCommand } from "./commands/read.js";
import { registerSetupCommand } from "./commands/setup.js";
import { registerSyncCommand } from "./commands/sync.js";

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

type CliContext = {
  program: Command;
  config: SlackInboxConfig;
  storeDir: string;
  logger: Logger;
  saveMemberId: (memberId: string) => Promise<void>;
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

export function registerSlackInboxCli(ctx: CliContext): void {
  const { program, config, storeDir, logger, saveMemberId, renderTable } = ctx;

  const root = program
    .command("inbox")
    .description("Slack inbox management")
    .addHelpText("after", () => "\nDocs: https://docs.openclaw.ai/cli/inbox\n");

  registerSetupCommand(root, { logger, botToken: config.botToken, saveMemberId });
  registerSyncCommand(root, { config, storeDir, logger });
  registerListCommand(root, { storeDir, logger, renderTable });
  registerListChannelsCommand(root, {
    logger,
    channelAllowlist: config.channelAllowlist,
    renderTable,
  });
  registerReadCommand(root, { storeDir, logger });
  registerArchiveCommand(root, { storeDir, logger });
}
