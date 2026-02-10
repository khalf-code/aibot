/**
 * CLAWD PATCH: Stub for stripThinkingFromAssistantToolCallMessages.
 *
 * Some OpenAI-compatible APIs reject assistant messages that include both
 * `content` (with thinking blocks) and `tool_calls`. This utility strips
 * thinking blocks from assistant messages that also contain tool calls,
 * preventing template errors in pi-ai.
 *
 * See: https://github.com/openclaw/openclaw/issues/5769
 */

import type { Context, Message } from "@mariozechner/pi-ai";

/**
 * Strips thinking blocks from assistant messages that also include tool calls.
 * Returns a shallow copy of context with sanitized messages.
 */
export function stripThinkingFromAssistantToolCallMessages(context: Context): Context {
  if (!context.messages) return context;

  const messages = context.messages.map((msg: Message) => {
    if (msg.role !== "assistant") return msg;
    if (!Array.isArray(msg.content)) return msg;

    const hasToolCall = msg.content.some(
      (block) => (block as { type: string }).type === "toolCall" || (block as { type: string }).type === "tool_use",
    );
    if (!hasToolCall) return msg;

    const hasThinking = msg.content.some((block) => (block as { type: string }).type === "thinking");
    if (!hasThinking) return msg;

    // Remove thinking blocks, keep everything else
    const filtered = msg.content.filter((block) => (block as { type: string }).type !== "thinking");
    return { ...msg, content: filtered };
  });

  return { ...context, messages };
}
