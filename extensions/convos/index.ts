import type { OpenClawConfig, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema, renderQrPngBase64 } from "openclaw/plugin-sdk";
import { convosPlugin } from "./src/channel.js";
import { getConvosRuntime, setConvosRuntime } from "./src/runtime.js";
import { setupConvosWithInvite } from "./src/setup.js";
import type { ConvosSDKClient } from "./src/sdk-client.js";

// Module-level state for setup agent (accepts join requests during setup flow)
let setupAgent: ConvosSDKClient | null = null;
let setupJoinState = { joined: false, joinerInboxId: null as string | null };
let setupCleanupTimer: ReturnType<typeof setTimeout> | null = null;

// Deferred config: stored after setup, written on convos.setup.complete
let setupResult: {
  privateKey: string;
  conversationId: string;
  env: "production" | "dev";
  accountId?: string;
} | null = null;

async function cleanupSetupAgent() {
  if (setupCleanupTimer) {
    clearTimeout(setupCleanupTimer);
    setupCleanupTimer = null;
  }
  if (setupAgent) {
    try {
      await setupAgent.stop();
    } catch {
      // Ignore cleanup errors
    }
    setupAgent = null;
  }
}

const plugin = {
  id: "convos",
  name: "Convos",
  description: "E2E encrypted messaging via XMTP",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setConvosRuntime(api.runtime);
    api.registerChannel({ plugin: convosPlugin });

    // Register convos.setup gateway method for web UI
    // Creates conversation and keeps agent running to accept join requests
    api.registerGatewayMethod("convos.setup", async ({ params, respond }) => {
      try {
        // Stop any existing setup agent first
        await cleanupSetupAgent();
        setupJoinState = { joined: false, joinerInboxId: null };

        const accountId =
          typeof (params as { accountId?: unknown }).accountId === "string"
            ? (params as { accountId?: string }).accountId
            : undefined;
        const env =
          typeof (params as { env?: unknown }).env === "string"
            ? ((params as { env?: string }).env as "production" | "dev")
            : undefined;

        const result = await setupConvosWithInvite({
          accountId,
          env,
          name:
            typeof (params as { name?: unknown }).name === "string"
              ? (params as { name?: string }).name
              : undefined,
          // Keep agent running to accept join requests
          keepRunning: true,
          onInvite: async (ctx) => {
            console.log(`[convos-setup] Join request from ${ctx.joinerInboxId}`);
            try {
              await ctx.accept();
              setupJoinState = { joined: true, joinerInboxId: ctx.joinerInboxId };
              console.log(`[convos-setup] Accepted join from ${ctx.joinerInboxId}`);
              // Don't cleanup here — wait for convos.setup.complete to save config first
            } catch (err) {
              console.error(`[convos-setup] Failed to accept join:`, err);
            }
          },
        });

        // Store the running client
        if (result.client) {
          setupAgent = result.client;
          console.log("[convos-setup] Agent kept running to accept join requests");

          // Auto-cleanup after 10 minutes if no one joins
          setupCleanupTimer = setTimeout(async () => {
            console.log("[convos-setup] Timeout - stopping setup agent");
            setupResult = null;
            await cleanupSetupAgent();
          }, 10 * 60 * 1000);
        }

        // Store result for deferred config write (convos.setup.complete)
        setupResult = {
          privateKey: result.privateKey,
          conversationId: result.conversationId,
          env: env ?? "production",
          accountId,
        };

        // Generate QR code for the invite URL
        const qrBase64 = await renderQrPngBase64(result.inviteUrl);

        respond(
          true,
          {
            inviteUrl: result.inviteUrl,
            conversationId: result.conversationId,
            qrDataUrl: `data:image/png;base64,${qrBase64}`,
          },
          undefined,
        );
      } catch (err) {
        await cleanupSetupAgent();
        respond(false, undefined, {
          code: -1,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });

    // Register convos.setup.status to check join state
    api.registerGatewayMethod("convos.setup.status", async ({ respond }) => {
      respond(
        true,
        {
          active: setupAgent !== null,
          joined: setupJoinState.joined,
          joinerInboxId: setupJoinState.joinerInboxId,
        },
        undefined,
      );
    });

    // Register convos.setup.complete to persist config after join is confirmed
    api.registerGatewayMethod("convos.setup.complete", async ({ respond }) => {
      if (!setupResult) {
        respond(false, undefined, {
          code: -1,
          message: "No active setup to complete. Run convos.setup first.",
        });
        return;
      }

      try {
        const runtime = getConvosRuntime();
        const cfg = runtime.config.loadConfig() as OpenClawConfig;

        // Ensure channels.convos section exists
        const channels = (cfg as Record<string, unknown>).channels as
          | Record<string, unknown>
          | undefined;
        if (!channels) {
          (cfg as Record<string, unknown>).channels = {};
        }
        const convosSection =
          ((cfg as Record<string, unknown>).channels as Record<string, unknown>).convos ?? {};
        const convos = convosSection as Record<string, unknown>;

        // Write the identity + conversation config
        convos.privateKey = setupResult.privateKey;
        convos.ownerConversationId = setupResult.conversationId;
        convos.env = setupResult.env;
        convos.enabled = true;

        ((cfg as Record<string, unknown>).channels as Record<string, unknown>).convos = convos;

        await runtime.config.writeConfigFile(cfg);
        console.log("[convos-setup] Config saved successfully");

        // Clean up setup agent + state
        const saved = { ...setupResult };
        setupResult = null;
        await cleanupSetupAgent();

        respond(true, { saved: true, conversationId: saved.conversationId }, undefined);
      } catch (err) {
        respond(false, undefined, {
          code: -1,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });
  },
};

export default plugin;
