/**
 * Mezon channel plugin and dock definitions.
 */
import { ChannelMessage, MezonClient } from "mezon-sdk";
import { existsSync, mkdirSync } from "node:fs";
import type {
  ChannelAccountSnapshot,
  ChannelDock,
  ChannelPlugin,
  MarkdownTableMode,
  OpenClawConfig,
} from "openclaw/plugin-sdk";
import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId,
  setAccountEnabledInConfigSection,
} from "openclaw/plugin-sdk";
import {
  listMezonAccountIds,
  resolveDefaultMezonAccountId,
  resolveMezonAccount,
} from "./accounts.js";
import { MezonConfigSchema } from "./config-schema.js";
import { mezonOnboardingAdapter } from "./onboarding.js";
import { getMezonClient, getMezonRuntime, removeMezonClient, setMezonClient } from "./runtime.js";
import { collectMezonStatusIssues } from "./status-issues.js";
import { MezonMessageMode, ResolvedMezonAccount } from "./types.js";

const MEZON_TEXT_LIMIT = 4000;
const DEFAULT_MEDIA_MAX_MB = 10;

/** Channel metadata. */
const meta = {
  id: "mezon",
  label: "Mezon",
  selectionLabel: "Mezon (Bot SDK)",
  docsPath: "/channels/mezon",
  docsLabel: "mezon",
  blurb: "Mezon - modern team communication platform",
  aliases: ["mz"],
  order: 80,
  quickstartAllowFrom: true,
};

/** Normalize mezon: or mz: prefixes from target IDs. */
function normalizeTarget(raw: string): string | undefined {
  return raw?.trim().replace(/^(mezon|mz):/i, "") || undefined;
}

/** Format allowFrom entries (remove prefixes, lowercase). */
function formatAllowFrom(entries: string[]): string[] {
  return entries
    .map((e) => String(e).trim())
    .filter(Boolean)
    .map((e) => e.replace(/^(mezon|mz):/i, "").toLowerCase());
}

/** Check if sender is in allowFrom list. */
function isAllowed(senderId: string, allowFrom: string[]): boolean {
  if (allowFrom.includes("*")) return true;
  const normalized = senderId.toLowerCase();
  return allowFrom.some((e) => e.toLowerCase().replace(/^(mezon|mz):/i, "") === normalized);
}

/** Channel dock configuration. */
export const mezonDock: ChannelDock = {
  id: "mezon",
  capabilities: { chatTypes: ["direct", "group"], media: true, blockStreaming: true },
  outbound: { textChunkLimit: 4000 },
  config: {
    resolveAllowFrom: ({ cfg, accountId }) =>
      resolveMezonAccount({ cfg: cfg as OpenClawConfig, accountId }).config.allowFrom?.map(String) ?? [],
    formatAllowFrom: ({ allowFrom }) => formatAllowFrom(allowFrom),
  },
  groups: { resolveRequireMention: () => true },
  threading: { resolveReplyToMode: () => "off" },
};

/** Mezon channel plugin. */
export const mezonPlugin: ChannelPlugin<ResolvedMezonAccount> = {
  id: "mezon",
  meta,
  onboarding: mezonOnboardingAdapter,
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    reactions: true,
    threads: true,
    polls: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.mezon"] },
  configSchema: buildChannelConfigSchema(MezonConfigSchema),

  config: {
    listAccountIds: (cfg) => listMezonAccountIds(cfg as OpenClawConfig),
    resolveAccount: (cfg, accountId) => resolveMezonAccount({ cfg: cfg as OpenClawConfig, accountId }),
    defaultAccountId: (cfg) => resolveDefaultMezonAccountId(cfg as OpenClawConfig),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({ cfg: cfg as OpenClawConfig, sectionKey: "mezon", accountId, enabled, allowTopLevel: true }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({ cfg: cfg as OpenClawConfig, sectionKey: "mezon", accountId, clearBaseFields: ["botId", "botToken", "tokenFile", "name"] }),
    isConfigured: (account) => Boolean(account.token?.trim() && account.botId?.trim()),
    describeAccount: (account): ChannelAccountSnapshot => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.token && account.botId),
      tokenSource: account.tokenSource,
    }),
    resolveAllowFrom: ({ cfg, accountId }) =>
      resolveMezonAccount({ cfg: cfg as OpenClawConfig, accountId }).config.allowFrom?.map(String) ?? [],
    formatAllowFrom: ({ allowFrom }) => formatAllowFrom(allowFrom),
  },

  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const id = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean((cfg as OpenClawConfig).channels?.mezon?.accounts?.[id]);
      const basePath = useAccountPath ? `channels.mezon.accounts.${id}.` : "channels.mezon.";

      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: formatPairingApproveHint("mezon"),
        normalizeEntry: (raw) => raw.replace(/^(mezon|mz):/i, ""),
      };
    },
  },

  groups: { resolveRequireMention: () => true },
  threading: { resolveReplyToMode: () => "off" },
  actions: [],

  messaging: {
    normalizeTarget,
    targetResolver: {
      looksLikeId: (raw) => /^\d{10,}$/.test(raw.trim()),
      hint: "<channelId or userId>",
    },
  },

  directory: {
    self: async () => null,
    listPeers: async ({ cfg, accountId, query, limit }) => {
      const account = resolveMezonAccount({ cfg: cfg as OpenClawConfig, accountId });
      const q = query?.toLowerCase() || "";
      return (account.config.allowFrom ?? [])
        .map(String)
        .filter((id) => id && id !== "*" && (!q || id.toLowerCase().includes(q)))
        .slice(0, limit || undefined)
        .map((id) => ({ kind: "user", id: id.replace(/^(mezon|mz):/i, "") }) as const);
    },
    listGroups: async () => [],
  },

  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({ cfg: cfg as OpenClawConfig, channelKey: "mezon", accountId, name }),
    validateInput: ({ accountId, input }) => {
      if (input.useEnv && accountId !== DEFAULT_ACCOUNT_ID) {
        return "MEZON_BOT_ID/MEZON_BOT_TOKEN can only be used for default account";
      }
      if (!input.useEnv && (!input.token || !input.botId) && !input.tokenFile) {
        return "Mezon requires botId + token, --token-file, or --use-env";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      let next = applyAccountNameToChannelSection({ cfg: cfg as OpenClawConfig, channelKey: "mezon", accountId, name: input.name });

      if (accountId !== DEFAULT_ACCOUNT_ID) {
        next = migrateBaseNameToDefaultAccount({ cfg: next, channelKey: "mezon" });
      }

      const credentials = input.useEnv
        ? {}
        : input.tokenFile
          ? { tokenFile: input.tokenFile }
          : input.token && input.botId
            ? { botToken: input.token, botId: input.botId }
            : {};

      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...next,
          channels: { ...next.channels, mezon: { ...next.channels?.mezon, enabled: true, ...credentials } },
        } as OpenClawConfig;
      }

      return {
        ...next,
        channels: {
          ...next.channels,
          mezon: {
            ...next.channels?.mezon,
            enabled: true,
            accounts: {
              ...next.channels?.mezon?.accounts,
              [accountId]: { ...next.channels?.mezon?.accounts?.[accountId], enabled: true, ...credentials },
            },
          },
        },
      } as OpenClawConfig;
    },
  },

  pairing: {
    idLabel: "mezonUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(mezon|mz):/i, ""),
    notifyApproval: async ({ cfg, id, accountId }) => {
      const account = resolveMezonAccount({ cfg: cfg as OpenClawConfig, accountId });
      const client = getMezonClient(account.accountId);
      if (!client) throw new Error("Mezon client not running");
      const user = await client.users.fetch(id);
      if (!user) throw new Error(`User ${id} not found`);
      await user.sendDM({ t: "Welcome! You have been approved to chat with this bot. Send a message to get started." });
    },
  },

  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    collectStatusIssues: collectMezonStatusIssues,
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      tokenSource: snapshot.tokenSource ?? "none",
      running: snapshot.running ?? false,
      mode: "realtime",
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.token && account.botId),
      tokenSource: account.tokenSource,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      mode: "realtime",
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
      dmPolicy: account.config.dmPolicy ?? "pairing",
    }),
  },

  gateway: {
    startAccount: async (ctx) => {
      const { account, abortSignal } = ctx;
      const { botId, token, accountId } = account;
      const config = ctx.cfg as OpenClawConfig;
      const core = getMezonRuntime();
      const mediaMaxMb = account.config.mediaMaxMb ?? DEFAULT_MEDIA_MAX_MB;

      // Ensure cache directory for mezon-sdk SQLite
      if (!existsSync("./mezon-cache")) mkdirSync("./mezon-cache", { recursive: true });

      // Create client
      const client = new MezonClient({
        botId,
        token,
      });
      await client.login();

      // Message handler
      client.onChannelMessage((message) => {
        ctx.setStatus({ accountId, lastInboundAt: Date.now() });
        handleMessage(message, {
          client,
          account,
          config,
          core,
          mediaMaxMb,
          log: (msg) => ctx.log?.info(msg),
          error: (msg) => ctx.log?.error(msg),
          setStatus: (patch) => ctx.setStatus({ accountId, ...patch }),
        }).catch((err) => ctx.log?.error(`[${accountId}] Message error: ${String(err)}`));
      });
      setMezonClient(accountId, client);

      // Wait until abort signal
      await new Promise<void>((resolve) => {
        if (abortSignal.aborted) {
          resolve();
          return;
        }
        const onAbort = () => {
          abortSignal.removeEventListener("abort", onAbort);
          resolve();
        };
        abortSignal.addEventListener("abort", onAbort, { once: true });
      });

      removeMezonClient(accountId);
    },
  },
};

// --- Message handler ---
type HandlerContext = {
  client: MezonClient;
  account: ResolvedMezonAccount;
  config: OpenClawConfig;
  core: ReturnType<typeof getMezonRuntime>;
  mediaMaxMb: number;
  log: (msg: string) => void;
  error: (msg: string) => void;
  setStatus: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

async function handleMessage(message: ChannelMessage, ctx: HandlerContext): Promise<void> {
  const { client, account, config, core, mediaMaxMb, error, setStatus } = ctx;
  const {
    message_id,
    mode,
    channel_id,
    clan_id,
    sender_id,
    display_name,
    username,
    content,
    attachments,
    create_time } = message;

  if (!content.t?.trim() && !attachments) return;
  const isDM = clan_id === "0" || mode === MezonMessageMode.DIRECT_MESSAGE;

  // Channel messages require # prefix to be processed
  if (!isDM) {
    if (!content.t?.trim().startsWith("#")) return;
    // Strip # prefix for processing
    content.t = content.t.trim().slice(1).trim();
  }

  // Access control
  const dmPolicy = account.config.dmPolicy ?? "pairing";
  const configAllowFrom = (account.config.allowFrom ?? []).map(String);
  const shouldComputeAuth = core.channel.commands.shouldComputeCommandAuthorized(content?.t, config);
  const storeAllowFrom =
    isDM && (dmPolicy !== "open" || shouldComputeAuth)
      ? await core.channel.pairing.readAllowFromStore("mezon").catch(() => [])
      : [];
  const effectiveAllowFrom = [...configAllowFrom, ...storeAllowFrom];
  const senderAllowed = isAllowed(sender_id, effectiveAllowFrom);

  // DM policy checks
  if (isDM && dmPolicy === "disabled") return;

  if (isDM && dmPolicy === "pairing" && !senderAllowed) {
    const { code, created } = await core.channel.pairing.upsertPairingRequest({
      channel: "mezon",
      id: sender_id,
      meta: { name: display_name || undefined },
    });

    if (created) {
      const user = await client.users.fetch(sender_id);
      await user?.sendDM({
        t: core.channel.pairing.buildPairingReply({
          channel: "mezon",
          idLine: `Your Mezon user id: ${sender_id}`,
          code,
        }),
      });
      setStatus({ lastOutboundAt: Date.now() });
    }
    return;
  }

  if (isDM && dmPolicy === "allowlist" && !senderAllowed) return;

  // Command authorization
  const useAccessGroups = config.commands?.useAccessGroups !== false;
  const commandAuthorized = shouldComputeAuth
    ? core.channel.commands.resolveCommandAuthorizedFromAuthorizers({
      useAccessGroups,
      authorizers: [{ configured: effectiveAllowFrom.length > 0, allowed: senderAllowed }],
    })
    : undefined;

  // Block unauthorized control commands in groups
  if (!isDM && core.channel.commands.isControlCommandMessage(content?.t, config) && commandAuthorized !== true) return;

  // Download attachments
  let mediaPath: string | undefined;
  let mediaType: string | undefined;

  if (attachments?.[0]?.url) {
    try {
      const fetched = await core.channel.media.fetchRemoteMedia({ url: attachments[0].url });
      const saved = await core.channel.media.saveMediaBuffer(
        fetched.buffer,
        fetched.contentType,
        "inbound",
        mediaMaxMb * 1024 * 1024,
      );
      mediaPath = saved.path;
      mediaType = saved.contentType;
    } catch (err) {
      error(`Failed to download attachment: ${String(err)}`);
    }
  }

  // Route to agent
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "mezon",
    accountId: account.accountId,
    peer: { kind: isDM ? "dm" : "group", id: channel_id },
  });

  const fromLabel = isDM ? display_name || `user:${sender_id}` : `group:${channel_id}`;
  // Build context
  const storePath = core.channel.session.resolveStorePath(config.session?.store, { agentId: route.agentId });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({ storePath, sessionKey: route.sessionKey });

  const body = core.channel.reply.formatAgentEnvelope({
    channel: "Mezon",
    from: fromLabel,
    timestamp: create_time,
    previousTimestamp,
    envelope: envelopeOptions,
    body: content?.t || (mediaPath ? "<media:attachment>" : ""),
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: content?.t,
    CommandBody: content?.t,
    From: isDM ? `mezon:${sender_id}` : `mezon:group:${channel_id}`,
    To: `mezon:${channel_id}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isDM ? "direct" : "group",
    ConversationLabel: fromLabel,
    SenderName: username || undefined,
    SenderId: sender_id,
    CommandAuthorized: commandAuthorized,
    Provider: "mezon",
    Surface: "mezon",
    MessageSid: message_id,
    MediaPath: mediaPath,
    MediaType: mediaType,
    MediaUrl: mediaPath,
    OriginatingChannel: "mezon",
    OriginatingTo: `mezon:${channel_id}`,
  });

  // Record session
  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => error(`Session update failed: ${String(err)}`),
  });

  // Dispatch and reply message
  const tableMode = core.channel.text.resolveMarkdownTableMode({ cfg: config, channel: "mezon", accountId: account.accountId });

  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: config,
    dispatcherOptions: {
      deliver: async (payload) => {
        await replyMessage(payload, { client, message_id, channel_id, sender_id, isDM, error, setStatus, core, config, accountId: account.accountId, tableMode });
      },
      onError: (err, info) => error(`[${account.accountId}] ${info.kind} reply failed: ${String(err)}`),
    },
  });
}

async function replyMessage(
  payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string },
  ctx: {
    client: MezonClient;
    message_id?: string;
    channel_id: string;
    sender_id: string;
    isDM: boolean;
    error: (msg: string) => void;
    setStatus: (patch: { lastOutboundAt?: number }) => void;
    core: ReturnType<typeof getMezonRuntime>;
    config: OpenClawConfig;
    accountId: string;
    tableMode?: MarkdownTableMode;
  },
): Promise<void> {
  const { client, message_id, channel_id, sender_id, isDM, error, setStatus, core, config, accountId, tableMode } = ctx;

  const text = core.channel.text.convertMarkdownTables(payload.text ?? "", tableMode ?? "code");
  const mediaUrls = payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : []);

  const chunkMode = core.channel.text.resolveChunkMode(config, "mezon", accountId);
  const chunks = core.channel.text.chunkMarkdownTextWithMode(text, MEZON_TEXT_LIMIT, chunkMode);

  try {
    if (isDM) {
      const user = await client.users.fetch(sender_id);
      if (!user) return;

      if (chunks.length > 0) {
        for (const chunk of chunks) {
          await user.sendDM({
            t: chunk
          });
          setStatus({ lastOutboundAt: Date.now() });
        }
      }

      if (mediaUrls.length > 0) {
        await user.sendDM({ t: "Attachments: " }, 0, mediaUrls.map((url) => ({ url })));
      }
    }
    else {
      const channel = await client.channels.fetch(channel_id);
      if (!channel || !message_id) return;

      const message = await channel.messages.fetch(message_id);
      if (chunks.length > 0 && message) {
        for (const chunk of chunks) {
          await message.reply({ t: chunk });
          setStatus({ lastOutboundAt: Date.now() });
        }
      }

      if (mediaUrls.length > 0) {
        await channel.send({ t: "Attachments: " },[], mediaUrls.map((url) => ({ url })));
      }
    }
  } catch (err) {
    error(`[${accountId}] Send failed: ${String(err)}`);
  }
}
