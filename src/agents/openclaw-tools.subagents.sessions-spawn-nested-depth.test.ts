import { beforeEach, describe, expect, it, vi } from "vitest";

const callGatewayMock = vi.fn();
vi.mock("../gateway/call.js", () => ({
  callGateway: (opts: unknown) => callGatewayMock(opts),
}));

let configOverride: ReturnType<(typeof import("../config/config.js"))["loadConfig"]> = {
  session: {
    mainKey: "main",
    scope: "per-sender",
  },
};

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => configOverride,
    resolveGatewayPort: () => 18789,
  };
});

import "./test-helpers/fast-core-tools.js";
import { addSubagentRunForTests, resetSubagentRegistryForTests } from "./subagent-registry.js";
import { createSessionsSpawnTool } from "./tools/sessions-spawn-tool.js";

describe("sessions_spawn nested depth", () => {
  beforeEach(() => {
    resetSubagentRegistryForTests();
    callGatewayMock.mockReset();
    configOverride = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
    };
  });

  it("blocks nested spawn when maxSpawnDepth is 0 (default)", async () => {
    // Subagent trying to spawn without maxSpawnDepth configured
    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:subagent:test-123",
      spawnDepth: 1,
    });

    const result = await tool.execute("call1", { task: "nested task" });

    expect(result.details).toMatchObject({
      status: "forbidden",
    });
    expect((result.details as { error?: string }).error).toContain("maxSpawnDepth = 0");
  });

  it("blocks nested spawn when at depth limit", async () => {
    configOverride = {
      session: { mainKey: "main", scope: "per-sender" },
      tools: {
        subagents: {
          maxSpawnDepth: 1, // Allow only one level
        },
      },
    };

    // Subagent at depth 1 trying to spawn (would create depth 2, but limit is 1)
    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:subagent:test-123",
      spawnDepth: 1,
    });

    const result = await tool.execute("call2", { task: "nested task" });

    expect(result.details).toMatchObject({
      status: "forbidden",
    });
    expect((result.details as { error?: string }).error).toContain("depth limit");
  });

  it("allows nested spawn when within depth limit", async () => {
    configOverride = {
      session: { mainKey: "main", scope: "per-sender" },
      tools: {
        subagents: {
          maxSpawnDepth: 2, // Allow two levels
        },
      },
    };

    callGatewayMock.mockImplementation(async (opts: unknown) => {
      const request = opts as { method?: string };
      if (request.method === "agent") {
        return { runId: "run-nested-1", status: "accepted", acceptedAt: 5000 };
      }
      if (request.method === "agent.wait") {
        return { status: "timeout" };
      }
      return {};
    });

    // Subagent at depth 1 trying to spawn (would create depth 2, limit is 2)
    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:subagent:test-123",
      spawnDepth: 1,
    });

    const result = await tool.execute("call3", { task: "nested task" });

    expect(result.details).toMatchObject({
      status: "accepted",
      runId: "run-nested-1",
    });
  });

  it("tracks spawn depth in registry", async () => {
    configOverride = {
      session: { mainKey: "main", scope: "per-sender" },
      tools: {
        subagents: {
          maxSpawnDepth: 3,
        },
      },
    };

    let capturedSessionKey: string | undefined;
    callGatewayMock.mockImplementation(async (opts: unknown) => {
      const request = opts as { method?: string; params?: { sessionKey?: string } };
      if (request.method === "agent") {
        capturedSessionKey = request.params?.sessionKey;
        return { runId: "run-depth-test", status: "accepted", acceptedAt: 5000 };
      }
      if (request.method === "agent.wait") {
        return { status: "timeout" };
      }
      return {};
    });

    // Main session spawning (depth 0 -> child at depth 1)
    const tool = createSessionsSpawnTool({
      agentSessionKey: "agent:main:main",
      spawnDepth: 0,
    });

    await tool.execute("call4", { task: "first level task" });

    // Verify child was registered with depth 1
    const { getSpawnDepthForSession } = await import("./subagent-registry.js");
    const childDepth = getSpawnDepthForSession(capturedSessionKey);
    expect(childDepth).toBe(1);
  });
});
