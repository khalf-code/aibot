/**
 * Smart Model Router
 *
 * Intelligent, rule-based model routing for Clawdbot.
 * Automatically selects the most cost-effective LLM for each request
 * based on task type, channel, and context size.
 *
 * @example
 * ```typescript
 * import { ModelRouter, createModelRouter } from './model-router';
 *
 * const router = createModelRouter();
 *
 * const result = router.selectModel({
 *   message: '@opus analyze this complex code',
 *   taskType: 'coding',
 *   promptTokens: 1500,
 * });
 *
 * console.log(result.model); // { provider: 'anthropic', model: 'claude-opus-4-5' }
 * console.log(result.cleanedMessage); // 'analyze this complex code'
 * console.log(result.rule); // 'override:claude-opus-4-5'
 * ```
 *
 * Routing Priority:
 * 1. Task-based (heartbeat/status/voice/cron → Haiku)
 * 2. Explicit overrides (@opus/@sonnet/@haiku)
 * 3. Coding-agent → Opus 4.5
 * 4. Subagent → Opus 4.5
 * 5. Length thresholds (>2k tokens or >100k context → Opus)
 * 6. Default → Haiku
 */

export { ModelRouter, createModelRouter, getGlobalRouter, resetGlobalRouter } from "./router.js";
export {
  DEFAULT_ROUTING_CONFIG,
  MODELS,
  DEFAULT_PROVIDER,
  mergeConfig,
  validateConfig,
} from "./config.js";
export {
  logRoutingDecision,
  logRoutingError,
  logMetricsSummary,
  formatRoutingResult,
  setLogger,
  setVerbose,
  consoleLogger,
  silentLogger,
} from "./logging.js";
export type {
  ModelRef,
  TaskType,
  RoutingConfig,
  RoutingContext,
  RoutingResult,
  RoutingMetrics,
  OverridePattern,
  LengthThresholds,
} from "./types.js";
