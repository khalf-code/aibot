import { describe, expect, it } from "vitest";
import {
  createActionGate,
  DEFAULT_TOOL_RESULT_MAX_CHARS,
  readNumberParam,
  readReactionParams,
  readStringOrNumberParam,
  truncatedJsonResult,
} from "./common.js";

type TestActions = {
  reactions?: boolean;
  messages?: boolean;
};

describe("createActionGate", () => {
  it("defaults to enabled when unset", () => {
    const gate = createActionGate<TestActions>(undefined);
    expect(gate("reactions")).toBe(true);
    expect(gate("messages", false)).toBe(false);
  });

  it("respects explicit false", () => {
    const gate = createActionGate<TestActions>({ reactions: false });
    expect(gate("reactions")).toBe(false);
    expect(gate("messages")).toBe(true);
  });
});

describe("readStringOrNumberParam", () => {
  it("returns numeric strings for numbers", () => {
    const params = { chatId: 123 };
    expect(readStringOrNumberParam(params, "chatId")).toBe("123");
  });

  it("trims strings", () => {
    const params = { chatId: "  abc  " };
    expect(readStringOrNumberParam(params, "chatId")).toBe("abc");
  });

  it("throws when required and missing", () => {
    expect(() => readStringOrNumberParam({}, "chatId", { required: true })).toThrow(
      /chatId required/,
    );
  });
});

describe("readNumberParam", () => {
  it("parses numeric strings", () => {
    const params = { messageId: "42" };
    expect(readNumberParam(params, "messageId")).toBe(42);
  });

  it("truncates when integer is true", () => {
    const params = { messageId: "42.9" };
    expect(readNumberParam(params, "messageId", { integer: true })).toBe(42);
  });

  it("throws when required and missing", () => {
    expect(() => readNumberParam({}, "messageId", { required: true })).toThrow(
      /messageId required/,
    );
  });
});

describe("readReactionParams", () => {
  it("allows empty emoji for removal semantics", () => {
    const params = { emoji: "" };
    const result = readReactionParams(params, {
      removeErrorMessage: "Emoji is required",
    });
    expect(result.isEmpty).toBe(true);
    expect(result.remove).toBe(false);
  });

  it("throws when remove true but emoji empty", () => {
    const params = { emoji: "", remove: true };
    expect(() =>
      readReactionParams(params, {
        removeErrorMessage: "Emoji is required",
      }),
    ).toThrow(/Emoji is required/);
  });

  it("passes through remove flag", () => {
    const params = { emoji: "✅", remove: true };
    const result = readReactionParams(params, {
      removeErrorMessage: "Emoji is required",
    });
    expect(result.remove).toBe(true);
    expect(result.emoji).toBe("✅");
  });
});

describe("truncatedJsonResult", () => {
  it("returns full result when under default limit", () => {
    const payload = { ok: true, message: "hello" };
    const result = truncatedJsonResult(payload);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({
      type: "text",
      text: JSON.stringify(payload, null, 2),
    });
    expect(result.details).toEqual(payload);
  });

  it("returns full result when under custom limit", () => {
    const payload = { ok: true };
    const result = truncatedJsonResult(payload, { maxChars: 100 });
    expect(result.content[0]).toEqual({
      type: "text",
      text: JSON.stringify(payload, null, 2),
    });
  });

  it("truncates and adds note when over limit", () => {
    const largePayload = { data: "x".repeat(1000) };
    const result = truncatedJsonResult(largePayload, { maxChars: 100 });
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text.length).toBeLessThanOrEqual(200); // 100 + note
    expect(text).toContain("[Result truncated:");
    expect(result.details).toEqual({
      _truncated: true,
      _originalLength: expect.any(Number),
      _maxChars: 100,
    });
  });

  it("uses custom truncation note", () => {
    const largePayload = { data: "x".repeat(1000) };
    const result = truncatedJsonResult(largePayload, {
      maxChars: 100,
      truncationNote: "[CUSTOM NOTE]",
    });
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("[CUSTOM NOTE]");
  });

  it("uses default max chars constant", () => {
    expect(DEFAULT_TOOL_RESULT_MAX_CHARS).toBe(50_000);
  });
});
