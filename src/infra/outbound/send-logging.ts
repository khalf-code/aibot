/**
 * FIX-2.2: Request logging for outbound sends.
 * Provides structured logging for all send operations with full request context.
 */
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("outbound/send");

export type SendLogContext = {
  source: "cli" | "rpc" | "session" | "sub-agent" | "tool" | "unknown";
  sessionKey?: string;
  channel: string;
  target: string;
  resolvedTarget?: string;
  resolvedFrom: "explicit" | "session" | "fallback" | "allowlist" | "directory";
  accountId?: string;
  callerIdentity?: string;
  dryRun?: boolean;
  firstTimeRecipient?: boolean;
};

/**
 * Format a send log context into a structured log line.
 */
export function formatSendLogLine(ctx: SendLogContext): string {
  const parts = [
    `source=${ctx.source}`,
    ctx.sessionKey ? `sessionKey=${ctx.sessionKey}` : null,
    `channel=${ctx.channel}`,
    `target=${maskTarget(ctx.target)}`,
    ctx.resolvedTarget && ctx.resolvedTarget !== ctx.target
      ? `resolvedTarget=${maskTarget(ctx.resolvedTarget)}`
      : null,
    `resolvedFrom=${ctx.resolvedFrom}`,
    ctx.accountId ? `accountId=${ctx.accountId}` : null,
    ctx.callerIdentity ? `caller=${ctx.callerIdentity}` : null,
    ctx.dryRun ? "dryRun=true" : null,
    ctx.firstTimeRecipient ? "firstTime=true" : null,
  ].filter(Boolean);
  return parts.join(" ");
}

/**
 * Mask sensitive parts of a target (phone numbers, emails) for logging.
 * Keeps enough info to identify the target without full exposure.
 */
function maskTarget(target: string): string {
  // For group IDs, show as-is (less sensitive) - check this FIRST
  if (target.includes("@g.us") || target.startsWith("group:") || target.startsWith("channel:")) {
    return target;
  }
  // For phone numbers like +16503802766, show +1650***2766
  if (/^\+\d{10,}$/.test(target)) {
    return target.slice(0, 4) + "***" + target.slice(-4);
  }
  // For WhatsApp JIDs like 16503802766@s.whatsapp.net (individual chats)
  const jidMatch = target.match(/^(\d+)@(.+)$/);
  if (jidMatch) {
    const [, num, domain] = jidMatch;
    if (num.length >= 8) {
      return num.slice(0, 3) + "***" + num.slice(-3) + "@" + domain;
    }
  }
  // For email-like targets
  if (target.includes("@") && !target.includes("whatsapp")) {
    const [local, domain] = target.split("@");
    if (local.length > 3) {
      return local.slice(0, 2) + "***@" + domain;
    }
  }
  // Default: mask middle if long enough
  if (target.length > 8) {
    return target.slice(0, 3) + "***" + target.slice(-3);
  }
  return target;
}

/**
 * Log a send request with full context.
 */
export function logSendRequest(ctx: SendLogContext): void {
  const line = formatSendLogLine(ctx);
  if (ctx.firstTimeRecipient) {
    log.warn(`[send] ${line}`);
  } else if (ctx.dryRun) {
    log.info(`[dry-run] ${line}`);
  } else {
    log.info(`[send] ${line}`);
  }
}

/**
 * Determine the source of a send request based on context.
 */
export function inferSendSource(params: {
  sessionKey?: string;
  isSubagent?: boolean;
  isRpc?: boolean;
  isCli?: boolean;
  isTool?: boolean;
}): SendLogContext["source"] {
  if (params.isSubagent) return "sub-agent";
  if (params.isTool) return "tool";
  if (params.isRpc) return "rpc";
  if (params.isCli) return "cli";
  if (params.sessionKey) return "session";
  return "unknown";
}
