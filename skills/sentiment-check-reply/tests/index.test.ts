/**
 * Tests for sentiment-check-reply skill.
 *
 * BIZ-043 (#135) — Sandbox fixture and test coverage.
 *
 * To run:
 *   pnpm vitest run skills/sentiment-check-reply/tests/index.test.ts
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SentimentCheckInput } from "../src/index.js";
import { execute } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load a JSON fixture file from the fixtures/ directory. */
function loadFixture<T = unknown>(name: string): T {
  const filePath = resolve(__dirname, "..", "fixtures", name);
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

describe("sentiment-check-reply", () => {
  it("analyzes a mixed-tone reply and detects formality flags", async () => {
    const input = loadFixture<SentimentCheckInput>("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.sentiment).toBeDefined();
    expect(output.sentimentScore).toBeGreaterThanOrEqual(-1);
    expect(output.sentimentScore).toBeLessThanOrEqual(1);
    // Should detect "per our policy" as a flag
    expect(output.flags.some((f) => f.phrase === "per our policy")).toBe(true);
  });

  it("flags blaming language as an error", async () => {
    const input: SentimentCheckInput = {
      replyText:
        "You should have read the documentation before contacting us. That's not our problem to solve.",
      customerFrustrated: true,
    };

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.flags.some((f) => f.severity === "error")).toBe(true);
    expect(output.recommendedAction).toBe("escalate_to_reviewer");
  });

  it("recommends send for a positive, empathetic reply", async () => {
    const input: SentimentCheckInput = {
      replyText:
        "I understand how frustrating this must be, and I appreciate your patience. I'm happy to help resolve this right away. I've processed your refund and you should see it within 3-5 business days. Thank you for your patience.",
    };

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.sentiment).toBe("positive");
    expect(output.recommendedAction).toBe("send");
    expect(output.toneScores.empathy).toBeGreaterThan(0);
  });

  it("flags missing empathy when customer is frustrated", async () => {
    const input: SentimentCheckInput = {
      replyText:
        "Your ticket has been updated. The issue will be resolved in the next release cycle.",
      customerFrustrated: true,
    };

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.flags.some((f) => f.phrase === "(missing empathy)")).toBe(true);
  });

  it("returns an error when replyText is missing", async () => {
    const output = await execute({} as SentimentCheckInput);

    expect(output.success).toBe(false);
    expect(output.error).toBeDefined();
    expect(output.error).toContain("replyText");
  });

  it("detects condescending tone", async () => {
    const input: SentimentCheckInput = {
      replyText:
        "As I already said in my previous email, you need to submit the form again. Please calm down and follow the steps carefully.",
    };

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.flags.some((f) => f.phrase === "as i already said")).toBe(true);
    expect(output.flags.some((f) => f.phrase === "calm down")).toBe(true);
    expect(output.recommendedAction).toBe("escalate_to_reviewer");
  });

  it("provides a human-readable summary", async () => {
    const input: SentimentCheckInput = {
      replyText: "Thank you for reaching out. I'd be glad to help with your request.",
    };

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.summary).toContain("Sentiment:");
    expect(output.summary).toContain("Recommendation:");
    expect(output.analyzedAt).toBeDefined();
  });
});
