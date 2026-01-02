/**
 * Deep Research result delivery
 * @see docs/sdd/deep-research/ui-flow.md
 */

import { messages, type DeepResearchResult } from "./messages.js";
import { parseResultJson, getResultJsonPath } from "./parser.js";
import type { ExecuteResult } from "./executor.js";

export interface DeliveryContext {
  sendMessage: (text: string) => Promise<void>;
  sendError: (text: string, retryButton?: unknown) => Promise<void>;
}

/**
 * Deliver deep research results to user
 * @param executeResult - Result from executeDeepResearch()
 * @param context - Delivery context with send functions
 */
export async function deliverResults(
  executeResult: ExecuteResult,
  context: DeliveryContext,
): Promise<boolean> {
  // Handle execution failure
  if (!executeResult.success) {
    if (executeResult.error === "Execution timeout") {
      await context.sendError(messages.timeout());
      return false;
    }
    if (executeResult.error?.startsWith("CLI not found:")) {
      const path = executeResult.error.replace("CLI not found:", "").trim();
      await context.sendError(messages.cliNotFound(path));
      return false;
    }
    await context.sendError(
      messages.error(
        executeResult.error || "Unknown error",
        executeResult.runId,
      ),
    );
    return false;
  }

  // Get result.json path
  const resultPath =
    executeResult.resultJsonPath ||
    (executeResult.runId ? getResultJsonPath(executeResult.runId) : null);

  if (!resultPath) {
    await context.sendError(
      messages.error("No result file found", executeResult.runId),
    );
    return false;
  }

  // Parse result
  const result = await parseResultJson(resultPath);

  if (!result) {
    await context.sendError(
      messages.error("Failed to parse results", executeResult.runId),
    );
    return false;
  }

  // Send formatted result
  await context.sendMessage(messages.resultDelivery(result));
  return true;
}

/**
 * Truncate long text for Telegram (4096 char limit)
 */
export function truncateForTelegram(text: string, maxLength = 4000): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + "...";
}
