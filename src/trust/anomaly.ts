/**
 * MeshGuard — Anomaly Detection Engine
 *
 * Analyses agent actions/events against a configurable set of detection rules,
 * evaluates severity, determines automatic response actions, and persists
 * findings for downstream risk assessment.
 *
 * Entry points:
 *   detectAnomalies()   — run all detection rules against an event
 *   processAnomaly()    — full pipeline: persist → action → audit log
 *   getAgentRiskProfile — aggregate anomaly history into a risk assessment
 *   checkRateLimit()    — rate-limit gate for a given agent + action type
 */

import crypto from "node:crypto";

import {
  insertAnomaly,
  listAnomalies,
  getAnomalySummary,
  recordRateEvent,
  countRateEvents,
} from "./db.js";
import type {
  AgentEvent,
  AnomalyEvent,
  AnomalySeverity,
  AnomalyType,
  AutoAction,
  ProcessAnomalyResult,
  RiskProfile,
  TrustTier,
} from "./types.js";
import { computeTrustScore, scoreToTier } from "./score.js";
import { logAuditEvent } from "../audit/db.js";

// ---------------------------------------------------------------------------
// Constants & thresholds
// ---------------------------------------------------------------------------

/** Default rate-limit thresholds per action (events per window). */
const DEFAULT_RATE_LIMITS: Record<string, number> = {
  api_call: 120,
  data_read: 60,
  data_write: 30,
  file_access: 100,
  network_request: 80,
  delegation: 10,
  default: 60,
};

/** Rolling-average window used for spike detection (minutes). */
const SPIKE_WINDOW_MINUTES = 5;
/** Multiplier above rolling average that triggers a rate spike. */
const SPIKE_MULTIPLIER = 3;

/** Data-size threshold for exfiltration heuristic (bytes). */
const EXFIL_SIZE_THRESHOLD = 10 * 1024 * 1024; // 10 MB

/** Normal operating hours (UTC). Outside this window → unusual_hours. */
const NORMAL_HOURS_START = 6; // 06:00 UTC
const NORMAL_HOURS_END = 22; // 22:00 UTC

/** Max allowed delegation chain depth before flagging chain_abuse. */
const MAX_CHAIN_DEPTH = 5;

/** Resource-abuse thresholds. */
const RESOURCE_CPU_THRESHOLD = 90; // percentage
const RESOURCE_MEMORY_THRESHOLD = 85; // percentage

// ---------------------------------------------------------------------------
// Detection rules
// ---------------------------------------------------------------------------

type DetectionRule = (agentId: string, event: AgentEvent) => AnomalyEvent | null;

/**
 * scope_violation — action outside granted permissions.
 *
 * Checks `event.metadata.grantedScopes` (string[]) against `event.action`.
 */
function detectScopeViolation(agentId: string, event: AgentEvent): AnomalyEvent | null {
  const granted = event.metadata?.grantedScopes;
  if (!Array.isArray(granted)) return null;

  const actionRoot = event.action.split(".")[0];
  const inScope = (granted as string[]).some(
    (scope) => scope === "*" || scope === event.action || scope === actionRoot,
  );
  if (inScope) return null;

  return buildAnomaly(agentId, "scope_violation", {
    description: `Action "${event.action}" is outside granted scopes [${(granted as string[]).join(", ")}]`,
    context: { action: event.action, grantedScopes: granted },
    event,
  });
}

/**
 * rate_spike — unusual burst of activity.
 *
 * Compares recent event count in the last SPIKE_WINDOW_MINUTES to the
 * rolling average stored via rate-event tracking in the trust DB.
 */
function detectRateSpike(agentId: string, event: AgentEvent): AnomalyEvent | null {
  const action = event.action;
  // Record this event for future rate calculations
  recordRateEvent(agentId, action);

  const now = new Date();
  const windowStart = new Date(now.getTime() - SPIKE_WINDOW_MINUTES * 60_000);
  const recentCount = countRateEvents(agentId, action, windowStart.toISOString());

  // Compare against a broader 1-hour window to get an average rate
  const hourStart = new Date(now.getTime() - 60 * 60_000);
  const hourCount = countRateEvents(agentId, action, hourStart.toISOString());
  const hourlyAvgPerWindow = (hourCount / 60) * SPIKE_WINDOW_MINUTES;

  // If we have enough history and current window is a spike
  const baseline = Math.max(hourlyAvgPerWindow, 2); // minimum baseline of 2
  if (recentCount > baseline * SPIKE_MULTIPLIER) {
    return buildAnomaly(agentId, "rate_spike", {
      description: `Rate spike detected for "${action}": ${recentCount} events in ${SPIKE_WINDOW_MINUTES}min (baseline ~${Math.round(baseline)})`,
      context: {
        action,
        recentCount,
        baselinePerWindow: Math.round(baseline),
        multiplier: Math.round(recentCount / baseline),
      },
      event,
    });
  }
  return null;
}

/**
 * privilege_escalation — attempting higher-tier actions.
 *
 * Expects `event.metadata.requiredTier` and `event.metadata.currentTier`.
 */
function detectPrivilegeEscalation(agentId: string, event: AgentEvent): AnomalyEvent | null {
  const required = event.metadata?.requiredTier as TrustTier | undefined;
  const current = event.metadata?.currentTier as TrustTier | undefined;
  if (!required || !current) return null;

  const tierRank: Record<TrustTier, number> = {
    untrusted: 0,
    basic: 1,
    standard: 2,
    elevated: 3,
    core: 4,
  };

  if (tierRank[required] > tierRank[current]) {
    return buildAnomaly(agentId, "privilege_escalation", {
      description: `Agent at tier "${current}" attempted action requiring "${required}"`,
      context: { action: event.action, currentTier: current, requiredTier: required },
      event,
    });
  }
  return null;
}

/**
 * data_exfiltration — large data access patterns.
 *
 * Flags when `event.metadata.dataSize` exceeds the exfiltration threshold.
 */
function detectDataExfiltration(agentId: string, event: AgentEvent): AnomalyEvent | null {
  const dataSize = event.metadata?.dataSize;
  if (typeof dataSize !== "number") return null;

  if (dataSize > EXFIL_SIZE_THRESHOLD) {
    const sizeMB = (dataSize / (1024 * 1024)).toFixed(1);
    return buildAnomaly(agentId, "data_exfiltration", {
      description: `Large data access detected: ${sizeMB} MB (threshold: ${EXFIL_SIZE_THRESHOLD / (1024 * 1024)} MB)`,
      context: { action: event.action, dataSize, thresholdBytes: EXFIL_SIZE_THRESHOLD },
      event,
    });
  }
  return null;
}

/**
 * unusual_hours — activity outside normal operating window.
 *
 * Uses the event timestamp (UTC) to check against the normal window.
 */
function detectUnusualHours(agentId: string, event: AgentEvent): AnomalyEvent | null {
  const hour = new Date(event.timestamp).getUTCHours();
  if (hour >= NORMAL_HOURS_START && hour < NORMAL_HOURS_END) return null;

  return buildAnomaly(agentId, "unusual_hours", {
    description: `Activity at ${String(hour).padStart(2, "0")}:00 UTC (normal window: ${NORMAL_HOURS_START}:00–${NORMAL_HOURS_END}:00)`,
    context: {
      action: event.action,
      hourUtc: hour,
      normalStart: NORMAL_HOURS_START,
      normalEnd: NORMAL_HOURS_END,
    },
    event,
  });
}

/**
 * chain_abuse — suspicious delegation chain usage.
 *
 * Expects `event.metadata.chainDepth` (number).
 */
function detectChainAbuse(agentId: string, event: AgentEvent): AnomalyEvent | null {
  const depth = event.metadata?.chainDepth;
  if (typeof depth !== "number") return null;

  if (depth > MAX_CHAIN_DEPTH) {
    return buildAnomaly(agentId, "chain_abuse", {
      description: `Delegation chain depth ${depth} exceeds maximum ${MAX_CHAIN_DEPTH}`,
      context: { action: event.action, chainDepth: depth, maxAllowed: MAX_CHAIN_DEPTH },
      event,
    });
  }
  return null;
}

/**
 * policy_violation — explicit policy rule breach.
 *
 * Expects `event.metadata.violatedPolicies` (string[]).
 */
function detectPolicyViolation(agentId: string, event: AgentEvent): AnomalyEvent | null {
  const violated = event.metadata?.violatedPolicies;
  if (!Array.isArray(violated) || violated.length === 0) return null;

  return buildAnomaly(agentId, "policy_violation", {
    description: `Policy violations: ${(violated as string[]).join(", ")}`,
    context: { action: event.action, violatedPolicies: violated },
    event,
  });
}

/**
 * resource_abuse — excessive resource consumption.
 *
 * Checks `event.metadata.cpuPercent` and `event.metadata.memoryPercent`.
 */
function detectResourceAbuse(agentId: string, event: AgentEvent): AnomalyEvent | null {
  const cpu = event.metadata?.cpuPercent;
  const mem = event.metadata?.memoryPercent;
  const issues: string[] = [];

  if (typeof cpu === "number" && cpu > RESOURCE_CPU_THRESHOLD) {
    issues.push(`CPU ${cpu}% (threshold: ${RESOURCE_CPU_THRESHOLD}%)`);
  }
  if (typeof mem === "number" && mem > RESOURCE_MEMORY_THRESHOLD) {
    issues.push(`Memory ${mem}% (threshold: ${RESOURCE_MEMORY_THRESHOLD}%)`);
  }
  if (issues.length === 0) return null;

  return buildAnomaly(agentId, "resource_abuse", {
    description: `Resource abuse: ${issues.join("; ")}`,
    context: { action: event.action, cpuPercent: cpu, memoryPercent: mem },
    event,
  });
}

/**
 * unauthorized_communication — contacting unauthorized endpoints.
 *
 * Expects `event.metadata.endpoint` (string) and optionally
 * `event.metadata.allowedEndpoints` (string[]).
 */
function detectUnauthorizedCommunication(agentId: string, event: AgentEvent): AnomalyEvent | null {
  const endpoint = event.metadata?.endpoint;
  const allowed = event.metadata?.allowedEndpoints;
  if (typeof endpoint !== "string") return null;
  if (!Array.isArray(allowed)) return null;

  const isAllowed = (allowed as string[]).some((pattern) => {
    if (pattern === "*") return true;
    // Simple prefix / glob matching
    if (pattern.endsWith("*")) {
      return endpoint.startsWith(pattern.slice(0, -1));
    }
    return endpoint === pattern;
  });

  if (isAllowed) return null;

  return buildAnomaly(agentId, "unauthorized_communication", {
    description: `Unauthorized endpoint: "${endpoint}"`,
    context: { action: event.action, endpoint, allowedEndpoints: allowed },
    event,
  });
}

// ---------------------------------------------------------------------------
// Rule registry
// ---------------------------------------------------------------------------

const DETECTION_RULES: DetectionRule[] = [
  detectScopeViolation,
  detectRateSpike,
  detectPrivilegeEscalation,
  detectDataExfiltration,
  detectUnusualHours,
  detectChainAbuse,
  detectPolicyViolation,
  detectResourceAbuse,
  detectUnauthorizedCommunication,
];

// ---------------------------------------------------------------------------
// 1. detectAnomalies
// ---------------------------------------------------------------------------

/**
 * Run all detection rules against an agent event.
 * Returns an array of detected anomalies (may be empty).
 */
export function detectAnomalies(agentId: string, event: AgentEvent): AnomalyEvent[] {
  const anomalies: AnomalyEvent[] = [];
  for (const rule of DETECTION_RULES) {
    try {
      const result = rule(agentId, event);
      if (result) anomalies.push(result);
    } catch {
      // Individual rule failures must not block other rules
    }
  }
  return anomalies;
}

// ---------------------------------------------------------------------------
// 2. evaluateSeverity
// ---------------------------------------------------------------------------

/**
 * Determine anomaly severity based on type and contextual signals.
 *
 * Context keys that influence severity:
 *   - `multiplier` (rate_spike): higher multiplier → higher severity
 *   - `chainDepth` (chain_abuse): deeper chains → higher severity
 *   - `dataSize` (data_exfiltration): bigger size → higher severity
 *   - `violatedPolicies` (policy_violation): more violations → higher severity
 *   - `requiredTier` / `currentTier` (privilege_escalation): gap determines severity
 */
export function evaluateSeverity(
  anomalyType: AnomalyType,
  context: Record<string, unknown> = {},
): AnomalySeverity {
  switch (anomalyType) {
    // -- Always high severity --
    case "privilege_escalation": {
      const tierRank: Record<string, number> = {
        untrusted: 0,
        basic: 1,
        standard: 2,
        elevated: 3,
        core: 4,
      };
      const required = tierRank[context.requiredTier as string] ?? 0;
      const current = tierRank[context.currentTier as string] ?? 0;
      const gap = required - current;
      if (gap >= 3) return "emergency";
      if (gap >= 2) return "critical";
      return "warning";
    }

    case "data_exfiltration": {
      const size = (context.dataSize as number) ?? 0;
      if (size > EXFIL_SIZE_THRESHOLD * 10) return "emergency";
      if (size > EXFIL_SIZE_THRESHOLD * 3) return "critical";
      return "warning";
    }

    case "rate_spike": {
      const mult = (context.multiplier as number) ?? 1;
      if (mult >= 10) return "critical";
      if (mult >= 5) return "warning";
      return "info";
    }

    case "chain_abuse": {
      const depth = (context.chainDepth as number) ?? 0;
      if (depth > MAX_CHAIN_DEPTH * 2) return "emergency";
      if (depth > MAX_CHAIN_DEPTH + 3) return "critical";
      return "warning";
    }

    case "unauthorized_communication":
      return "critical";

    case "scope_violation":
      return "warning";

    case "policy_violation": {
      const policies = context.violatedPolicies;
      if (Array.isArray(policies) && policies.length >= 3) return "critical";
      return "warning";
    }

    case "resource_abuse": {
      const cpu = (context.cpuPercent as number) ?? 0;
      const mem = (context.memoryPercent as number) ?? 0;
      if (cpu > 98 || mem > 98) return "critical";
      return "warning";
    }

    case "unusual_hours":
      return "info";

    default:
      return "info";
  }
}

// ---------------------------------------------------------------------------
// 3. determineAutoAction
// ---------------------------------------------------------------------------

/**
 * Map (severity × trust-tier) to an automatic response action.
 *
 * More-trusted agents get more lenient treatment; untrusted agents face
 * harsher actions at lower severity thresholds.
 */
export function determineAutoAction(
  severity: AnomalySeverity,
  agentTrustTier: TrustTier,
): AutoAction {
  const tierLeniency: Record<TrustTier, number> = {
    untrusted: 0,
    basic: 1,
    standard: 2,
    elevated: 3,
    core: 4,
  };

  const leniency = tierLeniency[agentTrustTier];

  switch (severity) {
    case "emergency":
      // Emergency: revoke untrusted/basic, suspend standard+
      if (leniency <= 1) return "revoke";
      if (leniency <= 3) return "suspend";
      return "throttle"; // core agents get throttled, human decides

    case "critical":
      if (leniency <= 0) return "suspend";
      if (leniency <= 2) return "throttle";
      return "alert";

    case "warning":
      if (leniency <= 1) return "throttle";
      return "alert";

    case "info":
      if (leniency <= 0) return "alert";
      return "none";

    default:
      return "none";
  }
}

// ---------------------------------------------------------------------------
// 4. processAnomaly
// ---------------------------------------------------------------------------

/**
 * Full anomaly processing pipeline:
 *   1. Persist to trust DB
 *   2. Determine auto-action (re-evaluate severity from context)
 *   3. Execute action (currently: audit log)
 *   4. Return result
 */
export function processAnomaly(agentId: string, anomaly: AnomalyEvent): ProcessAnomalyResult {
  // Re-evaluate severity from stored context for consistency
  const severity = evaluateSeverity(anomaly.type, anomaly.context);
  const updatedAnomaly: AnomalyEvent = { ...anomaly, severity };

  // Derive agent trust tier from recent history
  const summary = getAnomalySummary(agentId);
  const trustScore = computeTrustScore({
    severityCounts: summary.bySeverity,
    unresolvedCount: summary.unresolved,
    windowDays: 30,
  });
  const trustTier = scoreToTier(trustScore);

  const autoAction = determineAutoAction(severity, trustTier);
  updatedAnomaly.autoAction = autoAction;

  // 1. Persist anomaly
  insertAnomaly(updatedAnomaly);

  // 2. Audit log the detection + action
  logAuditEvent(agentId, "anomaly_detected", {
    anomalyId: updatedAnomaly.id,
    type: updatedAnomaly.type,
    severity,
    autoAction,
    trustScore,
    trustTier,
  });

  // 3. Execute action (log-only for now; future: integrate with agent runtime)
  let actionExecuted = false;
  if (autoAction !== "none") {
    logAuditEvent(agentId, `anomaly_action_${autoAction}`, {
      anomalyId: updatedAnomaly.id,
      type: updatedAnomaly.type,
      severity,
    });
    actionExecuted = true;
  }

  return {
    anomaly: updatedAnomaly,
    autoAction,
    actionExecuted,
  };
}

// ---------------------------------------------------------------------------
// 5. getAgentRiskProfile
// ---------------------------------------------------------------------------

/**
 * Aggregate anomaly history into a risk assessment for an agent.
 */
export function getAgentRiskProfile(agentId: string, windowDays: number = 30): RiskProfile {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60_000).toISOString();

  const anomalies = listAnomalies({ agentId, since });

  const severityBreakdown: Record<AnomalySeverity, number> = {
    info: 0,
    warning: 0,
    critical: 0,
    emergency: 0,
  };
  const typeBreakdown: Record<AnomalyType, number> = {
    scope_violation: 0,
    rate_spike: 0,
    privilege_escalation: 0,
    data_exfiltration: 0,
    unusual_hours: 0,
    chain_abuse: 0,
    policy_violation: 0,
    resource_abuse: 0,
    unauthorized_communication: 0,
  };

  let unresolvedCount = 0;
  for (const a of anomalies) {
    severityBreakdown[a.severity]++;
    typeBreakdown[a.type]++;
    if (!a.resolved) unresolvedCount++;
  }

  const riskScore =
    100 -
    computeTrustScore({
      severityCounts: severityBreakdown,
      unresolvedCount,
      windowDays,
    });

  let riskLevel: RiskProfile["riskLevel"];
  if (riskScore >= 75) riskLevel = "critical";
  else if (riskScore >= 50) riskLevel = "high";
  else if (riskScore >= 25) riskLevel = "medium";
  else riskLevel = "low";

  return {
    agentId,
    windowDays,
    totalAnomalies: anomalies.length,
    unresolvedCount,
    severityBreakdown,
    typeBreakdown,
    riskScore,
    riskLevel,
  };
}

// ---------------------------------------------------------------------------
// 6. checkRateLimit
// ---------------------------------------------------------------------------

/**
 * Check whether an agent is exceeding rate limits for a given action type.
 *
 * Returns `true` if the agent is within limits, `false` if rate-limited.
 * Also records the event for future tracking.
 */
export function checkRateLimit(
  agentId: string,
  actionType: string,
  windowMinutes: number = 5,
): boolean {
  const limit = DEFAULT_RATE_LIMITS[actionType] ?? DEFAULT_RATE_LIMITS.default;
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const count = countRateEvents(agentId, actionType, since);
  return count < limit;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAnomaly(
  agentId: string,
  type: AnomalyType,
  opts: {
    description: string;
    context: Record<string, unknown>;
    event: AgentEvent;
  },
): AnomalyEvent {
  const severity = evaluateSeverity(type, opts.context);
  return {
    id: crypto.randomUUID(),
    agentId,
    type,
    severity,
    description: opts.description,
    detectedAt: new Date(opts.event.timestamp).toISOString(),
    context: opts.context,
    autoAction: "none", // will be set by processAnomaly
    resolved: false,
  };
}
