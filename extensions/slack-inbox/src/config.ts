import { z } from "zod";

export const SlackInboxConfigSchema = z.object({
  /** Enable/disable the plugin */
  enabled: z.boolean().default(true),
  /** Slack bot token (xoxb-...) */
  botToken: z.string().optional(),
  /** Your Slack member ID to watch for mentions (e.g., U02T6CMF0) */
  memberId: z.string().optional(),
  /** Account identifier for multi-workspace support */
  accountId: z.string().default("default"),
  /** Auto-sync interval in minutes (0 = disabled) */
  autoSyncIntervalMin: z.number().default(0),
  /** Allowlist of channels to monitor (IDs or names). Empty = all channels. */
  channelAllowlist: z.array(z.string()).default([]),
});

export type SlackInboxConfig = z.infer<typeof SlackInboxConfigSchema>;

export function parseSlackInboxConfig(value: unknown): SlackInboxConfig {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return SlackInboxConfigSchema.parse({
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
    botToken: typeof raw.botToken === "string" ? raw.botToken : undefined,
    memberId: typeof raw.memberId === "string" ? raw.memberId : undefined,
    accountId: typeof raw.accountId === "string" ? raw.accountId : "default",
    autoSyncIntervalMin: typeof raw.autoSyncIntervalMin === "number" ? raw.autoSyncIntervalMin : 0,
    channelAllowlist: Array.isArray(raw.channelAllowlist) ? raw.channelAllowlist : [],
  });
}

export function validateSlackInboxConfig(config: SlackInboxConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.enabled && !config.botToken) {
    errors.push("channels.slack.botToken is required (configure Slack channel first)");
  }

  if (config.botToken && !config.botToken.startsWith("xoxb-")) {
    errors.push("channels.slack.botToken must be a Slack bot token (xoxb-...)");
  }

  if (config.enabled && !config.memberId) {
    errors.push("memberId is required (your Slack user ID to watch for mentions)");
  }

  if (config.memberId && !config.memberId.startsWith("U")) {
    errors.push("memberId should be a Slack user ID starting with U (e.g., U02T6CMF0)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
