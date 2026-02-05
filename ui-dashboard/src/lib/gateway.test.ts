import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock WebSocket before importing gateway
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  sentMessages: string[] = [];

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

let mockWsInstance: MockWebSocket | null = null;

vi.stubGlobal(
  "WebSocket",
  class extends MockWebSocket {
    constructor() {
      super();
      mockWsInstance = this;
    }
  },
);

// Import after WebSocket mock is set up
const { gateway, useSendMessage } = await import("./gateway");

/**
 * Complete the handshake and respond to the auto-fired snapshot request,
 * so the gateway is in a clean "ready" state for the test.
 */
function completeHandshakeAndSnapshot(ws: MockWebSocket) {
  const handshake = JSON.parse(ws.sentMessages[0]);
  ws.simulateMessage({
    type: "res",
    id: handshake.id,
    ok: true,
    payload: { protocol: 1 },
  });

  // After handshake, onConnected fires dashboard.snapshot automatically.
  // Respond to it so there are no dangling pending requests.
  const snapshotIdx = ws.sentMessages.length - 1;
  if (snapshotIdx > 0) {
    const snapshotReq = JSON.parse(ws.sentMessages[snapshotIdx]);
    if (snapshotReq.method === "dashboard.snapshot") {
      ws.simulateMessage({
        type: "res",
        id: snapshotReq.id,
        ok: true,
        payload: { tracks: [], tasks: [], workers: [], messages: [], reviews: [], worktrees: [] },
      });
    }
  }
}

describe("GatewayManager", () => {
  beforeEach(() => {
    mockWsInstance = null;
    gateway.disconnect();
  });

  afterEach(() => {
    gateway.disconnect();
    vi.restoreAllMocks();
  });

  it("connects and sends handshake", () => {
    gateway.connect();

    expect(mockWsInstance).toBeTruthy();
    mockWsInstance!.simulateOpen();

    // Should send connect handshake
    expect(mockWsInstance!.sentMessages.length).toBeGreaterThanOrEqual(1);
    const handshake = JSON.parse(mockWsInstance!.sentMessages[0]);
    expect(handshake.type).toBe("req");
    expect(handshake.method).toBe("connect");
    expect(handshake.params.role).toBe("operator");
    expect(handshake.params.client.id).toBe("openclaw-dashboard");
  });

  it("callMethod rejects when not connected", async () => {
    await expect(gateway.callMethod("test.method")).rejects.toThrow("Not connected");
  });

  it("callMethod sends request and resolves on response", async () => {
    gateway.connect();
    mockWsInstance!.simulateOpen();
    completeHandshakeAndSnapshot(mockWsInstance!);

    const msgCountBefore = mockWsInstance!.sentMessages.length;

    const promise = gateway.callMethod("dashboard.files.tree", {});
    expect(mockWsInstance!.sentMessages.length).toBe(msgCountBefore + 1);

    const req = JSON.parse(mockWsInstance!.sentMessages[msgCountBefore]);
    expect(req.method).toBe("dashboard.files.tree");

    mockWsInstance!.simulateMessage({
      type: "res",
      id: req.id,
      ok: true,
      payload: { tree: [] },
    });

    const result = await promise;
    expect(result).toEqual({ tree: [] });
  });

  it("callMethod rejects on error response", async () => {
    gateway.connect();
    mockWsInstance!.simulateOpen();
    completeHandshakeAndSnapshot(mockWsInstance!);

    const msgCountBefore = mockWsInstance!.sentMessages.length;

    const promise = gateway.callMethod("bad.method");
    const req = JSON.parse(mockWsInstance!.sentMessages[msgCountBefore]);

    mockWsInstance!.simulateMessage({
      type: "res",
      id: req.id,
      ok: false,
      error: { message: "Method not found" },
    });

    await expect(promise).rejects.toThrow("Method not found");
  });

  it("routes events to handlers", () => {
    gateway.connect();
    mockWsInstance!.simulateOpen();
    completeHandshakeAndSnapshot(mockWsInstance!);

    const handler = vi.fn();
    const unsubscribe = gateway.onEvent(handler);

    mockWsInstance!.simulateMessage({
      type: "event",
      event: "dashboard.message",
      payload: { content: "hello" },
    });

    expect(handler).toHaveBeenCalledWith("dashboard.message", { content: "hello" });
    unsubscribe();

    // After unsubscribe, handler should not be called
    mockWsInstance!.simulateMessage({
      type: "event",
      event: "dashboard.message",
      payload: { content: "world" },
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores connect.challenge events", () => {
    gateway.connect();
    mockWsInstance!.simulateOpen();
    completeHandshakeAndSnapshot(mockWsInstance!);

    const handler = vi.fn();
    gateway.onEvent(handler);

    mockWsInstance!.simulateMessage({
      type: "event",
      event: "connect.challenge",
      payload: { nonce: "abc" },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("disconnect clears state", () => {
    gateway.connect();
    mockWsInstance!.simulateOpen();
    gateway.disconnect();

    expect(mockWsInstance?.readyState).toBe(MockWebSocket.CLOSED);
  });

  it("rejects pending requests on connection close", async () => {
    gateway.connect();
    mockWsInstance!.simulateOpen();
    completeHandshakeAndSnapshot(mockWsInstance!);

    const promise = gateway.callMethod("slow.method");
    gateway.disconnect();

    await expect(promise).rejects.toThrow("Connection closed");
  });
});

describe("useSendMessage", () => {
  it("returns a function", () => {
    const send = useSendMessage();
    expect(typeof send).toBe("function");
  });
});
