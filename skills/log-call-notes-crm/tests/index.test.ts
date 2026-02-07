/**
 * Tests for log-call-notes-crm skill.
 *
 * BIZ-017 to BIZ-020 (#109-#112)
 *
 * Run: pnpm vitest run skills/log-call-notes-crm/tests/index.test.ts
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

describe("log-call-notes-crm", () => {
  it("produces a formatted note and activity ID for sample input", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.activityId).toBeTruthy();
    expect(output.contactId).toBe("CRM-CONTACT-00042");
    expect(output.dealId).toBe("CRM-DEAL-00017");
    expect(output.formattedNote).toBeTruthy();
    expect(output.actionItemCount).toBe(3);
  });

  it("includes call date and participants in the formatted note", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.formattedNote).toContain("2026-02-07");
    expect(output.formattedNote).toContain("Alex Rivera");
    expect(output.formattedNote).toContain("Jane Doe");
    expect(output.formattedNote).toContain("30 minutes");
  });

  it("includes action items in the formatted note", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.formattedNote).toContain("Send pricing proposal");
    expect(output.formattedNote).toContain("Owner: Alex Rivera");
    expect(output.formattedNote).toContain("due: 2026-02-10");
  });

  it("includes sentiment when provided", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.formattedNote).toContain("positive");
  });

  it("includes next step when provided", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.formattedNote).toContain("Follow-up call scheduled");
  });

  it("handles input with no action items", async () => {
    const output = await execute({
      contactId: "CRM-C-001",
      callDate: "2026-02-07T10:00:00.000Z",
      durationMinutes: 15,
      participants: ["Rep"],
      summary: "Quick check-in call.",
      actionItems: [],
    });

    expect(output.success).toBe(true);
    expect(output.actionItemCount).toBe(0);
    expect(output.formattedNote).not.toContain("### Action Items");
  });

  it("handles input without dealId", async () => {
    const output = await execute({
      contactId: "CRM-C-002",
      callDate: "2026-02-07T10:00:00.000Z",
      durationMinutes: 20,
      participants: ["Rep", "Lead"],
      summary: "Discovery call.",
      actionItems: [],
    });

    expect(output.success).toBe(true);
    expect(output.dealId).toBeNull();
  });

  it("generates HubSpot-prefixed activity ID by default", async () => {
    const output = await execute({
      contactId: "CRM-C-003",
      callDate: "2026-02-07T10:00:00.000Z",
      durationMinutes: 10,
      participants: ["Rep"],
      summary: "Short call.",
      actionItems: [],
    });

    expect(output.activityId).toMatch(/^HS-ACT-/);
  });

  it("generates Salesforce-prefixed activity ID when specified", async () => {
    const output = await execute({
      contactId: "CRM-C-004",
      callDate: "2026-02-07T10:00:00.000Z",
      durationMinutes: 10,
      participants: ["Rep"],
      summary: "Short call.",
      actionItems: [],
      crmProvider: "salesforce",
    });

    expect(output.activityId).toMatch(/^SF-ACT-/);
  });

  it("returns an error when contactId is missing", async () => {
    const output = await execute({} as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toContain("contactId");
  });

  it("returns an error when summary is missing", async () => {
    const output = await execute({ contactId: "CRM-C-005" } as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toContain("summary");
  });

  it("includes an ISO 8601 timestamp in loggedAt", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.loggedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("sample fixtures have the expected shape", () => {
    const input = loadFixture<SkillInput>("input.json");
    expect(input).toHaveProperty("contactId");
    expect(input).toHaveProperty("summary");
    expect(input).toHaveProperty("actionItems");
    expect(Array.isArray(input.actionItems)).toBe(true);

    const output = loadFixture<SkillOutput>("output.json");
    expect(output).toHaveProperty("success");
    expect(output).toHaveProperty("activityId");
    expect(output).toHaveProperty("formattedNote");
    expect(output).toHaveProperty("loggedAt");
  });
});
