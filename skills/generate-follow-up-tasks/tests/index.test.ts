/**
 * Tests for generate-follow-up-tasks skill.
 *
 * BIZ-021 to BIZ-024 (#113-#116)
 *
 * Run: pnpm vitest run skills/generate-follow-up-tasks/tests/index.test.ts
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SkillInput, SkillOutput, FollowUpTask } from "../src/index.js";
import { execute } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load a JSON fixture file from the fixtures/ directory. */
function loadFixture<T = unknown>(name: string): T {
  const filePath = resolve(__dirname, "..", "fixtures", name);
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

describe("generate-follow-up-tasks", () => {
  it("produces tasks for sample input", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.tasks.length).toBeGreaterThan(0);
    expect(output.taskCount).toBe(output.tasks.length);
  });

  it("always generates a recap email task", async () => {
    const output = await execute({
      summary: "Had a brief chat about nothing specific.",
      ownerName: "Rep",
      leadName: "Lead",
    });

    expect(output.success).toBe(true);
    const recapTask = output.tasks.find((t) => t.category === "email");
    expect(recapTask).toBeDefined();
    expect(recapTask!.title).toContain("recap email");
  });

  it("generates proposal task when pricing is mentioned", async () => {
    const output = await execute({
      summary: "Discussed pricing options for enterprise tier.",
      ownerName: "Rep",
      leadName: "Bob",
      company: "BigCo",
    });

    const proposalTask = output.tasks.find((t) => t.title.toLowerCase().includes("proposal"));
    expect(proposalTask).toBeDefined();
    expect(proposalTask!.priority).toBe("high");
    expect(proposalTask!.category).toBe("document");
  });

  it("generates demo task when demo is mentioned", async () => {
    const output = await execute({
      summary: "Lead wants to see a demo of the platform.",
      ownerName: "Rep",
      leadName: "Carol",
    });

    const demoTask = output.tasks.find((t) => t.title.toLowerCase().includes("demo"));
    expect(demoTask).toBeDefined();
    expect(demoTask!.category).toBe("meeting");
  });

  it("generates internal sync task when engineering is mentioned", async () => {
    const output = await execute({
      summary: "Need to check with engineering about the custom connector.",
      ownerName: "Rep",
      leadName: "Dave",
      company: "TechCo",
    });

    const internalTask = output.tasks.find((t) => t.category === "internal");
    expect(internalTask).toBeDefined();
    expect(internalTask!.title).toContain("TechCo");
  });

  it("generates contract task when deal stage is negotiation", async () => {
    const output = await execute({
      summary: "Finalized terms discussion.",
      ownerName: "Rep",
      leadName: "Eve",
      company: "MegaCorp",
      dealStage: "negotiation",
    });

    const contractTask = output.tasks.find((t) => t.title.toLowerCase().includes("contract"));
    expect(contractTask).toBeDefined();
    expect(contractTask!.priority).toBe("high");
  });

  it("all tasks have valid structure", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    for (const task of output.tasks) {
      expect(task.title).toBeTruthy();
      expect(task.description).toBeTruthy();
      expect(task.owner).toBeTruthy();
      expect(["low", "medium", "high"]).toContain(task.priority);
      expect(task.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["email", "call", "internal", "document", "meeting"]).toContain(task.category);
    }
  });

  it("due dates are after the base date", async () => {
    const baseDate = "2026-02-07T00:00:00.000Z";
    const output = await execute({
      summary: "Discussed pricing and demo.",
      ownerName: "Rep",
      leadName: "Frank",
      baseDate,
    });

    const baseDateMs = new Date(baseDate).getTime();
    for (const task of output.tasks) {
      const taskDateMs = new Date(task.dueDate).getTime();
      expect(taskDateMs).toBeGreaterThan(baseDateMs);
    }
  });

  it("returns an error when summary is missing", async () => {
    const output = await execute({} as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toContain("summary");
    expect(output.tasks).toEqual([]);
  });

  it("returns an error when ownerName is missing", async () => {
    const output = await execute({ summary: "Some notes" } as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toContain("ownerName");
  });

  it("includes an ISO 8601 timestamp in generatedAt", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("sample fixtures have the expected shape", () => {
    const input = loadFixture<SkillInput>("input.json");
    expect(input).toHaveProperty("summary");
    expect(input).toHaveProperty("ownerName");
    expect(input).toHaveProperty("leadName");

    const output = loadFixture<SkillOutput>("output.json");
    expect(output).toHaveProperty("success");
    expect(output).toHaveProperty("tasks");
    expect(Array.isArray(output.tasks)).toBe(true);
    expect(output).toHaveProperty("taskCount");
    expect(output).toHaveProperty("generatedAt");
  });
});
