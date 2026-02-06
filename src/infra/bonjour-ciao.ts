import { logDebug } from "../logger.js";
import { formatBonjourError } from "./bonjour-errors.js";

/**
 * Patterns that identify non-fatal ciao/mDNS unhandled rejections.
 * These occur during normal network changes (WiFi reconnect, VPN toggle, etc.)
 * and should not crash the gateway process.
 */
const CIAO_IGNORABLE_PATTERNS = [
  "CIAO ANNOUNCEMENT CANCELLED",
  "REACHED ILLEGAL STATE",
  "ADDRESS CHANGE FROM",
  "IPV4 ADDRESS",
  "IPV6 ADDRESS",
  "UPDATED NETWORK INTERFACES",
] as const;

function isCiaoError(message: string): boolean {
  const upper = message.toUpperCase();
  return CIAO_IGNORABLE_PATTERNS.some((pattern) => upper.includes(pattern));
}

export function ignoreCiaoCancellationRejection(reason: unknown): boolean {
  const formatted = formatBonjourError(reason);
  if (!isCiaoError(formatted)) {
    return false;
  }
  logDebug(`bonjour: ignoring unhandled ciao rejection: ${formatted}`);
  return true;
}
