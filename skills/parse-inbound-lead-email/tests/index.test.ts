/**
 * Tests for parse-inbound-lead-email skill.
 *
 * BIZ-001 to BIZ-004 (#93-#96)
 *
 * Run: pnpm vitest run skills/parse-inbound-lead-email/tests/index.test.ts
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

describe("parse-inbound-lead-email", () => {
  it("produces expected output shape for sample input", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.senderName).toBe("Jane Doe");
    expect(output.senderEmail).toBe("jane.doe@acmecorp.com");
    expect(output.company).toBe("acmecorp");
    expect(output.intent).toBe("demo request");
    expect(output).toHaveProperty("urgency");
    expect(output).toHaveProperty("intentSignals");
    expect(Array.isArray(output.intentSignals)).toBe(true);
    expect(output.intentSignals.length).toBeGreaterThan(0);
  });

  it("extracts sender name and email from angle-bracket format", async () => {
    const output = await execute({
      from: "Bob Smith <bob@widgets.io>",
      subject: "Quick question",
      body: "I need some info about your product.",
    });

    expect(output.success).toBe(true);
    expect(output.senderName).toBe("Bob Smith");
    expect(output.senderEmail).toBe("bob@widgets.io");
  });

  it("handles bare email address in from field", async () => {
    const output = await execute({
      from: "alice@megacorp.com",
      subject: "Hello",
      body: "I'm interested in learning more.",
    });

    expect(output.success).toBe(true);
    expect(output.senderName).toBeNull();
    expect(output.senderEmail).toBe("alice@megacorp.com");
    expect(output.company).toBe("megacorp");
  });

  it("returns null company for free email providers", async () => {
    const output = await execute({
      from: "someone@gmail.com",
      subject: "Hi",
      body: "Just checking things out.",
    });

    expect(output.success).toBe(true);
    expect(output.company).toBeNull();
  });

  it("detects high urgency keywords", async () => {
    const output = await execute({
      from: "urgent@acme.com",
      subject: "URGENT: Need pricing ASAP",
      body: "We need a decision immediately.",
    });

    expect(output.urgency).toBe("high");
  });

  it("detects demo request intent", async () => {
    const output = await execute({
      from: "lead@corp.com",
      subject: "Demo request",
      body: "We would like to schedule a demo.",
    });

    expect(output.intent).toBe("demo request");
  });

  it("detects pricing inquiry intent", async () => {
    const output = await execute({
      from: "lead@corp.com",
      subject: "Pricing question",
      body: "How much does your enterprise plan cost?",
    });

    expect(output.intent).toBe("pricing inquiry");
  });

  it("returns an error when from field is missing", async () => {
    const output = await execute({} as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toBeDefined();
    expect(output.error).toContain("from");
  });

  it("returns an error when body field is missing", async () => {
    const output = await execute({ from: "a@b.com", subject: "Hi" } as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toBeDefined();
    expect(output.error).toContain("body");
  });

  it("includes an ISO 8601 timestamp in parsedAt", async () => {
    const output = await execute({
      from: "test@example.com",
      subject: "Test",
      body: "Test body content.",
    });

    expect(output.parsedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("sample fixtures have the expected shape", () => {
    const input = loadFixture<SkillInput>("input.json");
    expect(input).toHaveProperty("from");
    expect(input).toHaveProperty("subject");
    expect(input).toHaveProperty("body");

    const output = loadFixture<SkillOutput>("output.json");
    expect(output).toHaveProperty("success");
    expect(output).toHaveProperty("senderName");
    expect(output).toHaveProperty("senderEmail");
    expect(output).toHaveProperty("parsedAt");
  });
});
