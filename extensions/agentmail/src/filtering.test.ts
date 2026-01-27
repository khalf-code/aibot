import { describe, expect, it } from "vitest";

import { checkSenderFilter, matchesList } from "./filtering.js";

describe("matchesList", () => {
  it("returns false for empty list", () => {
    expect(matchesList("user@example.com", [])).toBe(false);
  });

  it("matches exact email", () => {
    expect(matchesList("user@example.com", ["user@example.com"])).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(matchesList("User@Example.COM", ["user@example.com"])).toBe(true);
  });

  it("matches domain", () => {
    expect(matchesList("anyone@example.com", ["example.com"])).toBe(true);
  });

  it("does not match different domain", () => {
    expect(matchesList("user@other.com", ["example.com"])).toBe(false);
  });

  it("does not match partial email", () => {
    expect(matchesList("user@example.com", ["other@example.com"])).toBe(false);
  });

  it("matches subdomain via domain suffix", () => {
    expect(matchesList("user@sub.example.com", ["sub.example.com"])).toBe(true);
  });
});

describe("checkSenderFilter", () => {
  it("blocks sender on blocklist", () => {
    const result = checkSenderFilter("spam@bad.com", {
      blocklist: ["bad.com"],
      allowlist: [],
    });
    expect(result).toEqual({ allowed: false, blocked: true, label: "blocked" });
  });

  it("allows sender on allowlist", () => {
    const result = checkSenderFilter("friend@good.com", {
      blocklist: [],
      allowlist: ["good.com"],
    });
    expect(result).toEqual({ allowed: true, blocked: false, label: "allowed" });
  });

  it("allows all non-blocked in open mode (empty allowlist)", () => {
    const result = checkSenderFilter("anyone@anywhere.com", {
      blocklist: [],
      allowlist: [],
    });
    expect(result).toEqual({ allowed: true, blocked: false, label: "allowed" });
  });

  it("rejects sender not on non-empty allowlist", () => {
    const result = checkSenderFilter("stranger@unknown.com", {
      blocklist: [],
      allowlist: ["trusted.com"],
    });
    expect(result).toEqual({ allowed: false, blocked: false, label: null });
  });

  it("blocklist takes precedence over allowlist", () => {
    const result = checkSenderFilter("user@both.com", {
      blocklist: ["both.com"],
      allowlist: ["both.com"],
    });
    expect(result).toEqual({ allowed: false, blocked: true, label: "blocked" });
  });
});
