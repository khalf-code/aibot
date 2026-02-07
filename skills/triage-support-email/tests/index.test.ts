/**
 * Tests for triage-support-email skill.
 *
 * BIZ-025 to BIZ-028 (#117-#120)
 *
 * Run: pnpm vitest run skills/triage-support-email/tests/index.test.ts
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

describe("triage-support-email", () => {
  it("correctly triages the sample enterprise API issue", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.category).toBe("technical");
    expect(output.subCategory).toBe("integration");
    expect(output.priority).toBe("critical");
    expect(output.sentiment).toBe("angry");
    expect(output.suggestedRoute).toBe("integrations-team");
  });

  it("classifies billing/subscription emails", async () => {
    const output = await execute({
      from: "user@example.com",
      subject: "Cancel my subscription",
      body: "I want to cancel my subscription and get a refund for this month.",
    });

    expect(output.category).toBe("billing");
    expect(output.churnRisk).toBe(true);
  });

  it("classifies technical bug reports", async () => {
    const output = await execute({
      from: "dev@startup.io",
      subject: "Bug: Dashboard crashes on load",
      body: "The dashboard is crashing every time I try to load it. Getting a blank screen with an error message.",
    });

    expect(output.category).toBe("technical");
    expect(output.subCategory).toBe("bug");
  });

  it("classifies account access issues", async () => {
    const output = await execute({
      from: "locked@corp.com",
      subject: "Can't login to my account",
      body: "I've been locked out of my account after entering the wrong password. My 2FA device is also lost.",
    });

    expect(output.category).toBe("account");
    expect(output.subCategory).toBe("access");
    expect(output.suggestedRoute).toBe("account-team");
  });

  it("classifies feature requests", async () => {
    const output = await execute({
      from: "user@company.com",
      subject: "Feature request: dark mode",
      body: "It would be nice to have a dark mode option in the dashboard.",
    });

    expect(output.category).toBe("feature-request");
    expect(output.suggestedRoute).toBe("product-team");
  });

  it("detects angry sentiment", async () => {
    const output = await execute({
      from: "angry@user.com",
      subject: "This is unacceptable",
      body: "Your service is terrible and this is absolutely unacceptable. I want to speak to a manager.",
    });

    expect(output.sentiment).toBe("angry");
    expect(output.priority).toBe("high");
  });

  it("detects positive sentiment", async () => {
    const output = await execute({
      from: "happy@user.com",
      subject: "Thank you!",
      body: "I just wanted to say thank you for the excellent support. Your team is amazing!",
    });

    expect(output.sentiment).toBe("positive");
  });

  it("detects churn risk signals", async () => {
    const output = await execute({
      from: "leaving@corp.com",
      subject: "Switching to a competitor",
      body: "We've decided to switch to a competitor product. Please close my account.",
    });

    expect(output.churnRisk).toBe(true);
  });

  it("marks replies when existingTicketId is provided", async () => {
    const output = await execute({
      from: "user@corp.com",
      subject: "Re: Support ticket",
      body: "Following up on my previous request.",
      existingTicketId: "TKT-12345",
    });

    expect(output.isReply).toBe(true);
  });

  it("assigns critical priority to enterprise customers with outage", async () => {
    const output = await execute({
      from: "cto@bigcorp.com",
      subject: "Service is down",
      body: "Our production service is completely down since this morning.",
      customerTier: "enterprise",
    });

    expect(output.priority).toBe("critical");
  });

  it("assigns higher priority to pro customers", async () => {
    const output = await execute({
      from: "user@midsize.com",
      subject: "Question about settings",
      body: "How do I configure the notification preferences?",
      customerTier: "pro",
    });

    expect(output.priority).toBe("medium");
  });

  it("extracts topics from the email", async () => {
    const output = await execute({
      from: "dev@tech.io",
      subject: "API webhook errors",
      body: "Getting errors on our webhook integration. The API returns timeout responses.",
    });

    expect(output.topics).toContain("api");
    expect(output.topics).toContain("webhook");
    expect(output.topics).toContain("error");
  });

  it("returns an error when from is missing", async () => {
    const output = await execute({} as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toContain("from");
  });

  it("returns an error when body is missing", async () => {
    const output = await execute({
      from: "a@b.com",
      subject: "Hi",
    } as SkillInput);

    expect(output.success).toBe(false);
    expect(output.error).toContain("body");
  });

  it("includes an ISO 8601 timestamp in triagedAt", async () => {
    const input = loadFixture<SkillInput>("input.json");
    const output = await execute(input);

    expect(output.triagedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("sample fixtures have the expected shape", () => {
    const input = loadFixture<SkillInput>("input.json");
    expect(input).toHaveProperty("from");
    expect(input).toHaveProperty("subject");
    expect(input).toHaveProperty("body");

    const output = loadFixture<SkillOutput>("output.json");
    expect(output).toHaveProperty("success");
    expect(output).toHaveProperty("category");
    expect(output).toHaveProperty("priority");
    expect(output).toHaveProperty("sentiment");
    expect(output).toHaveProperty("suggestedRoute");
  });
});
