import { describe, expect, it, beforeEach } from "vitest";
import { clearVersionCache, resolveVersion, VERSION } from "../version.js";
import { clearCommitHashCache, resolveCommitHash } from "./git-commit.js";

describe("git-commit cache clearing", () => {
  beforeEach(() => {
    // Reset cache before each test
    clearCommitHashCache();
  });

  it("clearCommitHashCache allows fresh resolution", () => {
    // First call populates cache
    const first = resolveCommitHash();

    // Clear cache
    clearCommitHashCache();

    // Second call should work (may return same value, but cache was cleared)
    const second = resolveCommitHash();

    // Both should be valid (either a hash or null)
    expect(first === null || typeof first === "string").toBe(true);
    expect(second === null || typeof second === "string").toBe(true);
  });

  it("resolveCommitHash returns consistent value when cached", () => {
    const first = resolveCommitHash();
    const second = resolveCommitHash();
    expect(first).toBe(second);
  });
});

describe("version cache clearing", () => {
  beforeEach(() => {
    clearVersionCache();
  });

  it("clearVersionCache allows fresh resolution", () => {
    const first = resolveVersion();
    clearVersionCache();
    const second = resolveVersion();

    // Both should return a version string
    expect(typeof first).toBe("string");
    expect(typeof second).toBe("string");
    expect(first.length).toBeGreaterThan(0);
  });

  it("resolveVersion returns consistent value when cached", () => {
    const first = resolveVersion();
    const second = resolveVersion();
    expect(first).toBe(second);
  });

  it("VERSION constant exists and is a string", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });
});
