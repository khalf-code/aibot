import type { MoltbotConfig } from "../../../config/config.js";
import type { DmPolicy } from "../../../config/types.js";
import { DEFAULT_ACCOUNT_ID } from "../../../routing/session-key.js";
import { resolveZoomAccount, type ZoomConfig } from "../../../zoom/config.js";
import { formatDocsLink } from "../../../terminal/links.js";
import type { WizardPrompter } from "../../../wizard/prompts.js";
import type { ChannelOnboardingAdapter, ChannelOnboardingDmPolicy } from "../onboarding-types.js";
import { addWildcardAllowFrom } from "./helpers.js";

const channel = "zoom" as const;

function setZoomDmPolicy(cfg: MoltbotConfig, dmPolicy: DmPolicy) {
  const zoomConfig = (cfg.channels as any)?.zoom as ZoomConfig | undefined;
  const allowFrom =
    dmPolicy === "open" ? addWildcardAllowFrom(zoomConfig?.dm?.allowFrom) : undefined;
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      zoom: {
        ...zoomConfig,
        dm: {
          ...zoomConfig?.dm,
          policy: dmPolicy,
          ...(allowFrom ? { allowFrom } : {}),
        },
      },
    },
  };
}

async function noteZoomHelp(prompter: WizardPrompter): Promise<void> {
  await prompter.note(
    [
      "1) Go to Zoom App Marketplace (marketplace.zoom.us/develop/create)",
      "2) Create a General App",
      "3) Production tab: add OAuth Redirect URL",
      "4) Features tab > Surfaces > Team Chat: enable subscription + bot endpoint",
      "5) Copy Client ID, Client Secret, Bot JID, Secret Token",
      `Docs: ${formatDocsLink("/channels/zoom")}`,
      "Website: https://molt.bot",
    ].join("\n"),
    "Zoom setup",
  );
}

const dmPolicy: ChannelOnboardingDmPolicy = {
  label: "Zoom",
  channel,
  policyKey: "channels.zoom.dm.policy",
  allowFromKey: "channels.zoom.dm.allowFrom",
  getCurrent: (cfg) => {
    const zoomConfig = (cfg.channels as any)?.zoom as ZoomConfig | undefined;
    return zoomConfig?.dm?.policy ?? "pairing";
  },
  setPolicy: (cfg, policy) => setZoomDmPolicy(cfg, policy),
};

export const zoomOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const account = resolveZoomAccount({
      cfg,
      accountId: DEFAULT_ACCOUNT_ID,
    });
    const configured = Boolean(
      account.clientId?.trim() &&
      account.clientSecret?.trim() &&
      account.botJid?.trim() &&
      account.secretToken?.trim(),
    );
    return {
      channel,
      configured,
      statusLines: [`Zoom: ${configured ? "configured" : "not configured"}`],
      selectionHint: configured ? "configured" : "not configured",
      quickstartScore: configured ? 2 : 3,
    };
  },
  configure: async ({ cfg, prompter }) => {
    const zoomConfig = (cfg.channels as any)?.zoom as ZoomConfig | undefined;
    let next = cfg;

    await noteZoomHelp(prompter);

    const clientId = String(
      await prompter.text({
        message: "Zoom Client ID",
        placeholder: "lfcOyplW...",
        validate: (value) => {
          const trimmed = String(value ?? "").trim();
          return trimmed ? undefined : "Client ID is required";
        },
      }),
    ).trim();

    const clientSecret = String(
      await prompter.text({
        message: "Zoom Client Secret",
        placeholder: "rm48DW7m...",
        validate: (value) => {
          const trimmed = String(value ?? "").trim();
          return trimmed ? undefined : "Client Secret is required";
        },
      }),
    ).trim();

    const botJid = String(
      await prompter.text({
        message: "Zoom Bot JID",
        placeholder: "bot@xmpp.zoom.us",
        validate: (value) => {
          const str = String(value ?? "").trim();
          return str.includes("@xmpp")
            ? undefined
            : "Bot JID should contain @xmpp.zoom.us or @xmppdev.zoom.us";
        },
      }),
    ).trim();

    const secretToken = String(
      await prompter.text({
        message: "Zoom Secret Token",
        placeholder: "kVJhHKxo...",
        validate: (value) => {
          const trimmed = String(value ?? "").trim();
          return trimmed ? undefined : "Secret Token is required";
        },
      }),
    ).trim();

    // Prompt for OAuth Redirect URI
    await prompter.note(
      [
        "OAuth Redirect URL is the public URL where Zoom will redirect after installation.",
        "",
        "Examples:",
        "- Local dev: https://abc123.ngrok.io/api/zoomapp/auth (use ngrok http 3001)",
        "- Production: https://yourdomain.com/api/zoomapp/auth",
        "",
        "This MUST exactly match the OAuth Redirect URL configured in your Zoom app.",
      ].join("\n"),
      "OAuth Redirect URL",
    );

    const redirectUri = String(
      await prompter.text({
        message: "OAuth Redirect URL",
        placeholder: "https://yourdomain.com/api/zoomapp/auth",
        validate: (value) => {
          const trimmed = String(value ?? "").trim();
          if (!trimmed) return "OAuth Redirect URL is required";
          try {
            const url = new URL(trimmed);
            if (!url.protocol.startsWith("http")) {
              return "URL must start with http:// or https://";
            }
            if (!trimmed.endsWith("/api/zoomapp/auth")) {
              return "URL should end with /api/zoomapp/auth";
            }
            return undefined;
          } catch {
            return "Invalid URL format";
          }
        },
      }),
    ).trim();

    // Determine environment from Bot JID
    const isDev = botJid.includes("@xmppdev");
    const apiHost = isDev ? "https://zoomdev.us" : "https://api.zoom.us";
    const oauthHost = isDev ? "https://zoomdev.us" : "https://zoom.us";

    next = {
      ...next,
      channels: {
        ...next.channels,
        zoom: {
          ...zoomConfig,
          enabled: true,
          clientId,
          clientSecret,
          botJid,
          secretToken,
          redirectUri,
          apiHost,
          oauthHost,
        },
      },
    };

    // Show URL configuration instructions
    const gatewayHost = redirectUri.replace(/\/api\/zoomapp\/auth$/, "");
    await prompter.note(
      [
        "IMPORTANT: Configure these URLs in your Zoom app:",
        "",
        "Webhook URL (for receiving messages):",
        `  ${gatewayHost}/webhooks/zoom`,
        "",
        "OAuth Redirect URL (for app installation):",
        `  ${redirectUri}`,
        "",
        "Subscribe to event type: bot_notification",
      ].join("\n"),
      "Zoom URL Configuration Required",
    );

    return { cfg: next };
  },
  dmPolicy,
  disable: (cfg) => {
    const zoomConfig = (cfg.channels as any)?.zoom as ZoomConfig | undefined;
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        zoom: { ...zoomConfig, enabled: false },
      },
    };
  },
};
