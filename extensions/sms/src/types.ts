/**
 * SMS Channel Types
 */

import type { ProviderName } from "./providers/index.js";

// Quick command shortcut
export type QuickCommand = {
  trigger: string;
  fullCommand: string;
  description: string;
};

// Default quick commands
export const DEFAULT_QUICK_COMMANDS: QuickCommand[] = [
  { trigger: "cal", fullCommand: "show my calendar for today", description: "View today's calendar" },
  { trigger: "todo", fullCommand: "show my todo list", description: "View todo list" },
  { trigger: "weather", fullCommand: "what's the weather today", description: "Get weather forecast" },
  { trigger: "remind", fullCommand: "set a reminder", description: "Create a reminder" },
  { trigger: "note", fullCommand: "save a note", description: "Save a quick note" },
  { trigger: "help", fullCommand: "show available commands", description: "List all quick commands" },
];

// Provider-specific configuration
export type PlivoProviderConfig = {
  authId?: string;
  authToken?: string;
  authIdFile?: string;
  authTokenFile?: string;
};

export type TwilioProviderConfig = {
  accountSid?: string;
  authToken?: string;
};

// Account configuration
export type SMSAccountConfig = {
  name?: string;
  enabled?: boolean;
  provider?: ProviderName;
  phoneNumber?: string;
  webhookUrl?: string;
  webhookPath?: string;
  webhookSecret?: string;
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
  allowFrom?: string[];
  enableQuickCommands?: boolean;
  quickCommands?: QuickCommand[];
  plivo?: PlivoProviderConfig;
  twilio?: TwilioProviderConfig;
};

// Multi-account configuration
export type SMSConfig = {
  provider?: ProviderName;
  accounts?: Record<string, SMSAccountConfig>;
  plivo?: PlivoProviderConfig;
  twilio?: TwilioProviderConfig;
} & SMSAccountConfig;

// Resolved account with required fields
export type SMSResolvedAccount = {
  provider: ProviderName;
  phoneNumber: string;
  webhookUrl?: string;
  webhookPath: string;
  webhookSecret?: string;
  dmPolicy: "pairing" | "allowlist" | "open" | "disabled";
  allowFrom: string[];
  enableQuickCommands: boolean;
  quickCommands: QuickCommand[];
  providerConfig: PlivoProviderConfig | TwilioProviderConfig;
};

// Runtime state for an SMS account
export type SMSRuntimeState = {
  provider: import("./providers/index.js").SMSProvider;
  server?: unknown; // HTTP server
  phoneNumber: string;
  webhookConfigured: boolean;
};
