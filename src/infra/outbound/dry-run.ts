/**
 * FIX-3.3: Dry-run mode for development/testing.
 * When CLAWDBOT_DRY_RUN=true, all outbound sends log but don't execute.
 */
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("outbound/dry-run");

/**
 * Check if dry-run mode is enabled via environment variable.
 * This is separate from the --dry-run CLI flag and applies globally.
 */
export function isDryRunModeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.CLAWDBOT_DRY_RUN?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

/**
 * Log a dry-run send operation.
 */
export function logDryRunSend(params: {
  channel: string;
  target: string;
  message?: string;
  mediaUrl?: string;
  source?: string;
}): void {
  const { channel, target, message, mediaUrl, source } = params;
  const preview = message
    ? message.length > 100
      ? message.slice(0, 100) + "..."
      : message
    : "(no message)";

  const parts = [
    `[dry-run] would send to ${maskTarget(target)}`,
    `channel=${channel}`,
    source ? `source=${source}` : null,
    mediaUrl ? `media=true` : null,
    `message="${preview}"`,
  ].filter(Boolean);

  log.info(parts.join(" "));
}

/**
 * Log a dry-run poll operation.
 */
export function logDryRunPoll(params: {
  channel: string;
  target: string;
  question: string;
  options: string[];
  source?: string;
}): void {
  const { channel, target, question, options, source } = params;

  const parts = [
    `[dry-run] would send poll to ${maskTarget(target)}`,
    `channel=${channel}`,
    source ? `source=${source}` : null,
    `question="${question}"`,
    `options=[${options.map((o) => `"${o}"`).join(", ")}]`,
  ].filter(Boolean);

  log.info(parts.join(" "));
}

/**
 * Mask sensitive target information for logging.
 */
function maskTarget(target: string): string {
  // For phone numbers like +16503802766, show +1650***2766
  if (/^\+\d{10,}$/.test(target)) {
    return target.slice(0, 4) + "***" + target.slice(-4);
  }
  // For WhatsApp JIDs
  const jidMatch = target.match(/^(\d+)@(.+)$/);
  if (jidMatch) {
    const [, num, domain] = jidMatch;
    if (num.length >= 8) {
      return num.slice(0, 3) + "***" + num.slice(-3) + "@" + domain;
    }
  }
  // For groups, show as-is
  if (target.includes("@g.us") || target.startsWith("group:") || target.startsWith("channel:")) {
    return target;
  }
  // Default masking
  if (target.length > 8) {
    return target.slice(0, 3) + "***" + target.slice(-3);
  }
  return target;
}
