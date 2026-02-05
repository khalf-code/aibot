import { html, nothing } from "lit";
import type {
  ModelProviderUiEntry,
  OllamaModelUiEntry,
  ModelTestResult,
  ProviderTestResult,
  AllowedModelEntry,
} from "../types.models.ts";
import { RECOMMENDED_MODELS } from "../controllers/models.ts";

export type ModelsProps = {
  loading: boolean;
  providers: ModelProviderUiEntry[];
  ollamaAvailable: boolean;
  ollamaModels: OllamaModelUiEntry[];
  defaultModel: string;
  heartbeatModel: string;
  allowedModels: AllowedModelEntry[];
  allowAnyModels: boolean;
  allowedModelsLoading: boolean;
  allowedModelsActionRunning: string | null;
  error: string | null;
  testRunning: string | null;
  providerTestRunning: string | null;
  ollamaPullRunning: string | null;
  testResults: Map<string, ModelTestResult>;
  providerTestResults: Map<string, ProviderTestResult>;
  activeTab: "providers" | "local" | "recommended" | "heartbeat" | "allowed";
  showAddProvider: boolean;
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
  liveModels: Map<string, import("../types.models.ts").LiveModelEntry[]>;
  liveModelsLoading: string | null;
  onRefresh: () => void;
  onTabChange: (tab: "providers" | "local" | "recommended" | "heartbeat" | "allowed") => void;
  onTestModel: (modelId: string, providerId: string) => void;
  onTestProvider: (providerId: string) => void;
  onDiscoverOllama: () => void;
  onPullOllamaModel: (modelName: string) => void;
  onSetDefaultModel: (modelRef: string) => void;
  onSetHeartbeatModel: (modelRef: string) => void;
  onFetchLiveModels: (providerId: string) => void;
  onToggleAddProvider: () => void;
  onAddProvider: (models?: ModelsProps["newProviderForm"]["models"]) => void;
  onRemoveProvider: (providerId: string) => void;
  onProviderFormChange: (field: string, value: string) => void;
  onProviderPresetSelect?: (preset: {
    id: string;
    name: string;
    baseUrl: string;
    docsUrl: string;
    api: string;
    models: Array<{
      id: string;
      name: string;
      contextWindow?: number;
      maxTokens?: number;
      inputTypes?: Array<"text" | "image" | "audio" | "video">;
      reasoning?: boolean;
      costPer1MInput?: number;
      costPer1MOutput?: number;
    }>;
  }) => void;
  onAddAllowedModel: (modelKey: string, alias?: string) => void;
  onRemoveAllowedModel: (modelKey: string) => void;
  onSetAllowAllModels: (allowAll: boolean) => void;
};

export function renderModels(props: ModelsProps) {
  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">AI Models</div>
          <div class="card-sub">
            Manage providers, local models, and optimize for your workflow.
          </div>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      ${
        props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
          : nothing
      }

      <!-- Tab Navigation -->
      <div class="tab-nav" style="margin-top: 16px;">
        <button
          class="tab-btn ${props.activeTab === "providers" ? "active" : ""}"
          @click=${() => props.onTabChange("providers")}
        >
          Cloud Providers
        </button>
        <button
          class="tab-btn ${props.activeTab === "local" ? "active" : ""}"
          @click=${() => props.onTabChange("local")}
        >
          Local Models
          ${
            props.ollamaAvailable
              ? html`
                  <span class="chip chip-ok" style="margin-left: 6px">●</span>
                `
              : nothing
          }
        </button>
        <button
          class="tab-btn ${props.activeTab === "allowed" ? "active" : ""}"
          @click=${() => props.onTabChange("allowed")}
        >
          Allowed Models
          ${
            props.allowAnyModels
              ? html`
                  <span class="chip" style="margin-left: 6px">all</span>
                `
              : html`<span class="chip chip-ok" style="margin-left: 6px;">${props.allowedModels.length}</span>`
          }
        </button>
        <button
          class="tab-btn ${props.activeTab === "recommended" ? "active" : ""}"
          @click=${() => props.onTabChange("recommended")}
        >
          Recommended
        </button>
        <button
          class="tab-btn ${props.activeTab === "heartbeat" ? "active" : ""}"
          @click=${() => props.onTabChange("heartbeat")}
        >
          Heartbeat
          ${
            props.heartbeatModel
              ? html`
                  <span class="chip chip-ok" style="margin-left: 6px">✓</span>
                `
              : nothing
          }
        </button>
      </div>

      <!-- Tab Content -->
      <div class="tab-content" style="margin-top: 16px;">
        ${
          props.activeTab === "providers"
            ? renderProvidersTab(props)
            : props.activeTab === "local"
              ? renderLocalTab(props)
              : props.activeTab === "allowed"
                ? renderAllowedTab(props)
                : props.activeTab === "recommended"
                  ? renderRecommendedTab(props)
                  : renderHeartbeatTab(props)
        }
      </div>
    </section>
  `;
}

function renderProvidersTab(props: ModelsProps) {
  return html`
    <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
      <h3 style="margin: 0; font-size: 14px; font-weight: 600;">
        Configured Providers (${props.providers.length})
      </h3>
      <button class="btn btn-primary" @click=${props.onToggleAddProvider}>
        + Add Provider
      </button>
    </div>

    ${props.showAddProvider ? renderAddProviderForm(props) : nothing}

    ${
      props.providers.length === 0
        ? html`
            <div class="callout" style="margin-top: 12px">
              No providers configured. Add a provider to get started with cloud AI models.
            </div>
          `
        : html`
          <div class="models-provider-list">
            ${props.providers.map((provider) => renderProviderCard(provider, props))}
          </div>
        `
    }
  `;
}

function renderProviderCard(provider: ModelProviderUiEntry, props: ModelsProps) {
  const testResult = props.providerTestResults.get(provider.id);
  const isTesting = props.providerTestRunning === provider.id;
  const liveModels = props.liveModels.get(provider.id);
  const isLoadingLive = props.liveModelsLoading === provider.id;
  const isOllama = provider.id === "ollama";

  return html`
    <div class="list-item" style="flex-direction: column; align-items: stretch;">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="list-title" style="font-size: 15px; font-weight: 600;">
            ${provider.name}
            <span class="chip" style="margin-left: 8px; font-size: 11px;">${provider.id}</span>
          </div>
          <div class="list-sub" style="margin-top: 4px;">${provider.baseUrl}</div>
          <div class="chip-row" style="margin-top: 6px;">
            <span class="chip ${getStatusChipClass(provider.status)}">
              ${provider.status === "checking" ? "Checking…" : provider.status}
            </span>
            ${
              provider.latencyMs ? html`<span class="chip">${provider.latencyMs}ms</span>` : nothing
            }
            ${
              provider.models.length > 0
                ? html`<span class="chip">${provider.models.length} configured</span>`
                : nothing
            }
            ${
              testResult?.modelsAccessible
                ? html`<span class="chip chip-ok">${testResult.modelsAccessible} accessible</span>`
                : nothing
            }
          </div>
        </div>
        <div class="row" style="gap: 6px;">
          ${
            !isOllama && testResult?.ok
              ? html`
                <button
                  class="btn"
                  ?disabled=${isLoadingLive}
                  @click=${() => props.onFetchLiveModels(provider.id)}
                >
                  ${isLoadingLive ? "Loading…" : "Fetch Live Models"}
                </button>
              `
              : nothing
          }
          <button
            class="btn"
            ?disabled=${isTesting}
            @click=${() => props.onTestProvider(provider.id)}
          >
            ${isTesting ? "Testing…" : "Test Connection"}
          </button>
          ${
            !provider.id.startsWith("builtin-")
              ? html`
                <button
                  class="btn btn-danger"
                  @click=${() => props.onRemoveProvider(provider.id)}
                >
                  Remove
                </button>
              `
              : nothing
          }
        </div>
      </div>

      ${
        testResult
          ? html`
            <div
              class="callout ${testResult.ok ? "success" : "danger"}"
              style="margin-top: 12px;"
            >
              ${
                testResult.ok
                  ? html`
                    ✅ Connected successfully (${testResult.latencyMs}ms)
                    ${
                      testResult.modelsAccessible
                        ? html`• ${testResult.modelsAccessible} models accessible from API`
                        : nothing
                    }
                  `
                  : html`❌ Connection failed: ${testResult.error}`
              }
            </div>
          `
          : nothing
      }

      ${
        liveModels && liveModels.length > 0
          ? html`
            <details style="margin-top: 12px;" open>
              <summary style="cursor: pointer; font-size: 13px; color: var(--muted);">
                Live Models from API (${liveModels.length} found)
              </summary>
              <div class="models-list" style="margin-top: 8px; max-height: 400px; overflow-y: auto;">
                ${liveModels.map((model) => renderLiveModelRow(model, provider.id, props))}
              </div>
            </details>
          `
          : nothing
      }

      ${
        provider.models.length > 0
          ? html`
            <details style="margin-top: 12px;">
              <summary style="cursor: pointer; font-size: 13px; color: var(--muted);">
                Configured Models (${provider.models.length})
              </summary>
              <div class="models-list" style="margin-top: 8px;">
                ${provider.models.map((model) => renderModelRow(model, provider.id, props))}
              </div>
            </details>
          `
          : nothing
      }
    </div>
  `;
}

function renderModelRow(
  model: ModelProviderUiEntry["models"][0],
  providerId: string,
  props: ModelsProps,
) {
  const modelRef = `${providerId}/${model.id}`;
  const isDefault = props.defaultModel === modelRef;
  const testResult = props.testResults.get(modelRef);
  const isTesting = props.testRunning === modelRef;

  return html`
    <div
      class="model-row"
      style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border);"
    >
      <div style="flex: 1;">
        <div class="row" style="gap: 8px; align-items: center;">
          <span style="font-weight: 500;">${model.name}</span>
          ${
            isDefault
              ? html`
                  <span class="chip chip-ok" style="font-size: 10px">DEFAULT</span>
                `
              : nothing
          }
          ${
            model.reasoning
              ? html`
                  <span class="chip" style="font-size: 10px">reasoning</span>
                `
              : nothing
          }
        </div>
        <div class="row" style="gap: 12px; margin-top: 4px; font-size: 12px; color: var(--muted);">
          <span>${formatContextWindow(model.contextWindow)} context</span>
          <span>$${model.costPer1MInput}/$${model.costPer1MOutput} per 1M tokens</span>
        </div>
      </div>
      <div class="row" style="gap: 6px;">
        ${
          !isDefault
            ? html`
              <button
                class="btn"
                style="font-size: 12px; padding: 4px 10px;"
                @click=${() => props.onSetDefaultModel(modelRef)}
              >
                Set Default
              </button>
            `
            : nothing
        }
        <button
          class="btn"
          style="font-size: 12px; padding: 4px 10px;"
          ?disabled=${isTesting}
          @click=${() => props.onTestModel(model.id, providerId)}
        >
          ${isTesting ? "Testing…" : "Test"}
        </button>
      </div>
    </div>

    ${
      testResult
        ? html`
          <div
            class="callout ${testResult.ok ? "success" : "danger"}"
            style="margin: 8px 0; font-size: 12px;"
          >
            ${
              testResult.ok
                ? html`
                  ✅ ${testResult.latencyMs}ms
                  ${
                    testResult.tokensPerSecond
                      ? html`• ${testResult.tokensPerSecond.toFixed(1)} tok/s`
                      : nothing
                  }
                `
                : html`❌ ${testResult.error}`
            }
          </div>
        `
        : nothing
    }
  `;
}

function renderLiveModelRow(
  model: import("../types.models.ts").LiveModelEntry,
  providerId: string,
  props: ModelsProps,
) {
  const modelRef = `${providerId}/${model.id}`;
  const isDefault = props.defaultModel === modelRef;

  return html`
    <div
      class="model-row"
      style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border);"
    >
      <div style="flex: 1; min-width: 0;">
        <div class="row" style="gap: 8px; align-items: center;">
          <span style="font-weight: 500; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${model.name}</span>
          ${
            isDefault
              ? html`
                  <span class="chip chip-ok" style="font-size: 10px">DEFAULT</span>
                `
              : nothing
          }
        </div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
          ${model.ownedBy}
        </div>
      </div>
      <div class="row" style="gap: 6px; flex-shrink: 0;">
        ${
          !isDefault
            ? html`
              <button
                class="btn"
                style="font-size: 11px; padding: 3px 8px;"
                @click=${() => props.onSetDefaultModel(modelRef)}
              >
                Set Default
              </button>
            `
            : nothing
        }
      </div>
    </div>
  `;
}

function renderAddProviderForm(props: ModelsProps) {
  // Preset configurations for common providers - just add API key!
  // Updated: 2026-02-05 with latest model pricing and specs
  const providerPresets = [
    {
      id: "openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      docsUrl: "https://platform.openai.com/settings/organization/api-keys",
      api: "openai-completions",
      models: [
        {
          id: "gpt-5",
          name: "GPT-5",
          contextWindow: 272000,
          maxTokens: 16384,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 1.25,
          costPer1MOutput: 10.0,
        },
        {
          id: "gpt-5.2",
          name: "GPT-5.2 (Latest)",
          contextWindow: 272000,
          maxTokens: 16384,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 1.25,
          costPer1MOutput: 10.0,
        },
        {
          id: "gpt-4.1",
          name: "GPT-4.1 (Legacy)",
          contextWindow: 1047576,
          maxTokens: 32768,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: false,
          costPer1MInput: 2.0,
          costPer1MOutput: 8.0,
        },
        {
          id: "gpt-4.1-mini",
          name: "GPT-4.1 Mini (Legacy)",
          contextWindow: 1047576,
          maxTokens: 32768,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: false,
          costPer1MInput: 0.4,
          costPer1MOutput: 1.6,
        },
        {
          id: "codex",
          name: "Codex (Preview)",
          contextWindow: 272000,
          maxTokens: 16384,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 1.25,
          costPer1MOutput: 10.0,
        },
        {
          id: "o3",
          name: "o3 (Reasoning)",
          contextWindow: 200000,
          maxTokens: 100000,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 10.0,
          costPer1MOutput: 40.0,
        },
        {
          id: "o3-mini",
          name: "o3 Mini (Reasoning)",
          contextWindow: 200000,
          maxTokens: 100000,
          inputTypes: ["text"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 1.1,
          costPer1MOutput: 4.4,
        },
        {
          id: "o1",
          name: "o1 (Reasoning)",
          contextWindow: 200000,
          maxTokens: 100000,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 15.0,
          costPer1MOutput: 60.0,
        },
        {
          id: "o1-mini",
          name: "o1 Mini (Reasoning)",
          contextWindow: 128000,
          maxTokens: 65536,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 1.1,
          costPer1MOutput: 4.4,
        },
        {
          id: "gpt-4o",
          name: "GPT-4o",
          contextWindow: 128000,
          maxTokens: 16384,
          inputTypes: ["text", "image", "audio"] as ("text" | "image")[],
          reasoning: false,
          costPer1MInput: 2.5,
          costPer1MOutput: 10.0,
        },
        {
          id: "gpt-4o-mini",
          name: "GPT-4o Mini",
          contextWindow: 128000,
          maxTokens: 16384,
          inputTypes: ["text", "image", "audio"] as ("text" | "image")[],
          reasoning: false,
          costPer1MInput: 0.15,
          costPer1MOutput: 0.6,
        },
      ],
    },
    {
      id: "anthropic",
      name: "Anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      docsUrl: "https://console.anthropic.com/settings/keys",
      api: "anthropic-messages",
      models: [
        {
          id: "claude-opus-4.5-20251101",
          name: "Claude Opus 4.5",
          contextWindow: 200000,
          maxTokens: 8192,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 5.0,
          costPer1MOutput: 25.0,
        },
        {
          id: "claude-sonnet-4.5-20250929",
          name: "Claude Sonnet 4.5",
          contextWindow: 200000,
          maxTokens: 8192,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 3.0,
          costPer1MOutput: 15.0,
        },
        {
          id: "claude-haiku-4.5-20251015",
          name: "Claude Haiku 4.5",
          contextWindow: 200000,
          maxTokens: 4096,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: false,
          costPer1MInput: 1.0,
          costPer1MOutput: 5.0,
        },
      ],
    },
    {
      id: "google",
      name: "Google (Gemini)",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      docsUrl: "https://aistudio.google.com/app/apikey",
      api: "google-generative-ai",
      models: [
        {
          id: "gemini-3-pro",
          name: "Gemini 3 Pro",
          contextWindow: 1000000,
          maxTokens: 65536,
          inputTypes: ["text", "image", "audio", "video"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 2.0,
          costPer1MOutput: 12.0,
        },
        {
          id: "gemini-3-pro-long",
          name: "Gemini 3 Pro (>200K ctx)",
          contextWindow: 1000000,
          maxTokens: 65536,
          inputTypes: ["text", "image", "audio", "video"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 4.0,
          costPer1MOutput: 18.0,
        },
        {
          id: "gemini-3-flash",
          name: "Gemini 3 Flash",
          contextWindow: 1000000,
          maxTokens: 8192,
          inputTypes: ["text", "image", "audio", "video"] as ("text" | "image")[],
          reasoning: false,
          costPer1MInput: 0.5,
          costPer1MOutput: 3.0,
        },
      ],
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      docsUrl: "https://openrouter.ai/settings/keys",
      api: "openai-completions",
      models: [
        {
          id: "openai/gpt-5",
          name: "GPT-5 (via OpenRouter)",
          contextWindow: 272000,
          maxTokens: 16384,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 1.25,
          costPer1MOutput: 10.0,
        },
        {
          id: "anthropic/claude-opus-4.5",
          name: "Claude Opus 4.5 (via OpenRouter)",
          contextWindow: 200000,
          maxTokens: 8192,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 5.0,
          costPer1MOutput: 25.0,
        },
        {
          id: "google/gemini-3-pro",
          name: "Gemini 3 Pro (via OpenRouter)",
          contextWindow: 1000000,
          maxTokens: 65536,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 2.0,
          costPer1MOutput: 12.0,
        },
        {
          id: "meta-llama/llama-3.3-70b",
          name: "Llama 3.3 70B",
          contextWindow: 128000,
          maxTokens: 4096,
          inputTypes: ["text"] as ("text" | "image")[],
          reasoning: false,
          costPer1MInput: 0.59,
          costPer1MOutput: 0.79,
        },
        {
          id: "deepseek/deepseek-chat-v3",
          name: "DeepSeek V3",
          contextWindow: 128000,
          maxTokens: 8192,
          inputTypes: ["text"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 0.28,
          costPer1MOutput: 0.42,
        },
      ],
    },
    {
      id: "groq",
      name: "Groq",
      baseUrl: "https://api.groq.com/openai/v1",
      docsUrl: "https://console.groq.com/keys",
      api: "openai-completions",
      models: [
        {
          id: "llama-3.3-70b-versatile",
          name: "Llama 3.3 70B",
          contextWindow: 128000,
          maxTokens: 32768,
          inputTypes: ["text"] as ("text" | "image")[],
          reasoning: false,
          costPer1MInput: 0.59,
          costPer1MOutput: 0.79,
        },
        {
          id: "deepseek-r1-distill-llama-70b",
          name: "DeepSeek R1 Distill Llama 70B",
          contextWindow: 128000,
          maxTokens: 32768,
          inputTypes: ["text"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 0.75,
          costPer1MOutput: 0.99,
        },
        {
          id: "mixtral-8x7b-32768",
          name: "Mixtral 8x7B",
          contextWindow: 32768,
          maxTokens: 8192,
          inputTypes: ["text"] as ("text" | "image")[],
          reasoning: false,
          costPer1MInput: 0.24,
          costPer1MOutput: 0.24,
        },
        {
          id: "llama-3.1-8b-instant",
          name: "Llama 3.1 8B",
          contextWindow: 128000,
          maxTokens: 8192,
          inputTypes: ["text"] as ("text" | "image")[],
          reasoning: false,
          costPer1MInput: 0.05,
          costPer1MOutput: 0.08,
        },
      ],
    },
    {
      id: "kimi",
      name: "Kimi (Moonshot AI)",
      baseUrl: "https://api.moonshot.cn/v1",
      docsUrl: "https://platform.moonshot.cn/console/api-keys",
      api: "openai-completions",
      models: [
        {
          id: "kimi-k2.5",
          name: "Kimi K2.5",
          contextWindow: 256000,
          maxTokens: 8192,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 2.0,
          costPer1MOutput: 8.0,
        },
        {
          id: "kimi-k2.5-32k",
          name: "Kimi K2.5 32K",
          contextWindow: 32000,
          maxTokens: 8192,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 1.0,
          costPer1MOutput: 4.0,
        },
        {
          id: "kimi-k2.5-128k",
          name: "Kimi K2.5 128K",
          contextWindow: 128000,
          maxTokens: 8192,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 1.5,
          costPer1MOutput: 6.0,
        },
        {
          id: "kimi-k2.5-1m",
          name: "Kimi K2.5 1M",
          contextWindow: 1000000,
          maxTokens: 8192,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 3.5,
          costPer1MOutput: 14.0,
        },
        {
          id: "kimi-k2",
          name: "Kimi K2",
          contextWindow: 256000,
          maxTokens: 8192,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 2.0,
          costPer1MOutput: 8.0,
        },
        {
          id: "kimi-k2-32k",
          name: "Kimi K2 32K",
          contextWindow: 32000,
          maxTokens: 8192,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 1.0,
          costPer1MOutput: 4.0,
        },
        {
          id: "kimi-k2-code",
          name: "Kimi K2 Code",
          contextWindow: 256000,
          maxTokens: 8192,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 2.0,
          costPer1MOutput: 8.0,
        },
        {
          id: "kimi-k2-code-32k",
          name: "Kimi K2 Code 32K",
          contextWindow: 32000,
          maxTokens: 8192,
          inputTypes: ["text", "image"] as ("text" | "image")[],
          reasoning: true,
          costPer1MInput: 1.0,
          costPer1MOutput: 4.0,
        },
      ],
    },
  ];

  const applyPreset = (preset: (typeof providerPresets)[0]) => {
    if (props.onProviderPresetSelect) {
      props.onProviderPresetSelect(preset);
    } else {
      // Fallback: update fields individually
      props.onProviderFormChange("id", preset.id);
      props.onProviderFormChange("name", preset.name);
      props.onProviderFormChange("baseUrl", preset.baseUrl);
      (props.newProviderForm as unknown as Record<string, unknown>).models = preset.models;
    }
    window.open(preset.docsUrl, "_blank");
  };

  return html`
    <div class="callout" style="margin: 12px 0;">
      <h4 style="margin: 0 0 12px 0; font-size: 14px;">Add New Provider</h4>
      
      <!-- Preset Provider Buttons -->
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">
          Select a provider (opens API key page, models pre-configured):
        </div>
        <div class="row" style="gap: 8px; flex-wrap: wrap;">
          ${providerPresets.map(
            (p) => html`
            <button
              class="btn ${props.newProviderForm.id === p.id ? "btn-primary" : ""}"
              style="font-size: 12px;"
              @click=${() => applyPreset(p)}
            >
              ${p.name}
            </button>
          `,
          )}
        </div>
      </div>

      <div class="form-grid" style="display: grid; gap: 12px;">
        <label class="field">
          <span>Provider ID</span>
          <input
            .value=${props.newProviderForm.id}
            @input=${(e: Event) =>
              props.onProviderFormChange("id", (e.target as HTMLInputElement).value)}
            placeholder="e.g., openai, anthropic"
          />
        </label>
        <label class="field">
          <span>Display Name</span>
          <input
            .value=${props.newProviderForm.name}
            @input=${(e: Event) =>
              props.onProviderFormChange("name", (e.target as HTMLInputElement).value)}
            placeholder="e.g., OpenAI"
          />
        </label>
        <label class="field">
          <span>Base URL</span>
          <input
            .value=${props.newProviderForm.baseUrl}
            @input=${(e: Event) =>
              props.onProviderFormChange("baseUrl", (e.target as HTMLInputElement).value)}
            placeholder="https://api.openai.com/v1"
          />
        </label>
        <label class="field">
          <span>API Key</span>
          <input
            type="password"
            .value=${props.newProviderForm.apiKey}
            @input=${(e: Event) =>
              props.onProviderFormChange("apiKey", (e.target as HTMLInputElement).value)}
            placeholder="sk-..."
          />
        </label>
        <label class="field">
          <span>Authentication</span>
          <select
            .value=${props.newProviderForm.authType}
            @change=${(e: Event) =>
              props.onProviderFormChange("authType", (e.target as HTMLSelectElement).value)}
          >
            <option value="api-key">API Key</option>
            <option value="oauth">OAuth (if supported)</option>
          </select>
        </label>
      </div>
      <div class="row" style="justify-content: flex-end; gap: 8px; margin-top: 12px;">
        <button class="btn" @click=${props.onToggleAddProvider}>Cancel</button>
        <button class="btn btn-primary" @click=${() => props.onAddProvider(props.newProviderForm.models)}>Add Provider</button>
      </div>
    </div>
  `;
}

function renderLocalTab(props: ModelsProps) {
  const isPulling = props.ollamaPullRunning !== null;

  return html`
    <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
      <div>
        <h3 style="margin: 0; font-size: 14px; font-weight: 600;">Ollama Local Models</h3>
        <p class="muted" style="margin: 4px 0 0 0; font-size: 12px;">
          Run AI models locally on your M3 Max. Zero API costs, complete privacy.
        </p>
      </div>
      <button class="btn" @click=${props.onDiscoverOllama} ?disabled=${props.loading}>Refresh</button>
    </div>

    ${
      !props.ollamaAvailable
        ? html`
          <div class="callout warning" style="margin-top: 12px;">
            <strong>Ollama not detected</strong>
            <p style="margin: 8px 0;">
              Install Ollama to run models locally:
              <code>brew install ollama</code>
            </p>
            <p style="margin: 8px 0; font-size: 12px;">
              Then start the server: <code>ollama serve</code>
            </p>
            <button 
              class="btn btn-primary" 
              style="margin-top: 8px;"
              @click=${props.onDiscoverOllama}
            >
              Check Again
            </button>
          </div>
        `
        : html`
          <div class="callout success" style="margin-top: 12px;">
            <strong>✓ Ollama is running</strong>
            <span class="muted" style="margin-left: 8px;">(${props.ollamaModels.length} models installed)</span>
          </div>
          
          ${
            props.ollamaModels.length === 0
              ? html`
                  <div class="callout" style="margin-top: 12px">
                    No models found. Pull a model to get started using the buttons below.
                  </div>
                `
              : html`
                <div class="models-ollama-list" style="margin-top: 12px;">
                  ${props.ollamaModels.map((model) => renderOllamaModelCard(model, props))}
                </div>
              `
          }
        `
    }

    <!-- Quick Pull Section -->
    <div class="callout" style="margin-top: 16px;">
      <h4 style="margin: 0 0 8px 0; font-size: 13px;">Pull Recommended Models</h4>
      <p class="muted" style="margin: 0 0 12px 0; font-size: 12px;">
        Click to download models. This may take several minutes for large models.
      </p>
      <div class="row" style="gap: 8px; flex-wrap: wrap;">
        ${[
          { name: "llama3.2:3b", desc: "Fast heartbeat/checks (~50 tok/s)" },
          { name: "gemma3:4b", desc: "Vision capable, ultra-fast (~50 tok/s)" },
          { name: "phi4:14b", desc: "Best reasoning & logic (~15 tok/s)" },
          { name: "deepseek-coder-v2:16b", desc: "Fast coding MoE (~20 tok/s)" },
          { name: "qwen2.5-coder:32b", desc: "Best coding - GPT-4o level (20GB)" },
          { name: "qwen3:30b", desc: "MoE architecture - fast & capable (18GB)" },
        ].map(
          ({ name, desc }) => html`
            <button
              class="btn"
              style="font-size: 12px;"
              ?disabled=${props.ollamaPullRunning === name || !props.ollamaAvailable || isPulling}
              @click=${() => props.onPullOllamaModel(name)}
            >
              ${props.ollamaPullRunning === name ? "Pulling…" : name}
              <span class="muted" style="margin-left: 4px; font-size: 10px;">${desc}</span>
            </button>
          `,
        )}
      </div>
      ${
        isPulling
          ? html`
        <div style="margin-top: 12px; font-size: 12px; color: var(--muted);">
          Pulling ${props.ollamaPullRunning}… This may take several minutes. Do not close the browser.
        </div>
      `
          : nothing
      }
    </div>
  `;
}

function renderOllamaModelCard(model: OllamaModelUiEntry, props: ModelsProps) {
  const modelRef = `ollama/${model.name}`;
  const isDefault = props.defaultModel === modelRef;

  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">
          ${model.name}
          ${
            isDefault
              ? html`
                  <span class="chip chip-ok" style="margin-left: 8px">DEFAULT</span>
                `
              : nothing
          }
        </div>
        <div class="list-sub">
          ${model.parameterSize ? html`${model.parameterSize} • ` : nothing}
          ${model.family ? html`${model.family} • ` : nothing}
          ${model.size}
        </div>
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${formatContextWindow(model.contextWindow)} context</span>
          <span class="chip chip-ok">Free</span>
        </div>
      </div>
      <div class="list-meta">
        <div class="row" style="gap: 6px;">
          ${
            !isDefault
              ? html`
                <button
                  class="btn"
                  @click=${() => props.onSetDefaultModel(modelRef)}
                >
                  Set Default
                </button>
              `
              : nothing
          }
          <button
            class="btn"
            ?disabled=${props.testRunning === modelRef}
            @click=${() => props.onTestModel(model.name, "ollama")}
          >
            ${props.testRunning === modelRef ? "Testing…" : "Test"}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderRecommendedTab(props: ModelsProps) {
  return html`
    <div style="margin-bottom: 16px;">
      <h3 style="margin: 0; font-size: 14px; font-weight: 600;">Optimized for M3 Max 36GB</h3>
      <p class="muted" style="margin: 4px 0 0 0; font-size: 12px;">
        These configurations minimize API costs while maximizing performance on your hardware.
      </p>
    </div>

    <!-- Quick Link to Heartbeat Tab -->
    <div class="callout" style="margin-bottom: 20px;">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div>
          <strong>💡 Token Optimization</strong>
          <p style="margin: 4px 0 0 0; font-size: 12px;">
            Save $5-15/month by routing heartbeat checks to a free local model.
          </p>
        </div>
        <button 
          class="btn btn-primary" 
          style="font-size: 12px;"
          @click=${() => props.onTabChange("heartbeat")}
        >
          Configure Heartbeat →
        </button>
      </div>
    </div>

    <!-- Simple Task Models -->
    <div class="recommended-section" style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 8px 0; font-size: 13px; display: flex; align-items: center; gap: 8px;">
        <span class="chip" style="background: var(--accent); color: white;">Simple</span>
        Fast, cost-effective daily tasks
      </h4>
      <p class="muted" style="margin: 0 0 8px 0; font-size: 12px;">
        Use for: File operations, simple edits, routine code tasks
      </p>
      <div class="models-recommended-list">
        ${RECOMMENDED_MODELS.simple.map((rec) =>
          renderRecommendedCard(rec.id, rec.name, rec.why, props),
        )}
      </div>
    </div>

    <!-- Complex Task Models -->
    <div class="recommended-section">
      <h4 style="margin: 0 0 8px 0; font-size: 13px; display: flex; align-items: center; gap: 8px;">
        <span class="chip" style="background: var(--info); color: white;">Complex</span>
        Full reasoning capabilities
      </h4>
      <p class="muted" style="margin: 0 0 8px 0; font-size: 12px;">
        Use for: Architecture decisions, complex debugging, security analysis
      </p>
      <div class="models-recommended-list">
        ${RECOMMENDED_MODELS.complex.map((rec) =>
          renderRecommendedCard(rec.id, rec.name, rec.why, props),
        )}
      </div>
    </div>

    <!-- Configuration Tip -->
    <div class="callout" style="margin-top: 20px;">
      <strong>📝 Model Routing Tip</strong>
      <p style="margin: 8px 0; font-size: 12px;">
        Configure your agent to use cheaper models by default. Add this to your system prompt:
      </p>
      <pre style="margin: 8px 0; padding: 8px; background: var(--bg-secondary); border-radius: 4px; font-size: 11px; overflow-x: auto;"><code>Default model: Use cheapest appropriate model
Switch to complex model ONLY for:
- Architecture decisions
- Security analysis  
- Complex debugging
- Multi-project strategy</code></pre>
    </div>
  `;
}

function renderHeartbeatTab(props: ModelsProps) {
  // Calculate potential savings
  const hasHeartbeatModel = Boolean(props.heartbeatModel);
  const estimatedSavings = "$5-15/month";

  // Heartbeat model options with metadata
  const heartbeatOptions = [
    {
      id: "ollama/llama3.2:1b",
      name: "Llama 3.2 1B",
      desc: "Ultra-lightweight, fastest (~100 tok/s)",
      ram: "1GB",
      bestFor: "Minimal resource usage",
    },
    {
      id: "ollama/llama3.2:3b",
      name: "Llama 3.2 3B",
      desc: "Fast and capable (~50 tok/s)",
      ram: "2GB",
      bestFor: "Recommended for most users",
    },
    {
      id: "ollama/gemma3:4b",
      name: "Gemma 3 4B",
      desc: "Vision capable, ultra-fast (~50 tok/s)",
      ram: "3GB",
      bestFor: "Vision + text heartbeat tasks",
    },
    {
      id: "ollama/phi4:14b",
      name: "Phi-4 14B",
      desc: "Better reasoning, still fast (~15 tok/s)",
      ram: "8GB",
      bestFor: "Complex heartbeat logic",
    },
  ];

  // Get all available models from providers and Ollama for custom selection
  const allAvailableModels: Array<{
    ref: string;
    name: string;
    provider: string;
    isOllama: boolean;
  }> = [];

  // Add Ollama models
  for (const model of props.ollamaModels) {
    allAvailableModels.push({
      ref: `ollama/${model.name}`,
      name: model.name,
      provider: "ollama",
      isOllama: true,
    });
  }

  // Add provider models
  for (const provider of props.providers) {
    for (const model of provider.models) {
      allAvailableModels.push({
        ref: `${provider.id}/${model.id}`,
        name: model.name,
        provider: provider.name,
        isOllama: false,
      });
    }
  }

  return html`
    <div style="margin-bottom: 16px;">
      <h3 style="margin: 0; font-size: 14px; font-weight: 600;">Heartbeat Model Configuration</h3>
      <p class="muted" style="margin: 4px 0 0 0; font-size: 12px;">
        Set a dedicated model for heartbeat checks. This saves costs by routing periodic health checks to a lightweight local model instead of your main API model.
      </p>
    </div>

    <!-- Cost Savings Card -->
    <div class="callout ${hasHeartbeatModel ? "success" : ""}" style="margin-bottom: 20px;">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <strong>${hasHeartbeatModel ? "✓ Cost Savings Active" : "💰 Potential Savings"}</strong>
          <p style="margin: 8px 0; font-size: 12px;">
            ${
              hasHeartbeatModel
                ? html`Your heartbeat is configured to use <code>${props.heartbeatModel}</code>. 
                   This routes ~1,440 daily checks to a free local model, saving approximately <strong>${estimatedSavings}</strong>.`
                : html`Heartbeats run ~1,440 times per day (every 30 minutes). 
                   Without a local heartbeat model, these checks use your main API model, costing approximately <strong>${estimatedSavings}</strong>.`
            }
          </p>
        </div>
        <div class="chip ${hasHeartbeatModel ? "chip-ok" : ""}" style="font-size: 11px;">
          ${hasHeartbeatModel ? "Saving" : "Not configured"}
        </div>
      </div>
    </div>

    <!-- Quick Select -->
    <div style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 12px 0; font-size: 13px;">Recommended Heartbeat Models</h4>
      <div class="models-recommended-list">
        ${heartbeatOptions.map((opt) => {
          const isSelected = props.heartbeatModel === opt.id;
          const isAvailable = opt.id.startsWith("ollama/")
            ? props.ollamaModels.some((m) => m.name === opt.id.replace("ollama/", ""))
            : true;

          return html`
            <div 
              class="list-item" 
              style="padding: 12px; ${isSelected ? "border-left: 3px solid var(--success);" : ""}"
            >
              <div class="list-main">
                <div class="list-title" style="font-size: 13px;">
                  ${opt.name}
                  ${
                    isSelected
                      ? html`
                          <span class="chip chip-ok" style="margin-left: 6px; font-size: 10px">ACTIVE</span>
                        `
                      : nothing
                  }
                </div>
                <div class="list-sub" style="font-size: 11px; margin-top: 2px;">${opt.desc}</div>
                <div class="chip-row" style="margin-top: 6px;">
                  <span class="chip" style="font-size: 10px;">~${opt.ram} RAM</span>
                  <span class="chip" style="font-size: 10px;">${opt.bestFor}</span>
                  ${
                    !isAvailable
                      ? html`
                          <span class="chip chip-warn" style="font-size: 10px">Not installed</span>
                        `
                      : html`
                          <span class="chip chip-ok" style="font-size: 10px">Free</span>
                        `
                  }
                </div>
              </div>
              <div class="list-meta">
                ${
                  isSelected
                    ? html`
                      <button
                        class="btn"
                        style="font-size: 11px; padding: 4px 10px;"
                        @click=${() => props.onSetHeartbeatModel("")}
                      >
                        Clear
                      </button>
                    `
                    : isAvailable
                      ? html`
                        <button
                          class="btn btn-primary"
                          style="font-size: 11px; padding: 4px 10px;"
                          @click=${() => props.onSetHeartbeatModel(opt.id)}
                        >
                          Use for Heartbeat
                        </button>
                      `
                      : html`
                        <button
                          class="btn"
                          style="font-size: 11px; padding: 4px 10px;"
                          @click=${() => props.onPullOllamaModel(opt.id.replace("ollama/", ""))}
                        >
                          Pull Model
                        </button>
                      `
                }
              </div>
            </div>
          `;
        })}
      </div>
    </div>

    <!-- Custom Selection -->
    <div class="callout" style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 12px 0; font-size: 13px;">Custom Heartbeat Model</h4>
      <p class="muted" style="margin: 0 0 12px 0; font-size: 12px;">
        Select any available model for heartbeat checks. Local Ollama models are recommended for cost savings.
      </p>
      <select
        style="width: 100%; padding: 8px; font-size: 13px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg); color: var(--fg);"
        @change=${(e: Event) => {
          const value = (e.target as HTMLSelectElement).value;
          if (value) {
            props.onSetHeartbeatModel(value);
          }
        }}
      >
        <option value="" ?selected=${!props.heartbeatModel}>
          ${props.heartbeatModel ? "Clear heartbeat model" : "Select a model..."}
        </option>
        ${
          allAvailableModels.length === 0
            ? html`
                <option disabled>No models available</option>
              `
            : html`
              <optgroup label="Local Models (Free)">
                ${allAvailableModels
                  .filter((m) => m.isOllama)
                  .map(
                    (m) => html`
                    <option value=${m.ref} ?selected=${props.heartbeatModel === m.ref}>
                      ${m.name} (${m.provider})
                    </option>
                  `,
                  )}
              </optgroup>
              <optgroup label="Cloud Providers">
                ${allAvailableModels
                  .filter((m) => !m.isOllama)
                  .map(
                    (m) => html`
                    <option value=${m.ref} ?selected=${props.heartbeatModel === m.ref}>
                      ${m.name} (${m.provider})
                    </option>
                  `,
                  )}
              </optgroup>
            `
        }
      </select>
      ${
        props.heartbeatModel
          ? html`
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
              <div class="row" style="justify-content: space-between; align-items: center;">
                <code style="font-size: 12px;">${props.heartbeatModel}</code>
                <button
                  class="btn btn-danger"
                  style="font-size: 11px; padding: 4px 10px;"
                  @click=${() => props.onSetHeartbeatModel("")}
                >
                  Remove
                </button>
              </div>
            </div>
          `
          : nothing
      }
    </div>

    <!-- Info Card -->
    <div class="callout" style="margin-bottom: 20px;">
      <strong>ℹ️ How Heartbeat Model Works</strong>
      <ul style="margin: 8px 0; padding-left: 16px; font-size: 12px;">
        <li>Heartbeat checks run periodically (default: every 30 minutes)</li>
        <li>When configured, heartbeat uses its own model instead of the default</li>
        <li>This separates routine checks from main task processing</li>
        <li>Use a lightweight local model (1B-3B) for best cost savings</li>
        <li>Your main model stays available for actual user requests</li>
      </ul>
    </div>

    <!-- Setup Instructions -->
    ${
      !props.ollamaAvailable
        ? html`
            <div class="callout warning">
              <strong>Ollama Not Detected</strong>
              <p style="margin: 8px 0; font-size: 12px">
                To use free local models for heartbeat, install Ollama:
              </p>
              <pre
                style="
                  margin: 8px 0;
                  padding: 8px;
                  background: var(--bg-secondary);
                  border-radius: 4px;
                  font-size: 11px;
                  overflow-x: auto;
                "
              ><code>brew install ollama
            ollama serve
            ollama pull llama3.2:3b</code></pre>
            </div>
          `
        : nothing
    }
  `;
}

function renderAllowedTab(props: ModelsProps) {
  // Build list of all available models from providers and Ollama
  const allModels: Array<{
    ref: string;
    name: string;
    provider: string;
    isOllama: boolean;
    isDefault: boolean;
    isAllowed: boolean;
  }> = [];

  // Add Ollama models
  for (const model of props.ollamaModels) {
    const ref = `ollama/${model.name}`;
    allModels.push({
      ref,
      name: model.name,
      provider: "ollama",
      isOllama: true,
      isDefault: props.defaultModel === ref,
      isAllowed: props.allowAnyModels || props.allowedModels.some((m) => m.key === ref),
    });
  }

  // Add provider models
  for (const provider of props.providers) {
    for (const model of provider.models) {
      const ref = `${provider.id}/${model.id}`;
      // Skip if already added (e.g., from Ollama)
      if (allModels.some((m) => m.ref === ref)) {
        continue;
      }
      allModels.push({
        ref,
        name: model.name,
        provider: provider.name,
        isOllama: false,
        isDefault: props.defaultModel === ref,
        isAllowed: props.allowAnyModels || props.allowedModels.some((m) => m.key === ref),
      });
    }
  }

  // Sort: default first, then by provider, then by name
  allModels.sort((a, b) => {
    if (a.isDefault && !b.isDefault) {
      return -1;
    }
    if (!a.isDefault && b.isDefault) {
      return 1;
    }
    const p = a.provider.localeCompare(b.provider);
    if (p !== 0) {
      return p;
    }
    return a.name.localeCompare(b.name);
  });

  const isActionRunning = (action: string, ref: string) => {
    return props.allowedModelsActionRunning === `${action}:${ref}`;
  };

  return html`
    <div style="margin-bottom: 16px;">
      <h3 style="margin: 0; font-size: 14px; font-weight: 600;">Allowed Models</h3>
      <p class="muted" style="margin: 4px 0 0 0; font-size: 12px;">
        Control which models the brain agent can use for sub-agent tasks.
        ${
          props.allowAnyModels
            ? html`
                Currently <strong>all models are allowed</strong> (no restrictions).
              `
            : html`Currently <strong>${props.allowedModels.length} models allowed</strong> (restricted mode).`
        }
      </p>
    </div>

    <!-- Allow All Toggle -->
    <div class="callout" style="margin-bottom: 20px;">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div>
          <strong>${props.allowAnyModels ? "🟢 All Models Allowed" : "🔒 Restricted Mode"}</strong>
          <p style="margin: 4px 0 0 0; font-size: 12px;">
            ${
              props.allowAnyModels
                ? "The agent can use any available model for sub-agents."
                : "The agent can only use models explicitly added to this list."
            }
          </p>
        </div>
        <button
          class="btn ${props.allowAnyModels ? "" : "btn-primary"}"
          style="font-size: 12px;"
          ?disabled=${props.allowedModelsActionRunning === "setAllowAll"}
          @click=${() => props.onSetAllowAllModels(!props.allowAnyModels)}
        >
          ${
            props.allowedModelsActionRunning === "setAllowAll"
              ? "Updating…"
              : props.allowAnyModels
                ? "Enable Restrictions"
                : "Allow All Models"
          }
        </button>
      </div>
    </div>

    <!-- Models List -->
    ${
      props.allowedModelsLoading
        ? html`
            <div class="callout" style="text-align: center">Loading allowed models…</div>
          `
        : allModels.length === 0
          ? html`
              <div class="callout warning">
                <strong>No models available</strong>
                <p style="margin: 8px 0; font-size: 12px">
                  Add providers in the Cloud Providers tab or install Ollama models first.
                </p>
              </div>
            `
          : html`
            <div class="models-allowed-list">
              ${allModels.map((model) => {
                const alias = props.allowedModels.find((m) => m.key === model.ref)?.alias;
                const isProcessing =
                  isActionRunning("add", model.ref) || isActionRunning("remove", model.ref);

                return html`
                  <div
                    class="list-item"
                    style="${
                      !model.isAllowed && !props.allowAnyModels ? "opacity: 0.6;" : ""
                    } ${model.isDefault ? "border-left: 3px solid var(--success);" : ""}"
                  >
                    <div class="list-main">
                      <div class="list-title" style="font-size: 13px;">
                        ${model.name}
                        ${
                          model.isDefault
                            ? html`
                                <span class="chip chip-ok" style="margin-left: 6px; font-size: 10px">DEFAULT</span>
                              `
                            : nothing
                        }
                        ${
                          model.isAllowed || props.allowAnyModels
                            ? html`
                                <span class="chip chip-ok" style="margin-left: 6px; font-size: 10px">ALLOWED</span>
                              `
                            : html`
                                <span class="chip chip-warn" style="margin-left: 6px; font-size: 10px">BLOCKED</span>
                              `
                        }
                      </div>
                      <div class="list-sub" style="font-size: 11px; margin-top: 2px;">
                        ${model.ref}
                      </div>
                      <div class="chip-row" style="margin-top: 6px;">
                        <span class="chip" style="font-size: 10px;">${model.provider}</span>
                        ${
                          model.isOllama
                            ? html`
                                <span class="chip chip-ok" style="font-size: 10px">Local</span>
                              `
                            : nothing
                        }
                        ${
                          alias
                            ? html`<span class="chip" style="font-size: 10px;">Alias: ${alias}</span>`
                            : nothing
                        }
                      </div>
                    </div>
                    <div class="list-meta">
                      ${
                        !props.allowAnyModels
                          ? html`
                            ${
                              model.isAllowed
                                ? html`
                                  <button
                                    class="btn btn-danger"
                                    style="font-size: 11px; padding: 4px 10px;"
                                    ?disabled=${isProcessing}
                                    @click=${() => props.onRemoveAllowedModel(model.ref)}
                                  >
                                    ${isActionRunning("remove", model.ref) ? "Removing…" : "Remove"}
                                  </button>
                                `
                                : html`
                                  <button
                                    class="btn btn-primary"
                                    style="font-size: 11px; padding: 4px 10px;"
                                    ?disabled=${isProcessing}
                                    @click=${() => props.onAddAllowedModel(model.ref)}
                                  >
                                    ${isActionRunning("add", model.ref) ? "Adding…" : "Allow"}
                                  </button>
                                `
                            }
                          `
                          : html`
                            <span class="muted" style="font-size: 11px;">
                              ${model.isDefault ? "Primary model" : "All models allowed"}
                            </span>
                          `
                      }
                    </div>
                  </div>
                `;
              })}
            </div>
          `
    }

    <!-- Info Card -->
    <div class="callout" style="margin-top: 20px;">
      <strong>ℹ️ How Allowed Models Work</strong>
      <ul style="margin: 8px 0; padding-left: 16px; font-size: 12px;">
        <li><strong>Primary model:</strong> The default model the brain agent uses for itself</li>
        <li>
          <strong>Sub-agent models:</strong> Models the brain agent can spawn for specific tasks
        </li>
        <li>
          <strong>Allow All:</strong> The agent can use any available model (recommended for
          flexibility)
        </li>
        <li>
          <strong>Restricted:</strong> Only explicitly allowed models can be used (better cost
          control)
        </li>
        <li>Use <code>sessions_spawn</code> with the <code>model</code> parameter to route tasks</li>
      </ul>
      <p style="margin: 8px 0; font-size: 12px;">
        <strong>Example:</strong> Route simple tasks to cheap/fast models (ollama/llama3.2:3b) and
        complex tasks to powerful models (anthropic/claude-opus-4.5).
      </p>
    </div>
  `;
}

function renderRecommendedCard(modelRef: string, name: string, why: string, props: ModelsProps) {
  const isDefault = props.defaultModel === modelRef;
  const [provider, modelId] = modelRef.split("/");
  const isOllama = provider === "ollama";
  const isAvailable = isOllama
    ? props.ollamaModels.some((m) => m.name === modelId)
    : props.providers.some((p) => p.id === provider && p.models.some((m) => m.id === modelId));

  return html`
    <div
      class="list-item"
      style="padding: 12px; ${isDefault ? "border-left: 3px solid var(--success);" : ""}"
    >
      <div class="list-main">
        <div class="list-title" style="font-size: 13px;">
          ${name}
          ${
            isDefault
              ? html`
                  <span class="chip chip-ok" style="margin-left: 6px; font-size: 10px">DEFAULT</span>
                `
              : nothing
          }
        </div>
        <div class="list-sub" style="font-size: 11px; margin-top: 2px;">${why}</div>
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip" style="font-size: 10px;">${provider}</span>
          ${
            isOllama
              ? html`
                <span class="chip ${isAvailable ? "chip-ok" : "chip-warn"}" style="font-size: 10px;">
                  ${isAvailable ? "Installed" : "Not installed"}
                </span>
              `
              : html`
                <span class="chip ${isAvailable ? "chip-ok" : "chip-warn"}" style="font-size: 10px;">
                  ${isAvailable ? "Connected" : "Not configured"}
                </span>
              `
          }
        </div>
      </div>
      <div class="list-meta">
        ${
          !isDefault && isAvailable
            ? html`
              <button
                class="btn"
                style="font-size: 11px; padding: 4px 10px;"
                @click=${() => props.onSetDefaultModel(modelRef)}
              >
                Set Default
              </button>
            `
            : nothing
        }
        ${
          isOllama && !isAvailable
            ? html`
              <button
                class="btn"
                style="font-size: 11px; padding: 4px 10px;"
                ?disabled=${props.ollamaPullRunning === modelId}
                @click=${() => props.onPullOllamaModel(modelId)}
              >
                ${props.ollamaPullRunning === modelId ? "Pulling…" : "Pull"}
              </button>
            `
            : nothing
        }
      </div>
    </div>
  `;
}

// Helper functions
function getStatusChipClass(status: string): string {
  switch (status) {
    case "connected":
      return "chip-ok";
    case "error":
      return "chip-warn";
    case "checking":
      return "";
    default:
      return "";
  }
}

function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}K`;
  }
  return `${tokens}`;
}
