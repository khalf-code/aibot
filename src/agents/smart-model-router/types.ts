/**
 * Smart Model Router - Type Definitions
 *
 * Type definitions for the model routing system.
 */

/**
 * Model reference combining provider and model ID
 */
export interface ModelRef {
  provider: string;
  model: string;
}

/**
 * Task types that can be routed
 */
export type TaskType =
  | "heartbeat"
  | "status"
  | "voice"
  | "cron"
  | "coding"
  | "subagent"
  | "general";

/**
 * Request context for routing decisions
 */
export interface RoutingContext {
  /** Type of task (heartbeat, status, etc.) */
  taskType?: TaskType;
  /** User message text */
  message: string;
  /** Estimated prompt tokens */
  promptTokens?: number;
  /** Total context window tokens used */
  contextTokens?: number;
  /** Agent ID (e.g., 'coding-agent') */
  agentId?: string;
  /** Session key */
  sessionKey?: string;
  /** Whether TTS is enabled */
  ttsEnabled?: boolean;
  /** Message channel (telegram, discord, etc.) */
  channel?: string;
  /** Session type */
  sessionType?: "main" | "cron" | "subagent";
  /** Whether this is a heartbeat check */
  isHeartbeat?: boolean;
}

/**
 * Result of a routing decision
 */
export interface RoutingResult {
  /** Selected model reference */
  model: ModelRef;
  /** Which rule triggered (for logging) */
  rule: string;
  /** Cleaned message (explicit tags stripped) */
  cleanedMessage: string;
  /** Whether an explicit override was used */
  wasExplicitOverride: boolean;
  /** Original model if different from selected */
  originalModel?: ModelRef;
}

/**
 * Override pattern configuration
 */
export interface OverridePattern {
  /** Regex pattern to match (e.g., '@opus') */
  pattern: string;
  /** Model to use when matched */
  model: string;
  /** Provider (default: anthropic) */
  provider?: string;
  /** Whether to strip the pattern from the message */
  stripPattern: boolean;
}

/**
 * Length-based threshold configuration
 */
export interface LengthThresholds {
  promptTokens: {
    /** Tokens above this use heavy model */
    heavy: number;
    /** Tokens above this use medium model (future) */
    medium?: number;
  };
  contextTokens: {
    /** Context above this uses heavy model */
    heavy: number;
    /** Context above this uses medium model (future) */
    medium?: number;
  };
  /** Model for heavy workloads */
  heavyModel: string;
  /** Provider for heavy model */
  heavyProvider?: string;
  /** Model for medium workloads (future) */
  mediumModel?: string;
}

/**
 * Full routing configuration
 */
export interface RoutingConfig {
  /** Enable/disable routing */
  enabled: boolean;
  /** Default model when no rules match */
  defaultModel: string;
  /** Default provider */
  defaultProvider: string;
  /** Task-to-model mapping */
  tasks: Record<string, string>;
  /** Task-to-provider mapping */
  taskProviders?: Record<string, string>;
  /** Length-based thresholds */
  thresholds: LengthThresholds;
  /** Explicit override patterns */
  overrides: OverridePattern[];
  /** Future: Middle tier config */
  middleTier?: {
    enabled: boolean;
    model: string;
    provider?: string;
  };
  /** Future: Local LLM config */
  local?: {
    enabled: boolean;
    provider: string;
    url: string;
    triggers: string[];
  };
}

/**
 * Metrics tracking for routing decisions
 */
export interface RoutingMetrics {
  /** Requests per model */
  requestsByModel: Map<string, number>;
  /** Requests per rule */
  requestsByRule: Map<string, number>;
  /** Total requests routed */
  totalRequests: number;
  /** Estimated cost savings (vs all-opus baseline) */
  estimatedSavings: number;
}
