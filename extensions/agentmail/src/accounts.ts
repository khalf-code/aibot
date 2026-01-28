import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "clawdbot/plugin-sdk";

import type {
  AgentMailConfig,
  CoreConfig,
  ResolvedAgentMailAccount,
} from "./utils.js";

/** Resolved AgentMail credentials. */
export type ResolvedAgentMailCredentials = {
  apiKey?: string;
  inboxId?: string;
};

/**
 * Resolves AgentMail credentials from config and environment.
 * Maps user-facing keys (token, emailAddress) to SDK names (apiKey, inboxId).
 */
export function resolveCredentials(
  cfg: CoreConfig,
  env: Record<string, string | undefined> = process.env
): ResolvedAgentMailCredentials {
  const base = cfg.channels?.agentmail ?? {};
  return {
    apiKey: base.token || env.AGENTMAIL_TOKEN,
    inboxId: base.emailAddress || env.AGENTMAIL_EMAIL_ADDRESS,
  };
}

/**
 * Resolves a specific AgentMail account with its configuration and status.
 */
export function resolveAgentMailAccount(params: {
  cfg: CoreConfig;
  accountId?: string | null;
}): ResolvedAgentMailAccount {
  const accountId = normalizeAccountId(params.accountId);
  const base = (params.cfg.channels?.agentmail ?? {}) as AgentMailConfig;
  const { apiKey, inboxId } = resolveCredentials(params.cfg);

  return {
    accountId,
    name: base.name?.trim() || undefined,
    enabled: base.enabled !== false,
    configured: Boolean(apiKey && inboxId),
    config: base,
    inboxId,
  };
}
