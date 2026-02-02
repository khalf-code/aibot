import { describe, expect, it } from "vitest";
import { MAX_SET_TIMEOUT_MS, resolveAgentTimeoutMs } from "./timeout.js";

describe("resolveAgentTimeoutMs", () => {
  it("caps no-timeout to stay under the setTimeout limit", () => {
    const resolved = resolveAgentTimeoutMs({ overrideSeconds: 0 });

    expect(resolved).toBe(MAX_SET_TIMEOUT_MS - 10_000);
    expect(resolved).toBeLessThanOrEqual(MAX_SET_TIMEOUT_MS);
  });
});
