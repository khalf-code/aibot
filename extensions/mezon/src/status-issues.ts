import type { OpenClawConfig } from "openclaw/plugin-sdk";

import { listMezonAccountIds, resolveMezonAccount } from "./accounts.js";

export type MezonStatusIssue = {
  level: "error" | "warning" | "info";
  message: string;
  hint?: string;
};

/**
 * Collect configuration issues for Mezon accounts.
 */
export function collectMezonStatusIssues(cfg: OpenClawConfig): MezonStatusIssue[] {
  const issues: MezonStatusIssue[] = [];
  const accountIds = listMezonAccountIds(cfg);

  for (const accountId of accountIds) {
    const account = resolveMezonAccount({ cfg, accountId });
    if (!account.enabled) continue;

    const prefix = accountIds.length > 1 ? `[${accountId}] ` : "";

    // Check required credentials
    if (!account.botId?.trim()) {
      issues.push({
        level: "error",
        message: `${prefix}Missing bot ID`,
        hint: "Set channels.mezon.botId or MEZON_BOT_ID env var",
      });
    }

    if (!account.token?.trim()) {
      issues.push({
        level: "error",
        message: `${prefix}Missing bot token`,
        hint: "Set channels.mezon.botToken or MEZON_BOT_TOKEN env var",
      });
    }

    // Check DM policy configuration
    const dmPolicy = account.config.dmPolicy ?? "pairing";
    if (dmPolicy === "open") {
      issues.push({
        level: "warning",
        message: `${prefix}DM policy is 'open' - anyone can message`,
        hint: "Use 'pairing' or 'allowlist' for better security",
      });
    }

    if (dmPolicy === "allowlist" && !account.config.allowFrom?.length) {
      issues.push({
        level: "warning",
        message: `${prefix}DM policy is 'allowlist' but allowFrom is empty`,
        hint: "Add user IDs to channels.mezon.allowFrom",
      });
    }
  }

  return issues;
}
