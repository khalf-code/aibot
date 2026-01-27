/**
 * MeshGuard — Audit Database
 *
 * Lightweight audit event logging backed by node:sqlite.
 */

import crypto from "node:crypto";
import path from "node:path";

import { requireNodeSqlite } from "../memory/sqlite.js";
import { resolveStateDir } from "../config/paths.js";

import type { DatabaseSync } from "node:sqlite";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const AUDIT_TABLE = `
  CREATE TABLE IF NOT EXISTS audit_events (
    id         TEXT PRIMARY KEY,
    agent_id   TEXT NOT NULL,
    event_type TEXT NOT NULL,
    detail     TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
`;

const AUDIT_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_audit_agent_created
    ON audit_events(agent_id, created_at);
`;

// ---------------------------------------------------------------------------
// Singleton database
// ---------------------------------------------------------------------------

let _db: DatabaseSync | null = null;

export function getAuditDb(): DatabaseSync {
  if (_db) return _db;
  const { DatabaseSync } = requireNodeSqlite();
  const stateDir = resolveStateDir();
  const dbPath = path.join(stateDir, "meshguard-audit.db");
  _db = new DatabaseSync(dbPath);
  _db.exec(AUDIT_TABLE);
  _db.exec(AUDIT_INDEX);
  return _db;
}

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------

export interface AuditEntry {
  id: string;
  agentId: string;
  eventType: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export function logAuditEvent(
  agentId: string,
  eventType: string,
  detail: Record<string, unknown> = {},
): AuditEntry {
  const db = getAuditDb();
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    agentId,
    eventType,
    detail,
    createdAt: new Date().toISOString(),
  };
  const stmt = db.prepare(
    `INSERT INTO audit_events (id, agent_id, event_type, detail, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  stmt.run(entry.id, entry.agentId, entry.eventType, JSON.stringify(entry.detail), entry.createdAt);
  return entry;
}
