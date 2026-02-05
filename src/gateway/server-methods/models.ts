import type { ModelProviderConfig } from "../../config/types.models.js";
import type { GatewayRequestHandlers } from "./types.js";
import { ensureOpenClawModelsJson } from "../../agents/models-config.js";
import {
  loadConfig,
  readConfigFileSnapshot,
  writeConfigFile,
  parseConfigJson5,
  validateConfigObjectWithPlugins,
} from "../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsListParams,
} from "../protocol/index.js";

// Ollama types
interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    family?: string;
    parameter_size?: string;
    format?: string;
    quantization_level?: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

// Helper to discover Ollama models
async function discoverOllamaModels(): Promise<{
  available: boolean;
  models: Array<{
    name: string;
    size: string;
    parameterSize?: string;
    family?: string;
    format?: string;
    quantization?: string;
    contextWindow: number;
  }>;
}> {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { available: false, models: [] };
    }

    const data = (await response.json()) as OllamaTagsResponse;

    const models = data.models.map((model) => ({
      name: model.name,
      size: formatBytes(model.size),
      parameterSize: model.details?.parameter_size,
      family: model.details?.family,
      format: model.details?.format,
      quantization: model.details?.quantization_level,
      contextWindow: 128000,
    }));

    return { available: true, models };
  } catch {
    return { available: false, models: [] };
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Helper to test a model with a simple inference
async function testModelInference(
  baseUrl: string,
  apiKey: string | undefined,
  modelId: string,
): Promise<{
  ok: boolean;
  latencyMs: number;
  tokensPerSecond?: number;
  error?: string;
  sample?: string;
}> {
  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Say 'OK' and nothing else." }],
        max_tokens: 10,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      return { ok: false, latencyMs, error: `HTTP ${response.status}: ${error}` };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { completion_tokens?: number };
    };

    const sample = data.choices?.[0]?.message?.content ?? "";
    const completionTokens = data.usage?.completion_tokens ?? 0;
    const tokensPerSecond =
      completionTokens > 0 ? completionTokens / (latencyMs / 1000) : undefined;

    return { ok: true, latencyMs, tokensPerSecond, sample };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - startTime,
      error: String(err),
    };
  }
}

// Helper to read and parse current config
async function getCurrentConfig(): Promise<{
  config: Record<string, unknown>;
  raw: string;
}> {
  const snapshot = await readConfigFileSnapshot();
  if (snapshot.exists && snapshot.raw) {
    const parsed = parseConfigJson5(snapshot.raw);
    if (parsed.ok) {
      return { config: parsed.parsed as Record<string, unknown>, raw: snapshot.raw };
    }
  }
  return { config: {}, raw: "{}" };
}

export const modelsHandlers: GatewayRequestHandlers = {
  "models.list": async ({ params, respond, context }) => {
    if (!validateModelsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.list params: ${formatValidationErrors(validateModelsListParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const models = await context.loadGatewayModelCatalog();
      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.status": async ({ respond }) => {
    try {
      const config = await getCurrentConfig();
      const parsedConfig = loadConfig();

      // Build providers list from config
      const providers: Array<{
        id: string;
        name: string;
        baseUrl: string;
        authType: string;
        apiKeyConfigured: boolean;
        oauthConfigured: boolean;
        status: "connected" | "error" | "unknown";
        models: Array<{
          id: string;
          name: string;
          contextWindow: number;
          maxTokens: number;
          inputTypes: Array<"text" | "image" | "audio" | "video">;
          reasoning: boolean;
          costPer1MInput: number;
          costPer1MOutput: number;
        }>;
      }> = [];

      // Get providers from config
      const providersConfig =
        (config.config.models as { providers?: Record<string, ModelProviderConfig> })?.providers ??
        {};

      for (const [providerId, providerConfig] of Object.entries(providersConfig)) {
        const isOllama = providerId === "ollama";
        const models =
          providerConfig.models?.map((m) => ({
            id: m.id,
            name: m.name ?? m.id,
            contextWindow: m.contextWindow ?? 128000,
            maxTokens: m.maxTokens ?? 8192,
            inputTypes: m.input ?? ["text"],
            reasoning: m.reasoning ?? false,
            costPer1MInput: m.cost?.input ?? 0,
            costPer1MOutput: m.cost?.output ?? 0,
          })) ?? [];

        providers.push({
          id: providerId,
          name: isOllama ? "Ollama (Local)" : providerId,
          baseUrl: providerConfig.baseUrl ?? (isOllama ? "http://127.0.0.1:11434" : ""),
          authType: providerConfig.auth ?? (isOllama ? "none" : "api-key"),
          apiKeyConfigured: Boolean(providerConfig.apiKey),
          oauthConfigured: providerConfig.auth === "oauth",
          status: "unknown",
          models,
        });
      }

      // Check Ollama availability separately
      const ollamaDiscovery = await discoverOllamaModels();

      // Get default model from config
      const defaultModel =
        (parsedConfig.agents?.defaults?.model as { primary?: string })?.primary ?? "";

      // Get heartbeat model from config (separate from default model)
      const heartbeatModel =
        (parsedConfig.agents?.defaults?.heartbeat as { model?: string })?.model ?? "";

      respond(
        true,
        {
          providers,
          ollamaAvailable: ollamaDiscovery.available,
          ollamaModels: ollamaDiscovery.models,
          defaultModel,
          heartbeatModel,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.test": async ({ params, respond }) => {
    const { model, provider } = params as { model: string; provider: string };

    try {
      const config = await getCurrentConfig();
      const providersConfig =
        (config.config.models as { providers?: Record<string, ModelProviderConfig> })?.providers ??
        {};
      const providerConfig = providersConfig[provider];

      if (!providerConfig && provider !== "ollama") {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Provider not found: ${provider}`),
        );
        return;
      }

      const baseUrl =
        provider === "ollama" ? "http://127.0.0.1:11434/v1" : (providerConfig?.baseUrl ?? "");
      const apiKey = providerConfig?.apiKey;

      const result = await testModelInference(baseUrl, apiKey, model);

      respond(
        true,
        {
          ok: result.ok,
          model,
          provider,
          latencyMs: result.latencyMs,
          tokensPerSecond: result.tokensPerSecond,
          error: result.error,
          sample: result.sample,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.testProvider": async ({ params, respond }) => {
    const { provider } = params as { provider: string };

    try {
      const config = await getCurrentConfig();
      const providersConfig =
        (config.config.models as { providers?: Record<string, ModelProviderConfig> })?.providers ??
        {};
      const providerConfig = providersConfig[provider];

      if (!providerConfig && provider !== "ollama") {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Provider not found: ${provider}`),
        );
        return;
      }

      const baseUrl =
        provider === "ollama" ? "http://127.0.0.1:11434" : (providerConfig?.baseUrl ?? "");

      const startTime = Date.now();

      try {
        const headers: Record<string, string> = {};
        if (providerConfig?.apiKey) {
          headers["Authorization"] = `Bearer ${providerConfig.apiKey}`;
        }

        const response = await fetch(
          `${baseUrl}${provider === "ollama" ? "/api/tags" : "/models"}`,
          {
            headers,
            signal: AbortSignal.timeout(10000),
          },
        );

        const latencyMs = Date.now() - startTime;

        if (response.ok) {
          const data = (await response.json()) as { models?: unknown[]; data?: unknown[] };
          const modelCount =
            provider === "ollama" ? (data.models?.length ?? 0) : (data.data?.length ?? 0);
          respond(
            true,
            {
              ok: true,
              provider,
              latencyMs,
              modelsAccessible: modelCount,
            },
            undefined,
          );
        } else {
          respond(
            true,
            {
              ok: false,
              provider,
              latencyMs,
              error: `HTTP ${response.status}`,
            },
            undefined,
          );
        }
      } catch (err) {
        respond(
          true,
          {
            ok: false,
            provider,
            latencyMs: Date.now() - startTime,
            error: String(err),
          },
          undefined,
        );
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.fetchLive": async ({ params, respond }) => {
    const { provider } = params as { provider: string };

    try {
      const config = await getCurrentConfig();
      const providersConfig =
        (config.config.models as { providers?: Record<string, ModelProviderConfig> })?.providers ??
        {};
      const providerConfig = providersConfig[provider];

      if (!providerConfig) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Provider not found: ${provider}`),
        );
        return;
      }

      const baseUrl = providerConfig?.baseUrl ?? "";

      try {
        const headers: Record<string, string> = {};
        if (providerConfig?.apiKey) {
          headers["Authorization"] = `Bearer ${providerConfig.apiKey}`;
        }

        const response = await fetch(`${baseUrl}/models`, {
          headers,
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          respond(
            false,
            undefined,
            errorShape(ErrorCodes.UNAVAILABLE, `HTTP ${response.status}: ${await response.text()}`),
          );
          return;
        }

        const data = (await response.json()) as {
          data?: Array<{
            id?: string;
            object?: string;
            created?: number;
            owned_by?: string;
          }>;
        };

        const models = (data.data ?? []).map((m) => ({
          id: m.id ?? "unknown",
          name: m.id ?? "Unknown Model",
          ownedBy: m.owned_by ?? "unknown",
        }));

        respond(
          true,
          {
            provider,
            models,
          },
          undefined,
        );
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
      }
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.discoverLocal": async ({ params, respond }) => {
    const { provider } = params as { provider: string };

    if (provider !== "ollama") {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          "Only ollama provider is supported for local discovery",
        ),
      );
      return;
    }

    try {
      const result = await discoverOllamaModels();
      respond(true, result, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.pullLocal": async ({ params, respond }) => {
    const { provider, model } = params as { provider: string; model: string };

    if (provider !== "ollama") {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "Only ollama provider is supported for pull"),
      );
      return;
    }

    try {
      // Check if Ollama is available first
      const checkResponse = await fetch("http://127.0.0.1:11434/api/tags", {
        signal: AbortSignal.timeout(5000),
      });

      if (!checkResponse.ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.UNAVAILABLE, "Ollama is not running on http://127.0.0.1:11434"),
        );
        return;
      }

      // Start the pull operation
      const pullResponse = await fetch("http://127.0.0.1:11434/api/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: model, stream: false }),
        signal: AbortSignal.timeout(300000), // 5 minute timeout for large models
      });

      if (!pullResponse.ok) {
        const error = await pullResponse.text();
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, `Pull failed: ${error}`));
        return;
      }

      const result = (await pullResponse.json()) as { status?: string };
      respond(
        true,
        {
          message: "Pull completed",
          status: result.status,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.setDefault": async ({ params, respond }) => {
    const { model } = params as { model: string };

    try {
      const { config, raw } = await getCurrentConfig();

      // Set the default model in agents.defaults
      if (!config.agents) {
        config.agents = {};
      }
      if (!(config.agents as Record<string, unknown>).defaults) {
        (config.agents as Record<string, unknown>).defaults = {};
      }
      const defaults = (config.agents as { defaults: Record<string, unknown> }).defaults;

      if (!defaults.model) {
        defaults.model = {};
      }
      (defaults.model as Record<string, unknown>).primary = model;

      // Validate before writing
      const validated = validateConfigObjectWithPlugins(config);
      if (!validated.ok) {
        console.error(
          "[models.addProvider] Config validation failed:",
          JSON.stringify(validated.issues, null, 2),
        );
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Invalid config after modification", {
            details: { issues: validated.issues },
          }),
        );
        return;
      }

      await writeConfigFile(validated.config);

      // Regenerate models.json to include any newly discovered local models
      // This is important when setting an Ollama model as default
      await ensureOpenClawModelsJson(validated.config);

      respond(
        true,
        {
          model,
          message: "Default model updated successfully",
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.setHeartbeatModel": async ({ params, respond }) => {
    const { model } = params as { model: string };

    try {
      const { config, raw } = await getCurrentConfig();

      // Set the heartbeat model in agents.defaults.heartbeat
      if (!config.agents) {
        config.agents = {};
      }
      if (!(config.agents as Record<string, unknown>).defaults) {
        (config.agents as Record<string, unknown>).defaults = {};
      }
      const defaults = (config.agents as { defaults: Record<string, unknown> }).defaults;

      if (!defaults.heartbeat) {
        defaults.heartbeat = {};
      }
      (defaults.heartbeat as Record<string, unknown>).model = model;

      // Validate before writing
      const validated = validateConfigObjectWithPlugins(config);
      if (!validated.ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Invalid config after modification", {
            details: { issues: validated.issues },
          }),
        );
        return;
      }

      await writeConfigFile(validated.config);

      // Regenerate models.json to include any newly discovered local models
      await ensureOpenClawModelsJson(validated.config);

      respond(
        true,
        {
          model,
          message: "Heartbeat model updated successfully",
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.addProvider": async ({ params, respond }) => {
    const { id, name, baseUrl, apiKey, authType, api, models } = params as {
      id: string;
      name: string;
      baseUrl: string;
      apiKey?: string;
      authType?: string;
      api?: string;
      models?: Array<{
        id: string;
        name: string;
        contextWindow?: number;
        maxTokens?: number;
        inputTypes?: Array<"text" | "image">;
        reasoning?: boolean;
        costPer1MInput?: number;
        costPer1MOutput?: number;
      }>;
    };

    try {
      const { config } = await getCurrentConfig();

      if (!config.models) {
        config.models = {};
      }
      if (!(config.models as Record<string, unknown>).providers) {
        (config.models as Record<string, unknown>).providers = {};
      }
      const providers = (config.models as { providers: Record<string, unknown> }).providers;

      // Build models array from preset or use empty array
      const modelDefinitions =
        models?.map((m) => ({
          id: m.id,
          name: m.name,
          contextWindow: m.contextWindow ?? 128000,
          maxTokens: m.maxTokens ?? 8192,
          input: m.inputTypes ?? ["text"],
          reasoning: m.reasoning ?? false,
          cost: {
            input: m.costPer1MInput ?? 0,
            output: m.costPer1MOutput ?? 0,
            cacheRead: 0,
            cacheWrite: 0,
          },
        })) ?? [];

      // Create provider config
      const providerConfig: Record<string, unknown> = {
        baseUrl,
        models: modelDefinitions,
      };

      if (apiKey) {
        providerConfig.apiKey = apiKey;
      }

      if (api) {
        providerConfig.api = api;
      }

      if (authType && authType !== "none") {
        providerConfig.auth = authType;
      }

      providers[id] = providerConfig;

      // Validate before writing
      const validated = validateConfigObjectWithPlugins(config);
      if (!validated.ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Invalid config after modification", {
            details: { issues: validated.issues },
          }),
        );
        return;
      }

      await writeConfigFile(validated.config);

      // Regenerate models.json to include the new provider
      await ensureOpenClawModelsJson(validated.config);

      respond(
        true,
        {
          provider: id,
          message: "Provider added successfully",
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.removeProvider": async ({ params, respond }) => {
    const { provider } = params as { provider: string };

    try {
      const { config } = await getCurrentConfig();

      const providers = (config.models as { providers?: Record<string, unknown> })?.providers;
      if (!providers || !providers[provider]) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Provider not found: ${provider}`),
        );
        return;
      }

      delete providers[provider];

      // Validate before writing
      const validated = validateConfigObjectWithPlugins(config);
      if (!validated.ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Invalid config after modification", {
            details: { issues: validated.issues },
          }),
        );
        return;
      }

      await writeConfigFile(validated.config);

      // Regenerate models.json to remove the provider
      await ensureOpenClawModelsJson(validated.config);

      respond(
        true,
        {
          provider,
          message: "Provider removed successfully",
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.getOAuthUrl": async ({ params, respond }) => {
    const { provider } = params as { provider: string };

    // OAuth providers configuration
    const oauthProviders: Record<string, { authUrl: string; scopes: string; docsUrl: string }> = {
      openai: {
        authUrl: "https://platform.openai.com/settings/organization/api-keys",
        scopes: "",
        docsUrl: "https://platform.openai.com/docs/quickstart",
      },
      anthropic: {
        authUrl: "https://console.anthropic.com/settings/keys",
        scopes: "",
        docsUrl: "https://docs.anthropic.com/en/docs/quickstart",
      },
      google: {
        authUrl: "https://aistudio.google.com/app/apikey",
        scopes: "",
        docsUrl: "https://ai.google.dev/gemini-api/docs",
      },
      openrouter: {
        authUrl: "https://openrouter.ai/settings/keys",
        scopes: "",
        docsUrl: "https://openrouter.ai/docs/quickstart",
      },
    };

    const providerConfig = oauthProviders[provider];
    if (!providerConfig) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `OAuth not supported for provider: ${provider}`),
      );
      return;
    }

    respond(
      true,
      {
        provider,
        setupUrl: providerConfig.authUrl,
        docsUrl: providerConfig.docsUrl,
        message: `Visit ${providerConfig.authUrl} to create an API key`,
      },
      undefined,
    );
  },

  "models.listAllowed": async ({ respond }) => {
    try {
      const parsedConfig = loadConfig();

      // Get the configured models allowlist
      const modelsConfig = parsedConfig.agents?.defaults?.models ?? {};
      const allowedModels = Object.entries(modelsConfig).map(([key, config]) => {
        const alias = (config as { alias?: string })?.alias;
        return {
          key,
          alias: alias?.trim() || undefined,
        };
      });

      // Get the default model
      const defaultModel =
        (parsedConfig.agents?.defaults?.model as { primary?: string })?.primary ?? "";

      respond(
        true,
        {
          allowAny: allowedModels.length === 0,
          defaultModel,
          allowedModels,
          count: allowedModels.length,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.addAllowed": async ({ params, respond }) => {
    const { model, alias } = params as { model: string; alias?: string };

    try {
      const { config } = await getCurrentConfig();

      if (!config.agents) {
        config.agents = {};
      }
      if (!(config.agents as Record<string, unknown>).defaults) {
        (config.agents as Record<string, unknown>).defaults = {};
      }
      const defaults = (config.agents as { defaults: Record<string, unknown> }).defaults;

      if (!defaults.models) {
        defaults.models = {};
      }
      const models = (defaults as { models: Record<string, unknown> }).models;

      // Add or update the model entry
      const existingEntry = models[model] as { alias?: string } | undefined;
      const newEntry: { alias?: string } = {};
      if (alias?.trim()) {
        newEntry.alias = alias.trim();
      } else if (existingEntry?.alias) {
        newEntry.alias = existingEntry.alias;
      }

      models[model] = newEntry;

      // Validate before writing
      const validated = validateConfigObjectWithPlugins(config);
      if (!validated.ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Invalid config after modification", {
            details: { issues: validated.issues },
          }),
        );
        return;
      }

      await writeConfigFile(validated.config);

      respond(
        true,
        {
          model,
          alias: newEntry.alias,
          message: `Model ${model} added to allowlist`,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.removeAllowed": async ({ params, respond }) => {
    const { model } = params as { model: string };

    try {
      const { config } = await getCurrentConfig();

      const defaults = (config.agents as { defaults?: { models?: Record<string, unknown> } })
        ?.defaults;
      const models = defaults?.models;

      if (!models || !(model in models)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, `Model not in allowlist: ${model}`),
        );
        return;
      }

      delete models[model];

      // Validate before writing
      const validated = validateConfigObjectWithPlugins(config);
      if (!validated.ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Invalid config after modification", {
            details: { issues: validated.issues },
          }),
        );
        return;
      }

      await writeConfigFile(validated.config);

      respond(
        true,
        {
          model,
          message: `Model ${model} removed from allowlist`,
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "models.setAllowAll": async ({ params, respond }) => {
    const { allowAll } = params as { allowAll: boolean };

    try {
      const { config } = await getCurrentConfig();

      if (!config.agents) {
        config.agents = {};
      }
      if (!(config.agents as Record<string, unknown>).defaults) {
        (config.agents as Record<string, unknown>).defaults = {};
      }
      const defaults = (config.agents as { defaults: Record<string, unknown> }).defaults;

      if (allowAll) {
        // Clear the models allowlist to allow all
        defaults.models = {};
      } else {
        // If turning off allowAll, ensure we have at least the default model in the list
        if (!defaults.models || Object.keys(defaults.models).length === 0) {
          const defaultModel =
            (defaults.model as { primary?: string })?.primary ?? "anthropic/claude-sonnet-4-5";
          defaults.models = {
            [defaultModel]: {},
          };
        }
      }

      // Validate before writing
      const validated = validateConfigObjectWithPlugins(config);
      if (!validated.ok) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Invalid config after modification", {
            details: { issues: validated.issues },
          }),
        );
        return;
      }

      await writeConfigFile(validated.config);

      respond(
        true,
        {
          allowAll,
          message: allowAll
            ? "All models are now allowed (empty allowlist)"
            : "Model allowlist restrictions enabled",
        },
        undefined,
      );
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
