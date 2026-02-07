/**
 * Tests for escalate-sla-breach skill.
 *
 * BIZ-035 (#127) — Sandbox fixture and test coverage.
 *
 * To run:
 *   pnpm vitest run skills/escalate-sla-breach/tests/index.test.ts
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { EscalateSlaInput } from "../src/index.js";
import { execute } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load a JSON fixture file from the fixtures/ directory. */
function loadFixture<T = unknown>(name: string): T {
  const filePath = resolve(__dirname, "..", "fixtures", name);
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

describe("escalate-sla-breach", () => {
  it("detects multiple SLA breaches on an overdue high-priority ticket", async () => {
    const input = loadFixture<EscalateSlaInput>("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.ticketId).toBe("TKT-90421");
    expect(output.breaches.length).toBeGreaterThanOrEqual(1);
    // At least first_response should be breached since firstResponseAt is null
    expect(output.breaches.some((b) => b.type === "first_response")).toBe(true);
    expect(output.escalation).not.toBeNull();
    expect(output.escalation?.notifyManager).toBe(true);
    expect(output.escalation?.tags).toContain("sla-breach");
  });

  it("returns no breaches for a resolved ticket", async () => {
    const input: EscalateSlaInput = {
      ticketId: "TKT-10001",
      priority: "medium",
      createdAt: "2026-02-06T10:00:00.000Z",
      firstResponseAt: "2026-02-06T10:05:00.000Z",
      lastUpdateAt: "2026-02-06T12:00:00.000Z",
      resolved: true,
      resolvedAt: "2026-02-06T12:30:00.000Z",
      assignee: "agent-kim",
    };

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.breaches).toHaveLength(0);
    expect(output.escalation).toBeNull();
  });

  it("returns an error when ticketId is missing", async () => {
    const output = await execute({} as EscalateSlaInput);

    expect(output.success).toBe(false);
    expect(output.error).toBeDefined();
    expect(output.error).toContain("ticketId");
  });

  it("respects custom SLA thresholds", async () => {
    const input: EscalateSlaInput = {
      ticketId: "TKT-20002",
      priority: "low",
      createdAt: new Date(Date.now() - 10 * 60_000).toISOString(), // 10 min ago
      firstResponseAt: null,
      lastUpdateAt: null,
      resolved: false,
      resolvedAt: null,
      assignee: "agent-lee",
      customThresholds: {
        firstResponseMinutes: 5, // very tight: 5 min
      },
    };

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.breaches.some((b) => b.type === "first_response")).toBe(true);
    // Overshoot should be ~5 minutes
    const frBreach = output.breaches.find((b) => b.type === "first_response");
    expect(frBreach?.overshootMinutes).toBeGreaterThanOrEqual(4);
  });

  it("escalates critical tickets to tier-3 with manager notification", async () => {
    const input: EscalateSlaInput = {
      ticketId: "TKT-30003",
      priority: "critical",
      createdAt: new Date(Date.now() - 30 * 60_000).toISOString(), // 30 min ago
      firstResponseAt: null,
      lastUpdateAt: null,
      resolved: false,
      resolvedAt: null,
      assignee: "agent-chen",
    };

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.escalation?.newTier).toBe("tier-3");
    expect(output.escalation?.notifyManager).toBe(true);
  });
});
