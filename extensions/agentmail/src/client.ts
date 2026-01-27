import { AgentMailClient } from "agentmail";

import { resolveCredentials } from "./accounts.js";
import { getAgentMailRuntime } from "./runtime.js";
import type { CoreConfig } from "./utils.js";

let sharedClient: AgentMailClient | null = null;
let sharedClientKey: string | null = null;

/** Creates or returns a shared AgentMailClient instance. Recreates if key changed. */
export function getAgentMailClient(apiKey?: string): AgentMailClient {
  const key = apiKey ?? getResolvedCredentials().apiKey;
  if (!key) throw new Error("AgentMail token is required");

  // Return cached client if key matches
  if (sharedClient && sharedClientKey === key) {
    return sharedClient;
  }

  // Create new client (key changed or first call)
  sharedClient = new AgentMailClient({ apiKey: key });
  sharedClientKey = key;
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

