/**
 * SMS Configuration Adapter
 * Handles account configuration, credential resolution, and DM policies
 */

import { readFileSync, existsSync } from "node:fs";
import type { SMSConfig, SMSAccountConfig, SMSResolvedAccount } from "./types.js";
import { DEFAULT_QUICK_COMMANDS } from "./types.js";

const CHANNEL_ID = "sms";
const DEFAULT_WEBHOOK_PATH = "/sms";

/**
 * Get SMS config from Clawdbot config
 */
function getSMSConfig(cfg: { channels?: Record<string, unknown> }): SMSConfig | undefined {
  return cfg?.channels?.[CHANNEL_ID] as SMSConfig | undefined;
}

/**
 * Read credential from file if path provided
 */
function readCredentialFile(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  if (!existsSync(filePath)) return undefined;
  return readFileSync(filePath, "utf-8").trim();
}

/**
 * List all configured account IDs
 */
export function listAccountIds(cfg: { channels?: Record<string, unknown> }): string[] {
  const smsConfig = getSMSConfig(cfg);
  if (!smsConfig) return [];

  // Check for multi-account setup
  if (smsConfig.accounts) {
    return Object.keys(smsConfig.accounts);
  }

  // Single account (default)
  if (smsConfig.phoneNumber || smsConfig.plivo || smsConfig.twilio) {
    return ["default"];
  }

  return [];
}

/**
 * Get account configuration by ID
 */
function getAccountConfig(
  cfg: { channels?: Record<string, unknown> },
  accountId?: string
): SMSAccountConfig | undefined {
  const smsConfig = getSMSConfig(cfg);
  if (!smsConfig) return undefined;

  const id = accountId || "default";

  // Multi-account lookup
  if (smsConfig.accounts?.[id]) {
    return { ...smsConfig, ...smsConfig.accounts[id] };
  }

  // Single account (only for "default")
  if (id === "default") {
    return smsConfig;
  }

  return undefined;
}

/**
 * Resolve account configuration with defaults and credential files
 */
export function resolveAccount(
  cfg: { channels?: Record<string, unknown> },
  accountId?: string
): SMSResolvedAccount | undefined {
  const accountConfig = getAccountConfig(cfg, accountId);
  if (!accountConfig) return undefined;

  const phoneNumber = accountConfig.phoneNumber;
  if (!phoneNumber) return undefined;

  // Determine provider
  const provider = accountConfig.provider || "plivo";

  // Resolve provider-specific config
  let providerConfig: SMSResolvedAccount["providerConfig"];

  if (provider === "plivo") {
    const plivoConfig = accountConfig.plivo || {};
    const authId = plivoConfig.authId || readCredentialFile(plivoConfig.authIdFile);
    const authToken = plivoConfig.authToken || readCredentialFile(plivoConfig.authTokenFile);

    if (!authId || !authToken) return undefined;

    providerConfig = { authId, authToken };
  } else if (provider === "twilio") {
    const twilioConfig = accountConfig.twilio || {};
    if (!twilioConfig.accountSid || !twilioConfig.authToken) return undefined;

    providerConfig = twilioConfig;
  } else {
    // Mock or unknown provider
    providerConfig = {};
  }

  return {
    provider,
    phoneNumber,
    webhookUrl: accountConfig.webhookUrl,
    webhookPath: accountConfig.webhookPath || DEFAULT_WEBHOOK_PATH,
    webhookSecret: accountConfig.webhookSecret,
    dmPolicy: accountConfig.dmPolicy || "pairing",
    allowFrom: accountConfig.allowFrom || [],
    enableQuickCommands: accountConfig.enableQuickCommands ?? true,
    quickCommands: accountConfig.quickCommands || DEFAULT_QUICK_COMMANDS,
    providerConfig,
  };
}

/**
 * Check if account is configured with required credentials
 */
export function isConfigured(
  cfg: { channels?: Record<string, unknown> },
  accountId?: string
): boolean {
  return resolveAccount(cfg, accountId) !== undefined;
}

/**
 * Check if account is enabled
 */
export function isEnabled(
  cfg: { channels?: Record<string, unknown> },
  accountId?: string
): boolean {
  const accountConfig = getAccountConfig(cfg, accountId);
  return accountConfig?.enabled !== false;
}

/**
 * Get DM allowlist for account
 */
export function resolveAllowFrom(
  cfg: { channels?: Record<string, unknown> },
  accountId?: string
): string[] {
  const account = resolveAccount(cfg, accountId);
  return account?.allowFrom || [];
}

/**
 * Describe account for UI display
 */
export function describeAccount(
  cfg: { channels?: Record<string, unknown> },
  accountId?: string
): {
  configured: boolean;
  enabled: boolean;
  provider?: string;
  phoneNumber?: string;
  dmPolicy?: string;
} {
  const accountConfig = getAccountConfig(cfg, accountId);
  const resolved = resolveAccount(cfg, accountId);

  return {
    configured: resolved !== undefined,
    enabled: accountConfig?.enabled !== false,
    provider: resolved?.provider,
    phoneNumber: resolved?.phoneNumber,
    dmPolicy: resolved?.dmPolicy,
  };
}

/**
 * Config adapter for Clawdbot channel plugin
 */
export const configAdapter = {
  listAccountIds,
  resolveAccount,
  isConfigured,
  resolveAllowFrom,
  describeAccount,
};
