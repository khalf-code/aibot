import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGatewayTool } from "./gateway-tool.js";

const callGatewayToolMock = vi.fn();
vi.mock("./gateway.js", () => ({
  callGatewayTool: (...args: unknown[]) => callGatewayToolMock(...args),
}));

describe("gateway tool config.schema", () => {
  beforeEach(() => {
    callGatewayToolMock.mockReset();
  });

  it("summarizes config.schema response to reduce size", async () => {
    // Mock a large schema response (simulating 400KB+ real response)
    const largeSchema = {
      version: "1.0.0",
      generatedAt: "2024-01-01T00:00:00Z",
      schema: {
        type: "object",
        properties: {
          agent: {
            type: "object",
            properties: {
              name: { type: "string" },
              model: { type: "string" },
              temperature: { type: "number" },
            },
          },
          channels: {
            type: "object",
            properties: {
              discord: { type: "object" },
              telegram: { type: "object" },
              slack: { type: "object" },
            },
          },
          gateway: {
            type: "object",
            properties: {
              port: { type: "number" },
              host: { type: "string" },
            },
          },
        },
      },
      uiHints: {
        "agent.name": { label: "Agent Name" },
        "agent.model": { label: "Model" },
        "channels.discord": { label: "Discord" },
      },
    };

    callGatewayToolMock.mockResolvedValueOnce(largeSchema);

    const tool = createGatewayTool();
    const result = await tool.execute("test-call-id", { action: "config.schema" });

    const content = result.content[0] as { type: "text"; text: string };
    const parsed = JSON.parse(content.text);

    // Verify summarized structure
    expect(parsed.ok).toBe(true);
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.generatedAt).toBe("2024-01-01T00:00:00Z");
    expect(parsed.sections).toEqual(["agent", "channels", "gateway"]);
    expect(parsed.sectionSummary).toEqual({
      agent: { type: "object", keys: ["name", "model", "temperature"] },
      channels: { type: "object", keys: ["discord", "telegram", "slack"] },
      gateway: { type: "object", keys: ["port", "host"] },
    });
    expect(parsed.uiHintCount).toBe(3);
    expect(parsed.note).toContain("Schema summarized");
  });

  it("returns reasonably sized response (under 25KB)", async () => {
    // Mock a realistic large schema with 50 sections x 20 keys
    const properties: Record<string, unknown> = {};
    for (let i = 0; i < 50; i++) {
      properties[`section${i}`] = {
        type: "object",
        properties: Object.fromEntries(
          Array.from({ length: 20 }, (_, j) => [`key${j}`, { type: "string" }]),
        ),
      };
    }

    const largeSchema = {
      version: "1.0.0",
      schema: { type: "object", properties },
      uiHints: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`hint${i}`, {}])),
    };

    callGatewayToolMock.mockResolvedValueOnce(largeSchema);

    const tool = createGatewayTool();
    const result = await tool.execute("test-call-id", { action: "config.schema" });

    const content = result.content[0] as { type: "text"; text: string };

    // Summarized response should be well under 25KB even with 50 sections x 20 keys
    // This is a 95%+ reduction from the ~400-600KB full schema
    expect(content.text.length).toBeLessThan(25_000);
  });
});

describe("gateway tool truncation", () => {
  beforeEach(() => {
    callGatewayToolMock.mockReset();
  });

  it("truncates config.get when response is large", async () => {
    // Mock a large config response
    const largeConfig = {
      hash: "abc123",
      raw: "x".repeat(50_000),
    };

    callGatewayToolMock.mockResolvedValueOnce(largeConfig);

    const tool = createGatewayTool();
    const result = await tool.execute("test-call-id", { action: "config.get" });

    const content = result.content[0] as { type: "text"; text: string };

    // Should be truncated to 30KB + truncation note
    expect(content.text.length).toBeLessThan(35_000);
    expect(content.text).toContain("[Result truncated:");
  });
});
