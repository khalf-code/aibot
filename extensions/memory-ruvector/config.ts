/**
 * Configuration schema for ruvector Memory Plugin
 */

import { join } from "node:path";
import { homedir } from "node:os";

import type { HooksConfig } from "./hooks.js";
import type { DistanceMetric, RuvLLMConfig, SONAConfig } from "./types.js";

// ============================================================================
// Types
// ============================================================================

export type RuvectorConfig = {
  /** Path to ruvector database directory */
  dbPath: string;
  /** Vector dimension (must match embedding model) */
  dimension: number;
  /** Distance metric for similarity search */
  metric: DistanceMetric;
  /** Embedding provider configuration */
  embedding: {
    provider: "openai" | "voyage" | "local";
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  };
  /** Hook configuration for automatic indexing */
  hooks: HooksConfig;
  /** SONA self-learning configuration */
  sona?: SONAConfig;
  /** ruvLLM (Ruvector LLM Integration) configuration */
  ruvllm?: RuvLLMConfig;
};

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_DB_PATH = join(homedir(), ".clawdbot", "memory", "ruvector");
const DEFAULT_DIMENSION = 1536;
const DEFAULT_METRIC = "cosine";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

// ============================================================================
// Dimension mappings for known models
// ============================================================================

const EMBEDDING_DIMENSIONS: Record<string, number> = {
  // OpenAI
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
  // Voyage AI
  "voyage-3": 1024,
  "voyage-3-large": 1024,
  "voyage-3.5-lite": 512,
  "voyage-code-3": 1024,
  // Local (common models)
  "nomic-embed-text": 768,
  "all-minilm-l6-v2": 384,
};

export function dimensionForModel(model: string): number {
  const dims = EMBEDDING_DIMENSIONS[model];
  if (dims) return dims;
  // Default fallback for unknown models
  return DEFAULT_DIMENSION;
}

// ============================================================================
// Validation helpers
// ============================================================================

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowed: string[],
  label: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) return;
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return envValue;
  });
}

// ============================================================================
// Config Schema
// ============================================================================

export const ruvectorConfigSchema = {
  parse(value: unknown): RuvectorConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("ruvector config required");
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(
      cfg,
      ["dbPath", "dimension", "metric", "embedding", "hooks", "sona", "ruvllm"],
      "ruvector config",
    );

    // Parse embedding config
    const embedding = cfg.embedding as Record<string, unknown> | undefined;
    if (!embedding) {
      throw new Error("embedding config is required");
    }
    assertAllowedKeys(
      embedding,
      ["provider", "apiKey", "model", "baseUrl"],
      "embedding config",
    );

    const embeddingProvider = (embedding.provider as string) ?? "openai";
    if (!["openai", "voyage", "local"].includes(embeddingProvider)) {
      throw new Error(
        `Invalid embedding provider: ${embeddingProvider}. Must be openai, voyage, or local`,
      );
    }

    // API key required for non-local providers (empty string treated as missing)
    const rawApiKey = embedding.apiKey as string | undefined;
    if (embeddingProvider !== "local" && (!rawApiKey || rawApiKey.trim() === "")) {
      throw new Error(`embedding.apiKey is required for provider: ${embeddingProvider}`);
    }

    const embeddingModel =
      typeof embedding.model === "string"
        ? embedding.model
        : DEFAULT_EMBEDDING_MODEL;

    const resolvedDimension =
      typeof cfg.dimension === "number"
        ? cfg.dimension
        : dimensionForModel(embeddingModel);

    // Validate dimension is a positive integer
    if (!Number.isInteger(resolvedDimension) || resolvedDimension <= 0) {
      throw new Error(`Invalid dimension: ${resolvedDimension}. Must be a positive integer`);
    }

    // Parse hooks config
    const hooksRaw = cfg.hooks as Record<string, unknown> | undefined;
    if (hooksRaw) {
      assertAllowedKeys(
        hooksRaw,
        ["enabled", "indexInbound", "indexOutbound", "indexAgentResponses", "batchSize", "debounceMs"],
        "hooks config",
      );
    }
    const batchSize = typeof hooksRaw?.batchSize === "number" ? hooksRaw.batchSize : 10;
    const debounceMs = typeof hooksRaw?.debounceMs === "number" ? hooksRaw.debounceMs : 500;

    // Validate hooks numeric values
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new Error(`Invalid hooks.batchSize: ${batchSize}. Must be a positive integer`);
    }
    if (!Number.isInteger(debounceMs) || debounceMs < 0) {
      throw new Error(`Invalid hooks.debounceMs: ${debounceMs}. Must be a non-negative integer`);
    }

    const hooks: HooksConfig = {
      enabled: hooksRaw?.enabled !== false,
      indexInbound: hooksRaw?.indexInbound !== false,
      indexOutbound: hooksRaw?.indexOutbound !== false,
      indexAgentResponses: hooksRaw?.indexAgentResponses !== false,
      batchSize,
      debounceMs,
    };

    // Validate metric with proper type narrowing
    const validMetrics = ["cosine", "euclidean", "dot"] as const;
    const metricRaw = (cfg.metric as string | undefined) ?? DEFAULT_METRIC;
    if (!validMetrics.includes(metricRaw as DistanceMetric)) {
      throw new Error(`Invalid metric: ${metricRaw}. Must be cosine, euclidean, or dot`);
    }
    const metric = metricRaw as DistanceMetric;

    // Parse SONA config
    const sonaRaw = cfg.sona as Record<string, unknown> | undefined;
    let sona: SONAConfig | undefined;
    if (sonaRaw) {
      assertAllowedKeys(
        sonaRaw,
        ["enabled", "hiddenDim", "learningRate", "qualityThreshold", "backgroundIntervalMs"],
        "sona config",
      );

      const hiddenDim = typeof sonaRaw.hiddenDim === "number" ? sonaRaw.hiddenDim : 256;
      const learningRate = typeof sonaRaw.learningRate === "number" ? sonaRaw.learningRate : undefined;
      const qualityThreshold = typeof sonaRaw.qualityThreshold === "number" ? sonaRaw.qualityThreshold : undefined;
      const backgroundIntervalMs = typeof sonaRaw.backgroundIntervalMs === "number" ? sonaRaw.backgroundIntervalMs : undefined;

      // Validate SONA numeric values
      if (!Number.isInteger(hiddenDim) || hiddenDim <= 0) {
        throw new Error(`Invalid sona.hiddenDim: ${hiddenDim}. Must be a positive integer`);
      }
      if (learningRate !== undefined && (learningRate < 0 || learningRate > 1)) {
        throw new Error(`Invalid sona.learningRate: ${learningRate}. Must be between 0 and 1`);
      }
      if (qualityThreshold !== undefined && (qualityThreshold < 0 || qualityThreshold > 1)) {
        throw new Error(`Invalid sona.qualityThreshold: ${qualityThreshold}. Must be between 0 and 1`);
      }
      if (backgroundIntervalMs !== undefined && (!Number.isInteger(backgroundIntervalMs) || backgroundIntervalMs <= 0)) {
        throw new Error(`Invalid sona.backgroundIntervalMs: ${backgroundIntervalMs}. Must be a positive integer`);
      }

      sona = {
        enabled: sonaRaw.enabled === true,
        hiddenDim,
        learningRate,
        qualityThreshold,
        backgroundIntervalMs,
      };
    }

    // Parse ruvLLM config
    const ruvllmRaw = cfg.ruvllm as Record<string, unknown> | undefined;
    let ruvllm: RuvLLMConfig | undefined;
    if (ruvllmRaw) {
      assertAllowedKeys(
        ruvllmRaw,
        ["enabled", "contextInjection", "trajectoryRecording"],
        "ruvllm config",
      );

      // Parse context injection config
      const contextInjectionRaw = ruvllmRaw.contextInjection as Record<string, unknown> | undefined;
      let contextInjection = {
        enabled: true,
        maxTokens: 2000,
        relevanceThreshold: 0.3,
      };
      if (contextInjectionRaw) {
        assertAllowedKeys(
          contextInjectionRaw,
          ["enabled", "maxTokens", "relevanceThreshold"],
          "ruvllm.contextInjection config",
        );
        const maxTokens = typeof contextInjectionRaw.maxTokens === "number"
          ? contextInjectionRaw.maxTokens
          : 2000;
        const relevanceThreshold = typeof contextInjectionRaw.relevanceThreshold === "number"
          ? contextInjectionRaw.relevanceThreshold
          : 0.3;

        // Validate context injection values
        if (!Number.isInteger(maxTokens) || maxTokens <= 0 || maxTokens > 100000) {
          throw new Error(`Invalid ruvllm.contextInjection.maxTokens: ${maxTokens}. Must be a positive integer up to 100000`);
        }
        if (relevanceThreshold < 0 || relevanceThreshold > 1) {
          throw new Error(`Invalid ruvllm.contextInjection.relevanceThreshold: ${relevanceThreshold}. Must be between 0 and 1`);
        }

        contextInjection = {
          enabled: contextInjectionRaw.enabled !== false,
          maxTokens,
          relevanceThreshold,
        };
      }

      // Parse trajectory recording config
      const trajectoryRecordingRaw = ruvllmRaw.trajectoryRecording as Record<string, unknown> | undefined;
      let trajectoryRecording = {
        enabled: true,
        maxTrajectories: 1000,
      };
      if (trajectoryRecordingRaw) {
        assertAllowedKeys(
          trajectoryRecordingRaw,
          ["enabled", "maxTrajectories"],
          "ruvllm.trajectoryRecording config",
        );
        const maxTrajectories = typeof trajectoryRecordingRaw.maxTrajectories === "number"
          ? trajectoryRecordingRaw.maxTrajectories
          : 1000;

        // Validate trajectory recording values
        if (!Number.isInteger(maxTrajectories) || maxTrajectories <= 0 || maxTrajectories > 100000) {
          throw new Error(`Invalid ruvllm.trajectoryRecording.maxTrajectories: ${maxTrajectories}. Must be a positive integer up to 100000`);
        }

        trajectoryRecording = {
          enabled: trajectoryRecordingRaw.enabled !== false,
          maxTrajectories,
        };
      }

      ruvllm = {
        enabled: ruvllmRaw.enabled === true,
        contextInjection,
        trajectoryRecording,
      };
    }

    return {
      dbPath: typeof cfg.dbPath === "string" ? cfg.dbPath : DEFAULT_DB_PATH,
      dimension: resolvedDimension,
      metric,
      embedding: {
        provider: embeddingProvider as "openai" | "voyage" | "local",
        apiKey: rawApiKey ? resolveEnvVars(rawApiKey) : undefined,
        model: embeddingModel,
        baseUrl: embedding.baseUrl
          ? resolveEnvVars(embedding.baseUrl as string)
          : undefined,
      },
      hooks,
      sona,
      ruvllm,
    };
  },
  uiHints: {
    dbPath: {
      label: "Database Path",
      placeholder: "~/.clawdbot/memory/ruvector",
      advanced: true,
      help: "Directory for ruvector database storage",
    },
    dimension: {
      label: "Vector Dimension",
      placeholder: "1536",
      advanced: true,
      help: "Must match your embedding model output dimension",
    },
    metric: {
      label: "Distance Metric",
      placeholder: "cosine",
      advanced: true,
      help: "Similarity metric: cosine (default), euclidean, or dot",
    },
    "embedding.provider": {
      label: "Embedding Provider",
      placeholder: "openai",
      help: "openai, voyage, or local",
    },
    "embedding.apiKey": {
      label: "Embedding API Key",
      sensitive: true,
      placeholder: "sk-...",
      help: "API key for embedding provider (or use ${ENV_VAR})",
    },
    "embedding.model": {
      label: "Embedding Model",
      placeholder: "text-embedding-3-small",
      help: "Model to use for generating embeddings",
    },
    "embedding.baseUrl": {
      label: "Base URL",
      placeholder: "https://api.openai.com/v1",
      advanced: true,
      help: "Custom API base URL (for local/self-hosted)",
    },
    "hooks.enabled": {
      label: "Enable Auto-Indexing",
      help: "Automatically index messages via hooks",
    },
    "hooks.indexInbound": {
      label: "Index Inbound Messages",
      help: "Index incoming user messages",
    },
    "hooks.indexOutbound": {
      label: "Index Outbound Messages",
      help: "Index outgoing bot messages",
    },
    "hooks.indexAgentResponses": {
      label: "Index Agent Responses",
      help: "Index full agent conversation turns",
    },
    "hooks.batchSize": {
      label: "Batch Size",
      placeholder: "10",
      advanced: true,
      help: "Number of messages to batch before indexing",
    },
    "hooks.debounceMs": {
      label: "Debounce (ms)",
      placeholder: "500",
      advanced: true,
      help: "Delay before flushing partial batch",
    },
    "sona.enabled": {
      label: "Enable SONA Self-Learning",
      help: "Enable Self-Organizing Neural Architecture for adaptive learning",
    },
    "sona.hiddenDim": {
      label: "Hidden Dimension",
      placeholder: "256",
      advanced: true,
      help: "Hidden dimension for SONA neural architecture",
    },
    "sona.learningRate": {
      label: "Learning Rate",
      placeholder: "0.01",
      advanced: true,
      help: "Learning rate for SONA adaptation (0-1)",
    },
    "sona.qualityThreshold": {
      label: "Quality Threshold",
      placeholder: "0.5",
      advanced: true,
      help: "Minimum quality score for learning (0-1)",
    },
    "sona.backgroundIntervalMs": {
      label: "Background Interval (ms)",
      placeholder: "30000",
      advanced: true,
      help: "Interval for background learning cycles",
    },
    "ruvllm.enabled": {
      label: "Enable ruvLLM",
      help: "Enable ruvLLM features for LLM context enrichment and adaptive learning",
    },
    "ruvllm.contextInjection.enabled": {
      label: "Enable Context Injection",
      help: "Automatically inject relevant memories into agent prompts",
    },
    "ruvllm.contextInjection.maxTokens": {
      label: "Max Context Tokens",
      placeholder: "2000",
      advanced: true,
      help: "Maximum number of tokens to inject as context",
    },
    "ruvllm.contextInjection.relevanceThreshold": {
      label: "Relevance Threshold",
      placeholder: "0.3",
      advanced: true,
      help: "Minimum relevance score (0-1) for including memories in context",
    },
    "ruvllm.trajectoryRecording.enabled": {
      label: "Enable Trajectory Recording",
      help: "Record search trajectories for learning and adaptation",
    },
    "ruvllm.trajectoryRecording.maxTrajectories": {
      label: "Max Trajectories",
      placeholder: "1000",
      advanced: true,
      help: "Maximum number of trajectories to store before pruning",
    },
  },
};
