/**
 * Tests for draft-first-response-email skill.
 *
 * BIZ-009 to BIZ-012 (#101-#104)
 *
 * Run: pnpm vitest run skills/draft-first-response-email/tests/index.test.ts
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SkillInput, SkillOutput } from "../src/index.js";
import { execute } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load a JSON fixture file from the fixtures/ directory. */
function loadFixture<T = unknown>(name: string): T {
  const filePath = resolve(__dirname, "..", "fixtures", name);
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

describe("draft-first-response-email", () => {
  it("produces a complete draft for the sample input", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.subject).toBeTruthy();
    expect(output.body).toBeTruthy();
    expect(output.callToAction).toBeTruthy();
    expect(output).toHaveProperty("draftedAt");
  });

  it("includes the lead name in the greeting", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.body).toContain("Jane Doe");
  });

  it("includes company name in the subject for demo requests", async () => {
    const output = await execute({
      leadName: "Bob Smith",
      leadEmail: "bob@widgets.io",
      company: "Widgets Inc",
      intent: "demo request",
      intentSignals: [],
      senderName: "Sales Bot",
      senderTitle: "SDR",
    });

    expect(output.subject).toContain("Widgets Inc");
    expect(output.subject).toContain("Demo");
  });

  it("generates pricing-specific content for pricing inquiries", async () => {
    const output = await execute({
      leadName: "Carol Lee",
      leadEmail: "carol@bigco.com",
      company: "BigCo",
      intent: "pricing inquiry",
      intentSignals: ["need pricing for 50 seats"],
      senderName: "Sales Team",
      senderTitle: "AE",
    });

    expect(output.success).toBe(true);
    expect(output.subject).toContain("Pricing");
    expect(output.body).toContain("pricing");
  });

  it("uses formal tone when specified", async () => {
    const output = await execute({
      leadName: "Dr. Smith",
      leadEmail: "smith@uni.edu",
      company: null,
      intent: "general inquiry",
      intentSignals: [],
      senderName: "Rep",
      senderTitle: "SDR",
      tone: "formal",
    });

    expect(output.body).toContain("Dear Dr. Smith,");
    expect(output.body).toContain("Kind regards,");
  });

  it("uses casual tone when specified", async () => {
    const output = await execute({
      leadName: "Mike",
      leadEmail: "mike@startup.io",
      company: null,
      intent: "general inquiry",
      intentSignals: [],
      senderName: "Rep",
      senderTitle: "SDR",
      tone: "casual",
    });

    expect(output.body).toContain("Hey Mike!");
    expect(output.body).toContain("Cheers,");
  });

  it("returns an error when leadName is missing", async () => {
    const output = await execute({} as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toContain("leadName");
  });

  it("returns an error when leadEmail is missing", async () => {
    const output = await execute({ leadName: "Test" } as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toContain("leadEmail");
  });

  it("includes an ISO 8601 timestamp in draftedAt", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.draftedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("sample fixtures have the expected shape", () => {
    const input = loadFixture<SkillInput>("input.json");
    expect(input).toHaveProperty("leadName");
    expect(input).toHaveProperty("leadEmail");
    expect(input).toHaveProperty("intent");

    const output = loadFixture<SkillOutput>("output.json");
    expect(output).toHaveProperty("success");
    expect(output).toHaveProperty("subject");
    expect(output).toHaveProperty("body");
    expect(output).toHaveProperty("draftedAt");
  });
});
