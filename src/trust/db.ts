/**
 * MeshGuard — Trust / Anomaly Database
 *
 * CRUD operations for anomaly persistence backed by node:sqlite.
 */

import crypto from "node:crypto";
import path from "node:path";

import { requireNodeSqlite } from "../memory/sqlite.js";
import { resolveStateDir } from "../config/paths.js";

import type { DatabaseSync } from "node:sqlite";
import type {
  AnomalyEvent,
  AnomalyRow,
  AnomalySeverity,
  AnomalySummary,
  AnomalyType,
} from "./types.js";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ANOMALY_TABLE = `
  CREATE TABLE IF NOT EXISTS anomalies (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    type        TEXT NOT NULL,
    severity    TEXT NOT NULL,
    description TEXT NOT NULL,
    detected_at TEXT NOT NULL,
    context     TEXT NOT NULL DEFAULT '{}',
    auto_action TEXT NOT NULL DEFAULT 'none',
    resolved    INTEGER NOT NULL DEFAULT 0,
    resolved_at TEXT
  );
`;

const ANOMALY_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_anomalies_agent     ON anomalies(agent_id);`,
  `CREATE INDEX IF NOT EXISTS idx_anomalies_type      ON anomalies(type);`,
  `CREATE INDEX IF NOT EXISTS idx_anomalies_severity  ON anomalies(severity);`,
  `CREATE INDEX IF NOT EXISTS idx_anomalies_detected  ON anomalies(detected_at);`,
  `CREATE INDEX IF NOT EXISTS idx_anomalies_resolved  ON anomalies(resolved);`,
];

const RATE_TABLE = `
  CREATE TABLE IF NOT EXISTS rate_events (
    id         TEXT PRIMARY KEY,
    agent_id   TEXT NOT NULL,
    action     TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`;

const RATE_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_rate_events_agent_action
    ON rate_events(agent_id, action, created_at);
`;

// ---------------------------------------------------------------------------
// Singleton database
// ---------------------------------------------------------------------------

let _db: DatabaseSync | null = null;

export function getTrustDb(): DatabaseSync {
  if (_db) return _db;
  const { DatabaseSync } = requireNodeSqlite();
  const stateDir = resolveStateDir();
  const dbPath = path.join(stateDir, "meshguard-trust.db");
  _db = new DatabaseSync(dbPath);
  _db.exec(ANOMALY_TABLE);
  for (const idx of ANOMALY_INDEXES) _db.exec(idx);
  _db.exec(RATE_TABLE);
  _db.exec(RATE_INDEX);
  return _db;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToEvent(row: AnomalyRow): AnomalyEvent {
  return {
    id: row.id,
    agentId: row.agent_id,
    type: row.type,
    severity: row.severity,
    description: row.description,
    detectedAt: row.detected_at,
    context: JSON.parse(row.context),
    autoAction: row.auto_action,
    resolved: row.resolved === 1,
    resolvedAt: row.resolved_at ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function insertAnomaly(event: AnomalyEvent): void {
  const db = getTrustDb();
  const stmt = db.prepare(`
    INSERT INTO anomalies (id, agent_id, type, severity, description, detected_at, context, auto_action, resolved, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    event.id,
    event.agentId,
    event.type,
    event.severity,
    event.description,
    event.detectedAt,
    JSON.stringify(event.context),
    event.autoAction,
    event.resolved ? 1 : 0,
    event.resolvedAt ?? null,
  );
}

export function listAnomalies(opts?: {
  agentId?: string;
  type?: AnomalyType;
  severity?: AnomalySeverity;
  resolved?: boolean;
  since?: string;
  limit?: number;
}): AnomalyEvent[] {
  const db = getTrustDb();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (opts?.agentId) {
    clauses.push("agent_id = ?");
    params.push(opts.agentId);
  }
  if (opts?.type) {
    clauses.push("type = ?");
    params.push(opts.type);
  }
  if (opts?.severity) {
    clauses.push("severity = ?");
    params.push(opts.severity);
  }
  if (opts?.resolved !== undefined) {
    clauses.push("resolved = ?");
    params.push(opts.resolved ? 1 : 0);
  }
  if (opts?.since) {
    clauses.push("detected_at >= ?");
    params.push(opts.since);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = opts?.limit ?? 500;

  const stmt = db.prepare(`SELECT * FROM anomalies ${where} ORDER BY detected_at DESC LIMIT ?`);
  const rows = stmt.all(...(params as Array<string | number>), limit) as unknown as AnomalyRow[];

  return rows.map(rowToEvent);
}

export function resolveAnomaly(id: string): void {
  const db = getTrustDb();
  db.prepare(`UPDATE anomalies SET resolved = 1, resolved_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    id,
  );
}

export function getAnomalySummary(agentId?: string): AnomalySummary {
  const db = getTrustDb();

  const whereAgent = agentId ? "WHERE agent_id = ?" : "";
  const agentParams = agentId ? [agentId] : [];

  const totalRow = db
    .prepare(`SELECT COUNT(*) as cnt FROM anomalies ${whereAgent}`)
    .get(...agentParams) as { cnt: number };

  const unresolvedRow = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM anomalies ${whereAgent ? whereAgent + " AND" : "WHERE"} resolved = 0`,
    )
    .get(...agentParams) as { cnt: number };

  const severityRows = db
    .prepare(`SELECT severity, COUNT(*) as cnt FROM anomalies ${whereAgent} GROUP BY severity`)
    .all(...agentParams) as Array<{ severity: AnomalySeverity; cnt: number }>;

  const typeRows = db
    .prepare(`SELECT type, COUNT(*) as cnt FROM anomalies ${whereAgent} GROUP BY type`)
    .all(...agentParams) as Array<{ type: AnomalyType; cnt: number }>;

  const bySeverity: Record<AnomalySeverity, number> = {
    info: 0,
    warning: 0,
    critical: 0,
    emergency: 0,
  };
  for (const r of severityRows) bySeverity[r.severity] = r.cnt;

  const byType: Record<AnomalyType, number> = {
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
  for (const r of typeRows) byType[r.type] = r.cnt;

  return {
    total: totalRow.cnt,
    bySeverity,
    byType,
    unresolved: unresolvedRow.cnt,
  };
}

// ---------------------------------------------------------------------------
// Rate-event tracking
// ---------------------------------------------------------------------------

export function recordRateEvent(agentId: string, action: string): void {
  const db = getTrustDb();
  db.prepare(`INSERT INTO rate_events (id, agent_id, action, created_at) VALUES (?, ?, ?, ?)`).run(
    crypto.randomUUID(),
    agentId,
    action,
    new Date().toISOString(),
  );
}

export function countRateEvents(agentId: string, action: string, sinceIso: string): number {
  const db = getTrustDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM rate_events WHERE agent_id = ? AND action = ? AND created_at >= ?`,
    )
    .get(agentId, action, sinceIso) as { cnt: number };
  return row.cnt;
}
