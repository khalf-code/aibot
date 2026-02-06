/**
 * Smart Model Router - Core Implementation
 *
 * The main ModelRouter class that handles routing decisions.
 */

import type {
  ModelRef,
  RoutingConfig,
  RoutingContext,
  RoutingResult,
  TaskType,
  RoutingMetrics,
} from "./types.js";
import { DEFAULT_ROUTING_CONFIG, mergeConfig, DEFAULT_PROVIDER, MODELS } from "./config.js";

/**
 * ModelRouter - Intelligent model selection for LLM requests
 *
 * Routes requests to the most appropriate model based on:
 * 1. Task type (heartbeat, status, voice, cron, coding)
 * 2. Explicit overrides (@opus, @sonnet, @haiku)
 * 3. Agent type (coding-agent → Opus)
 * 4. Prompt/context length thresholds
 * 5. Default fallback (Haiku)
 */
export class ModelRouter {
  private config: RoutingConfig;
  private metrics: RoutingMetrics;
  private overridePatterns: Array<{
    regex: RegExp;
    model: string;
    provider: string;
    strip: boolean;
  }>;

  constructor(config?: Partial<RoutingConfig>) {
    this.config = mergeConfig(config);
    this.metrics = {
      requestsByModel: new Map(),
      requestsByRule: new Map(),
      totalRequests: 0,
      estimatedSavings: 0,
    };

    // Pre-compile override patterns for performance
    this.overridePatterns = this.config.overrides.map((override) => ({
      regex: new RegExp(override.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      model: override.model,
      provider: override.provider ?? DEFAULT_PROVIDER,
      strip: override.stripPattern,
    }));
  }

  /**
   * Select the optimal model for a request
   */
  selectModel(context: RoutingContext): RoutingResult {
    // If routing disabled, return default
    if (!this.config.enabled) {
      return this.createResult(
        { provider: this.config.defaultProvider, model: this.config.defaultModel },
        "disabled",
        context.message,
        false,
      );
    }

    // Priority 1: Task-based routing (heartbeat, status, voice, cron)
    const taskRoute = this.checkTaskRoute(context);
    if (taskRoute) {
      return this.recordAndReturn(taskRoute, context);
    }

    // Priority 2: Explicit override (@opus, @sonnet, @haiku)
    const overrideRoute = this.checkExplicitOverride(context.message);
    if (overrideRoute) {
      return this.recordAndReturn(overrideRoute, context);
    }

    // Priority 3: Coding agent
    if (this.isCodingAgent(context)) {
      const model = this.config.tasks.coding ?? MODELS.OPUS;
      const provider = this.config.taskProviders?.coding ?? DEFAULT_PROVIDER;
      return this.recordAndReturn(
        this.createResult({ provider, model }, "coding-agent", context.message, false),
        context,
      );
    }

    // Priority 4: Subagent
    if (this.isSubagent(context)) {
      const model = this.config.tasks.subagent ?? MODELS.OPUS;
      const provider = this.config.taskProviders?.subagent ?? DEFAULT_PROVIDER;
      return this.recordAndReturn(
        this.createResult({ provider, model }, "subagent", context.message, false),
        context,
      );
    }

    // Priority 5: Length-based routing
    const lengthRoute = this.checkLengthThreshold(context);
    if (lengthRoute) {
      return this.recordAndReturn(lengthRoute, context);
    }

    // Default: Use cheap model (Haiku)
    return this.recordAndReturn(
      this.createResult(
        { provider: this.config.defaultProvider, model: this.config.defaultModel },
        "default",
        context.message,
        false,
      ),
      context,
    );
  }

  /**
   * Check task-based routing rules
   */
  private checkTaskRoute(context: RoutingContext): RoutingResult | null {
    const taskType = this.detectTaskType(context);

    // Only route specific task types, not 'general'
    if (taskType === "general") {
      return null;
    }

    const model = this.config.tasks[taskType];
    if (!model) {
      return null;
    }

    const provider = this.config.taskProviders?.[taskType] ?? DEFAULT_PROVIDER;

    return this.createResult({ provider, model }, `task:${taskType}`, context.message, false);
  }

  /**
   * Detect task type from context
   */
  private detectTaskType(context: RoutingContext): TaskType {
    // Explicit task type takes precedence
    if (context.taskType) {
      return context.taskType;
    }

    // Check for heartbeat
    if (context.isHeartbeat) {
      return "heartbeat";
    }

    // Check message for status commands
    const msg = context.message?.toLowerCase().trim() ?? "";
    if (msg.startsWith("/status") || msg.startsWith("/sessions") || msg.startsWith("/health")) {
      return "status";
    }

    // Check for voice context
    if (context.ttsEnabled) {
      return "voice";
    }

    // Check session type
    if (context.sessionType === "cron") {
      return "cron";
    }

    if (context.sessionType === "subagent") {
      return "subagent";
    }

    // Check agent ID for coding
    if (this.isCodingAgent(context)) {
      return "coding";
    }

    return "general";
  }

  /**
   * Check for explicit model override in message
   */
  private checkExplicitOverride(message: string): RoutingResult | null {
    if (!message) return null;

    for (const override of this.overridePatterns) {
      if (override.regex.test(message)) {
        const cleanedMessage = override.strip
          ? message.replace(override.regex, "").trim().replace(/\s+/g, " ")
          : message;

        return this.createResult(
          { provider: override.provider, model: override.model },
          `override:${override.model}`,
          cleanedMessage,
          true,
        );
      }
    }

    return null;
  }

  /**
   * Check if this is a coding agent request
   */
  private isCodingAgent(context: RoutingContext): boolean {
    const agentId = context.agentId?.toLowerCase();
    if (!agentId) return false;

    return (
      agentId === "coding-agent" ||
      agentId === "codex" ||
      agentId.includes("coding") ||
      agentId.includes("code")
    );
  }

  /**
   * Check if this is a subagent request
   */
  private isSubagent(context: RoutingContext): boolean {
    if (context.sessionType === "subagent") return true;

    const sessionKey = context.sessionKey?.toLowerCase() ?? "";
    return sessionKey.includes(":subagent:");
  }

  /**
   * Check length-based thresholds
   */
  private checkLengthThreshold(context: RoutingContext): RoutingResult | null {
    const { promptTokens, contextTokens } = context;
    const { thresholds } = this.config;

    // Check prompt length
    if (typeof promptTokens === "number" && promptTokens > thresholds.promptTokens.heavy) {
      return this.createResult(
        {
          provider: thresholds.heavyProvider ?? DEFAULT_PROVIDER,
          model: thresholds.heavyModel,
        },
        `length:prompt>${thresholds.promptTokens.heavy}`,
        context.message,
        false,
      );
    }

    // Check context length
    if (typeof contextTokens === "number" && contextTokens > thresholds.contextTokens.heavy) {
      return this.createResult(
        {
          provider: thresholds.heavyProvider ?? DEFAULT_PROVIDER,
          model: thresholds.heavyModel,
        },
        `length:context>${thresholds.contextTokens.heavy}`,
        context.message,
        false,
      );
    }

    return null;
  }

  /**
   * Create a routing result
   */
  private createResult(
    model: ModelRef,
    rule: string,
    cleanedMessage: string,
    wasExplicitOverride: boolean,
    originalModel?: ModelRef,
  ): RoutingResult {
    return {
      model,
      rule,
      cleanedMessage,
      wasExplicitOverride,
      originalModel,
    };
  }

  /**
   * Record metrics and return result
   */
  private recordAndReturn(result: RoutingResult, context: RoutingContext): RoutingResult {
    this.metrics.totalRequests++;

    const modelKey = `${result.model.provider}/${result.model.model}`;
    this.metrics.requestsByModel.set(
      modelKey,
      (this.metrics.requestsByModel.get(modelKey) ?? 0) + 1,
    );

    this.metrics.requestsByRule.set(
      result.rule,
      (this.metrics.requestsByRule.get(result.rule) ?? 0) + 1,
    );

    // Estimate savings (rough: Haiku is ~1/10th cost of Opus)
    if (result.model.model.includes("haiku")) {
      // Saved cost = what Opus would have cost - what Haiku costs
      // Approximate: $15/1M for Opus, $0.25/1M for Haiku input
      // Savings per request ≈ $0.015 - $0.00025 ≈ $0.015
      const estimatedTokens = context.promptTokens ?? 1000;
      const opusCost = (estimatedTokens / 1_000_000) * 15;
      const haikuCost = (estimatedTokens / 1_000_000) * 0.25;
      this.metrics.estimatedSavings += opusCost - haikuCost;
    }

    return result;
  }

  /**
   * Get current metrics
   */
  getMetrics(): RoutingMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      requestsByModel: new Map(),
      requestsByRule: new Map(),
      totalRequests: 0,
      estimatedSavings: 0,
    };
  }

  /**
   * Get formatted metrics summary
   */
  getMetricsSummary(): string {
    const parts: string[] = [];

    for (const [model, count] of this.metrics.requestsByModel.entries()) {
      const shortName = model.split("/").pop() ?? model;
      parts.push(`${shortName}: ${count}`);
    }

    const savings = this.metrics.estimatedSavings.toFixed(2);
    parts.push(`saved ~$${savings}`);

    return parts.join(" | ");
  }

  /**
   * Check if routing is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable/disable routing
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Get current config
   */
  getConfig(): RoutingConfig {
    return { ...this.config };
  }
}

/**
 * Create a default router instance
 */
export function createModelRouter(config?: Partial<RoutingConfig>): ModelRouter {
  return new ModelRouter(config);
}

/**
 * Singleton router instance for global use
 */
let globalRouter: ModelRouter | null = null;

/**
 * Get or create the global router instance
 */
export function getGlobalRouter(config?: Partial<RoutingConfig>): ModelRouter {
  if (!globalRouter) {
    globalRouter = createModelRouter(config);
  }
  return globalRouter;
}

/**
 * Reset the global router (for testing)
 */
export function resetGlobalRouter(): void {
  globalRouter = null;
}
