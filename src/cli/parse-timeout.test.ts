import { describe, expect, it } from "vitest";
import { parseTimeoutMs } from "./parse-timeout.js";

describe("parseTimeoutMs", () => {
  // --- Number inputs ---

  it("returns a finite number unchanged", () => {
    expect(parseTimeoutMs(5000)).toBe(5000);
  });

  it("returns zero for number 0", () => {
    expect(parseTimeoutMs(0)).toBe(0);
  });

  it("returns negative numbers as-is", () => {
    expect(parseTimeoutMs(-100)).toBe(-100);
  });

  it("returns undefined for NaN", () => {
    expect(parseTimeoutMs(Number.NaN)).toBeUndefined();
  });

  it("returns undefined for Infinity", () => {
    expect(parseTimeoutMs(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it("returns undefined for -Infinity", () => {
    expect(parseTimeoutMs(Number.NEGATIVE_INFINITY)).toBeUndefined();
  });

  // --- String inputs ---

  it("parses an integer string", () => {
    expect(parseTimeoutMs("3000")).toBe(3000);
  });

  it("trims whitespace from string input", () => {
    expect(parseTimeoutMs("  4000  ")).toBe(4000);
  });

  it("returns undefined for an empty string", () => {
    expect(parseTimeoutMs("")).toBeUndefined();
  });

  it("returns undefined for a whitespace-only string", () => {
    expect(parseTimeoutMs("   ")).toBeUndefined();
  });

  it("returns undefined for a non-numeric string", () => {
    expect(parseTimeoutMs("abc")).toBeUndefined();
  });

  it("parses integer prefix of a mixed string (parseInt behavior)", () => {
    // parseInt("123abc") === 123
    expect(parseTimeoutMs("123abc")).toBe(123);
  });

  // --- BigInt inputs ---

  it("converts bigint to number", () => {
    expect(parseTimeoutMs(BigInt(9000))).toBe(9000);
  });

  // --- Null / undefined ---

  it("returns undefined for undefined", () => {
    expect(parseTimeoutMs(undefined)).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(parseTimeoutMs(null)).toBeUndefined();
  });

  // --- Other types ---

  it("returns undefined for a boolean", () => {
    expect(parseTimeoutMs(true)).toBeUndefined();
  });

  it("returns undefined for an object", () => {
    expect(parseTimeoutMs({})).toBeUndefined();
  });
});
