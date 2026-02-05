// Types for Models management UI

export type ModelProviderUiEntry = {
  id: string;
  name: string;
  baseUrl: string;
  authType: "api-key" | "oauth" | "none" | string;
  apiKeyConfigured?: boolean;
  oauthConfigured?: boolean;
  status: "connected" | "error" | "unknown" | "checking";
  statusMessage?: string;
  latencyMs?: number;
  models: ModelUiEntry[];
  supportsOAuth?: boolean;
  supportsApiKey?: boolean;
  docsUrl?: string;
};

export type ModelUiEntry = {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxTokens: number;
  inputTypes: Array<"text" | "image" | "audio" | "video">;
  reasoning: boolean;
  costPer1MInput: number;
  costPer1MOutput: number;
  alias?: string;
};

export type OllamaModelUiEntry = {
  name: string;
  size: string;
  parameterSize?: string;
  family?: string;
  format?: string;
  quantization?: string;
  contextWindow: number;
  status: "available" | "pulling" | "error" | "not_installed";
  pullProgress?: number;
};

export type ModelTestResult = {
  ok: boolean;
  model: string;
  provider: string;
  latencyMs: number;
  tokensPerSecond?: number;
  error?: string;
  sample?: string;
};

export type ProviderTestResult = {
  ok: boolean;
  provider: string;
  latencyMs: number;
  error?: string;
  modelsAccessible?: number;
};

export type ModelsStatusSnapshot = {
  providers: ModelProviderUiEntry[];
  ollamaAvailable: boolean;
  ollamaModels: OllamaModelUiEntry[];
  defaultModel?: string;
  heartbeatModel?: string;
  recommendedModels: {
    heartbeat: string[];
    simple: string[];
    complex: string[];
  };
};

export type HeartbeatModelOption = {
  id: string;
  name: string;
  provider: string;
  description: string;
  estimatedTokensPerSecond?: number;
  costPerMonth?: number;
};

export type LiveModelEntry = {
  id: string;
  name: string;
  ownedBy: string;
};

export type ModelsConfigSuggestion = {
  id: string;
  name: string;
  description: string;
  provider: string;
  contextWindow: number;
  setupUrl?: string;
};

export type AllowedModelEntry = {
  key: string;
  alias?: string;
};

export type AllowedModelsStatus = {
  allowAny: boolean;
  defaultModel: string;
  allowedModels: AllowedModelEntry[];
  count: number;
};
