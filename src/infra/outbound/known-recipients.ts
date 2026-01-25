/**
 * FIX-3.1: Known recipients tracking.
 * Tracks recipients that have successfully received messages to detect first-time sends.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../../config/paths.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("outbound/known-recipients");

const KNOWN_RECIPIENTS_FILENAME = "known-recipients.json";

type KnownRecipientsData = {
  version: 1;
  recipients: Record<
    string,
    {
      channel: string;
      firstSentAt: string;
      lastSentAt: string;
      sendCount: number;
    }
  >;
};

let cachedData: KnownRecipientsData | null = null;
let lastLoadTime = 0;
const CACHE_TTL_MS = 60_000; // Reload from disk at most every minute

/**
 * Get the path to the known recipients file.
 */
function getKnownRecipientsPath(): string {
  const stateDir = resolveStateDir();
  return path.join(stateDir, KNOWN_RECIPIENTS_FILENAME);
}

/**
 * Load known recipients from disk.
 */
function loadKnownRecipients(): KnownRecipientsData {
  const now = Date.now();
  if (cachedData && now - lastLoadTime < CACHE_TTL_MS) {
    return cachedData;
  }

  const filePath = getKnownRecipientsPath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw) as KnownRecipientsData;
      if (data.version === 1 && typeof data.recipients === "object") {
        cachedData = data;
        lastLoadTime = now;
        return data;
      }
    }
  } catch (err) {
    log.warn("Failed to load known recipients", { error: String(err) });
  }

  const empty: KnownRecipientsData = { version: 1, recipients: {} };
  cachedData = empty;
  lastLoadTime = now;
  return empty;
}

/**
 * Save known recipients to disk.
 */
function saveKnownRecipients(data: KnownRecipientsData): void {
  const filePath = getKnownRecipientsPath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    cachedData = data;
    lastLoadTime = Date.now();
  } catch (err) {
    log.warn("Failed to save known recipients", { error: String(err) });
  }
}

/**
 * Normalize a recipient key for consistent storage.
 * Combines channel and target into a unique key.
 */
function normalizeRecipientKey(channel: string, target: string): string {
  // Normalize WhatsApp targets to E.164 format
  let normalizedTarget = target.trim().toLowerCase();

  // Remove @s.whatsapp.net suffix for individual chats
  if (normalizedTarget.endsWith("@s.whatsapp.net")) {
    normalizedTarget = normalizedTarget.replace(/@s\.whatsapp\.net$/, "");
    if (!normalizedTarget.startsWith("+")) {
      normalizedTarget = "+" + normalizedTarget;
    }
  }

  return `${channel.toLowerCase()}:${normalizedTarget}`;
}

/**
 * Check if a recipient is known (has received messages before).
 */
export function isKnownRecipient(channel: string, target: string): boolean {
  const data = loadKnownRecipients();
  const key = normalizeRecipientKey(channel, target);
  return key in data.recipients;
}

/**
 * Record a successful send to a recipient.
 * Returns whether this was the first-time send to this recipient.
 */
export function recordRecipient(channel: string, target: string): boolean {
  const data = loadKnownRecipients();
  const key = normalizeRecipientKey(channel, target);
  const now = new Date().toISOString();
  const isFirstTime = !(key in data.recipients);

  if (isFirstTime) {
    data.recipients[key] = {
      channel: channel.toLowerCase(),
      firstSentAt: now,
      lastSentAt: now,
      sendCount: 1,
    };
    log.info(`New recipient recorded: ${channel}:${maskRecipient(target)}`, {
      channel,
      isFirstTime: true,
    });
  } else {
    data.recipients[key].lastSentAt = now;
    data.recipients[key].sendCount += 1;
  }

  saveKnownRecipients(data);
  return isFirstTime;
}

/**
 * Mask recipient for logging (partial exposure).
 */
function maskRecipient(target: string): string {
  if (/^\+?\d{10,}/.test(target)) {
    // Phone number: show first 4 and last 4 digits
    const digits = target.replace(/\D/g, "");
    if (digits.length >= 8) {
      return (target.startsWith("+") ? "+" : "") + digits.slice(0, 3) + "***" + digits.slice(-3);
    }
  }
  if (target.includes("@g.us")) {
    // Group: show as-is (less sensitive)
    return target;
  }
  if (target.length > 8) {
    return target.slice(0, 3) + "***" + target.slice(-3);
  }
  return target;
}

/**
 * Log a warning for first-time recipient sends.
 * This provides visibility into when automation sends to new targets.
 */
export function logFirstTimeRecipient(channel: string, target: string, inAllowlist: boolean): void {
  const allowlistNote = inAllowlist ? " (in allowlist)" : " (NOT in allowlist)";
  log.warn(`[${channel}] First-time recipient: ${maskRecipient(target)}${allowlistNote}`, {
    channel,
    target: maskRecipient(target),
    inAllowlist,
    firstTime: true,
  });
}

/**
 * Get statistics about known recipients.
 */
export function getKnownRecipientsStats(): {
  total: number;
  byChannel: Record<string, number>;
} {
  const data = loadKnownRecipients();
  const stats: { total: number; byChannel: Record<string, number> } = {
    total: Object.keys(data.recipients).length,
    byChannel: {},
  };

  for (const entry of Object.values(data.recipients)) {
    stats.byChannel[entry.channel] = (stats.byChannel[entry.channel] ?? 0) + 1;
  }

  return stats;
}

/**
 * Clear the in-memory cache (for testing).
 */
export function clearKnownRecipientsCache(): void {
  cachedData = null;
  lastLoadTime = 0;
}
