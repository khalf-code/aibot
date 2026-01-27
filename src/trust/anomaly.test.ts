/**
 * MeshGuard — Anomaly Detection Engine Tests
 */

import { describe, it, expect } from "vitest";

import {
  detectAnomalies,
  evaluateSeverity,
  determineAutoAction,
  checkRateLimit,
} from "./anomaly.js";
import type { AgentEvent, AnomalySeverity, AnomalyType, TrustTier } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<AgentEvent> = {}): AgentEvent {
  return {
    action: "api_call",
    timestamp: Date.now(),
    metadata: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// detectAnomalies
// ---------------------------------------------------------------------------

describe("detectAnomalies", () => {
  it("returns empty array for a benign event", () => {
    const event = makeEvent({ metadata: { grantedScopes: ["*"] } });
    const results = detectAnomalies("agent-1", event);
    // May contain unusual_hours depending on when tests run; filter those out
    const nonTimeResults = results.filter((r) => r.type !== "unusual_hours");
    expect(nonTimeResults.length).toBe(0);
  });

  it("detects scope_violation when action is outside granted scopes", () => {
    const event = makeEvent({
      action: "admin.delete_user",
      metadata: { grantedScopes: ["read", "write"] },
    });
    const results = detectAnomalies("agent-1", event);
    const scopeViolations = results.filter((r) => r.type === "scope_violation");
    expect(scopeViolations.length).toBe(1);
    expect(scopeViolations[0].description).toContain("admin.delete_user");
  });

  it("does not flag scope_violation when action matches a granted scope", () => {
    const event = makeEvent({
      action: "read.documents",
      metadata: { grantedScopes: ["read"] },
    });
    const results = detectAnomalies("agent-1", event);
    const scopeViolations = results.filter((r) => r.type === "scope_violation");
    expect(scopeViolations.length).toBe(0);
  });

  it("detects privilege_escalation", () => {
    const event = makeEvent({
      metadata: { requiredTier: "core", currentTier: "basic" },
    });
    const results = detectAnomalies("agent-1", event);
    const escalations = results.filter((r) => r.type === "privilege_escalation");
    expect(escalations.length).toBe(1);
  });

  it("detects data_exfiltration for large data access", () => {
    const event = makeEvent({
      metadata: { dataSize: 50 * 1024 * 1024 }, // 50 MB
    });
    const results = detectAnomalies("agent-1", event);
    const exfil = results.filter((r) => r.type === "data_exfiltration");
    expect(exfil.length).toBe(1);
    expect(exfil[0].description).toContain("50.0 MB");
  });

  it("detects unusual_hours for activity outside normal window", () => {
    // 3 AM UTC
    const event = makeEvent({
      timestamp: new Date("2025-01-15T03:00:00Z").getTime(),
    });
    const results = detectAnomalies("agent-1", event);
    const unusual = results.filter((r) => r.type === "unusual_hours");
    expect(unusual.length).toBe(1);
  });

  it("detects chain_abuse for deep delegation chains", () => {
    const event = makeEvent({
      metadata: { chainDepth: 10 },
    });
    const results = detectAnomalies("agent-1", event);
    const chainAbuse = results.filter((r) => r.type === "chain_abuse");
    expect(chainAbuse.length).toBe(1);
  });

  it("detects policy_violation", () => {
    const event = makeEvent({
      metadata: { violatedPolicies: ["no-external-api", "data-retention"] },
    });
    const results = detectAnomalies("agent-1", event);
    const violations = results.filter((r) => r.type === "policy_violation");
    expect(violations.length).toBe(1);
  });

  it("detects resource_abuse for high CPU", () => {
    const event = makeEvent({
      metadata: { cpuPercent: 95 },
    });
    const results = detectAnomalies("agent-1", event);
    const abuse = results.filter((r) => r.type === "resource_abuse");
    expect(abuse.length).toBe(1);
  });

  it("detects unauthorized_communication", () => {
    const event = makeEvent({
      metadata: {
        endpoint: "https://evil.com/exfil",
        allowedEndpoints: ["https://api.internal.com/*", "https://cdn.example.com/*"],
      },
    });
    const results = detectAnomalies("agent-1", event);
    const unauth = results.filter((r) => r.type === "unauthorized_communication");
    expect(unauth.length).toBe(1);
  });

  it("allows authorized communication via wildcard prefix", () => {
    const event = makeEvent({
      metadata: {
        endpoint: "https://api.internal.com/v2/data",
        allowedEndpoints: ["https://api.internal.com/*"],
      },
    });
    const results = detectAnomalies("agent-1", event);
    const unauth = results.filter((r) => r.type === "unauthorized_communication");
    expect(unauth.length).toBe(0);
  });

  it("detects multiple anomalies from a single event", () => {
    const event = makeEvent({
      action: "admin.export_all",
      timestamp: new Date("2025-01-15T02:00:00Z").getTime(), // unusual hours
      metadata: {
        grantedScopes: ["read"],
        dataSize: 100 * 1024 * 1024, // data exfiltration
        violatedPolicies: ["no-bulk-export"],
      },
    });
    const results = detectAnomalies("agent-1", event);
    const types = new Set(results.map((r) => r.type));
    expect(types.has("scope_violation")).toBe(true);
    expect(types.has("data_exfiltration")).toBe(true);
    expect(types.has("unusual_hours")).toBe(true);
    expect(types.has("policy_violation")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateSeverity
// ---------------------------------------------------------------------------

describe("evaluateSeverity", () => {
  it("returns emergency for large privilege escalation gap", () => {
    expect(
      evaluateSeverity("privilege_escalation", { requiredTier: "core", currentTier: "untrusted" }),
    ).toBe("emergency");
  });

  it("returns critical for 2-tier privilege escalation gap", () => {
    expect(
      evaluateSeverity("privilege_escalation", { requiredTier: "elevated", currentTier: "basic" }),
    ).toBe("critical");
  });

  it("returns warning for 1-tier privilege escalation gap", () => {
    expect(
      evaluateSeverity("privilege_escalation", { requiredTier: "standard", currentTier: "basic" }),
    ).toBe("warning");
  });

  it("returns critical for very large data exfiltration", () => {
    expect(evaluateSeverity("data_exfiltration", { dataSize: 50 * 1024 * 1024 })).toBe("critical");
  });

  it("returns info for low rate spike multiplier", () => {
    expect(evaluateSeverity("rate_spike", { multiplier: 4 })).toBe("info");
  });

  it("returns critical for high rate spike multiplier", () => {
    expect(evaluateSeverity("rate_spike", { multiplier: 10 })).toBe("critical");
  });

  it("returns critical for unauthorized_communication", () => {
    expect(evaluateSeverity("unauthorized_communication", {})).toBe("critical");
  });

  it("returns info for unusual_hours", () => {
    expect(evaluateSeverity("unusual_hours", {})).toBe("info");
  });

  it("returns critical for many policy violations", () => {
    expect(evaluateSeverity("policy_violation", { violatedPolicies: ["a", "b", "c"] })).toBe(
      "critical",
    );
  });
});

// ---------------------------------------------------------------------------
// determineAutoAction
// ---------------------------------------------------------------------------

describe("determineAutoAction", () => {
  const cases: Array<[AnomalySeverity, TrustTier, AutoAction]> = [
    // Emergency
    ["emergency", "untrusted", "revoke"],
    ["emergency", "basic", "revoke"],
    ["emergency", "standard", "suspend"],
    ["emergency", "elevated", "suspend"],
    ["emergency", "core", "throttle"],
    // Critical
    ["critical", "untrusted", "suspend"],
    ["critical", "basic", "throttle"],
    ["critical", "standard", "throttle"],
    ["critical", "elevated", "alert"],
    ["critical", "core", "alert"],
    // Warning
    ["warning", "untrusted", "throttle"],
    ["warning", "basic", "throttle"],
    ["warning", "standard", "alert"],
    ["warning", "elevated", "alert"],
    // Info
    ["info", "untrusted", "alert"],
    ["info", "basic", "none"],
    ["info", "standard", "none"],
    ["info", "core", "none"],
  ];

  for (const [severity, tier, expected] of cases) {
    it(`${severity} + ${tier} → ${expected}`, () => {
      expect(determineAutoAction(severity, tier)).toBe(expected);
    });
  }
});
