/**
 * Smart Model Router - Logging
 *
 * Logging utilities for routing decisions.
 */

import type { RoutingResult, RoutingContext } from "./types.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface RouterLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Default console logger
 */
export const consoleLogger: RouterLogger = {
  debug: (msg) => console.log(`[router:debug] ${msg}`),
  info: (msg) => console.log(`[router] ${msg}`),
  warn: (msg) => console.warn(`[router:warn] ${msg}`),
  error: (msg) => console.error(`[router:error] ${msg}`),
};

/**
 * Silent logger (for testing)
 */
export const silentLogger: RouterLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

let activeLogger: RouterLogger = consoleLogger;
let isVerbose = false;

/**
 * Set the active logger
 */
export function setLogger(logger: RouterLogger): void {
  activeLogger = logger;
}

/**
 * Enable/disable verbose logging
 */
export function setVerbose(verbose: boolean): void {
  isVerbose = verbose;
}

/**
 * Log a routing decision
 */
export function logRoutingDecision(result: RoutingResult, context?: RoutingContext): void {
  const modelKey = `${result.model.provider}/${result.model.model}`;
  // Extract model name like 'haiku', 'sonnet', 'opus' from 'claude-haiku-4'
  const modelParts = result.model.model.replace("claude-", "").split("-");
  const shortModel = modelParts[0] ?? result.model.model;

  const parts = [`→ ${shortModel}`, `(rule: ${result.rule})`];

  if (result.wasExplicitOverride) {
    parts.push("[explicit]");
  }

  if (isVerbose && context) {
    if (context.taskType) parts.push(`task=${context.taskType}`);
    if (context.agentId) parts.push(`agent=${context.agentId}`);
    if (context.promptTokens) parts.push(`tokens=${context.promptTokens}`);
  }

  activeLogger.info(parts.join(" "));
}

/**
 * Log routing disabled
 */
export function logRoutingDisabled(): void {
  activeLogger.debug("routing disabled, using default model");
}

/**
 * Log routing error
 */
export function logRoutingError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  activeLogger.error(`routing error: ${message}`);
}

/**
 * Log metrics summary
 */
export function logMetricsSummary(summary: string): void {
  activeLogger.info(`📊 Routing: ${summary}`);
}

/**
 * Format routing result for display
 */
export function formatRoutingResult(result: RoutingResult): string {
  const modelName = result.model.model
    .replace("claude-", "")
    .replace("-4-5", " 4.5")
    .replace("-4", " 4");

  return `${modelName} (${result.rule})`;
}
