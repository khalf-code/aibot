import { describe, expect, it } from "vitest";

import { formatUtcDate, parseEmailFromAddress, parseNameFromAddress } from "./utils.js";

describe("formatUtcDate", () => {
  it("formats Date object to UTC string", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    const result = formatUtcDate(date);
    expect(result).toContain("Mon, 15 Jan 2024");
    expect(result).toContain("UTC");
    expect(result).not.toContain("GMT");
  });

  it("formats ISO string to UTC string", () => {
    const result = formatUtcDate("2024-06-20T15:45:00Z");
    expect(result).toContain("Thu, 20 Jun 2024");
    expect(result).toContain("UTC");
  });

  it("formats timestamp to UTC string", () => {
    const timestamp = new Date("2024-03-10T08:00:00Z").getTime();
    const result = formatUtcDate(timestamp);
    expect(result).toContain("Sun, 10 Mar 2024");
  });
});

describe("parseEmailFromAddress", () => {
  it("extracts email from angle bracket format", () => {
    expect(parseEmailFromAddress("John Doe <john@example.com>")).toBe("john@example.com");
  });

  it("returns plain email as-is", () => {
    expect(parseEmailFromAddress("user@example.com")).toBe("user@example.com");
  });

  it("handles email with spaces", () => {
    expect(parseEmailFromAddress("  user@example.com  ")).toBe("user@example.com");
  });

  it("lowercases email", () => {
    expect(parseEmailFromAddress("User@EXAMPLE.COM")).toBe("user@example.com");
  });

  it("handles complex display names", () => {
    expect(parseEmailFromAddress("Dr. John Smith Jr. <john.smith@company.org>")).toBe("john.smith@company.org");
  });
});

describe("parseNameFromAddress", () => {
  it("extracts display name from angle bracket format", () => {
    expect(parseNameFromAddress("John Doe <john@example.com>")).toBe("John Doe");
  });

  it("falls back to email local part for plain email", () => {
    expect(parseNameFromAddress("user@example.com")).toBe("user");
  });

  it("handles complex display names", () => {
    expect(parseNameFromAddress("Dr. Jane Smith <jane@hospital.org>")).toBe("Dr. Jane Smith");
  });

  it("trims whitespace from display name", () => {
    expect(parseNameFromAddress("  John Doe  <john@example.com>")).toBe("John Doe");
  });
});
