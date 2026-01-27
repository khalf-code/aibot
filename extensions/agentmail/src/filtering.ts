import type { AgentMailClient } from "agentmail";

import type { AgentMailConfig, FilterResult } from "./utils.js";

/**
 * Checks if a sender email matches any entry in a list.
 * Entries can be exact email addresses or domains.
 */
export function matchesList(senderEmail: string, list: string[]): boolean {
  if (!list || list.length === 0) return false;

  const normalizedSender = senderEmail.toLowerCase().trim();
  const domain = normalizedSender.split("@")[1];

  return list.some((entry) => {
    const normalizedEntry = entry.toLowerCase().trim();
    return (
      normalizedEntry === normalizedSender || // exact email match
      normalizedEntry === domain || // exact domain match
      normalizedSender.endsWith(`@${normalizedEntry}`) // domain suffix match
    );
  });
}

/**
 * Determines the filter result for a sender based on allowlist/blocklist.
 *
 * Logic:
 * 1. If sender is on blocklist → blocked
 * 2. If sender is on allowlist → allowed
 * 3. If allowlist is empty and not blocked → allowed (open mode)
 * 4. If allowlist is non-empty and sender not on it → not allowed
 */
export function checkSenderFilter(
  senderEmail: string,
  config: Pick<AgentMailConfig, "allowlist" | "blocklist">,
): FilterResult {
  const { allowlist = [], blocklist = [] } = config;

  // Check blocklist first
  if (matchesList(senderEmail, blocklist)) {
    return { allowed: false, blocked: true, label: "blocked" };
  }

  // Check allowlist
  if (allowlist.length === 0) {
    // Open mode: all non-blocked senders are allowed
    return { allowed: true, blocked: false, label: "allowed" };
  }

  if (matchesList(senderEmail, allowlist)) {
    return { allowed: true, blocked: false, label: "allowed" };
  }

  // Not on allowlist and allowlist is non-empty
  return { allowed: false, blocked: false, label: null };
}

/**
 * Labels a message via the AgentMail API.
 */
export async function labelMessage(
  client: AgentMailClient,
  inboxId: string,
  messageId: string,
  label: "allowed" | "blocked",
): Promise<void> {
  await client.inboxes.messages.update(inboxId, messageId, {
    addLabels: [label],
  });
}

/**
 * Processes an incoming message and applies filtering.
 * Returns the filter result and labels the message if needed.
 */
export async function filterAndLabelMessage(
  client: AgentMailClient,
  inboxId: string,
  messageId: string,
  senderEmail: string,
  config: Pick<AgentMailConfig, "allowlist" | "blocklist">,
): Promise<FilterResult> {
  const result = checkSenderFilter(senderEmail, config);

  if (result.label) {
    await labelMessage(client, inboxId, messageId, result.label);
  }

  return result;
}
