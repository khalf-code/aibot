/**
 * MeshGuard — Trust & Anomaly Detection Types
 *
 * Core type definitions for the agent governance anomaly detection engine.
 */

// ---------------------------------------------------------------------------
// Anomaly classification
// ---------------------------------------------------------------------------

export type AnomalyType =
  | "scope_violation"
  | "rate_spike"
  | "privilege_escalation"
  | "data_exfiltration"
  | "unusual_hours"
  | "chain_abuse"
  | "policy_violation"
  | "resource_abuse"
  | "unauthorized_communication";

export type AnomalySeverity = "info" | "warning" | "critical" | "emergency";

export type AutoAction = "none" | "alert" | "throttle" | "suspend" | "revoke";

// ---------------------------------------------------------------------------
// Trust tiers
// ---------------------------------------------------------------------------

/** Higher tier = more trusted. Determines auto-action leniency. */
export type TrustTier = "untrusted" | "basic" | "standard" | "elevated" | "core";

// ---------------------------------------------------------------------------
// Events & anomalies
// ---------------------------------------------------------------------------

/** Inbound agent action/event fed into detection rules. */
export interface AgentEvent {
  /** Type of action the agent is performing. */
  action: string;
  /** Unix-ms timestamp when the event occurred. */
  timestamp: number;
  /** Optional metadata bag (resource size, endpoint, delegation depth, etc.). */
  metadata?: Record<string, unknown>;
}

/** A detected anomaly before persistence. */
export interface AnomalyEvent {
  id: string;
  agentId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  detectedAt: string; // ISO-8601
  context: Record<string, unknown>;
  autoAction: AutoAction;
  resolved: boolean;
  resolvedAt?: string; // ISO-8601
}

/** Persisted anomaly row (mirrors AnomalyEvent but all fields are present). */
export interface AnomalyRow {
  id: string;
  agent_id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  detected_at: string;
  context: string; // JSON-serialised
  auto_action: AutoAction;
  resolved: number; // 0 | 1
  resolved_at: string | null;
}

// ---------------------------------------------------------------------------
// Summaries & risk profiles
// ---------------------------------------------------------------------------

export interface AnomalySummary {
  total: number;
  bySeverity: Record<AnomalySeverity, number>;
  byType: Record<AnomalyType, number>;
  unresolved: number;
}

export interface RiskProfile {
  agentId: string;
  windowDays: number;
  totalAnomalies: number;
  unresolvedCount: number;
  severityBreakdown: Record<AnomalySeverity, number>;
  typeBreakdown: Record<AnomalyType, number>;
  riskScore: number; // 0–100
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface ProcessAnomalyResult {
  anomaly: AnomalyEvent;
  autoAction: AutoAction;
  actionExecuted: boolean;
}
