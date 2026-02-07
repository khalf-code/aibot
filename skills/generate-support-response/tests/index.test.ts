/**
 * Tests for generate-support-response skill.
 *
 * BIZ-029 to BIZ-032 (#121-#124)
 *
 * Run: pnpm vitest run skills/generate-support-response/tests/index.test.ts
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

describe("generate-support-response", () => {
  it("generates a complete response for the sample critical issue", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.subject).toContain("Re:");
    expect(output.subject).toContain("TKT-20260207-001");
    expect(output.body).toBeTruthy();
    expect(output.internalNote).toBeTruthy();
    expect(output.shouldEscalate).toBe(true);
  });

  it("includes customer name in the greeting", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.body).toContain("John Smith");
  });

  it("includes empathetic acknowledgment for angry sentiment", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.body).toContain("frustration");
    expect(output.body).toContain("apologize");
  });

  it("includes positive acknowledgment for happy customers", async () => {
    const output = await execute({
      customerName: "Happy User",
      customerEmail: "happy@corp.com",
      originalSubject: "Thanks!",
      originalBody: "Your product is great!",
      category: "general",
      subCategory: "other",
      priority: "low",
      sentiment: "positive",
      agentName: "Agent",
    });

    expect(output.body).toContain("happy to help");
  });

  it("suggests KB articles for technical integration issues", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.suggestedArticles.length).toBeGreaterThan(0);
    const titles = output.suggestedArticles.map((a) => a.title);
    expect(titles).toContain("API Integration Guide");
  });

  it("suggests KB articles for billing refund issues", async () => {
    const output = await execute({
      customerName: "Refund User",
      customerEmail: "user@corp.com",
      originalSubject: "Refund request",
      originalBody: "I want a refund for the last payment.",
      category: "billing",
      subCategory: "refund",
      priority: "medium",
      sentiment: "negative",
      agentName: "Agent",
    });

    const titles = output.suggestedArticles.map((a) => a.title);
    expect(titles).toContain("Refund Policy");
  });

  it("recommends escalation for critical priority", async () => {
    const output = await execute({
      customerName: "Critical User",
      customerEmail: "user@corp.com",
      originalSubject: "Service down",
      originalBody: "Everything is broken.",
      category: "technical",
      subCategory: "bug",
      priority: "critical",
      sentiment: "angry",
      agentName: "Agent",
    });

    expect(output.shouldEscalate).toBe(true);
    expect(output.internalNote).toContain("ESCALATION RECOMMENDED");
  });

  it("does not recommend escalation for low-priority positive tickets", async () => {
    const output = await execute({
      customerName: "Calm User",
      customerEmail: "user@corp.com",
      originalSubject: "Question",
      originalBody: "How do I configure my settings?",
      category: "general",
      subCategory: "other",
      priority: "low",
      sentiment: "neutral",
      agentName: "Agent",
    });

    expect(output.shouldEscalate).toBe(false);
  });

  it("uses concise tone when specified", async () => {
    const output = await execute({
      customerName: "Quick User",
      customerEmail: "user@corp.com",
      originalSubject: "Quick Q",
      originalBody: "How do I reset my password?",
      category: "account",
      subCategory: "access",
      priority: "low",
      sentiment: "neutral",
      agentName: "Agent",
      tone: "concise",
    });

    expect(output.body).toContain("Thank you for reaching out.");
    expect(output.body).toContain("Best,");
  });

  it("includes ticket ID in the subject when provided", async () => {
    const output = await execute({
      customerName: "User",
      customerEmail: "user@corp.com",
      originalSubject: "Issue",
      originalBody: "Some issue.",
      category: "general",
      subCategory: "other",
      priority: "low",
      sentiment: "neutral",
      agentName: "Agent",
      ticketId: "TKT-999",
    });

    expect(output.subject).toContain("[TKT-999]");
  });

  it("omits ticket ID bracket when not provided", async () => {
    const output = await execute({
      customerName: "User",
      customerEmail: "user@corp.com",
      originalSubject: "Issue",
      originalBody: "Some issue.",
      category: "general",
      subCategory: "other",
      priority: "low",
      sentiment: "neutral",
      agentName: "Agent",
    });

    expect(output.subject).toBe("Re: Issue");
  });

  it("includes agent name in the signature", async () => {
    const output = await execute({
      customerName: "User",
      customerEmail: "user@corp.com",
      originalSubject: "Hi",
      originalBody: "Need help.",
      category: "general",
      subCategory: "other",
      priority: "low",
      sentiment: "neutral",
      agentName: "Sarah Chen",
    });

    expect(output.body).toContain("Sarah Chen");
    expect(output.body).toContain("Support Team");
  });

  it("internal note includes priority and sentiment", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.internalNote).toContain("critical");
    expect(output.internalNote).toContain("angry");
    expect(output.internalNote).toContain("1 hour");
  });

  it("returns an error when customerName is missing", async () => {
    const output = await execute({} as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toContain("customerName");
  });

  it("returns an error when originalBody is missing", async () => {
    const output = await execute({
      customerName: "User",
    } as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toContain("originalBody");
  });

  it("includes an ISO 8601 timestamp in generatedAt", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("sample fixtures have the expected shape", () => {
    const input = loadFixture<SkillInput>("input.json");
    expect(input).toHaveProperty("customerName");
    expect(input).toHaveProperty("originalBody");
    expect(input).toHaveProperty("category");
    expect(input).toHaveProperty("priority");
    expect(input).toHaveProperty("sentiment");

    const output = loadFixture<SkillOutput>("output.json");
    expect(output).toHaveProperty("success");
    expect(output).toHaveProperty("subject");
    expect(output).toHaveProperty("body");
    expect(output).toHaveProperty("internalNote");
    expect(output).toHaveProperty("suggestedArticles");
    expect(output).toHaveProperty("shouldEscalate");
    expect(output).toHaveProperty("generatedAt");
  });
});
