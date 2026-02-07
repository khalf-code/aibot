/**
 * Tests for schedule-intro-call skill.
 *
 * BIZ-013 to BIZ-016 (#105-#108)
 *
 * Run: pnpm vitest run skills/schedule-intro-call/tests/index.test.ts
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

describe("schedule-intro-call", () => {
  it("produces proposed slots for sample input", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.proposedSlots.length).toBeGreaterThan(0);
    expect(output.proposedSlots.length).toBeLessThanOrEqual(3);
    expect(output.title).toContain("Alex Rivera");
    expect(output.title).toContain("Jane Doe");
  });

  it("generates slots with valid ISO 8601 timestamps", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    for (const slot of output.proposedSlots) {
      expect(slot.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(slot.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      // End should be after start
      expect(new Date(slot.end).getTime()).toBeGreaterThan(new Date(slot.start).getTime());
    }
  });

  it("respects default 30-minute duration", async () => {
    const output = await execute({
      leadName: "Bob Smith",
      leadEmail: "bob@widgets.io",
      hostEmail: "rep@openclaw.ai",
      hostName: "Rep",
      preferredAfter: "2026-02-10T09:00:00.000Z",
    });

    expect(output.success).toBe(true);
    if (output.proposedSlots.length > 0) {
      const slot = output.proposedSlots[0];
      const diffMs = new Date(slot.end).getTime() - new Date(slot.start).getTime();
      expect(diffMs).toBe(30 * 60 * 1000);
    }
  });

  it("uses custom title when provided", async () => {
    const output = await execute({
      leadName: "Carol Lee",
      leadEmail: "carol@bigco.com",
      hostEmail: "rep@openclaw.ai",
      hostName: "Rep",
      title: "Custom Meeting: Acme Partnership",
    });

    expect(output.success).toBe(true);
    expect(output.title).toBe("Custom Meeting: Acme Partnership");
  });

  it("builds default title from lead and host names", async () => {
    const output = await execute({
      leadName: "Dave Wilson",
      leadEmail: "dave@corp.com",
      hostEmail: "rep@openclaw.ai",
      hostName: "Sales Rep",
    });

    expect(output.title).toBe("Intro Call: Sales Rep <> Dave Wilson");
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

  it("returns an error when hostEmail is missing", async () => {
    const output = await execute({
      leadName: "Test",
      leadEmail: "test@test.com",
    } as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toContain("hostEmail");
  });

  it("includes an ISO 8601 timestamp in scheduledAt", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.scheduledAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("sample fixtures have the expected shape", () => {
    const input = loadFixture<SkillInput>("input.json");
    expect(input).toHaveProperty("leadName");
    expect(input).toHaveProperty("leadEmail");
    expect(input).toHaveProperty("hostEmail");

    const output = loadFixture<SkillOutput>("output.json");
    expect(output).toHaveProperty("success");
    expect(output).toHaveProperty("proposedSlots");
    expect(Array.isArray(output.proposedSlots)).toBe(true);
    expect(output).toHaveProperty("title");
  });
});
