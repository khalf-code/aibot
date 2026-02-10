import { describe, expect, it } from "vitest";
import { hasVersionFlag } from "./entry.js";

describe("entry version short-circuit", () => {
  it("detects global version flags", () => {
    expect(hasVersionFlag(["node", "openclaw", "--version"])).toBe(true);
    expect(hasVersionFlag(["node", "openclaw", "-V"])).toBe(true);
    expect(hasVersionFlag(["node", "openclaw", "-v"])).toBe(true);
  });

  it("ignores argv without version flags", () => {
    expect(hasVersionFlag(["node", "openclaw", "status"])).toBe(false);
    expect(hasVersionFlag(["node", "openclaw", "gateway", "--port", "18789"])).toBe(false);
  });
});
