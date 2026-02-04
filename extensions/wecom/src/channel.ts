/**
 * 企业微信 ChannelPlugin 实现
 */

import type { ResolvedWecomAccount, WecomConfig } from "./types.js";
import {
  DEFAULT_ACCOUNT_ID,
  listWecomAccountIds,
  resolveDefaultWecomAccountId,
  resolveWecomAccount,
  resolveAllowFrom,
  resolveGroupAllowFrom,
  resolveRequireMention,
  WecomConfigJsonSchema,
  type PluginConfig,
} from "./config.js";
import { registerWecomWebhookTarget } from "./monitor.js";
import { setWecomRuntime } from "./runtime.js";

const meta = {
  id: "wecom",
  label: "WeCom",
  selectionLabel: "WeCom (企业微信)",
  docsPath: "/channels/wecom",
  docsLabel: "wecom",
  blurb: "企业微信智能机器人回调",
  aliases: ["wechatwork", "wework", "qywx", "企微", "企业微信"],
  order: 85,
} as const;

const unregisterHooks = new Map<string, () => void>();

export const wecomPlugin = {
  id: "wecom",

  meta: {
    ...meta,
  },

  capabilities: {
    chatTypes: ["direct", "group"] as const,
    media: false,
    reactions: false,
    threads: false,
    edit: false,
    reply: true,
    polls: false,
  },

  configSchema: WecomConfigJsonSchema,

  reload: { configPrefixes: ["channels.wecom"] },

  config: {
    listAccountIds: (cfg: PluginConfig): string[] => listWecomAccountIds(cfg),

    resolveAccount: (cfg: PluginConfig, accountId?: string): ResolvedWecomAccount =>
      resolveWecomAccount({ cfg, accountId }),

    defaultAccountId: (cfg: PluginConfig): string => resolveDefaultWecomAccountId(cfg),

    setAccountEnabled: (params: {
      cfg: PluginConfig;
      accountId?: string;
      enabled: boolean;
    }): PluginConfig => {
      const accountId = params.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccount = Boolean(params.cfg.channels?.wecom?.accounts?.[accountId]);
      if (!useAccount) {
        return {
          ...params.cfg,
          channels: {
            ...params.cfg.channels,
            wecom: {
              ...(params.cfg.channels?.wecom ?? {}),
              enabled: params.enabled,
            } as WecomConfig,
          },
        };
      }

      return {
        ...params.cfg,
        channels: {
          ...params.cfg.channels,
          wecom: {
            ...(params.cfg.channels?.wecom ?? {}),
            accounts: {
              ...(params.cfg.channels?.wecom?.accounts ?? {}),
              [accountId]: {
                ...(params.cfg.channels?.wecom?.accounts?.[accountId] ?? {}),
                enabled: params.enabled,
              },
            },
          } as WecomConfig,
        },
      };
    },

    deleteAccount: (params: { cfg: PluginConfig; accountId?: string }): PluginConfig => {
      const accountId = params.accountId ?? DEFAULT_ACCOUNT_ID;
      const next = { ...params.cfg };
      const current = next.channels?.wecom;
      if (!current) return next;

      if (accountId === DEFAULT_ACCOUNT_ID) {
        const { accounts: _ignored, defaultAccount: _ignored2, ...rest } = current as WecomConfig;
        next.channels = {
          ...next.channels,
          wecom: { ...(rest as WecomConfig), enabled: false },
        };
        return next;
      }

      const accounts = { ...(current.accounts ?? {}) };
      delete accounts[accountId];

      next.channels = {
        ...next.channels,
        wecom: {
          ...(current as WecomConfig),
          accounts: Object.keys(accounts).length > 0 ? accounts : undefined,
        },
      };

      return next;
    },

    isConfigured: (account: ResolvedWecomAccount): boolean => account.configured,

    describeAccount: (account: ResolvedWecomAccount) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      webhookPath: account.config.webhookPath ?? "/wecom",
    }),

    resolveAllowFrom: (params: { cfg: PluginConfig; accountId?: string }): string[] => {
      const account = resolveWecomAccount({ cfg: params.cfg, accountId: params.accountId });
      return resolveAllowFrom(account.config);
    },

    formatAllowFrom: (params: { allowFrom: (string | number)[] }): string[] =>
      params.allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },

  groups: {
    resolveRequireMention: (params: {
      cfg: PluginConfig;
      accountId?: string;
      account?: ResolvedWecomAccount;
    }): boolean => {
      const account =
        params.account ??
        resolveWecomAccount({ cfg: params.cfg ?? {}, accountId: params.accountId });
      return resolveRequireMention(account.config);
    },
  },

  outbound: {
    deliveryMode: "direct",
    sendText: async () => {
      return {
        channel: "wecom",
        ok: false,
        messageId: "",
        error: new Error(
          "WeCom intelligent bot only supports replying within callbacks (no standalone sendText).",
        ),
      };
    },
  },

  gateway: {
    startAccount: async (ctx: {
      cfg: PluginConfig;
      runtime?: unknown;
      abortSignal?: AbortSignal;
      accountId: string;
      setStatus?: (status: Record<string, unknown>) => void;
      log?: { info: (msg: string) => void; error: (msg: string) => void };
    }): Promise<void> => {
      ctx.setStatus?.({ accountId: ctx.accountId });

      if (ctx.runtime) {
        const candidate = ctx.runtime as {
          channel?: {
            routing?: { resolveAgentRoute?: unknown };
            reply?: { dispatchReplyFromConfig?: unknown };
          };
        };
        if (
          candidate.channel?.routing?.resolveAgentRoute &&
          candidate.channel?.reply?.dispatchReplyFromConfig
        ) {
          setWecomRuntime(ctx.runtime as Record<string, unknown>);
        }
      }

      const account = resolveWecomAccount({ cfg: ctx.cfg, accountId: ctx.accountId });
      if (!account.configured) {
        ctx.log?.info(`[wecom] account ${ctx.accountId} not configured; webhook not registered`);
        ctx.setStatus?.({ accountId: ctx.accountId, running: false, configured: false });
        return;
      }

      const path = (account.config.webhookPath ?? "/wecom").trim();
      const unregister = registerWecomWebhookTarget({
        account,
        config: (ctx.cfg ?? {}) as PluginConfig,
        runtime: {
          log: ctx.log?.info ?? console.log,
          error: ctx.log?.error ?? console.error,
        },
        path,
        statusSink: (patch) => ctx.setStatus?.({ accountId: ctx.accountId, ...patch }),
      });

      const existing = unregisterHooks.get(ctx.accountId);
      if (existing) existing();
      unregisterHooks.set(ctx.accountId, unregister);

      ctx.log?.info(`[wecom] webhook registered at ${path} for account ${ctx.accountId}`);
      ctx.setStatus?.({
        accountId: ctx.accountId,
        running: true,
        configured: true,
        webhookPath: path,
        lastStartAt: Date.now(),
      });
    },

    stopAccount: async (ctx: {
      accountId: string;
      setStatus?: (status: Record<string, unknown>) => void;
    }): Promise<void> => {
      const unregister = unregisterHooks.get(ctx.accountId);
      if (unregister) {
        unregister();
        unregisterHooks.delete(ctx.accountId);
      }
      ctx.setStatus?.({ accountId: ctx.accountId, running: false, lastStopAt: Date.now() });
    },
  },
};

export { DEFAULT_ACCOUNT_ID } from "./config.js";
