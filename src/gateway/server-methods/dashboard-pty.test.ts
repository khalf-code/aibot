import { describe, expect, it, vi, beforeEach } from "vitest";
import type { GatewayRequestHandlerOptions } from "./types.js";
import { cleanupPtyForConnection, dashboardPtyHandlers } from "./dashboard-pty.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const noop = () => false;

function makeOpts(
  method: string,
  params: Record<string, unknown> = {},
  overrides: Partial<GatewayRequestHandlerOptions> = {},
): GatewayRequestHandlerOptions {
  return {
    req: { id: "req-1", type: "req", method },
    params,
    respond: vi.fn(),
    context: {
      broadcast: vi.fn(),
      broadcastToConnIds: vi.fn(),
    } as unknown as GatewayRequestHandlerOptions["context"],
    client: {
      connect: { client: { id: "test" } },
      connId: "conn-1",
    } as unknown as GatewayRequestHandlerOptions["client"],
    isWebchatConnect: noop,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// dashboard.pty.spawn
// ---------------------------------------------------------------------------

describe("dashboard.pty.spawn", () => {
  it("rejects when client has no connId", async () => {
    const opts = makeOpts(
      "dashboard.pty.spawn",
      {},
      {
        client: {
          connect: { client: { id: "test" } },
        } as unknown as GatewayRequestHandlerOptions["client"],
      },
    );
    await dashboardPtyHandlers["dashboard.pty.spawn"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "not connected" }),
    );
  });

  // Note: Spawning a real PTY requires @lydell/node-pty to be installed.
  // These tests cover the validation paths. Integration tests would need the binary.
});

// ---------------------------------------------------------------------------
// dashboard.pty.write
// ---------------------------------------------------------------------------

describe("dashboard.pty.write", () => {
  it("rejects missing sessionId", () => {
    const opts = makeOpts("dashboard.pty.write", { data: "hello" });
    dashboardPtyHandlers["dashboard.pty.write"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "sessionId and data are required" }),
    );
  });

  it("rejects missing data", () => {
    const opts = makeOpts("dashboard.pty.write", { sessionId: "s-1" });
    dashboardPtyHandlers["dashboard.pty.write"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "sessionId and data are required" }),
    );
  });

  it("rejects unknown session", () => {
    const opts = makeOpts("dashboard.pty.write", {
      sessionId: "nonexistent",
      data: "hello",
    });
    dashboardPtyHandlers["dashboard.pty.write"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "unknown session" }),
    );
  });
});

// ---------------------------------------------------------------------------
// dashboard.pty.resize
// ---------------------------------------------------------------------------

describe("dashboard.pty.resize", () => {
  it("rejects missing sessionId", () => {
    const opts = makeOpts("dashboard.pty.resize", { cols: 80, rows: 24 });
    dashboardPtyHandlers["dashboard.pty.resize"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "sessionId, cols, and rows are required" }),
    );
  });

  it("rejects missing dimensions", () => {
    const opts = makeOpts("dashboard.pty.resize", { sessionId: "s-1" });
    dashboardPtyHandlers["dashboard.pty.resize"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "sessionId, cols, and rows are required" }),
    );
  });

  it("rejects unknown session", () => {
    const opts = makeOpts("dashboard.pty.resize", {
      sessionId: "nonexistent",
      cols: 80,
      rows: 24,
    });
    dashboardPtyHandlers["dashboard.pty.resize"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "unknown session" }),
    );
  });
});

// ---------------------------------------------------------------------------
// dashboard.pty.destroy
// ---------------------------------------------------------------------------

describe("dashboard.pty.destroy", () => {
  it("rejects missing sessionId", () => {
    const opts = makeOpts("dashboard.pty.destroy", {});
    dashboardPtyHandlers["dashboard.pty.destroy"](opts);

    expect(opts.respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({ message: "sessionId is required" }),
    );
  });

  it("succeeds for nonexistent session (idempotent)", () => {
    const opts = makeOpts("dashboard.pty.destroy", { sessionId: "nonexistent" });
    dashboardPtyHandlers["dashboard.pty.destroy"](opts);

    expect(opts.respond).toHaveBeenCalledWith(true, {});
  });
});

// ---------------------------------------------------------------------------
// cleanupPtyForConnection
// ---------------------------------------------------------------------------

describe("cleanupPtyForConnection", () => {
  it("does not throw when no sessions exist", () => {
    expect(() => cleanupPtyForConnection("conn-1")).not.toThrow();
  });
});
