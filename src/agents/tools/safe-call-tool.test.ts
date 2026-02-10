import { describe, expect, it } from "vitest";
import type { AnyAgentTool } from "./common.js";
import { createSafeCallTool } from "./safe-call-tool.js";

function createStubTool(payload: unknown): AnyAgentTool {
  return {
    label: "Stub",
    name: "stub",
    description: "stub tool",
    parameters: {},
    execute: async () => ({
      content: [{ type: "text", text: JSON.stringify(payload) }],
      details: payload,
    }),
  };
}

function hasDanglingSurrogate(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const current = text.charCodeAt(index);
    if (current >= 0xd800 && current <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return true;
      }
      index += 1;
      continue;
    }
    if (current >= 0xdc00 && current <= 0xdfff) {
      return true;
    }
  }
  return false;
}

describe("safe_call tool", () => {
  it("applies fields and array pagination", async () => {
    const stub = createStubTool([
      { id: 1, name: "one" },
      { id: 2, name: "two" },
      { id: 3, name: "three" },
    ]);
    const tool = createSafeCallTool({
      resolveTool: (name) => (name === "stub" ? stub : undefined),
    });

    const result = await tool.execute("call-1", {
      tool: "stub",
      params: {},
      fields: [" id ", "id", ""],
      offset: 1,
      limit: 1,
    });

    const details = result.details as {
      totalItems: number;
      hasMore: boolean;
      nextOffset?: number;
      output: string;
      fields: string[];
    };

    expect(details.totalItems).toBe(3);
    expect(details.hasMore).toBe(true);
    expect(details.nextOffset).toBe(2);
    expect(details.fields).toEqual(["id"]);
    expect(details.output).toContain('"id": 2');
    expect(details.output).not.toContain('"name"');
  });

  it("paginates non-array payloads by line", async () => {
    const stub = createStubTool({ a: 1, b: 2, c: 3 });
    const tool = createSafeCallTool({
      resolveTool: (name) => (name === "stub" ? stub : undefined),
    });

    const result = await tool.execute("call-2", {
      tool: "stub",
      params: {},
      offset: 1,
      limit: 2,
    });

    const details = result.details as {
      mode: string;
      totalItems: number;
      hasMore: boolean;
      nextOffset?: number;
      output: string;
    };

    expect(details.mode).toBe("lines");
    expect(details.totalItems).toBeGreaterThan(2);
    expect(details.hasMore).toBe(true);
    expect(details.nextOffset).toBe(3);
    expect(details.output).toContain('"a": 1');
    expect(details.output).toContain('"b": 2');
    expect(details.output).not.toContain('"c": 3');
  });

  it("truncates oversized output with head and tail", async () => {
    const stub = createStubTool(`HEAD-${"x".repeat(120)}-TAIL`);
    const tool = createSafeCallTool({
      resolveTool: (name) => (name === "stub" ? stub : undefined),
    });

    const result = await tool.execute("call-3", {
      tool: "stub",
      params: {},
      maxChars: 80,
    });

    const details = result.details as {
      truncated: boolean;
      output: string;
    };

    expect(details.truncated).toBe(true);
    expect(details.output).toContain("HEAD-");
    expect(details.output).toContain("-TAIL");
    expect(details.output).toContain("用 offset 翻页查看更多");
    expect(details.output.length).toBeLessThanOrEqual(80);
  });

  it("rejects unknown tools and self wrapping", async () => {
    const stub = createStubTool({ ok: true });
    const tool = createSafeCallTool({
      resolveTool: (name) => (name === "stub" ? stub : undefined),
    });

    await expect(tool.execute("call-4", { tool: "missing", params: {} })).rejects.toThrow(
      "Unknown tool: missing",
    );
    await expect(tool.execute("call-5", { tool: "safe_call", params: {} })).rejects.toThrow(
      "safe_call cannot wrap itself",
    );
  });

  it("rejects prototype pollution field paths", async () => {
    const stub = createStubTool([{ id: 1 }]);
    const tool = createSafeCallTool({
      resolveTool: (name) => (name === "stub" ? stub : undefined),
    });

    await expect(
      tool.execute("call-6", {
        tool: "stub",
        params: {},
        fields: ["__proto__.polluted"],
      }),
    ).rejects.toThrow("Unsafe field path segment: __proto__");

    await expect(
      tool.execute("call-7", {
        tool: "stub",
        params: {},
        fields: ["constructor.prototype.polluted"],
      }),
    ).rejects.toThrow("Unsafe field path segment: constructor");

    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it("paginates arrays before applying field projection", async () => {
    let projectedReads = 0;
    const payload = Array.from({ length: 1000 }, (_, index) => {
      const entry: Record<string, unknown> = {};
      Object.defineProperty(entry, "id", {
        enumerable: true,
        get: () => {
          projectedReads += 1;
          return index;
        },
      });
      Object.defineProperty(entry, "name", {
        enumerable: true,
        value: `item-${index}`,
      });
      return entry;
    });

    const stub: AnyAgentTool = {
      label: "Stub",
      name: "stub",
      description: "stub tool",
      parameters: {},
      execute: async () => ({
        content: [{ type: "text", text: "large array" }],
        details: payload,
      }),
    };
    const tool = createSafeCallTool({
      resolveTool: (name) => (name === "stub" ? stub : undefined),
    });

    const result = await tool.execute("call-8", {
      tool: "stub",
      params: {},
      fields: ["id"],
      offset: 10,
      limit: 2,
    });

    const details = result.details as {
      totalItems: number;
      output: string;
    };

    expect(details.totalItems).toBe(1000);
    expect(projectedReads).toBe(2);
    expect(details.output).toContain('"id": 10');
    expect(details.output).toContain('"id": 11');
  });

  it("falls back to content when details is null", async () => {
    const stub: AnyAgentTool = {
      label: "Stub",
      name: "stub",
      description: "stub tool",
      parameters: {},
      execute: async () => ({
        content: [{ type: "text", text: "line-1\nline-2" }],
        details: null,
      }),
    };

    const tool = createSafeCallTool({
      resolveTool: (name) => (name === "stub" ? stub : undefined),
    });

    const result = await tool.execute("call-9", {
      tool: "stub",
      params: {},
      offset: 0,
      limit: 1,
    });

    const details = result.details as {
      totalItems: number;
      output: string;
    };

    expect(details.totalItems).toBe(2);
    expect(details.output).toContain("line-1");
    expect(details.output).not.toContain("null");
  });

  it("handles very small maxChars", async () => {
    const stub = createStubTool("abcdef");
    const tool = createSafeCallTool({
      resolveTool: (name) => (name === "stub" ? stub : undefined),
    });

    const result = await tool.execute("call-10", {
      tool: "stub",
      params: {},
      maxChars: 1,
    });

    const details = result.details as {
      truncated: boolean;
      output: string;
    };

    expect(details.truncated).toBe(true);
    expect(details.output.length).toBeLessThanOrEqual(1);
  });

  it("does not emit dangling surrogates after truncation", async () => {
    const stub = createStubTool(`START-${"😀".repeat(80)}-END`);
    const tool = createSafeCallTool({
      resolveTool: (name) => (name === "stub" ? stub : undefined),
    });

    const result = await tool.execute("call-11", {
      tool: "stub",
      params: {},
      maxChars: 60,
    });

    const details = result.details as {
      truncated: boolean;
      output: string;
    };

    expect(details.truncated).toBe(true);
    expect(hasDanglingSurrogate(details.output)).toBe(false);
  });
});
