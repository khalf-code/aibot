import type { GatewayBrowserClient } from "../gateway.ts";
import type {
  ModelProviderUiEntry,
  OllamaModelUiEntry,
  ModelTestResult,
  ProviderTestResult,
  AllowedModelEntry,
} from "../types.models.ts";

export type ModelsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;

  // Loading states
  modelsLoading: boolean;
  providersLoading: boolean;
  ollamaLoading: boolean;
  testRunning: string | null; // model id being tested
  providerTestRunning: string | null; // provider id being tested
  ollamaPullRunning: string | null; // ollama model being pulled
  allowedModelsLoading: boolean;
  allowedModelsActionRunning: string | null; // action being performed

  // Data
  providers: ModelProviderUiEntry[];
  ollamaAvailable: boolean;
  ollamaModels: OllamaModelUiEntry[];
  defaultModel: string;
  heartbeatModel: string;
  allowedModels: AllowedModelEntry[];
  allowAnyModels: boolean;

  // Errors
  modelsError: string | null;
  providersError: string | null;
  ollamaError: string | null;
  allowedModelsError: string | null;

  // UI state
  selectedProvider: string | null;
  selectedOllamaModel: string | null;
  showAddProvider: boolean;
  testResults: Map<string, ModelTestResult>;
  providerTestResults: Map<string, ProviderTestResult>;
  activeTab: "providers" | "local" | "recommended" | "heartbeat" | "allowed";

  // Form state
  newProviderForm: {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    authType: "api-key" | "oauth";
    api?: string;
    models?: Array<{
      id: string;
      name: string;
      contextWindow?: number;
      maxTokens?: number;
      inputTypes?: Array<"text" | "image" | "audio" | "video">;
      reasoning?: boolean;
      costPer1MInput?: number;
      costPer1MOutput?: number;
    }>;
  };

  // Live models from provider APIs
  liveModels: Map<string, import("../types.models.ts").LiveModelEntry[]>;
  liveModelsLoading: string | null;
};

// Type helper for app state that has models properties mapped
export type AppModelsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  modelsLoading: boolean;
  modelsProviders: ModelProviderUiEntry[];
  modelsOllamaAvailable: boolean;
  modelsOllamaModels: OllamaModelUiEntry[];
  modelsDefaultModel: string;
  modelsHeartbeatModel: string;
  modelsAllowedModels: AllowedModelEntry[];
  modelsAllowAny: boolean;
  modelsError: string | null;
  modelsTestRunning: string | null;
  modelsProviderTestRunning: string | null;
  modelsOllamaPullRunning: string | null;
  modelsAllowedModelsLoading: boolean;
  modelsAllowedModelsActionRunning: string | null;
  modelsTestResults: Map<string, ModelTestResult>;
  modelsProviderTestResults: Map<string, ProviderTestResult>;
  modelsActiveTab: "providers" | "local" | "recommended" | "heartbeat" | "allowed";
  modelsShowAddProvider: boolean;
  modelsNewProviderForm: {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    authType: "api-key" | "oauth";
    api?: string;
    models?: Array<{
      id: string;
      name: string;
      contextWindow?: number;
      maxTokens?: number;
      inputTypes?: Array<"text" | "image" | "audio" | "video">;
      reasoning?: boolean;
      costPer1MInput?: number;
      costPer1MOutput?: number;
    }>;
  };
  modelsLiveModels: Map<string, import("../types.models.ts").LiveModelEntry[]>;
  modelsLiveModelsLoading: string | null;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export async function loadModelsStatus(state: AppModelsState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.modelsLoading) {
    return;
  }

  state.modelsLoading = true;
  state.modelsError = null;

  try {
    const result = await state.client.request<{
      providers: ModelProviderUiEntry[];
      ollamaAvailable: boolean;
      ollamaModels: OllamaModelUiEntry[];
      defaultModel: string;
      heartbeatModel: string;
    }>("models.status", {});

    if (result) {
      state.modelsProviders = result.providers ?? [];
      state.modelsOllamaAvailable = result.ollamaAvailable ?? false;
      state.modelsOllamaModels = result.ollamaModels ?? [];
      state.modelsDefaultModel = result.defaultModel ?? "";
      state.modelsHeartbeatModel = result.heartbeatModel ?? "";
    }

    // Also load allowed models
    await loadAllowedModels(state);
  } catch (err) {
    state.modelsError = getErrorMessage(err);
  } finally {
    state.modelsLoading = false;
  }
}

export async function testModel(state: AppModelsState, modelId: string, providerId: string) {
  if (!state.client || !state.connected) {
    return;
  }

  state.modelsTestRunning = modelId;

  try {
    const result = await state.client.request<ModelTestResult>("models.test", {
      model: modelId,
      provider: providerId,
    });

    if (result) {
      state.modelsTestResults = new Map(state.modelsTestResults).set(modelId, result);
    }
  } catch (err) {
    state.modelsTestResults = new Map(state.modelsTestResults).set(modelId, {
      ok: false,
      model: modelId,
      provider: providerId,
      latencyMs: 0,
      error: getErrorMessage(err),
    });
  } finally {
    state.modelsTestRunning = null;
  }
}

export async function testProvider(state: AppModelsState, providerId: string) {
  if (!state.client || !state.connected) {
    return;
  }

  state.modelsProviderTestRunning = providerId;

  try {
    const result = await state.client.request<ProviderTestResult>("models.testProvider", {
      provider: providerId,
    });

    if (result) {
      state.modelsProviderTestResults = new Map(state.modelsProviderTestResults).set(
        providerId,
        result,
      );

      // Update provider status in the list
      state.modelsProviders = state.modelsProviders.map((p) =>
        p.id === providerId
          ? { ...p, status: result.ok ? "connected" : "error", latencyMs: result.latencyMs }
          : p,
      );
    }
  } catch (err) {
    state.modelsProviderTestResults = new Map(state.modelsProviderTestResults).set(providerId, {
      ok: false,
      provider: providerId,
      latencyMs: 0,
      error: getErrorMessage(err),
    });
  } finally {
    state.modelsProviderTestRunning = null;
  }
}

export async function discoverOllamaModels(state: AppModelsState) {
  if (!state.client || !state.connected) {
    return;
  }

  state.modelsLoading = true;
  state.modelsError = null;

  try {
    const result = await state.client.request<{
      available: boolean;
      models: OllamaModelUiEntry[];
    }>("models.discoverLocal", { provider: "ollama" });

    if (result) {
      state.modelsOllamaAvailable = result.available;
      state.modelsOllamaModels = result.models ?? [];
    }
  } catch (err) {
    state.modelsError = getErrorMessage(err);
    state.modelsOllamaAvailable = false;
  } finally {
    state.modelsLoading = false;
  }
}

export async function pullOllamaModel(state: AppModelsState, modelName: string) {
  if (!state.client || !state.connected) {
    return;
  }

  state.modelsOllamaPullRunning = modelName;

  try {
    await state.client.request("models.pullLocal", {
      provider: "ollama",
      model: modelName,
    });

    // Refresh the list after pull
    await discoverOllamaModels(state);
  } catch (err) {
    state.modelsError = getErrorMessage(err);
  } finally {
    state.modelsOllamaPullRunning = null;
  }
}

export async function setDefaultModel(state: AppModelsState, modelRef: string) {
  if (!state.client || !state.connected) {
    return;
  }

  try {
    await state.client.request("models.setDefault", { model: modelRef });
    state.modelsDefaultModel = modelRef;
  } catch (err) {
    state.modelsError = getErrorMessage(err);
  }
}

export async function setHeartbeatModel(state: AppModelsState, modelRef: string) {
  if (!state.client || !state.connected) {
    return;
  }

  try {
    await state.client.request("models.setHeartbeatModel", { model: modelRef });
    state.modelsHeartbeatModel = modelRef;
  } catch (err) {
    state.modelsError = getErrorMessage(err);
  }
}

export async function fetchLiveModels(state: AppModelsState, providerId: string) {
  if (!state.client || !state.connected) {
    return;
  }

  state.modelsLiveModelsLoading = providerId;
  state.modelsError = null;

  try {
    const result = await state.client.request<{
      provider: string;
      models: Array<{ id: string; name: string; ownedBy: string }>;
    }>("models.fetchLive", { provider: providerId });

    if (result) {
      state.modelsLiveModels = new Map(state.modelsLiveModels).set(providerId, result.models);
    }
  } catch (err) {
    state.modelsError = getErrorMessage(err);
  } finally {
    state.modelsLiveModelsLoading = null;
  }
}

export async function addProvider(
  state: AppModelsState,
  models?: ModelsState["newProviderForm"]["models"],
) {
  if (!state.client || !state.connected) {
    return;
  }

  const { id, name, baseUrl, apiKey, authType, api } = state.modelsNewProviderForm;

  if (!id || !name || !baseUrl) {
    state.modelsError = "Provider ID, name, and base URL are required";
    return;
  }

  try {
    const result = await state.client.request<{ message?: string }>("models.addProvider", {
      id,
      name,
      baseUrl,
      apiKey: apiKey || undefined,
      authType,
      api,
      models: models || undefined,
    });

    // Reset form and refresh
    state.modelsNewProviderForm = {
      id: "",
      name: "",
      baseUrl: "",
      apiKey: "",
      authType: "api-key",
    };
    state.modelsShowAddProvider = false;

    // Show success message
    if (result?.message) {
      state.modelsError = null;
      // Could add a success toast here
    }

    await loadModelsStatus(state);
  } catch (err) {
    state.modelsError = getErrorMessage(err);
  }
}

export async function getOAuthUrl(state: AppModelsState, provider: string): Promise<string | null> {
  if (!state.client || !state.connected) {
    return null;
  }

  try {
    const result = await state.client.request<{ setupUrl?: string; message?: string }>(
      "models.getOAuthUrl",
      { provider },
    );
    return result?.setupUrl ?? null;
  } catch (err) {
    state.modelsError = getErrorMessage(err);
    return null;
  }
}

export async function removeProvider(state: AppModelsState, providerId: string) {
  if (!state.client || !state.connected) {
    return;
  }

  try {
    await state.client.request("models.removeProvider", { provider: providerId });
    await loadModelsStatus(state);
  } catch (err) {
    state.modelsError = getErrorMessage(err);
  }
}

export function initModelsState(): Omit<ModelsState, "client" | "connected"> {
  return {
    modelsLoading: false,
    providersLoading: false,
    ollamaLoading: false,
    testRunning: null,
    providerTestRunning: null,
    ollamaPullRunning: null,
    allowedModelsLoading: false,
    allowedModelsActionRunning: null,

    providers: [],
    ollamaAvailable: false,
    ollamaModels: [],
    defaultModel: "",
    heartbeatModel: "",
    allowedModels: [],
    allowAnyModels: true,

    modelsError: null,
    providersError: null,
    ollamaError: null,
    allowedModelsError: null,

    selectedProvider: null,
    selectedOllamaModel: null,
    showAddProvider: false,
    testResults: new Map(),
    providerTestResults: new Map(),
    activeTab: "providers",

    newProviderForm: {
      id: "",
      name: "",
      baseUrl: "",
      apiKey: "",
      authType: "api-key",
      api: undefined,
      models: undefined,
    },
    liveModels: new Map(),
    liveModelsLoading: null,
  };
}

export async function loadAllowedModels(state: AppModelsState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.modelsAllowedModelsLoading) {
    return;
  }

  state.modelsAllowedModelsLoading = true;
  state.modelsError = null;

  try {
    const result = await state.client.request<{
      allowAny: boolean;
      defaultModel: string;
      allowedModels: AllowedModelEntry[];
      count: number;
    }>("models.listAllowed", {});

    if (result) {
      state.modelsAllowedModels = result.allowedModels ?? [];
      state.modelsAllowAny = result.allowAny ?? true;
    }
  } catch (err) {
    state.modelsError = getErrorMessage(err);
  } finally {
    state.modelsAllowedModelsLoading = false;
  }
}

export async function addAllowedModel(state: AppModelsState, modelKey: string, alias?: string) {
  if (!state.client || !state.connected) {
    return;
  }

  state.modelsAllowedModelsActionRunning = `add:${modelKey}`;

  try {
    await state.client.request<{ message?: string }>("models.addAllowed", {
      model: modelKey,
      alias: alias?.trim() || undefined,
    });

    // Refresh the list
    await loadAllowedModels(state);
  } catch (err) {
    state.modelsError = getErrorMessage(err);
  } finally {
    state.modelsAllowedModelsActionRunning = null;
  }
}

export async function removeAllowedModel(state: AppModelsState, modelKey: string) {
  if (!state.client || !state.connected) {
    return;
  }

  state.modelsAllowedModelsActionRunning = `remove:${modelKey}`;

  try {
    await state.client.request<{ message?: string }>("models.removeAllowed", {
      model: modelKey,
    });

    // Refresh the list
    await loadAllowedModels(state);
  } catch (err) {
    state.modelsError = getErrorMessage(err);
  } finally {
    state.modelsAllowedModelsActionRunning = null;
  }
}

export async function setAllowAllModels(state: AppModelsState, allowAll: boolean) {
  if (!state.client || !state.connected) {
    return;
  }

  state.modelsAllowedModelsActionRunning = "setAllowAll";

  try {
    await state.client.request<{ message?: string }>("models.setAllowAll", {
      allowAll,
    });

    // Refresh the list
    await loadAllowedModels(state);
  } catch (err) {
    state.modelsError = getErrorMessage(err);
  } finally {
    state.modelsAllowedModelsActionRunning = null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}K`;
  }
  return `${tokens}`;
}

export function formatCost(cost: number): string {
  if (cost === 0) return "Free";
  if (cost < 0.01) return `< $0.01`;
  return `$${cost.toFixed(2)}`;
}

// Recommended models for M3 Max 36GB based on token optimization guide
// Updated: 2026-02-05 with latest model recommendations
export const RECOMMENDED_MODELS = {
  heartbeat: [
    {
      id: "ollama/llama3.2:3b",
      name: "Llama 3.2 3B",
      why: "Ultra-fast for simple checks (~50 tok/s)",
    },
    {
      id: "ollama/gemma3:4b",
      name: "Gemma 3 4B",
      why: "Fastest local, vision capable (~50 tok/s)",
    },
  ],
  simple: [
    {
      id: "anthropic/claude-haiku-4.5-20251015",
      name: "Claude Haiku 4.5",
      why: "Fast, cheap API tasks ($1/$5 per 1M)",
    },
    {
      id: "ollama/deepseek-coder-v2:16b",
      name: "DeepSeek Coder V2 16B",
      why: "Fast coding with MoE (~20 tok/s)",
    },
    {
      id: "ollama/llama3.3:8b",
      name: "Llama 3.3 8B",
      why: "Balanced local, good for daily tasks (~35 tok/s)",
    },
    {
      id: "kimi/kimi-k2.5-32k",
      name: "Kimi K2.5 32K",
      why: "Fast context, good for coding ($1/$4 per 1M)",
    },
  ],
  complex: [
    {
      id: "anthropic/claude-opus-4.5-20251101",
      name: "Claude Opus 4.5",
      why: "Top-tier reasoning ($5/$25 per 1M)",
    },
    { id: "openai/gpt-5", name: "GPT-5", why: "Flagship model, 272K context ($1.25/$10 per 1M)" },
    {
      id: "kimi/kimi-k2.5",
      name: "Kimi K2.5",
      why: "256K context, strong reasoning ($2/$8 per 1M)",
    },
    {
      id: "kimi/kimi-k2.5-1m",
      name: "Kimi K2.5 1M",
      why: "1M context window for large docs ($3.5/$14 per 1M)",
    },
    {
      id: "kimi/kimi-k2-code",
      name: "Kimi K2 Code",
      why: "Optimized for coding tasks ($2/$8 per 1M)",
    },
    {
      id: "ollama/qwen2.5-coder:32b",
      name: "Qwen2.5-Coder 32B",
      why: "Best local coding - GPT-4o level (~9-14 tok/s)",
    },
    {
      id: "ollama/qwen3:30b",
      name: "Qwen 3 30B",
      why: "MoE architecture - fast & capable (~20-40 tok/s)",
    },
    { id: "ollama/phi4:14b", name: "Phi-4 14B", why: "Best local reasoning & logic (~15 tok/s)" },
  ],
};
