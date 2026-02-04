// 企业微信配置 schema
import { z } from "zod";
import type {
  ResolvedWecomAccount,
  WecomAccountConfig,
  WecomConfig,
  WecomDmPolicy,
  WecomGroupPolicy,
} from "./types.js";

/** 默认账户 ID */
export const DEFAULT_ACCOUNT_ID = "default";

const WecomAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  webhookPath: z.string().optional(),
  token: z.string().optional(),
  encodingAESKey: z.string().optional(),
  receiveId: z.string().optional(),
  welcomeText: z.string().optional(),
  dmPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).optional(),
  allowFrom: z.array(z.string()).optional(),
  groupPolicy: z.enum(["open", "allowlist", "disabled"]).optional(),
  groupAllowFrom: z.array(z.string()).optional(),
  requireMention: z.boolean().optional(),
});

export const WecomConfigSchema = WecomAccountSchema.extend({
  defaultAccount: z.string().optional(),
  accounts: z.record(WecomAccountSchema).optional(),
});

export type ParsedWecomConfig = z.infer<typeof WecomConfigSchema>;

export const WecomConfigJsonSchema = {
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      enabled: { type: "boolean" },
      webhookPath: { type: "string" },
      token: { type: "string" },
      encodingAESKey: { type: "string" },
      receiveId: { type: "string" },
      welcomeText: { type: "string" },
      dmPolicy: { type: "string", enum: ["open", "pairing", "allowlist", "disabled"] },
      allowFrom: { type: "array", items: { type: "string" } },
      groupPolicy: { type: "string", enum: ["open", "allowlist", "disabled"] },
      groupAllowFrom: { type: "array", items: { type: "string" } },
      requireMention: { type: "boolean" },
      defaultAccount: { type: "string" },
      accounts: {
        type: "object",
        additionalProperties: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            enabled: { type: "boolean" },
            webhookPath: { type: "string" },
            token: { type: "string" },
            encodingAESKey: { type: "string" },
            receiveId: { type: "string" },
            welcomeText: { type: "string" },
            dmPolicy: { type: "string", enum: ["open", "pairing", "allowlist", "disabled"] },
            allowFrom: { type: "array", items: { type: "string" } },
            groupPolicy: { type: "string", enum: ["open", "allowlist", "disabled"] },
            groupAllowFrom: { type: "array", items: { type: "string" } },
            requireMention: { type: "boolean" },
          },
        },
      },
    },
  },
};

export interface PluginConfig {
  session?: {
    store?: unknown;
  };
  channels?: {
    wecom?: WecomConfig;
  };
}

export function parseWecomConfig(raw: unknown): WecomConfig | undefined {
  const parsed = WecomConfigSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  return parsed.data as WecomConfig;
}

export function normalizeAccountId(raw?: string | null): string {
  const trimmed = String(raw ?? "").trim();
  return trimmed || DEFAULT_ACCOUNT_ID;
}

function listConfiguredAccountIds(cfg: PluginConfig): string[] {
  const accounts = cfg.channels?.wecom?.accounts;
  if (!accounts || typeof accounts !== "object") return [];
  return Object.keys(accounts).filter(Boolean);
}

export function listWecomAccountIds(cfg: PluginConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) return [DEFAULT_ACCOUNT_ID];
  return ids.sort((a, b) => a.localeCompare(b));
}

export function resolveDefaultWecomAccountId(cfg: PluginConfig): string {
  const wecomConfig = cfg.channels?.wecom;
  if (wecomConfig?.defaultAccount?.trim()) return wecomConfig.defaultAccount.trim();
  const ids = listWecomAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveAccountConfig(
  cfg: PluginConfig,
  accountId: string,
): WecomAccountConfig | undefined {
  const accounts = cfg.channels?.wecom?.accounts;
  if (!accounts || typeof accounts !== "object") return undefined;
  return accounts[accountId] as WecomAccountConfig | undefined;
}

function mergeWecomAccountConfig(cfg: PluginConfig, accountId: string): WecomAccountConfig {
  const base = (cfg.channels?.wecom ?? {}) as WecomConfig;
  const { accounts: _ignored, defaultAccount: _ignored2, ...baseConfig } = base;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...baseConfig, ...account };
}

export function resolveWecomAccount(params: {
  cfg: PluginConfig;
  accountId?: string | null;
}): ResolvedWecomAccount {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = params.cfg.channels?.wecom?.enabled !== false;
  const merged = mergeWecomAccountConfig(params.cfg, accountId);
  const enabled = baseEnabled && merged.enabled !== false;

  const isDefaultAccount = accountId === DEFAULT_ACCOUNT_ID;
  const token =
    merged.token?.trim() ||
    (isDefaultAccount ? process.env.WECOM_TOKEN?.trim() : undefined) ||
    undefined;
  const encodingAESKey =
    merged.encodingAESKey?.trim() ||
    (isDefaultAccount ? process.env.WECOM_ENCODING_AES_KEY?.trim() : undefined) ||
    undefined;
  const receiveId = merged.receiveId?.trim() ?? "";
  const configured = Boolean(token && encodingAESKey);

  return {
    accountId,
    name: merged.name?.trim() || undefined,
    enabled,
    configured,
    token,
    encodingAESKey,
    receiveId,
    config: merged,
  };
}

export function listEnabledWecomAccounts(cfg: PluginConfig): ResolvedWecomAccount[] {
  return listWecomAccountIds(cfg)
    .map((accountId) => resolveWecomAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}

export function resolveDmPolicy(config: WecomAccountConfig): WecomDmPolicy {
  return (config.dmPolicy ?? "pairing") as WecomDmPolicy;
}

export function resolveGroupPolicy(config: WecomAccountConfig): WecomGroupPolicy {
  return (config.groupPolicy ?? "open") as WecomGroupPolicy;
}

export function resolveRequireMention(config: WecomAccountConfig): boolean {
  if (typeof config.requireMention === "boolean") return config.requireMention;
  return true;
}

export function resolveAllowFrom(config: WecomAccountConfig): string[] {
  return config.allowFrom ?? [];
}

export function resolveGroupAllowFrom(config: WecomAccountConfig): string[] {
  return config.groupAllowFrom ?? [];
}
