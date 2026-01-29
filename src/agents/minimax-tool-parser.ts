/**
 * MiniMax M2.1 Tool Call Parser
 *
 * MiniMax outputs tool calls in a proprietary XML format instead of OpenAI's
 * structured JSON format. This parser extracts and converts XML tool calls
 * to structured format for execution.
 *
 * Example MiniMax output:
 * ```xml
 * <<minimax:tool_call>>
 *   <<invoke name="read">>
 *     <<parameter name="path">>/home/liam/file.txt<</parameter>>
 *   <</invoke>>
 * <</minimax:tool_call>>
 * ```
 */

export interface MinimaxToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ExtractedToolBlock {
  /** The complete tool call block (including tags) */
  block: string;
  /** Text before the tool call block */
  before: string;
  /** Text after the tool call block */
  after: string;
}

// Regex patterns for MiniMax XML format
// Note: MiniMax uses << >> delimiters, not < >
const TOOL_CALL_START_RE = /<<minimax:tool_call>>/i;
const TOOL_CALL_END_RE = /<<\/minimax:tool_call>>/i;
const TOOL_CALL_BLOCK_RE = /<<minimax:tool_call>>([\s\S]*?)<<\/minimax:tool_call>>/gi;
const INVOKE_RE = /<<invoke\s+name=["']?([^"'>\s]+)["']?\s*>>([\s\S]*?)<<\/invoke>>/gi;
const PARAMETER_RE = /<<parameter\s+name=["']?([^"'>\s]+)["']?\s*>>([\s\S]*?)<<\/parameter>>/gi;

/**
 * Check if text contains the start of a MiniMax tool call block.
 * Used for streaming detection.
 */
export function hasMinimaxToolCallStart(text: string): boolean {
  return TOOL_CALL_START_RE.test(text);
}

/**
 * Check if text contains the end of a MiniMax tool call block.
 * Used to detect when buffering should complete.
 */
export function hasMinimaxToolCallEnd(text: string): boolean {
  return TOOL_CALL_END_RE.test(text);
}

/**
 * Check if text contains a complete MiniMax tool call block.
 */
export function hasCompleteMinimaxToolCall(text: string): boolean {
  return TOOL_CALL_BLOCK_RE.test(text);
}

/**
 * Try to parse a JSON value, falling back to the raw string.
 */
function tryParseJsonValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  // Try JSON parse for arrays, objects, numbers, booleans
  try {
    return JSON.parse(trimmed);
  } catch {
    // Return as string if not valid JSON
    return trimmed;
  }
}

/**
 * Parse parameter values with type inference.
 * Handles JSON arrays/objects, numbers, booleans, and strings.
 */
function parseParameterValue(value: string): unknown {
  const trimmed = value.trim();

  // Handle newline-prefixed values (MiniMax sometimes adds leading newlines)
  const cleaned = trimmed.startsWith("\n") ? trimmed.slice(1).trim() : trimmed;

  return tryParseJsonValue(cleaned);
}

/**
 * Extract all tool calls from a single <<minimax:tool_call>> block.
 */
function parseToolCallBlock(blockContent: string): MinimaxToolCall[] {
  const calls: MinimaxToolCall[] = [];

  // Reset regex state
  const invokeRe = new RegExp(INVOKE_RE.source, "gi");

  let invokeMatch: RegExpExecArray | null;
  while ((invokeMatch = invokeRe.exec(blockContent)) !== null) {
    const toolName = invokeMatch[1].trim();
    const paramsContent = invokeMatch[2];

    const args: Record<string, unknown> = {};

    // Reset regex state for parameters
    const paramRe = new RegExp(PARAMETER_RE.source, "gi");

    let paramMatch: RegExpExecArray | null;
    while ((paramMatch = paramRe.exec(paramsContent)) !== null) {
      const paramName = paramMatch[1].trim();
      const paramValue = paramMatch[2];
      args[paramName] = parseParameterValue(paramValue);
    }

    calls.push({
      name: toolName,
      arguments: args,
    });
  }

  return calls;
}

/**
 * Parse all MiniMax tool calls from text.
 * Returns an array of tool calls extracted from all <<minimax:tool_call>> blocks.
 */
export function parseMinimaxToolCalls(text: string): MinimaxToolCall[] {
  const calls: MinimaxToolCall[] = [];

  // Reset regex state
  const blockRe = new RegExp(TOOL_CALL_BLOCK_RE.source, "gi");

  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRe.exec(text)) !== null) {
    const blockContent = blockMatch[1];
    const blockCalls = parseToolCallBlock(blockContent);
    calls.push(...blockCalls);
  }

  return calls;
}

/**
 * Extract the first complete tool call block from text.
 * Returns the block and surrounding text, or null if no complete block found.
 */
export function extractMinimaxToolCallBlock(text: string): ExtractedToolBlock | null {
  // Reset regex state
  const blockRe = new RegExp(TOOL_CALL_BLOCK_RE.source, "i");
  const match = blockRe.exec(text);

  if (!match) return null;

  const block = match[0];
  const startIndex = match.index;
  const endIndex = startIndex + block.length;

  return {
    block,
    before: text.slice(0, startIndex),
    after: text.slice(endIndex),
  };
}

/**
 * Extract all tool call blocks from text.
 * Returns array of extracted blocks with their positions.
 */
export function extractAllMinimaxToolCallBlocks(text: string): ExtractedToolBlock[] {
  const blocks: ExtractedToolBlock[] = [];
  let remaining = text;
  let offset = 0;

  while (true) {
    const extracted = extractMinimaxToolCallBlock(remaining);
    if (!extracted) break;

    blocks.push({
      block: extracted.block,
      before: text.slice(offset, offset + extracted.before.length),
      after: "", // Will be set for the last block
    });

    offset += extracted.before.length + extracted.block.length;
    remaining = extracted.after;
  }

  // Set the after text for the last block
  if (blocks.length > 0) {
    blocks[blocks.length - 1].after = remaining;
  }

  return blocks;
}

/**
 * Strip all MiniMax tool call blocks from text, returning only non-tool content.
 * This is the inverse of extractMinimaxToolCallBlocks.
 */
export function stripMinimaxToolCallBlocks(text: string): string {
  return text.replace(TOOL_CALL_BLOCK_RE, "");
}

/**
 * Check if text appears to be a partial/incomplete MiniMax tool call.
 * Used to detect when we need to buffer more content.
 */
export function isPartialMinimaxToolCall(text: string): boolean {
  const hasStart = hasMinimaxToolCallStart(text);
  const hasEnd = hasMinimaxToolCallEnd(text);

  // Has start but no end = partial
  return hasStart && !hasEnd;
}

/**
 * Generate a unique tool call ID for synthetic tool executions.
 */
export function generateMinimaxToolCallId(): string {
  return `minimax_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
