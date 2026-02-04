import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerSlackInboxCli } from "./src/cli.js";
import {
  parseSlackInboxConfig,
  validateSlackInboxConfig,
  type SlackInboxConfig,
} from "./src/config.js";
import { registerTuiCommands } from "./src/tui-commands.js";

// Lazy-loaded renderTable to avoid bundling issues
let renderTableFn:
  | ((opts: {
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
    }) => string)
  | null = null;

function resolveStoreDir(accountId: string): string {
  return path.join(os.homedir(), ".openclaw", "inbox", "slack", accountId);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const slackInboxConfigSchema = {
  parse(value: unknown): SlackInboxConfig {
    return parseSlackInboxConfig(value);
  },
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      enabled: { type: "boolean" },
      botToken: { type: "string" },
      memberId: { type: "string" },
      accountId: { type: "string" },
      autoSyncIntervalMin: { type: "number" },
      channelAllowlist: { type: "array", items: { type: "string" } },
    },
  },
  uiHints: {
    enabled: { label: "Enable Plugin" },
    memberId: {
      label: "Your Member ID",
      help: "Your Slack user ID to watch for mentions (e.g., U02T6CMF0)",
    },
    accountId: {
      label: "Account ID",
      help: "Identifier for multi-workspace support",
    },
    autoSyncIntervalMin: {
      label: "Auto-sync Interval (min)",
      help: "0 = disabled",
      advanced: true,
    },
    channelAllowlist: {
      label: "Channel Allowlist",
      help: "Channels to monitor (IDs or names). Empty = all channels. Use 'openclaw inbox list-channels' to see available channels.",
      advanced: true,
    },
  },
};

const slackInboxPlugin = {
  id: "slack-inbox",
  name: "Slack Inbox",
  description: "Monitor Slack DMs and @mentions",
  configSchema: slackInboxConfigSchema,

  register(api) {
    const pluginConfig = slackInboxConfigSchema.parse(api.pluginConfig);

    // Use channels.slack config for botToken (shared with slack channel)
    const slackChannelConfig = (api.config as { channels?: { slack?: { botToken?: string } } })
      .channels?.slack;

    const storeDir = resolveStoreDir(pluginConfig.accountId);
    ensureDir(storeDir);

    const config: SlackInboxConfig = {
      ...pluginConfig,
      botToken: slackChannelConfig?.botToken ?? pluginConfig.botToken,
    };

    const validation = validateSlackInboxConfig(config);

    if (config.enabled && !validation.valid) {
      for (const error of validation.errors) {
        api.logger.warn(`[slack-inbox] ${error}`);
      }
    }

    // Register CLI commands (must be synchronous - async registrars don't work)
    api.registerCli(
      ({ program, logger }) => {
        // Lazily resolve renderTable when commands actually run
        const lazyRenderTable = (opts: Parameters<typeof renderTableFn>[0]) => {
          if (!renderTableFn) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const mod = require("openclaw/terminal");
              renderTableFn = mod.renderTable;
            } catch {
              // Fallback simple table renderer
              renderTableFn = (o) => {
                const header = o.columns.map((c) => c.header).join(" | ");
                const rows = o.rows.map((r) => o.columns.map((c) => r[c.key] ?? "").join(" | "));
                return [header, ...rows].join("\n");
              };
            }
          }
          return renderTableFn!(opts);
        };

        registerSlackInboxCli({
          program,
          config,
          storeDir,
          logger,
          renderTable: lazyRenderTable,
          saveMemberId: async (memberId: string) => {
            // Save memberId directly to plugin config via CLI
            try {
              execFileSync(
                "openclaw",
                ["config", "set", "plugins.entries.slack-inbox.config.memberId", memberId],
                { stdio: "inherit" },
              );
            } catch {
              api.logger.error(`[slack-inbox] Failed to save config via CLI`);
              throw new Error("Failed to save member ID to config");
            }
          },
        });
      },
      { commands: ["inbox"] },
    );

    // Register TUI slash commands
    registerTuiCommands({
      api,
      config,
      storeDir,
    });
  },
};

export default slackInboxPlugin;
