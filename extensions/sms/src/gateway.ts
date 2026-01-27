/**
 * SMS Gateway Adapter
 * Handles channel startup, shutdown, and webhook configuration
 */

import { setAccountState, removeAccountState } from "./runtime.js";
import { startWebhookServer } from "./webhook.js";
import { PlivoProvider, MockProvider } from "./providers/index.js";
import type { SMSProvider } from "./providers/index.js";
import type { SMSResolvedAccount, SMSRuntimeState, PlivoProviderConfig } from "./types.js";

export type GatewayContext = {
  cfg: { channels?: Record<string, unknown> };
  accountId: string;
  account: SMSResolvedAccount;
  runtime: unknown;
  abortSignal?: AbortSignal;
  log: (message: string, data?: Record<string, unknown>) => void;
  getStatus: () => unknown;
  setStatus: (status: Partial<{
    running: boolean;
    connected: boolean;
    lastConnectedAt: number;
    lastError: string;
    webhookUrl: string;
  }>) => void;
  onInboundMessage?: (message: {
    from: string;
    text: string;
    accountId: string;
    channelId: string;
  }) => Promise<string | void>;
};

/**
 * Create provider instance based on configuration
 */
function createProvider(account: SMSResolvedAccount): SMSProvider {
  switch (account.provider) {
    case "plivo": {
      const config = account.providerConfig as PlivoProviderConfig;
      if (!config.authId || !config.authToken) {
        throw new Error("Plivo provider requires authId and authToken");
      }
      return new PlivoProvider({ authId: config.authId, authToken: config.authToken });
    }
    case "mock":
      return new MockProvider();
    default:
      throw new Error(`Unknown SMS provider: ${account.provider}`);
  }
}

/**
 * Start SMS account - initialize provider and webhook server
 */
export async function startAccount(ctx: GatewayContext): Promise<void> {
  const { account, accountId, log, setStatus } = ctx;

  log("Starting SMS account", { accountId, provider: account.provider, phoneNumber: account.phoneNumber });

  // Create and initialize provider
  const provider = createProvider(account);

  try {
    await provider.initialize();
    log("SMS provider initialized", { accountId, provider: account.provider });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log("Failed to initialize SMS provider", { error: errorMessage });
    setStatus({ running: false, lastError: errorMessage });
    throw new Error(`Invalid SMS credentials: ${errorMessage}`);
  }

  // Determine webhook URL
  const webhookPort = parseInt(process.env.SMS_WEBHOOK_PORT || "8787", 10);
  const webhookHost = process.env.SMS_WEBHOOK_HOST || "0.0.0.0";
  const publicUrl = account.webhookUrl || process.env.PUBLIC_URL || `http://localhost:${webhookPort}`;
  const fullWebhookUrl = `${publicUrl}${account.webhookPath}`;

  // Start webhook server
  const { server, stop } = await startWebhookServer({
    provider,
    account,
    accountId,
    path: account.webhookPath,
    port: webhookPort,
    host: webhookHost,
    onMessage: async (message) => {
      // Route to Clawdbot's message handler
      if (ctx.onInboundMessage) {
        return ctx.onInboundMessage({
          from: message.from,
          text: message.text,
          accountId,
          channelId: "sms",
        });
      }
      return undefined;
    },
    onError: (error) => {
      log("Webhook error", { error: error.message });
      setStatus({ lastError: error.message });
    },
    log,
  });

  // Auto-configure provider webhooks
  const configResult = await provider.configureWebhook({
    phoneNumber: account.phoneNumber,
    webhookUrl: fullWebhookUrl,
  });

  if (!configResult.success) {
    log("Webhook auto-configuration failed, manual setup may be required", {
      error: configResult.error,
      manualUrl: fullWebhookUrl,
    });
  }

  // Store runtime state
  const state: SMSRuntimeState = {
    provider,
    server,
    phoneNumber: account.phoneNumber,
    webhookConfigured: configResult.success,
  };
  setAccountState(accountId, state);

  // Update channel status
  setStatus({
    running: true,
    connected: true,
    lastConnectedAt: Date.now(),
    webhookUrl: fullWebhookUrl,
  });

  log("SMS account started successfully", {
    accountId,
    provider: account.provider,
    phoneNumber: account.phoneNumber,
    webhookUrl: fullWebhookUrl,
    webhookConfigured: configResult.success,
  });

  // Handle abort signal
  if (ctx.abortSignal) {
    ctx.abortSignal.addEventListener("abort", async () => {
      await stop();
      removeAccountState(accountId);
      setStatus({ running: false, connected: false });
      log("SMS account stopped via abort signal", { accountId });
    });
  }
}

/**
 * Stop SMS account
 */
export async function stopAccount(ctx: GatewayContext): Promise<void> {
  const { accountId, log, setStatus } = ctx;

  log("Stopping SMS account", { accountId });

  // Clean up runtime state
  removeAccountState(accountId);

  setStatus({ running: false, connected: false });

  log("SMS account stopped", { accountId });
}

/**
 * Gateway adapter for Clawdbot channel plugin
 */
export const gatewayAdapter = {
  startAccount,
  stopAccount,
};
