import { describe, it, expect, vi } from "vitest";

// Mock gateway to prevent WebSocket connections during test
vi.mock("./lib/gateway", () => ({
  gateway: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    callMethod: vi.fn().mockResolvedValue({}),
    onEvent: vi.fn(() => () => {}),
  },
  useGateway: () => ({
    connected: false,
    connecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
  useSendMessage: () => vi.fn(),
  initGateway: vi.fn(),
}));

describe("App", () => {
  it("module loads without errors", async () => {
    const module = await import("./App");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
