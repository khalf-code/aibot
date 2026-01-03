import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AgentSideConnection } from "@agentclientprotocol/sdk";
import type { GatewayClient } from "../gateway/client.js";
import { AcpGwAgent } from "./translator.js";

// Mock AgentSideConnection
function createMockConnection(): AgentSideConnection {
  return {
    sessionUpdate: vi.fn().mockResolvedValue(undefined),
    requestPermission: vi.fn().mockResolvedValue({ outcome: { outcome: "selected", optionId: "allow" } }),
  } as unknown as AgentSideConnection;
}

// Mock GatewayClient
function createMockGateway(): GatewayClient {
  return {
    request: vi.fn().mockResolvedValue({}),
    start: vi.fn(),
  } as unknown as GatewayClient;
}

describe("AcpGwAgent", () => {
  let connection: AgentSideConnection;
  let gateway: GatewayClient;
  let agent: AcpGwAgent;

  beforeEach(() => {
    connection = createMockConnection();
    gateway = createMockGateway();
    agent = new AcpGwAgent(connection, gateway, { verbose: false });
  });

  describe("initialize", () => {
    it("returns protocol version and capabilities", async () => {
      const result = await agent.initialize({
        protocolVersion: 1,
        clientCapabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      });

      expect(result.protocolVersion).toBe(1);
      expect(result.agentCapabilities).toBeDefined();
      expect(result.agentInfo?.name).toBe("clawd-gw");
    });
  });

  describe("newSession", () => {
    it("creates session with unique ID", async () => {
      const result = await agent.newSession({
        cwd: "/test/workspace",
        mcpServers: [],
      });

      expect(result.sessionId).toBeDefined();
      expect(typeof result.sessionId).toBe("string");
      expect(result.sessionId.length).toBeGreaterThan(0);
    });

    it("creates unique sessions", async () => {
      const r1 = await agent.newSession({ cwd: "/path1", mcpServers: [] });
      const r2 = await agent.newSession({ cwd: "/path2", mcpServers: [] });

      expect(r1.sessionId).not.toBe(r2.sessionId);
    });
  });

  describe("authenticate", () => {
    it("returns empty object (no auth required)", async () => {
      const result = await agent.authenticate({
        authMethodId: "none",
        credentials: {},
      });

      expect(result).toEqual({});
    });
  });

  describe("loadSession", () => {
    it("throws not implemented error", async () => {
      await expect(
        agent.loadSession({ sessionId: "test" }),
      ).rejects.toThrow("Session loading not implemented");
    });
  });

  describe("handleGatewayDisconnect", () => {
    it("marks agent as disconnected", () => {
      agent.start();
      expect((agent as any).connected).toBe(true);

      agent.handleGatewayDisconnect("test disconnect");
      expect((agent as any).connected).toBe(false);
    });
  });

  describe("handleGatewayReconnect", () => {
    it("marks agent as connected", () => {
      agent.handleGatewayDisconnect("test");
      expect((agent as any).connected).toBe(false);

      agent.handleGatewayReconnect();
      expect((agent as any).connected).toBe(true);
    });
  });

  describe("updateGateway", () => {
    it("updates gateway reference", () => {
      const newGateway = createMockGateway();
      agent.updateGateway(newGateway);
      expect((agent as any).gateway).toBe(newGateway);
    });
  });
});
