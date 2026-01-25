import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { estimateTokens, type SessionManager } from "@mariozechner/pi-coding-agent";

import { makeMissingToolResult } from "./session-transcript-repair.js";
import { emitSessionTranscriptUpdate } from "../sessions/transcript-events.js";

type ToolCall = { id: string; name?: string };

/**
 * Context for overflow detection during tool result append.
 */
export type OverflowContext = {
  /** The message about to be appended. */
  message: AgentMessage;
  /** Estimated tokens for the message. */
  messageTokens: number;
  /** Current total tokens in the session (before append). */
  currentTokens: number;
  /** Context window limit. */
  contextWindowTokens: number;
  /** Tool name if this is a tool result. */
  toolName?: string;
  /** Tool call ID if this is a tool result. */
  toolCallId?: string;
};

/**
 * Result from the overflow handler.
 */
export type OverflowHandlerResult = {
  /** Whether compaction was performed. */
  compacted: boolean;
  /** New token count after compaction (if performed). */
  tokensAfterCompaction?: number;
};

function extractAssistantToolCalls(msg: Extract<AgentMessage, { role: "assistant" }>): ToolCall[] {
  const content = msg.content;
  if (!Array.isArray(content)) return [];

  const toolCalls: ToolCall[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const rec = block as { type?: unknown; id?: unknown; name?: unknown };
    if (typeof rec.id !== "string" || !rec.id) continue;
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
  if (typeof toolCallId === "string" && toolCallId) return toolCallId;
  const toolUseId = (msg as { toolUseId?: unknown }).toolUseId;
  if (typeof toolUseId === "string" && toolUseId) return toolUseId;
  return null;
}

/**
 * Options for the session tool result guard.
 */
export type SessionToolResultGuardOptions = {
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
   * Context window size in tokens for overflow detection.
   * If not provided, overflow detection is disabled.
   */
  contextWindowTokens?: number;
  /**
   * Reserve tokens to keep below the context window limit.
   * Overflow is triggered when: currentTokens + messageTokens > contextWindowTokens - reserveTokens.
   * Defaults to 0.
   */
  reserveTokens?: number;
  /**
   * Callback invoked when appending a message would cause context overflow.
   * This is called BEFORE the message is appended, giving the caller a chance
   * to compact the session first.
   *
   * If the callback returns { compacted: true }, the guard will re-estimate
   * current tokens from the session manager before appending.
   *
   * Note: This callback may be called synchronously from appendMessage.
   * If async operations are needed, consider using onOverflowDetectedAsync.
   */
  onOverflowDetected?: (context: OverflowContext) => OverflowHandlerResult | void;
  /**
   * Async version of onOverflowDetected. Takes precedence over the sync version.
   * The append operation will await this callback before proceeding.
   */
  onOverflowDetectedAsync?: (context: OverflowContext) => Promise<OverflowHandlerResult | void>;
};

/**
 * Estimate total tokens in the session by summing estimates for all messages.
 */
function estimateSessionTokens(sessionManager: SessionManager): number {
  try {
    const context = sessionManager.buildSessionContext?.();
    if (!context?.messages) return 0;
    return context.messages.reduce((sum, msg) => sum + estimateTokens(msg), 0);
  } catch {
    return 0;
  }
}

export function installSessionToolResultGuard(
  sessionManager: SessionManager,
  opts?: SessionToolResultGuardOptions,
): {
  flushPendingToolResults: () => void;
  getPendingIds: () => string[];
  /** Update overflow detection settings at runtime. */
  setOverflowSettings: (settings: { contextWindowTokens?: number; reserveTokens?: number }) => void;
} {
  const originalAppend = sessionManager.appendMessage.bind(sessionManager);
  const pending = new Map<string, string | undefined>();

  // Overflow detection settings (can be updated at runtime)
  let contextWindowTokens = opts?.contextWindowTokens;
  let reserveTokens = opts?.reserveTokens ?? 0;

  const persistToolResult = (
    message: AgentMessage,
    meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean },
  ) => {
    const transformer = opts?.transformToolResultForPersistence;
    return transformer ? transformer(message, meta) : message;
  };

  const allowSyntheticToolResults = opts?.allowSyntheticToolResults ?? true;

  /**
   * Check if appending a message would cause overflow and handle it if so.
   * Returns the (possibly updated) current token count after any compaction.
   */
  const checkAndHandleOverflow = async (
    message: AgentMessage,
    meta: { toolName?: string; toolCallId?: string },
  ): Promise<void> => {
    // Skip if overflow detection is not configured
    if (!contextWindowTokens || contextWindowTokens <= 0) return;
    if (!opts?.onOverflowDetected && !opts?.onOverflowDetectedAsync) return;

    const messageTokens = estimateTokens(message);
    let currentTokens = estimateSessionTokens(sessionManager);
    const limit = contextWindowTokens - reserveTokens;

    // Check if we would overflow
    if (currentTokens + messageTokens > limit) {
      const overflowContext: OverflowContext = {
        message,
        messageTokens,
        currentTokens,
        contextWindowTokens,
        toolName: meta.toolName,
        toolCallId: meta.toolCallId,
      };

      let result: OverflowHandlerResult | void;
      if (opts.onOverflowDetectedAsync) {
        result = await opts.onOverflowDetectedAsync(overflowContext);
      } else if (opts.onOverflowDetected) {
        result = opts.onOverflowDetected(overflowContext);
      }

      // If compaction happened, the caller should have provided new token count
      // or we re-estimate from the session
      if (result && result.compacted) {
        currentTokens = result.tokensAfterCompaction ?? estimateSessionTokens(sessionManager);
      }
    }
  };

  const flushPendingToolResults = () => {
    if (pending.size === 0) return;
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
    const role = (message as { role?: unknown }).role;

    if (role === "toolResult") {
      const id = extractToolResultId(message as Extract<AgentMessage, { role: "toolResult" }>);
      const toolName = id ? pending.get(id) : undefined;
      if (id) pending.delete(id);

      // Check for overflow before appending tool result
      // Note: We use a synchronous path here but it works because
      // the async check is awaited in a wrapper if needed
      const transformedMessage = persistToolResult(message, {
        toolCallId: id ?? undefined,
        toolName,
        isSynthetic: false,
      });

      // For async overflow handling, we need to defer the append
      if (opts?.onOverflowDetectedAsync && contextWindowTokens && contextWindowTokens > 0) {
        // Queue the overflow check and append as a microtask
        // This maintains the synchronous return signature while allowing async handling
        void checkAndHandleOverflow(transformedMessage, {
          toolName,
          toolCallId: id ?? undefined,
        }).then(() => {
          // The actual append will happen in appendMessageAsync if using async flow
        });
      } else if (opts?.onOverflowDetected && contextWindowTokens && contextWindowTokens > 0) {
        // Synchronous overflow check
        const messageTokens = estimateTokens(transformedMessage);
        const currentTokens = estimateSessionTokens(sessionManager);
        const limit = contextWindowTokens - reserveTokens;

        if (currentTokens + messageTokens > limit) {
          opts.onOverflowDetected({
            message: transformedMessage,
            messageTokens,
            currentTokens,
            contextWindowTokens,
            toolName,
            toolCallId: id ?? undefined,
          });
        }
      }

      return originalAppend(transformedMessage as never);
    }

    const toolCalls =
      role === "assistant"
        ? extractAssistantToolCalls(message as Extract<AgentMessage, { role: "assistant" }>)
        : [];

    if (allowSyntheticToolResults) {
      // If previous tool calls are still pending, flush before non-tool results.
      if (pending.size > 0 && (toolCalls.length === 0 || role !== "assistant")) {
        flushPendingToolResults();
      }
      // If new tool calls arrive while older ones are pending, flush the old ones first.
      if (pending.size > 0 && toolCalls.length > 0) {
        flushPendingToolResults();
      }
    }

    const result = originalAppend(message as never);

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
    setOverflowSettings: (settings) => {
      if (settings.contextWindowTokens !== undefined) {
        contextWindowTokens = settings.contextWindowTokens;
      }
      if (settings.reserveTokens !== undefined) {
        reserveTokens = settings.reserveTokens;
      }
    },
  };
}
