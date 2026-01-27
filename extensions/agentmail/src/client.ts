import { AgentMailClient } from "agentmail";

import { resolveCredentials } from "./accounts.js";
import { getAgentMailRuntime } from "./runtime.js";
import type { CoreConfig } from "./utils.js";

let sharedClient: AgentMailClient | null = null;

/** Creates or returns a shared AgentMailClient instance. */
export function getAgentMailClient(apiKey?: string): AgentMailClient {
  if (sharedClient) return sharedClient;

  const key = apiKey ?? getResolvedCredentials().apiKey;
  if (!key) throw new Error("AgentMail token is required");

  sharedClient = new AgentMailClient({ apiKey: key });
  return sharedClient;
}

/** Resolves credentials from current config. */
export function getResolvedCredentials() {
  return resolveCredentials(getAgentMailRuntime().config.loadConfig() as CoreConfig);
}

/** Returns client and inboxId, or throws if not configured. */
export function getClientAndInbox(): { client: AgentMailClient; inboxId: string } {
  const { apiKey, inboxId } = getResolvedCredentials();
  if (!apiKey || !inboxId) throw new Error("AgentMail not configured (missing token or email address)");
  return { client: getAgentMailClient(apiKey), inboxId };
}

