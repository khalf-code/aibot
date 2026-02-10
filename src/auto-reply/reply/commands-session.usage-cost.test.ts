import { describe, expect, it, vi } from "vitest";

vi.mock("../../infra/session-cost-usage.js", () => ({
  loadSessionCostSummary: vi.fn(async () => ({
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 10,
    totalCost: 1.23,
    inputCost: 0,
    outputCost: 0,
    cacheReadCost: 0,
    cacheWriteCost: 0,
    missingCostEntries: 0,
  })),
  loadCostUsageSummary: vi.fn(async () => ({
    updatedAt: Date.now(),
    days: 30,
    daily: [],
    totals: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 100,
      totalCost: 12.3,
      inputCost: 0,
      outputCost: 0,
      cacheReadCost: 0,
      cacheWriteCost: 0,
      missingCostEntries: 0,
    },
  })),
}));

import { loadCostUsageSummary } from "../../infra/session-cost-usage.js";
import { handleUsageCommand } from "./commands-session.js";

describe("handleUsageCommand /usage cost", () => {
  it("passes agentId derived from sessionKey to loadCostUsageSummary", async () => {
    const result = await handleUsageCommand(
      {
        cfg: {},
        command: {
          commandBodyNormalized: "/usage cost",
          isAuthorizedSender: true,
        },
        sessionKey: "agent:ops:main",
        sessionEntry: {
          sessionId: "sess-1",
        },
      } as never,
      true,
    );

    expect(vi.mocked(loadCostUsageSummary)).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "ops" }),
    );
    expect(result?.shouldContinue).toBe(false);
    expect(result?.reply?.text).toContain("Usage cost");
  });
});
