import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
  MAX_TOOL_RESULT_CONTENT_CHARS,
  truncateToolResultContent,
  installSessionToolResultGuard,
} from "./session-tool-result-guard.js";

type AppendMessage = Parameters<SessionManager["appendMessage"]>[0];
const asAppendMessage = (message: unknown) => message as AppendMessage;

// ---------------------------------------------------------------------------
// Unit tests for truncateToolResultContent
// ---------------------------------------------------------------------------

describe("truncateToolResultContent", () => {
  const limit = 100; // small limit for easy testing

  it("returns the message unchanged when content is below the limit", () => {
    const msg = {
      role: "toolResult",
      toolCallId: "c1",
      content: [{ type: "text", text: "short" }],
    } as unknown as AgentMessage;

    expect(truncateToolResultContent(msg, limit)).toBe(msg); // same reference
  });

  it("truncates a single oversized text block with a note", () => {
    const original = "x".repeat(200);
    const msg = {
      role: "toolResult",
      toolCallId: "c1",
      content: [{ type: "text", text: original }],
    } as unknown as AgentMessage;

    const result = truncateToolResultContent(msg, limit) as {
      content: Array<{ text: string }>;
    };
    expect(result).not.toBe(msg);
    // The preserved text starts with the first `limit` characters
    expect(result.content[0].text.startsWith("x".repeat(limit))).toBe(true);
    // The truncation note is appended (output is larger than `limit` because
    // it includes the human-readable note, but the *preserved payload*
    // is capped at `limit` characters of original content).
    expect(result.content[0].text).toContain("Truncated");
    expect(result.content[0].text).toContain("200"); // original length mentioned
    // Verify only `limit` chars of original content kept (no extra x's)
    const xCount = (result.content[0].text.match(/x/g) ?? []).length;
    expect(xCount).toBe(limit);
  });

  it("distributes the budget across multiple text blocks", () => {
    const msg = {
      role: "toolResult",
      toolCallId: "c1",
      content: [
        { type: "text", text: "a".repeat(80) }, // 80 chars – fits within 100
        { type: "text", text: "b".repeat(80) }, // 80 chars – only 20 remaining budget
      ],
    } as unknown as AgentMessage;

    const result = truncateToolResultContent(msg, limit) as {
      content: Array<{ type: string; text: string }>;
    };
    // First block preserved in full (80 <= 100)
    expect(result.content[0].text).toBe("a".repeat(80));
    // Second block truncated (budget remaining = 20)
    expect(result.content[1].text).toContain("b".repeat(20));
    expect(result.content[1].text).toContain("Truncated");
  });

  it("replaces a text block entirely when zero budget remains", () => {
    const msg = {
      role: "toolResult",
      toolCallId: "c1",
      content: [
        { type: "text", text: "a".repeat(100) }, // exhausts the budget
        { type: "text", text: "b".repeat(50) }, // zero budget left
      ],
    } as unknown as AgentMessage;

    const result = truncateToolResultContent(msg, limit) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[1].text).toContain("Content omitted");
  });

  it("preserves non-text blocks (e.g. images) untouched", () => {
    const imageBlock = { type: "image", source: "data:png;base64,..." };
    const msg = {
      role: "toolResult",
      toolCallId: "c1",
      content: [imageBlock, { type: "text", text: "a".repeat(200) }],
    } as unknown as AgentMessage;

    const result = truncateToolResultContent(msg, limit) as {
      content: Array<Record<string, unknown>>;
    };
    expect(result.content[0]).toBe(imageBlock); // same reference
  });

  it("handles plain-string content", () => {
    const msg = {
      role: "toolResult",
      toolCallId: "c1",
      content: "x".repeat(200),
    } as unknown as AgentMessage;

    const result = truncateToolResultContent(msg, limit) as { content: string };
    expect(typeof result.content).toBe("string");
    expect(result.content).toContain("Truncated");
    expect(result.content.startsWith("x".repeat(limit))).toBe(true);
  });

  it("returns plain-string content unchanged when within limit", () => {
    const msg = {
      role: "toolResult",
      toolCallId: "c1",
      content: "short",
    } as unknown as AgentMessage;

    expect(truncateToolResultContent(msg, limit)).toBe(msg);
  });

  it("ignores non-toolResult messages entirely", () => {
    const msg = {
      role: "assistant",
      content: [{ type: "text", text: "x".repeat(200) }],
    } as unknown as AgentMessage;

    expect(truncateToolResultContent(msg, limit)).toBe(msg);
  });

  it("handles missing / null content gracefully", () => {
    const msg = {
      role: "toolResult",
      toolCallId: "c1",
    } as unknown as AgentMessage;

    expect(truncateToolResultContent(msg, limit)).toBe(msg);
  });

  it("handles empty content array", () => {
    const msg = {
      role: "toolResult",
      toolCallId: "c1",
      content: [],
    } as unknown as AgentMessage;

    expect(truncateToolResultContent(msg, limit)).toBe(msg);
  });

  it("does not truncate at exactly the limit", () => {
    const msg = {
      role: "toolResult",
      toolCallId: "c1",
      content: [{ type: "text", text: "x".repeat(100) }],
    } as unknown as AgentMessage;

    expect(truncateToolResultContent(msg, limit)).toBe(msg);
  });

  it("uses the default MAX_TOOL_RESULT_CONTENT_CHARS constant", () => {
    // Verify the constant is a sensible value
    expect(MAX_TOOL_RESULT_CONTENT_CHARS).toBe(32_000);
  });
});

// ---------------------------------------------------------------------------
// Integration: truncation applied through the guard
// ---------------------------------------------------------------------------

describe("installSessionToolResultGuard truncation integration", () => {
  it("truncates oversized tool results in the persisted session", () => {
    const sm = SessionManager.inMemory();
    installSessionToolResultGuard(sm, {
      maxToolResultContentChars: 100,
    });

    sm.appendMessage(
      asAppendMessage({
        role: "assistant",
        content: [{ type: "toolCall", id: "call_1", name: "gateway", arguments: {} }],
      }),
    );

    sm.appendMessage(
      asAppendMessage({
        role: "toolResult",
        toolCallId: "call_1",
        content: [{ type: "text", text: "x".repeat(500) }],
        isError: false,
      }),
    );

    const entries = sm
      .getEntries()
      .filter((e) => e.type === "message")
      .map((e) => (e as { message: AgentMessage }).message);

    const toolResult = entries.find((m) => m.role === "toolResult") as {
      content?: Array<{ text: string }>;
    };
    expect(toolResult).toBeDefined();
    expect(toolResult.content?.[0]?.text.length).toBeLessThan(500);
    expect(toolResult.content?.[0]?.text).toContain("Truncated");
  });

  it("does not truncate small tool results", () => {
    const sm = SessionManager.inMemory();
    installSessionToolResultGuard(sm, {
      maxToolResultContentChars: 100,
    });

    sm.appendMessage(
      asAppendMessage({
        role: "assistant",
        content: [{ type: "toolCall", id: "call_1", name: "read", arguments: {} }],
      }),
    );

    const originalText = "small output";
    sm.appendMessage(
      asAppendMessage({
        role: "toolResult",
        toolCallId: "call_1",
        content: [{ type: "text", text: originalText }],
        isError: false,
      }),
    );

    const entries = sm
      .getEntries()
      .filter((e) => e.type === "message")
      .map((e) => (e as { message: AgentMessage }).message);

    const toolResult = entries.find((m) => m.role === "toolResult") as {
      content?: Array<{ text: string }>;
    };
    expect(toolResult.content?.[0]?.text).toBe(originalText);
  });

  it("applies truncation after the transformToolResultForPersistence hook", () => {
    const sm = SessionManager.inMemory();
    // The hook doubles the content, then truncation caps it.
    installSessionToolResultGuard(sm, {
      maxToolResultContentChars: 100,
      transformToolResultForPersistence: (msg) => {
        const content = (msg as { content?: unknown }).content;
        if (Array.isArray(content)) {
          const doubled = content.map((block: { type?: string; text?: string }) => {
            if (block.type === "text" && typeof block.text === "string") {
              return { ...block, text: block.text + block.text };
            }
            return block;
          });
          return { ...msg, content: doubled } as AgentMessage;
        }
        return msg;
      },
    });

    sm.appendMessage(
      asAppendMessage({
        role: "assistant",
        content: [{ type: "toolCall", id: "call_1", name: "gateway", arguments: {} }],
      }),
    );

    sm.appendMessage(
      asAppendMessage({
        role: "toolResult",
        toolCallId: "call_1",
        content: [{ type: "text", text: "y".repeat(80) }],
        isError: false,
      }),
    );

    const entries = sm
      .getEntries()
      .filter((e) => e.type === "message")
      .map((e) => (e as { message: AgentMessage }).message);

    const toolResult = entries.find((m) => m.role === "toolResult") as {
      content?: Array<{ text: string }>;
    };
    // Hook doubled 80 chars → 160 chars > 100 char limit → truncated
    expect(toolResult.content?.[0]?.text).toContain("Truncated");
    expect(toolResult.content?.[0]?.text).toContain("160"); // original length note
  });

  it("uses default MAX_TOOL_RESULT_CONTENT_CHARS when option not specified", () => {
    const sm = SessionManager.inMemory();
    installSessionToolResultGuard(sm);

    sm.appendMessage(
      asAppendMessage({
        role: "assistant",
        content: [{ type: "toolCall", id: "call_1", name: "read", arguments: {} }],
      }),
    );

    // Content smaller than 32K default — should not be truncated
    const text = "z".repeat(1000);
    sm.appendMessage(
      asAppendMessage({
        role: "toolResult",
        toolCallId: "call_1",
        content: [{ type: "text", text }],
        isError: false,
      }),
    );

    const entries = sm
      .getEntries()
      .filter((e) => e.type === "message")
      .map((e) => (e as { message: AgentMessage }).message);

    const toolResult = entries.find((m) => m.role === "toolResult") as {
      content?: Array<{ text: string }>;
    };
    expect(toolResult.content?.[0]?.text).toBe(text);
  });
});
