import type { OpenClawConfig } from "../config/config.js";
import type { ThinkLevel } from "./model-selection.js";
import { buildModelAliasIndex, modelKey, resolveModelRefFromString } from "./model-selection.js";

export type ModelRoutingMatch = {
  /** Originating message channel/provider (e.g. "discord", "telegram", "slack"). */
  channel?: string;
  /** Cron lane (e.g. "cron", "heartbeat", "ops"). */
  lane?: string;
  /** Session key prefix match (e.g. "cron:" or "hook:gmail:"). */
  sessionKeyPrefix?: string;
  /** Agent id (normalized). */
  agentId?: string;
  /** Whether the run is from cron. */
  isCron?: boolean;
  /** Whether the run originated from a group chat. */
  isGroup?: boolean;
};

export type ModelRoutingReceiptMode = "off" | "tokens" | "cost" | "full";

export type ModelRoutingRule = {
  name?: string;
  match?: ModelRoutingMatch;
  /** Optional model override (provider/model or alias). */
  model?: {
    primary?: string;
    fallbacks?: string[];
  };
  /** Optional thinking override. */
  thinking?: ThinkLevel;
  /** Optional per-run usage/cost receipt mode (overrides session /usage mode). */
  receipt?: ModelRoutingReceiptMode;
};

export type ModelRoutingDecision = {
  modelPrimary?: string;
  modelFallbacksOverride?: string[];
  thinking?: ThinkLevel;
  receipt?: ModelRoutingReceiptMode;
  /** Human-readable rule name used (if any). */
  rule?: string;
};

function normalizeMaybe(value?: string): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed.toLowerCase() : undefined;
}

function matchRule(params: {
  match?: ModelRoutingMatch;
  ctx: {
    channel?: string;
    lane?: string;
    sessionKey?: string;
    agentId?: string;
    isCron?: boolean;
    isGroup?: boolean;
  };
}): boolean {
  const m = params.match;
  if (!m) {
    return true;
  }
  const channel = normalizeMaybe(params.ctx.channel);
  const lane = normalizeMaybe(params.ctx.lane);
  const sessionKey = (params.ctx.sessionKey ?? "").trim();
  const agentId = normalizeMaybe(params.ctx.agentId);

  if (m.channel && normalizeMaybe(m.channel) !== channel) {
    return false;
  }
  if (m.lane && normalizeMaybe(m.lane) !== lane) {
    return false;
  }
  if (m.sessionKeyPrefix && !sessionKey.startsWith(m.sessionKeyPrefix)) {
    return false;
  }
  if (m.agentId && normalizeMaybe(m.agentId) !== agentId) {
    return false;
  }
  if (typeof m.isCron === "boolean" && m.isCron !== Boolean(params.ctx.isCron)) {
    return false;
  }
  if (typeof m.isGroup === "boolean" && m.isGroup !== Boolean(params.ctx.isGroup)) {
    return false;
  }
  return true;
}

function normalizeModelStrings(params: {
  cfg: OpenClawConfig;
  defaultProvider: string;
  models?: { primary?: string; fallbacks?: string[] };
}): { primary?: string; fallbacks?: string[] } {
  const rawPrimary = params.models?.primary?.trim();
  const rawFallbacks = (params.models?.fallbacks ?? []).map((s) => String(s ?? "").trim());

  const aliasIndex = buildModelAliasIndex({
    cfg: params.cfg,
    defaultProvider: params.defaultProvider,
  });
  const normalizeRef = (raw: string): string | undefined => {
    const resolved = resolveModelRefFromString({
      raw,
      defaultProvider: params.defaultProvider,
      aliasIndex,
    });
    if (!resolved) {
      return undefined;
    }
    return modelKey(resolved.ref.provider, resolved.ref.model);
  };

  const primary = rawPrimary ? normalizeRef(rawPrimary) : undefined;
  const fallbacks = rawFallbacks
    .map((raw) => normalizeRef(raw))
    .filter((v): v is string => Boolean(v));

  return {
    ...(primary ? { primary } : {}),
    ...(fallbacks.length ? { fallbacks } : {}),
  };
}

/**
 * Resolve a model routing decision based on run context.
 *
 * Notes:
 * - This is intentionally minimal: it picks an explicit model + fallbacks list when configured.
 * - Cost/latency/quality constraints can be layered on later by expanding match + rule actions.
 */
export function resolveModelRoutingDecision(params: {
  cfg: OpenClawConfig;
  defaultProvider: string;
  ctx: {
    channel?: string;
    lane?: string;
    sessionKey?: string;
    agentId?: string;
    isCron?: boolean;
    isGroup?: boolean;
  };
}): ModelRoutingDecision {
  const rules = params.cfg.models?.routing?.rules ?? [];
  for (const rule of rules) {
    if (!matchRule({ match: rule.match, ctx: params.ctx })) {
      continue;
    }
    const normalizedModels = normalizeModelStrings({
      cfg: params.cfg,
      defaultProvider: params.defaultProvider,
      models: rule.model,
    });

    return {
      ...(normalizedModels.primary ? { modelPrimary: normalizedModels.primary } : {}),
      ...(normalizedModels.fallbacks ? { modelFallbacksOverride: normalizedModels.fallbacks } : {}),
      ...(rule.thinking ? { thinking: rule.thinking } : {}),
      ...(rule.receipt ? { receipt: rule.receipt } : {}),
      rule: rule.name,
    };
  }

  const defaultReceipt = params.cfg.models?.routing?.receipts?.defaultMode;
  return {
    ...(defaultReceipt ? { receipt: defaultReceipt } : {}),
  };
}
