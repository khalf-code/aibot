import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk";

import type { ResolvedMezonAccount, MezonAccountConfig, MezonConfig } from "./types.js";
import { resolveMezonToken } from "./token.js";

function listConfiguredAccountIds(cfg: OpenClawConfig): string[] {
  const accounts = (cfg.channels?.mezon as MezonConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return [];
  return Object.keys(accounts).filter(Boolean);
}

export function listMezonAccountIds(cfg: OpenClawConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) return [DEFAULT_ACCOUNT_ID];
  return ids.sort((a, b) => a.localeCompare(b));
}

export function resolveDefaultMezonAccountId(cfg: OpenClawConfig): string {
  const mezonConfig = cfg.channels?.mezon as MezonConfig | undefined;
  if (mezonConfig?.defaultAccount?.trim()) return mezonConfig.defaultAccount.trim();
  const ids = listMezonAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveAccountConfig(
  cfg: OpenClawConfig,
  accountId: string,
): MezonAccountConfig | undefined {
  const accounts = (cfg.channels?.mezon as MezonConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return undefined;
  return accounts[accountId] as MezonAccountConfig | undefined;
}

function mergeMezonAccountConfig(cfg: OpenClawConfig, accountId: string): MezonAccountConfig {
  const raw = (cfg.channels?.mezon ?? {}) as MezonConfig;
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}

export function resolveMezonAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedMezonAccount {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = (params.cfg.channels?.mezon as MezonConfig | undefined)?.enabled !== false;
  const merged = mergeMezonAccountConfig(params.cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const tokenResolution = resolveMezonToken(
    params.cfg.channels?.mezon as MezonConfig | undefined,
    accountId,
  );

  return {
    accountId,
    name: merged.name?.trim() || undefined,
    enabled,
    botId: tokenResolution.botId,
    token: tokenResolution.token,
    tokenSource: tokenResolution.source,
    config: merged,
  };
}

export function listEnabledMezonAccounts(cfg: OpenClawConfig): ResolvedMezonAccount[] {
  return listMezonAccountIds(cfg)
    .map((accountId) => resolveMezonAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}
