/**
 * MiniMax M2.1 Tool Result Formatter
 *
 * Formats tool execution results in the format expected by MiniMax.
 * MiniMax expects tool results to be returned in a specific format
 * so the model can continue the conversation properly.
 */

export interface MinimaxToolResult {
  /** Tool name that was called */
  name: string;
  /** Tool call ID for correlation */
  toolCallId: string;
  /** Result content (string or JSON-serializable) */
  result: unknown;
  /** Whether the tool execution resulted in an error */
  isError: boolean;
}

/**
 * Format a tool result for MiniMax.
 * MiniMax expects results to be formatted as structured content
 * that it can parse and use in subsequent reasoning.
 */
export function formatToolResultForMinimax(params: MinimaxToolResult): string {
  const { name, toolCallId, result, isError } = params;

  // Serialize result to string if needed
  let resultText: string;
  if (typeof result === "string") {
    resultText = result;
  } else if (result === null || result === undefined) {
    resultText = isError ? "Tool execution failed with no error message" : "No output";
  } else {
    try {
      resultText = JSON.stringify(result, null, 2);
    } catch {
      // Fallback for non-serializable objects
      resultText = typeof result === "object" ? "[object]" : String(result as string | number);
    }
  }

  // Truncate very long results to avoid context overflow
  const maxLength = 50000; // 50KB limit for tool results
  if (resultText.length > maxLength) {
    resultText = resultText.slice(0, maxLength) + "\n...[truncated]";
  }

  // Format in MiniMax's expected tool result format
  // Based on MiniMax documentation, tool results should use the ]\~b]tool role marker
  if (isError) {
    return `Tool "${name}" (${toolCallId}) failed:\n${resultText}`;
  }

  return `Tool "${name}" (${toolCallId}) result:\n${resultText}`;
}

/**
 * Format multiple tool results for MiniMax.
 */
export function formatMultipleToolResultsForMinimax(results: MinimaxToolResult[]): string {
  return results.map(formatToolResultForMinimax).join("\n\n");
}

/**
 * Create a tool result message entry for the session history.
 * This formats the result in a way that MiniMax can understand
 * when the conversation continues.
 */
export function createMinimaxToolResultMessage(params: MinimaxToolResult): {
  role: "tool";
  content: Array<{ type: "text"; name: string; text: string }>;
} {
  const { name, result, isError } = params;

  let resultText: string;
  if (typeof result === "string") {
    resultText = result;
  } else if (result === null || result === undefined) {
    resultText = isError ? "Error: No details available" : "";
  } else {
    try {
      resultText = JSON.stringify(result, null, 2);
    } catch {
      // Fallback for non-serializable objects
      resultText = typeof result === "object" ? "[object]" : String(result as string | number);
    }
  }

  return {
    role: "tool",
    content: [
      {
        type: "text",
        name,
        text: isError ? `Error: ${resultText}` : resultText,
      },
    ],
  };
}
