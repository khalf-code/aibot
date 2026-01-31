/**
 * Unit tests for MCP client
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MCPClient } from "../../src/mcp/client.js";
import type { MCPServerConfig } from "../../src/config/types.mcp.js";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("MCPClient", () => {
  let config: MCPServerConfig;

  const originalFetch = global.fetch;

  beforeEach(() => {
    config = {
      type: "http",
      url: "http://localhost:8765/mcp",
      timeoutMs: 5000,
    };
    vi.clearAllMocks();
    // Reset fetch to a failing default so tests must set their own mock
    global.fetch = vi.fn().mockRejectedValue(new Error("no mock set"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("should create client with HTTP config", () => {
      const client = new MCPClient(config, mockLogger);
      expect(client).toBeDefined();
      expect(client.isConnected()).toBe(false);
    });

    it("should throw error for stdio config", () => {
      const stdioConfig: MCPServerConfig = {
        type: "stdio",
        command: "mcp-server",
      };
      expect(() => new MCPClient(stdioConfig, mockLogger)).toThrow(
        "Only HTTP MCP servers supported",
      );
    });

    it("should throw error if url missing for HTTP", () => {
      const invalidConfig: MCPServerConfig = {
        type: "http",
      };
      expect(() => new MCPClient(invalidConfig, mockLogger)).toThrow(
        "HTTP MCP server requires url",
      );
    });
  });

  describe("connect", () => {
    it("should connect successfully when server responds", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: { tools: [] },
        }),
      });

      const client = new MCPClient(config, mockLogger);
      await client.connect();

      expect(client.isConnected()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("connected"));
    });

    it("should handle connection failure gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const client = new MCPClient(config, mockLogger);
      await client.connect();

      expect(client.isConnected()).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("unreachable"));
    });

    it("should not throw on connection failure", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const client = new MCPClient(config, mockLogger);
      await expect(client.connect()).resolves.not.toThrow();
    });
  });

  describe("listTools", () => {
    it("should return empty array when not connected", async () => {
      const client = new MCPClient(config, mockLogger);
      const tools = await client.listTools();

      expect(tools).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("not connected"));
    });

    it("should fetch tools from server", async () => {
      const mockTools = [
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: {
            type: "object" as const,
            properties: {
              param: { type: "string" },
            },
            required: ["param"],
          },
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: { tools: mockTools },
        }),
      });

      const client = new MCPClient(config, mockLogger);
      await client.connect();
      const tools = await client.listTools();

      expect(tools).toEqual(mockTools);
    });

    it("should handle server errors", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            id: 2,
            error: { code: -1, message: "Internal error" },
          }),
        });

      const client = new MCPClient(config, mockLogger);
      await client.connect();
      const tools = await client.listTools();

      expect(tools).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("reconnection failed"));
    });
  });

  describe("callTool", () => {
    it("should return error when not connected", async () => {
      const client = new MCPClient(config, mockLogger);
      const result = await client.callTool("test", { arg: "value" });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain("unreachable");
    });

    it("should call tool successfully", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            id: 2,
            result: {
              content: [{ type: "text", text: "Success!" }],
            },
          }),
        });

      const client = new MCPClient(config, mockLogger);
      await client.connect();
      const result = await client.callTool("test_tool", { param: "value" });

      expect(result.content?.[0]?.text).toBe("Success!");
      expect(result.isError).toBeUndefined();
    });

    it("should handle tool call errors", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            id: 2,
            error: { code: -1, message: "Tool execution failed" },
          }),
        });

      const client = new MCPClient(config, mockLogger);
      await client.connect();
      const result = await client.callTool("test_tool", { param: "value" });

      expect(result.isError).toBe(true);
      expect(result.content?.[0]?.text).toContain("Tool execution failed");
    });
  });

  describe("registerAgent", () => {
    it("should register agent with mutex protection", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jsonrpc: "2.0", id: 2, result: {} }),
        });

      const client = new MCPClient(config, mockLogger);
      await client.connect();

      // Concurrent registrations
      await Promise.all([
        client.registerAgent("agent1", "/workspace"),
        client.registerAgent("agent1", "/workspace"),
      ]);

      // Should only call register once (ping + register)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should warn when not connected", async () => {
      const client = new MCPClient(config, mockLogger);
      await client.registerAgent("agent1", "/workspace");

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Cannot register"));
    });
  });

  describe("session cache", () => {
    it("should cache tools per session", async () => {
      const mockTools = [
        {
          name: "tool1",
          description: "Tool 1",
          inputSchema: { type: "object" as const, properties: {} },
        },
      ];

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jsonrpc: "2.0", id: 1, result: { tools: [] } }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            id: 2,
            result: { tools: mockTools },
          }),
        });

      const client = new MCPClient(config, mockLogger);
      await client.connect();

      const tools1 = await client.getToolsForSession("session1");
      const tools2 = await client.getToolsForSession("session1");

      expect(tools1).toEqual(tools2);
      // Should only fetch once (ping + list)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should clear session cache", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: { tools: [] },
        }),
      });

      const client = new MCPClient(config, mockLogger);
      await client.connect();
      await client.getToolsForSession("session1");

      client.clearSessionCache("session1");
      await client.getToolsForSession("session1");

      // Should fetch twice (ping + list + list)
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("timeout handling", () => {
    it("should timeout on slow requests", async () => {
      global.fetch = vi.fn().mockImplementation(
        (_url: string, options?: { signal?: AbortSignal }) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ jsonrpc: "2.0", id: 1, result: {} }),
              });
            }, 10000);
            // Respect abort signal
            options?.signal?.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(new DOMException("The operation was aborted", "AbortError"));
            });
          }),
      );

      const client = new MCPClient({ ...config, timeoutMs: 100 }, mockLogger);
      await client.connect();

      expect(client.isConnected()).toBe(false);
    });
  });
});
