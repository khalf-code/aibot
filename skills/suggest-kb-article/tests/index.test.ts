/**
 * Tests for suggest-kb-article skill.
 *
 * BIZ-039 (#131) — Sandbox fixture and test coverage.
 *
 * To run:
 *   pnpm vitest run skills/suggest-kb-article/tests/index.test.ts
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SuggestKbInput } from "../src/index.js";
import { execute } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load a JSON fixture file from the fixtures/ directory. */
function loadFixture<T = unknown>(name: string): T {
  const filePath = resolve(__dirname, "..", "fixtures", name);
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

describe("suggest-kb-article", () => {
  it("suggests relevant articles for a password-related ticket", async () => {
    const input = loadFixture<SuggestKbInput>("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.extractedKeywords.length).toBeGreaterThan(0);
    expect(output.suggestions.length).toBeGreaterThanOrEqual(1);
    // Password reset article should be in the suggestions
    expect(output.suggestions.some((s) => s.articleId === "KB-001")).toBe(true);
    // Articles should be sorted by relevance descending
    for (let i = 1; i < output.suggestions.length; i++) {
      expect(output.suggestions[i - 1].relevanceScore).toBeGreaterThanOrEqual(
        output.suggestions[i].relevanceScore,
      );
    }
  });

  it("respects maxResults limit", async () => {
    const input: SuggestKbInput = {
      subject: "billing invoice payment error login password api",
      body: "Everything is broken, need help with authentication and rate limits.",
      maxResults: 2,
    };

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.suggestions.length).toBeLessThanOrEqual(2);
  });

  it("returns empty suggestions when no articles match", async () => {
    const input: SuggestKbInput = {
      subject: "Completely unrelated xylophone query",
      body: "This ticket is about musical instruments and has no relevance to any KB article.",
    };

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.suggestions).toHaveLength(0);
  });

  it("returns an error when subject is missing", async () => {
    const output = await execute({} as SuggestKbInput);

    expect(output.success).toBe(false);
    expect(output.error).toBeDefined();
    expect(output.error).toContain("subject");
  });

  it("extracts keywords from combined subject and body", async () => {
    const input: SuggestKbInput = {
      subject: "API rate limit exceeded",
      body: "Getting HTTP 429 errors when calling the REST API endpoint. Need to understand throttling.",
    };

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.extractedKeywords).toContain("api");
    expect(output.extractedKeywords).toContain("rate");
    expect(output.suggestions.some((s) => s.articleId === "KB-004")).toBe(true);
  });

  it("reports the total number of articles searched", async () => {
    const input: SuggestKbInput = {
      subject: "any query",
      body: "",
    };

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.articlesSearched).toBe(8);
  });
});
