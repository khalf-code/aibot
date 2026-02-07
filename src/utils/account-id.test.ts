import { describe, expect, it } from "vitest";
import { normalizeAccountId } from "./account-id.js";

describe("normalizeAccountId", () => {
  it("returns trimmed string for a valid account id", () => {
    expect(normalizeAccountId("user-123")).toBe("user-123");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeAccountId("  user-123  ")).toBe("user-123");
  });

  it("returns undefined for an empty string", () => {
    expect(normalizeAccountId("")).toBeUndefined();
  });

  it("returns undefined for a whitespace-only string", () => {
    expect(normalizeAccountId("   ")).toBeUndefined();
  });

  it("returns undefined when called with undefined", () => {
    expect(normalizeAccountId(undefined)).toBeUndefined();
  });

  it("returns undefined when called with no arguments", () => {
    expect(normalizeAccountId()).toBeUndefined();
  });

  it("returns undefined for non-string types", () => {
    // @ts-expect-error -- testing runtime behavior with wrong type
    expect(normalizeAccountId(123)).toBeUndefined();
    // @ts-expect-error -- testing runtime behavior with wrong type
    expect(normalizeAccountId(null)).toBeUndefined();
    // @ts-expect-error -- testing runtime behavior with wrong type
    expect(normalizeAccountId({})).toBeUndefined();
  });

  it("preserves internal whitespace", () => {
    expect(normalizeAccountId("user 123")).toBe("user 123");
  });

  it("handles single-character ids", () => {
    expect(normalizeAccountId("a")).toBe("a");
  });
});
