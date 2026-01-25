import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";

import {
  installSessionToolResultGuard,
  type OverflowContext,
} from "./session-tool-result-guard.js";

const toolCallMessage = {
  role: "assistant",
  content: [{ type: "toolCall", id: "call_1", name: "read", arguments: {} }],
} satisfies AgentMessage;

const smallToolResult = {
  role: "toolResult",
  toolCallId: "call_1",
  content: [{ type: "text", text: "small result" }],
} satisfies AgentMessage;

// Create a large tool result that would cause overflow
function makeLargeToolResult(chars: number): AgentMessage {
  return {
    role: "toolResult",
    toolCallId: "call_1",
    content: [{ type: "text", text: "x".repeat(chars) }],
  } as AgentMessage;
}

describe("installSessionToolResultGuard overflow detection", () => {
  it("does not call overflow handler when context window is not set", () => {
    const sm = SessionManager.inMemory();
    const onOverflowDetected = vi.fn();

    installSessionToolResultGuard(sm, {
      onOverflowDetected,
      // contextWindowTokens not set
    });

    sm.appendMessage(toolCallMessage);
    sm.appendMessage(smallToolResult);

    expect(onOverflowDetected).not.toHaveBeenCalled();
  });

  it("does not call overflow handler when below threshold", () => {
    const sm = SessionManager.inMemory();
    const onOverflowDetected = vi.fn();

    installSessionToolResultGuard(sm, {
      contextWindowTokens: 100_000, // Large context window
      reserveTokens: 0,
      onOverflowDetected,
    });

    sm.appendMessage(toolCallMessage);
    sm.appendMessage(smallToolResult);

    expect(onOverflowDetected).not.toHaveBeenCalled();
  });

  it("calls overflow handler when appending would exceed context window", () => {
    const sm = SessionManager.inMemory();
    const onOverflowDetected = vi.fn();

    installSessionToolResultGuard(sm, {
      contextWindowTokens: 100, // Very small context window (100 tokens ~ 400 chars)
      reserveTokens: 0,
      onOverflowDetected,
    });

    sm.appendMessage(toolCallMessage);
    // Large tool result that would push us over the limit
    sm.appendMessage(makeLargeToolResult(2000)); // ~500 tokens

    expect(onOverflowDetected).toHaveBeenCalledTimes(1);
    expect(onOverflowDetected).toHaveBeenCalledWith(
      expect.objectContaining({
        contextWindowTokens: 100,
        toolCallId: "call_1",
        toolName: "read",
      }),
    );
  });

  it("provides accurate overflow context to handler", () => {
    const sm = SessionManager.inMemory();
    let capturedContext: OverflowContext | null = null;

    installSessionToolResultGuard(sm, {
      contextWindowTokens: 50,
      reserveTokens: 10,
      onOverflowDetected: (ctx) => {
        capturedContext = ctx;
      },
    });

    sm.appendMessage(toolCallMessage);
    sm.appendMessage(makeLargeToolResult(500));

    expect(capturedContext).not.toBeNull();
    expect(capturedContext!.contextWindowTokens).toBe(50);
    expect(capturedContext!.toolName).toBe("read");
    expect(capturedContext!.toolCallId).toBe("call_1");
    expect(capturedContext!.messageTokens).toBeGreaterThan(0);
    expect(capturedContext!.currentTokens).toBeGreaterThanOrEqual(0);
  });

  it("respects reserveTokens in overflow calculation", () => {
    const sm = SessionManager.inMemory();
    const onOverflowDetected = vi.fn();

    // With a 1000 token window and 800 reserve, effective limit is 200 tokens
    installSessionToolResultGuard(sm, {
      contextWindowTokens: 1000,
      reserveTokens: 800,
      onOverflowDetected,
    });

    sm.appendMessage(toolCallMessage);
    // 500 chars ~ 125 tokens, but with reserve we only have 200 tokens
    sm.appendMessage(makeLargeToolResult(1000)); // ~250 tokens, exceeds effective limit

    expect(onOverflowDetected).toHaveBeenCalled();
  });

  it("allows updating overflow settings at runtime", () => {
    const sm = SessionManager.inMemory();
    const onOverflowDetected = vi.fn();

    const guard = installSessionToolResultGuard(sm, {
      contextWindowTokens: 100_000, // Large - won't trigger
      reserveTokens: 0,
      onOverflowDetected,
    });

    sm.appendMessage(toolCallMessage);
    sm.appendMessage(smallToolResult);
    expect(onOverflowDetected).not.toHaveBeenCalled();

    // Update to small context window
    guard.setOverflowSettings({
      contextWindowTokens: 10, // Very small
    });

    sm.appendMessage({
      role: "assistant",
      content: [{ type: "toolCall", id: "call_2", name: "exec", arguments: {} }],
    } as AgentMessage);
    sm.appendMessage({
      role: "toolResult",
      toolCallId: "call_2",
      content: [{ type: "text", text: "x".repeat(500) }],
    } as AgentMessage);

    expect(onOverflowDetected).toHaveBeenCalled();
  });

  it("still appends message after overflow is detected", () => {
    const sm = SessionManager.inMemory();
    const onOverflowDetected = vi.fn();

    installSessionToolResultGuard(sm, {
      contextWindowTokens: 10,
      reserveTokens: 0,
      onOverflowDetected,
    });

    sm.appendMessage(toolCallMessage);
    sm.appendMessage(makeLargeToolResult(500));

    // Verify message was still appended
    const messages = sm
      .getEntries()
      .filter((e) => e.type === "message")
      .map((e) => (e as { message: AgentMessage }).message);

    expect(messages.length).toBe(2);
    expect(messages[1].role).toBe("toolResult");
  });
});
