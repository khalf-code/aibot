/**
 * SMS Channel Extension for Clawdbot
 *
 * This extension provides SMS/MMS messaging capabilities via various providers
 * (Plivo, Twilio, etc.), enabling universal phone-based access to your AI assistant.
 *
 * Features:
 * - Two-way SMS messaging
 * - MMS media support (images, videos, documents)
 * - Quick command shortcuts (e.g., "cal" -> "show my calendar")
 * - Auto-configuration of provider webhooks
 * - Multi-account and multi-provider support
 */

import { smsPlugin } from "./src/channel.js";
import { setSMSRuntime } from "./src/runtime.js";

// Plugin definition for Clawdbot
const plugin = {
  id: "sms",
  name: "SMS",
  description: "SMS/MMS channel - Universal phone access to your AI assistant",

  register(api: {
    runtime: unknown;
    registerChannel: (opts: { plugin: typeof smsPlugin }) => void;
  }) {
    // Store runtime reference for access in adapters
    setSMSRuntime(api.runtime);

    // Register the SMS channel
    api.registerChannel({ plugin: smsPlugin });
  },
};

export default plugin;

// Re-export types and utilities for external use
export { smsPlugin } from "./src/channel.js";
export type {
  SMSConfig,
  SMSAccountConfig,
  SMSResolvedAccount,
  QuickCommand,
} from "./src/types.js";
export type { SMSProvider, ProviderName } from "./src/providers/index.js";
export { PlivoProvider } from "./src/providers/index.js";
