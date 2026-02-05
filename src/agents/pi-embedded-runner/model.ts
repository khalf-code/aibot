import type { Api, Model } from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../../config/config.js";
import type { ModelDefinitionConfig } from "../../config/types.js";
import { resolveOpenClawAgentDir } from "../agent-paths.js";
import { DEFAULT_CONTEXT_TOKENS } from "../defaults.js";
import { normalizeModelCompat } from "../model-compat.js";
import { normalizeProviderId } from "../model-selection.js";
import {
  discoverAuthStorage,
  discoverModels,
  type AuthStorage,
  type ModelRegistry,
} from "../pi-model-discovery.js";

/**
 * Bedrock inference profile prefixes. AWS requires these for certain models
 * (e.g., Claude Opus 4.5) when using on-demand throughput.
 * See: https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html
 */
const BEDROCK_INFERENCE_PROFILE_PREFIXES = ["us.", "eu.", "ap.", "global."];

/**
 * Strips the regional inference profile prefix from a Bedrock model ID.
 * e.g., "us.anthropic.claude-opus-4-5-20251101-v1:0" -> "anthropic.claude-opus-4-5-20251101-v1:0"
 */
export function stripBedrockInferenceProfilePrefix(modelId: string): {
  prefix: string | null;
  baseModelId: string;
} {
  for (const prefix of BEDROCK_INFERENCE_PROFILE_PREFIXES) {
    if (modelId.startsWith(prefix)) {
      return {
        prefix,
        baseModelId: modelId.slice(prefix.length),
      };
    }
  }
  return { prefix: null, baseModelId: modelId };
}

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

/**
 * Try to find a model in inline models, optionally matching Bedrock inference profile variants.
 * For Bedrock models with regional prefixes (us., eu., etc.), also tries matching the base model ID.
 */
function findInlineModel(
  inlineModels: InlineModelEntry[],
  normalizedProvider: string,
  modelId: string,
): InlineModelEntry | undefined {
  // Direct match first
  const directMatch = inlineModels.find(
    (entry) => normalizeProviderId(entry.provider) === normalizedProvider && entry.id === modelId,
  );
  if (directMatch) {
    return directMatch;
  }

  // For Bedrock, try matching with/without inference profile prefix
  if (normalizedProvider === "amazon-bedrock") {
    const { prefix, baseModelId } = stripBedrockInferenceProfilePrefix(modelId);
    if (prefix) {
      // User requested prefixed ID (e.g., us.anthropic...), try finding base model
      const baseMatch = inlineModels.find(
        (entry) =>
          normalizeProviderId(entry.provider) === normalizedProvider && entry.id === baseModelId,
      );
      if (baseMatch) {
        // Return a copy with the prefixed ID so AWS receives the inference profile ID
        return { ...baseMatch, id: modelId };
      }
    }
  }

  return undefined;
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
  const normalizedProvider = normalizeProviderId(provider);

  // Try direct registry lookup first
  let model = modelRegistry.find(provider, modelId) as Model<Api> | null;

  // For Bedrock with inference profile prefix, try matching the base model ID
  if (!model && normalizedProvider === "amazon-bedrock") {
    const { prefix, baseModelId } = stripBedrockInferenceProfilePrefix(modelId);
    if (prefix) {
      const baseModel = modelRegistry.find(provider, baseModelId) as Model<Api> | null;
      if (baseModel) {
        // Return a copy with the prefixed ID for the API call
        model = { ...baseModel, id: modelId } as Model<Api>;
      }
    }
  }

  if (!model) {
    const providers = cfg?.models?.providers ?? {};
    const inlineModels = buildInlineProviderModels(providers);
    if (inlineModels.length > 0) {
      const inlineIds = inlineModels
        .filter((m) => normalizeProviderId(m.provider) === normalizedProvider)
        .map((m) => m.id)
        .join(", ");
    }

    const inlineMatch = findInlineModel(inlineModels, normalizedProvider, modelId);
    if (inlineMatch) {
      const normalized = normalizeModelCompat(inlineMatch as Model<Api>);
      return {
        model: normalized,
        authStorage,
        modelRegistry,
      };
    }
    const providerCfg = providers[provider];
    if (providerCfg || modelId.startsWith("mock-")) {
      const fallbackModel: Model<Api> = normalizeModelCompat({
        id: modelId,
        name: modelId,
        api: providerCfg?.api ?? "openai-responses",
        provider,
        baseUrl: providerCfg?.baseUrl,
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
