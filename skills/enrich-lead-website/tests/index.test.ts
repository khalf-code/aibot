import { describe, expect, it } from "vitest";
import type { EnrichInput, EnrichOutput } from "../src/index.ts";
import sampleInput from "../fixtures/input.json";
import sampleOutput from "../fixtures/output.json";
import { enrichLeadWebsite } from "../src/index.ts";

describe("enrich-lead-website", () => {
  it("returns a valid EnrichOutput shape for a given URL", async () => {
    const input: EnrichInput = { url: "https://example.com" };
    const result = await enrichLeadWebsite(input);

    expect(result.url).toBe("https://example.com");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("description");
    expect(result).toHaveProperty("industry");
    expect(result).toHaveProperty("socialLinks");
    expect(result).toHaveProperty("emails");
    expect(result).toHaveProperty("techSignals");
    expect(result).toHaveProperty("excerpt");
    expect(result).toHaveProperty("enrichedAt");
  });

  it("includes an ISO 8601 timestamp in enrichedAt", async () => {
    const result = await enrichLeadWebsite({ url: "https://example.com" });
    // ISO 8601 date pattern
    expect(result.enrichedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("returns arrays for socialLinks, emails, and techSignals", async () => {
    const result = await enrichLeadWebsite({ url: "https://example.com" });
    expect(Array.isArray(result.socialLinks)).toBe(true);
    expect(Array.isArray(result.emails)).toBe(true);
    expect(Array.isArray(result.techSignals)).toBe(true);
  });

  it("sample fixtures have the expected shape", () => {
    // Verify the sample input fixture has a url field
    expect(sampleInput).toHaveProperty("url");
    expect(typeof sampleInput.url).toBe("string");

    // Verify the sample output fixture has required fields
    const output = sampleOutput as EnrichOutput;
    expect(output).toHaveProperty("url");
    expect(output).toHaveProperty("name");
    expect(output).toHaveProperty("enrichedAt");
    expect(Array.isArray(output.socialLinks)).toBe(true);
  });
});
