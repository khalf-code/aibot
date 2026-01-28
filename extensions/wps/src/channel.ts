import type { ChannelPlugin, ChannelStatusIssue, ClawdbotConfig } from "clawdbot/plugin-sdk";
import { buildChannelConfigSchema, DEFAULT_ACCOUNT_ID, formatPairingApproveHint } from "clawdbot/plugin-sdk";
import { WpsConfigSchema, type WpsConfig } from "./types.js";
import { wpsOutbound } from "./send.js";
import { resolveWpsCredentials, getAccessToken } from "./token.js";
import { getWpsRuntime } from "./runtime.js";

type ResolvedWpsAccount = {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  config: WpsConfig;
};

const meta = {
  id: "wps",
  label: "WPS",
  selectionLabel: "WPS365 (Open Platform)",
  docsPath: "/channels/wps",
  docsLabel: "WPS",
  blurb: "WPS365 Open Platform bot integration.",
  aliases: ["wps", "wps365"],
  order: 70,
} as const;

function resolveWpsAccount(cfg: ClawdbotConfig, _accountId?: string): ResolvedWpsAccount {
  const wpsCfg = cfg.channels?.wps as WpsConfig | undefined;
  return {
    accountId: DEFAULT_ACCOUNT_ID,
    enabled: wpsCfg?.enabled !== false,
    configured: Boolean(resolveWpsCredentials(wpsCfg)),
    config: wpsCfg ?? ({} as WpsConfig),
  };
}

function normalizeAllowEntry(entry: string): string {
  // WPS IDs are case-sensitive, do not convert to lowercase
  return entry.trim().replace(/^wps:/i, "");
}

export const wpsPlugin: ChannelPlugin<ResolvedWpsAccount> = {
  id: "wps",
  meta: { ...meta, aliases: [...meta.aliases] },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: false,
    threads: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.wps"] },
  configSchema: buildChannelConfigSchema(WpsConfigSchema),

  // WPS IDs are obfuscated strings with no specific format, case-sensitive
  messaging: {
    // Preserve original case - WPS IDs are case-sensitive
    normalizeTarget: (raw: string) => raw.trim(),
    targetResolver: {
      hint: "WPS target: user_id or chat_id (obfuscated string, case-sensitive)",
      looksLikeId: (raw: string) => {
        const trimmed = raw.trim();
        // Accept any non-empty string as WPS ID
        return trimmed.length > 0;
      },
    },
  },

  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],
    resolveAccount: (cfg) => resolveWpsAccount(cfg as ClawdbotConfig),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, enabled }) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        wps: {
          ...(cfg.channels?.wps ?? {}),
          enabled,
        },
      },
    }),
    deleteAccount: ({ cfg }) => {
      const next = { ...cfg } as ClawdbotConfig;
      const nextChannels = { ...cfg.channels };
      delete nextChannels.wps;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
      } else {
        delete next.channels;
      }
      return next;
    },
    isConfigured: (_account, cfg) => Boolean(resolveWpsCredentials((cfg as ClawdbotConfig).channels?.wps as WpsConfig)),
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
    }),
    resolveAllowFrom: ({ cfg }) => ((cfg as ClawdbotConfig).channels?.wps as WpsConfig)?.allowFrom ?? [],
    formatAllowFrom: ({ allowFrom }) => allowFrom.map((s) => normalizeAllowEntry(String(s))),
  },

  security: {
    resolveDmPolicy: ({ cfg }) => {
      const wpsCfg = (cfg as ClawdbotConfig).channels?.wps as WpsConfig | undefined;
      return {
        policy: wpsCfg?.dmPolicy ?? "pairing",
        allowFrom: wpsCfg?.allowFrom ?? [],
        policyPath: "channels.wps.dmPolicy",
        allowFromPath: "channels.wps.allowFrom",
        approveHint: formatPairingApproveHint("wps"),
        normalizeEntry: normalizeAllowEntry,
      };
    },
    collectWarnings: ({ cfg }) => {
      const warnings: string[] = [];
      const wpsCfg = (cfg as ClawdbotConfig).channels?.wps as WpsConfig | undefined;

      if (wpsCfg?.dmPolicy === "open") {
        warnings.push(
          `- WPS DMs are open to anyone. Set channels.wps.dmPolicy="pairing" or "allowlist" for security.`
        );
      }

      const groupPolicy = wpsCfg?.groupPolicy ?? "allowlist";
      if (groupPolicy === "open") {
        warnings.push(
          `- WPS groups: groupPolicy="open" allows any group to trigger (mention-gated). Set channels.wps.groupPolicy="allowlist" and configure channels.wps.groups.`
        );
      }

      return warnings;
    },
  },

  pairing: {
    idLabel: "wpsUserId",
    normalizeAllowEntry,
    notifyApproval: async ({ cfg, id }) => {
      const wpsCfg = (cfg as ClawdbotConfig).channels?.wps as WpsConfig | undefined;
      const creds = resolveWpsCredentials(wpsCfg);
      if (!creds) {
        throw new Error("WPS credentials not configured");
      }

      const token = await getAccessToken(creds);
      // Use WPS batch_create API to send approval notification to user
      const url = `${creds.baseUrl.replace(/\/$/, "")}/v7/messages/batch_create`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          type: "text",
          receivers: [
            {
              type: "user",
              receiver_ids: [id],
            },
          ],
          content: {
            text: {
              content: "Your pairing request has been approved. You can now chat with this bot.",
              type: "plain",
            },
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Failed to send approval notification: ${res.status} ${body}`);
      }

      const data = await res.json() as { code: number; msg: string };
      if (data.code !== 0) {
        throw new Error(`WPS API error (code ${data.code}): ${data.msg}`);
      }
    },
  },

  groups: {
    resolveRequireMention: ({ cfg, groupId }) => {
      const wpsCfg = (cfg as ClawdbotConfig).channels?.wps as WpsConfig | undefined;
      if (!wpsCfg?.groups || !groupId) return true;
      const groupConfig = wpsCfg.groups[groupId] ?? wpsCfg.groups["*"];
      return groupConfig?.requireMention ?? true;
    },
    resolveToolPolicy: () => {
      // WPS uses simplified tool policy strings; return undefined to use system defaults
      return undefined;
    },
  },

  outbound: {
    ...wpsOutbound,
    deliveryMode: "direct",
    textChunkLimit: 5000, // WPS message limit is 5000 characters
    chunker: (text, limit) => getWpsRuntime().channel.text.chunkMarkdownText(text, limit),
    chunkerMode: "markdown",
  },

  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: (accounts) =>
      accounts.flatMap((entry) => {
        const issues: ChannelStatusIssue[] = [];
        const enabled = entry.enabled !== false;
        const configured = entry.configured === true;

        if (enabled && !configured) {
          issues.push({
            channel: "wps",
            accountId: String(entry.accountId ?? DEFAULT_ACCOUNT_ID),
            kind: "config",
            message: "WPS credentials not configured (appId, appSecret, and companyId required).",
            fix: "Set channels.wps.appId, channels.wps.appSecret, and channels.wps.companyId.",
          });
        }

        return issues;
      }),
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ account }) => {
      const creds = resolveWpsCredentials(account.config);
      if (!creds) {
        return { ok: false, error: "Not configured" };
      }

      try {
        const token = await getAccessToken(creds);
        return { ok: true, token: token.substring(0, 8) + "..." };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
      dmPolicy: account.config.dmPolicy ?? "pairing",
      probe,
    }),
  },

  gateway: {
    startAccount: async (ctx) => {
      const { monitorWpsProvider } = await import("./monitor.js");
      const wpsCfg = (ctx.cfg as ClawdbotConfig).channels?.wps as WpsConfig | undefined;
      const port = wpsCfg?.webhook?.port ?? 3000;

      ctx.setStatus({
        accountId: ctx.accountId,
        running: true,
        lastStartAt: Date.now(),
        port,
      });
      ctx.log?.info(`[${ctx.accountId}] starting WPS provider (port ${port})`);

      return monitorWpsProvider({
        cfg: ctx.cfg as ClawdbotConfig,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
      });
    },
  },

  onboarding: {
    channel: "wps",
    getStatus: async ({ cfg }) => {
      const wpsCfg = (cfg as ClawdbotConfig).channels?.wps as WpsConfig | undefined;
      const configured = Boolean(resolveWpsCredentials(wpsCfg));
      return {
        channel: "wps",
        configured,
        statusLines: [`WPS: ${configured ? "configured" : "needs appId, appSecret, and companyId"}`],
        selectionHint: configured ? "configured" : "needs credentials",
        quickstartScore: configured ? 2 : 1,
      };
    },
    configure: async ({ cfg }) => {
      // WPS configuration is done via config file; no interactive wizard
      return { cfg };
    },
  },
};
