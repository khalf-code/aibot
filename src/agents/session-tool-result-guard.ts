import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SessionManager } from "@mariozechner/pi-coding-agent";
import { emitSessionTranscriptUpdate } from "../sessions/transcript-events.js";
import { makeMissingToolResult, sanitizeToolCallInputs } from "./session-transcript-repair.js";

/**
 * Maximum characters preserved in a single tool result's text content.
 *
 * Tool results exceeding this limit are truncated before persistence to
 * prevent session file bloat (see #2254).  Large tool outputs — such as
 * the gateway `config.schema` action returning 396 KB+ of JSON — are the
 * primary driver of runaway session growth that leads to context overflow
 * and compaction failures (#3479).
 *
 * ~32 000 chars ≈ 8 000 tokens — well within summarisation chunk budgets.
 */
export const MAX_TOOL_RESULT_CONTENT_CHARS = 32_000;

type ToolCall = { id: string; name?: string };

function extractAssistantToolCalls(msg: Extract<AgentMessage, { role: "assistant" }>): ToolCall[] {
  const content = msg.content;
  if (!Array.isArray(content)) {
    return [];
  }

  const toolCalls: ToolCall[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const rec = block as { type?: unknown; id?: unknown; name?: unknown };
    if (typeof rec.id !== "string" || !rec.id) {
      continue;
    }
    if (rec.type === "toolCall" || rec.type === "toolUse" || rec.type === "functionCall") {
      toolCalls.push({
        id: rec.id,
        name: typeof rec.name === "string" ? rec.name : undefined,
      });
    }
  }
  return toolCalls;
}

function extractToolResultId(msg: Extract<AgentMessage, { role: "toolResult" }>): string | null {
  const toolCallId = (msg as { toolCallId?: unknown }).toolCallId;
  if (typeof toolCallId === "string" && toolCallId) {
    return toolCallId;
  }
  const toolUseId = (msg as { toolUseId?: unknown }).toolUseId;
  if (typeof toolUseId === "string" && toolUseId) {
    return toolUseId;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tool-result size guard (#2254)
// ---------------------------------------------------------------------------

type ContentBlock = { type?: unknown; text?: unknown; [key: string]: unknown };

function measureTextContent(content: unknown): number {
  if (typeof content === "string") {
    return content.length;
  }
  if (!Array.isArray(content)) {
    return 0;
  }
  let total = 0;
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const rec = block as ContentBlock;
    if (rec.type === "text" && typeof rec.text === "string") {
      total += rec.text.length;
    }
  }
  return total;
}

/**
 * Truncate oversized tool-result content so the session transcript does not
 * grow beyond practical limits.  Only `role === "toolResult"` messages whose
 * total text content exceeds `maxChars` are affected.
 *
 * The function preserves the leading portion of each text block (up to the
 * remaining character budget) and appends a human-readable truncation note.
 */
export function truncateToolResultContent(message: AgentMessage, maxChars: number): AgentMessage {
  const role = (message as { role?: unknown }).role;
  if (role !== "toolResult") {
    return message;
  }

  const content = (message as { content?: unknown }).content;

  // Handle plain-string content (uncommon but possible).
  if (typeof content === "string") {
    if (content.length <= maxChars) {
      return message;
    }
    const note =
      `\n\n[Truncated: original output was ${content.length.toLocaleString()} chars. ` +
      `Only the first ${maxChars.toLocaleString()} chars were preserved to prevent session bloat.]`;
    return { ...message, content: content.slice(0, maxChars) + note } as AgentMessage;
  }

  if (!Array.isArray(content)) {
    return message;
  }

  const totalChars = measureTextContent(content);
  if (totalChars <= maxChars) {
    return message;
  }

  // Distribute the character budget across text blocks in order.
  let budget = maxChars;
  const truncated = content.map((block: unknown) => {
    if (!block || typeof block !== "object") {
      return block;
    }
    const rec = block as ContentBlock;
    if (rec.type !== "text" || typeof rec.text !== "string") {
      return block;
    }
    if (rec.text.length <= budget) {
      budget -= rec.text.length;
      return block;
    }
    const kept = Math.max(0, budget);
    budget = 0;
    if (kept === 0) {
      return {
        ...rec,
        text: `[Content omitted — tool output exceeded ${maxChars.toLocaleString()} char session limit]`,
      };
    }
    const note =
      `\n\n[Truncated: original block was ${rec.text.length.toLocaleString()} chars. ` +
      `Only the first ${kept.toLocaleString()} chars were preserved to prevent session bloat.]`;
    return { ...rec, text: rec.text.slice(0, kept) + note };
  });

  return { ...message, content: truncated } as AgentMessage;
}

export function installSessionToolResultGuard(
  sessionManager: SessionManager,
  opts?: {
    /**
     * Optional, synchronous transform applied to toolResult messages *before* they are
     * persisted to the session transcript.
     */
    transformToolResultForPersistence?: (
      message: AgentMessage,
      meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean },
    ) => AgentMessage;
    /**
     * Whether to synthesize missing tool results to satisfy strict providers.
     * Defaults to true.
     */
    allowSyntheticToolResults?: boolean;
    /**
     * Maximum characters to preserve in tool-result text content.
     * Tool results exceeding this limit are truncated with a note.
     * Defaults to {@link MAX_TOOL_RESULT_CONTENT_CHARS} (32 000).
     */
    maxToolResultContentChars?: number;
  },
): {
  flushPendingToolResults: () => void;
  getPendingIds: () => string[];
} {
  const originalAppend = sessionManager.appendMessage.bind(sessionManager);
  const pending = new Map<string, string | undefined>();
  const maxToolResultChars = opts?.maxToolResultContentChars ?? MAX_TOOL_RESULT_CONTENT_CHARS;

  const persistToolResult = (
    message: AgentMessage,
    meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean },
  ) => {
    const transformer = opts?.transformToolResultForPersistence;
    return transformer ? transformer(message, meta) : message;
  };

  const allowSyntheticToolResults = opts?.allowSyntheticToolResults ?? true;

  const flushPendingToolResults = () => {
    if (pending.size === 0) {
      return;
    }
    if (allowSyntheticToolResults) {
      for (const [id, name] of pending.entries()) {
        const synthetic = makeMissingToolResult({ toolCallId: id, toolName: name });
        originalAppend(
          persistToolResult(synthetic, {
            toolCallId: id,
            toolName: name,
            isSynthetic: true,
          }) as never,
        );
      }
    }
    pending.clear();
  };

  const guardedAppend = (message: AgentMessage) => {
    let nextMessage = message;
    const role = (message as { role?: unknown }).role;
    if (role === "assistant") {
      const sanitized = sanitizeToolCallInputs([message]);
      if (sanitized.length === 0) {
        if (allowSyntheticToolResults && pending.size > 0) {
          flushPendingToolResults();
        }
        return undefined;
      }
      nextMessage = sanitized[0];
    }
    const nextRole = (nextMessage as { role?: unknown }).role;

    if (nextRole === "toolResult") {
      const id = extractToolResultId(nextMessage as Extract<AgentMessage, { role: "toolResult" }>);
      const toolName = id ? pending.get(id) : undefined;
      if (id) {
        pending.delete(id);
      }
      const persisted = persistToolResult(nextMessage, {
        toolCallId: id ?? undefined,
        toolName,
        isSynthetic: false,
      });
      // Truncate oversized tool results before writing to the session
      // transcript.  This prevents pathological session growth (#2254)
      // caused by tools that return very large payloads (e.g. gateway
      // config.schema returning 396 KB+ of JSON).
      const safeSized = truncateToolResultContent(persisted, maxToolResultChars);
      return originalAppend(safeSized as never);
    }

    const toolCalls =
      nextRole === "assistant"
        ? extractAssistantToolCalls(nextMessage as Extract<AgentMessage, { role: "assistant" }>)
        : [];

    if (allowSyntheticToolResults) {
      // If previous tool calls are still pending, flush before non-tool results.
      if (pending.size > 0 && (toolCalls.length === 0 || nextRole !== "assistant")) {
        flushPendingToolResults();
      }
      // If new tool calls arrive while older ones are pending, flush the old ones first.
      if (pending.size > 0 && toolCalls.length > 0) {
        flushPendingToolResults();
      }
    }

    const result = originalAppend(nextMessage as never);

    const sessionFile = (
      sessionManager as { getSessionFile?: () => string | null }
    ).getSessionFile?.();
    if (sessionFile) {
      emitSessionTranscriptUpdate(sessionFile);
    }

    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        pending.set(call.id, call.name);
      }
    }

    return result;
  };

  // Monkey-patch appendMessage with our guarded version.
  sessionManager.appendMessage = guardedAppend as SessionManager["appendMessage"];

  return {
    flushPendingToolResults,
    getPendingIds: () => Array.from(pending.keys()),
  };
}
