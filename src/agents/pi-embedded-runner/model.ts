import type { Api, Model } from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../../config/config.js";
import type { ModelDefinitionConfig } from "../../config/types.js";
import { resolveOpenClawAgentDir } from "../agent-paths.js";
import { DEFAULT_CONTEXT_TOKENS } from "../defaults.js";
import { normalizeModelCompat } from "../model-compat.js";
import { normalizeProviderId } from "../model-selection.js";
import { OLLAMA_BASE_URL } from "../models-config.providers.js";
import {
  discoverAuthStorage,
  discoverModels,
  type AuthStorage,
  type ModelRegistry,
} from "../pi-model-discovery.js";

type InlineModelEntry = ModelDefinitionConfig & { provider: string; baseUrl?: string };
type InlineProviderConfig = {
  baseUrl?: string;
  api?: ModelDefinitionConfig["api"];
  models?: ModelDefinitionConfig[];
};

export function buildInlineProviderModels(
  providers: Record<string, InlineProviderConfig>,
): InlineModelEntry[] {
  return Object.entries(providers).flatMap(([providerId, entry]) => {
    const trimmed = providerId.trim();
    if (!trimmed) {
      return [];
    }
    return (entry?.models ?? []).map((model) => ({
      ...model,
      provider: trimmed,
      baseUrl: entry?.baseUrl,
      api: model.api ?? entry?.api,
    }));
  });
}

export function buildModelAliasLines(cfg?: OpenClawConfig) {
  const models = cfg?.agents?.defaults?.models ?? {};
  const entries: Array<{ alias: string; model: string }> = [];
  for (const [keyRaw, entryRaw] of Object.entries(models)) {
    const model = String(keyRaw ?? "").trim();
    if (!model) {
      continue;
    }
    const alias = String((entryRaw as { alias?: string } | undefined)?.alias ?? "").trim();
    if (!alias) {
      continue;
    }
    entries.push({ alias, model });
  }
  return entries
    .toSorted((a, b) => a.alias.localeCompare(b.alias))
    .map((entry) => `- ${entry.alias}: ${entry.model}`);
}

export function resolveModel(
  provider: string,
  modelId: string,
  agentDir?: string,
  cfg?: OpenClawConfig,
): {
  model?: Model<Api>;
  error?: string;
  authStorage: AuthStorage;
  modelRegistry: ModelRegistry;
} {
  const resolvedAgentDir = agentDir ?? resolveOpenClawAgentDir();
  const authStorage = discoverAuthStorage(resolvedAgentDir);
  const modelRegistry = discoverModels(authStorage, resolvedAgentDir);
  const model = modelRegistry.find(provider, modelId) as Model<Api> | null;

  // Check if there's an inline config that might have different API settings
  const providers = cfg?.models?.providers ?? {};
  const inlineModels = buildInlineProviderModels(providers);
  const normalizedProvider = normalizeProviderId(provider);
  const inlineMatch = inlineModels.find(
    (entry) => normalizeProviderId(entry.provider) === normalizedProvider && entry.id === modelId,
  );

  // Get the provider-level API setting from config (applies to all models from this provider)
  const providerCfg = providers[provider];
  const providerApi = providerCfg?.api;

  // Priority 1: If model found in registry and provider has API override in config, use it
  if (model && providerApi && providerApi !== model.api) {
    console.error(`[DEBUG resolveModel] Provider API override: ${model.api} -> ${providerApi}`);
    const mergedModel = normalizeModelCompat({
      ...model,
      api: providerApi,
    } as Model<Api>);
    return {
      model: mergedModel,
      authStorage,
      modelRegistry,
    };
  }

  // Priority 2: If model found in registry and specific model has different API in config, use it
  if (model && inlineMatch && inlineMatch.api && inlineMatch.api !== model.api) {
    const mergedModel = normalizeModelCompat({
      ...model,
      api: inlineMatch.api,
    } as Model<Api>);
    return {
      model: mergedModel,
      authStorage,
      modelRegistry,
    };
  }

  if (!model) {
    if (inlineMatch) {
      const normalized = normalizeModelCompat(inlineMatch as Model<Api>);
      return {
        model: normalized,
        authStorage,
        modelRegistry,
      };
    }
    const providerCfg = providers[provider];
    const isOllama = normalizeProviderId(provider) === "ollama";
    if (providerCfg || modelId.startsWith("mock-") || isOllama) {
      const fallbackModel: Model<Api> = normalizeModelCompat({
        id: modelId,
        name: modelId,
        api: providerCfg?.api ?? "openai-completions",
        provider,
        baseUrl: providerCfg?.baseUrl ?? (isOllama ? OLLAMA_BASE_URL : undefined),
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: providerCfg?.models?.[0]?.contextWindow ?? DEFAULT_CONTEXT_TOKENS,
        maxTokens: providerCfg?.models?.[0]?.maxTokens ?? DEFAULT_CONTEXT_TOKENS,
      } as Model<Api>);
      return { model: fallbackModel, authStorage, modelRegistry };
    }
    return {
      error: `Unknown model: ${provider}/${modelId}`,
      authStorage,
      modelRegistry,
    };
  }
  return { model: normalizeModelCompat(model), authStorage, modelRegistry };
}
