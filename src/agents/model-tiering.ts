/**
 * Smart Model Tiering
 *
 * Routes simple queries to cheaper models automatically, escalating to expensive
 * models only when complexity warrants it. This can significantly reduce costs
 * for users who primarily use OpenClaw for casual conversations.
 *
 * Configuration:
 * ```json5
 * {
 *   agents: {
 *     defaults: {
 *       model: {
 *         primary: "anthropic/claude-sonnet-4-5",  // Complex tasks
 *         tiering: {
 *           enabled: true,
 *           simple: "ollama/llama3.3",  // Simple queries (free/cheap)
 *         },
 *       },
 *     },
 *   },
 * }
 * ```
 */

import type { OpenClawConfig } from "../config/config.js";
import { parseModelRef, type ModelRef } from "./model-selection.js";

export type QueryComplexity = "simple" | "complex";

export type TieringConfig = {
  enabled?: boolean;
  /** Model to use for simple queries (e.g., "ollama/llama3.3") */
  simple?: string;
  /** Custom patterns that indicate complex queries (regex strings) */
  complexPatterns?: string[];
  /** Minimum message length to consider for simple tier (default: 500 chars) */
  complexLengthThreshold?: number;
};

/**
 * Patterns that indicate a query is complex and needs a powerful model.
 * These are checked case-insensitively.
 */
const DEFAULT_COMPLEX_PATTERNS = [
  // Code-related tasks
  /\b(write|create|implement|build|code|program)\b.*\b(function|class|api|endpoint|algorithm|module|component|service|script)\b/i,
  /\b(function|class|api|endpoint|algorithm)\b.*\b(for|that|which|to)\b/i,
  /\b(debug|fix|refactor|optimize|review)\b.*\b(code|function|bug|error|issue)\b/i,
  /\b(explain|analyze)\b.*\b(code|algorithm|architecture|system)\b/i,
  /```[\s\S]{50,}```/, // Code blocks over 50 chars

  // Multi-step reasoning
  /\b(step[- ]by[- ]step|let'?s think|break down|analyze|compare and contrast)\b/i,
  /\b(pros? and cons?|trade[- ]?offs?|advantages? and disadvantages?)\b/i,

  // Long-form content
  /\b(write|draft|compose|create)\b.*\b(essay|article|report|document|proposal|plan)\b/i,
  /\b(summarize|synthesize)\b.*\b(article|paper|document|book|chapter)\b/i,

  // Data/file operations
  /\b(read|parse|process|transform|convert)\b.*\b(file|json|csv|xml|data)\b/i,
  /\b(search|find|grep|locate)\b.*\b(in|across|through)\b.*\b(files?|codebase|project)\b/i,

  // System operations
  /\b(run|execute|install|deploy|configure|setup)\b/i,
  /\b(git|npm|pip|docker|kubectl|terraform)\b/i,

  // Complex questions
  /\b(how (does|do|can|should|would)|why (does|do|is|are|would)|what (is the best|are the|would happen))\b.*\?/i,

  // Planning/architecture
  /\b(design|architect|plan|structure|organize)\b.*\b(system|app|application|project|database)\b/i,
];

/**
 * Patterns that indicate a query is simple and can use a cheaper model.
 */
const SIMPLE_PATTERNS = [
  // Greetings
  /^(hi|hello|hey|good (morning|afternoon|evening)|howdy|yo|sup)[\s!?.]*$/i,

  // Simple status/info
  /^(thanks|thank you|ok|okay|got it|understood|cool|great|nice|awesome|perfect)[\s!?.]*$/i,

  // Simple questions
  /^(what time is it|what'?s the (time|date|weather))[\s?]*$/i,
  /^(who are you|what are you|what can you do)[\s?]*$/i,

  // Single-word or very short queries
  /^[a-z]{1,15}[\s!?.]*$/i,

  // Yes/no responses
  /^(yes|no|yep|nope|yeah|nah|sure|maybe)[\s!?.]*$/i,
];

/**
 * Classify a query as simple or complex to determine model tier.
 */
export function classifyQueryComplexity(
  query: string,
  config?: TieringConfig,
): QueryComplexity {
  const trimmed = query.trim();

  // Empty or very short queries are simple
  if (!trimmed || trimmed.length < 3) {
    return "simple";
  }

  // Check explicit simple patterns first
  for (const pattern of SIMPLE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "simple";
    }
  }

  // Check length threshold (default: 500 chars indicates complexity)
  const lengthThreshold = config?.complexLengthThreshold ?? 500;
  if (trimmed.length > lengthThreshold) {
    return "complex";
  }

  // Check default complex patterns
  for (const pattern of DEFAULT_COMPLEX_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "complex";
    }
  }

  // Check custom complex patterns from config
  if (config?.complexPatterns) {
    for (const patternStr of config.complexPatterns) {
      try {
        const pattern = new RegExp(patternStr, "i");
        if (pattern.test(trimmed)) {
          return "complex";
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }

  // Check for question complexity by counting question words
  const questionWords = (trimmed.match(/\b(what|why|how|when|where|which|who|explain|describe)\b/gi) || []).length;
  if (questionWords >= 2) {
    return "complex";
  }

  // Check for list requests (often need structured thinking)
  if (/\b(list|enumerate|give me|show me|tell me)\b.*\b(all|every|each|different|various)\b/i.test(trimmed)) {
    return "complex";
  }

  // Default to simple for short, non-matching queries
  if (trimmed.length < 100) {
    return "simple";
  }

  // Medium-length queries without complex indicators are also simple
  return "simple";
}

/**
 * Resolve the tiering configuration from OpenClawConfig.
 */
export function resolveTieringConfig(cfg: OpenClawConfig): TieringConfig | null {
  const modelConfig = cfg.agents?.defaults?.model;
  if (!modelConfig || typeof modelConfig === "string") {
    return null;
  }

  const tiering = (modelConfig as { tiering?: TieringConfig }).tiering;
  if (!tiering?.enabled) {
    return null;
  }

  return tiering;
}

/**
 * Resolve the model to use based on query complexity and tiering config.
 * Returns the tiered model ref if applicable, or null to use the default.
 */
export function resolveTieredModel(params: {
  cfg: OpenClawConfig;
  query: string;
  defaultProvider: string;
}): { ref: ModelRef; tier: QueryComplexity } | null {
  const tiering = resolveTieringConfig(params.cfg);
  if (!tiering) {
    return null;
  }

  const complexity = classifyQueryComplexity(params.query, tiering);

  // Only override for simple queries when a simple model is configured
  if (complexity === "simple" && tiering.simple) {
    const ref = parseModelRef(tiering.simple, params.defaultProvider);
    if (ref) {
      return { ref, tier: "simple" };
    }
  }

  // Complex queries or no simple model configured - use default
  return null;
}

/**
 * Get a human-readable description of why a query was classified as complex.
 */
export function describeComplexityReason(query: string): string | null {
  const trimmed = query.trim();

  if (trimmed.length > 500) {
    return "Query length exceeds 500 characters";
  }

  for (const pattern of DEFAULT_COMPLEX_PATTERNS) {
    if (pattern.test(trimmed)) {
      return `Matches complex pattern: ${pattern.source.slice(0, 50)}...`;
    }
  }

  const questionWords = (trimmed.match(/\b(what|why|how|when|where|which|who|explain|describe)\b/gi) || []).length;
  if (questionWords >= 2) {
    return `Contains ${questionWords} question/explanation words`;
  }

  return null;
}
