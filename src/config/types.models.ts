export type ModelApi =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages"
  | "google-generative-ai"
  | "github-copilot"
  | "bedrock-converse-stream";

export type ModelCompatConfig = {
  supportsStore?: boolean;
  supportsDeveloperRole?: boolean;
  supportsReasoningEffort?: boolean;
  maxTokensField?: "max_completion_tokens" | "max_tokens";
};

export type ModelProviderAuthMode = "api-key" | "aws-sdk" | "oauth" | "token";

export type ModelDefinitionConfig = {
  id: string;
  name: string;
  api?: ModelApi;
  reasoning: boolean;
  input: Array<"text" | "image">;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
  headers?: Record<string, string>;
  compat?: ModelCompatConfig;
};

export type ModelProviderConfig = {
  baseUrl: string;
  apiKey?: string;
  auth?: ModelProviderAuthMode;
  api?: ModelApi;
  headers?: Record<string, string>;
  authHeader?: boolean;
  models: ModelDefinitionConfig[];
};

export type BedrockDiscoveryConfig = {
  enabled?: boolean;
  region?: string;
  providerFilter?: string[];
  refreshInterval?: number;
  defaultContextWindow?: number;
  defaultMaxTokens?: number;
};

export type ModelRoutingConfig = {
  /**
   * Rule-based model routing.
   *
   * Rules are evaluated in order; first match wins.
   */
  rules?: Array<{
    name?: string;
    match?: {
      channel?: string;
      lane?: string;
      sessionKeyPrefix?: string;
      agentId?: string;
      isCron?: boolean;
      isGroup?: boolean;
    };
    model?: {
      /** provider/model or alias */
      primary?: string;
      /** provider/model or alias */
      fallbacks?: string[];
    };
    thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
    receipt?: "off" | "tokens" | "cost" | "full";
  }>;
  receipts?: {
    /** Optional global default receipt mode applied when no rule matches. */
    defaultMode?: "off" | "tokens" | "cost" | "full";
  };
  usageLog?: {
    /** When enabled, persist per-run usage+cost events for rollups. */
    enabled?: boolean;
  };
};

export type ModelsConfig = {
  mode?: "merge" | "replace";
  providers?: Record<string, ModelProviderConfig>;
  bedrockDiscovery?: BedrockDiscoveryConfig;
  routing?: ModelRoutingConfig;
};
