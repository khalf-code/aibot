import type { DatabaseSync } from "node:sqlite";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type {
  MeridiaDbBackend,
  MeridiaDbStats,
  MeridiaSessionListItem,
  MeridiaSessionSummary,
  MeridiaToolStatsItem,
  RecordQueryFilters,
  RecordQueryResult,
} from "../backend.js";
import type { MeridiaExperienceRecord, MeridiaTraceEvent } from "../../types.js";
import { isDefaultMeridiaDir, resolveMeridiaDir } from "../../paths.js";
import { wipeDir } from "../../fs.js";

const require = createRequire(import.meta.url);

const SCHEMA_VERSION = "1";

function openDb(dbPath: string): DatabaseSync {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("node:sqlite") as typeof import("node:sqlite");
  const db = new mod.DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

function listTables(db: DatabaseSync): string[] {
  try {
    const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as Array<{
      name: string;
    }>;
    return rows.map((row) => row.name).filter(Boolean);
  } catch {
    return [];
  }
}

function tableExists(db: DatabaseSync, name: string): boolean {
  try {
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
      .get(name) as { name?: string } | undefined;
    return Boolean(row?.name);
  } catch {
    return false;
  }
}

function readSchemaVersion(db: DatabaseSync): string | null {
  try {
    if (!tableExists(db, "meridia_meta")) {
      return null;
    }
    const row = db.prepare(`SELECT value FROM meridia_meta WHERE key = 'schema_version'`).get() as
      | { value?: string }
      | undefined;
    return typeof row?.value === "string" ? row.value : null;
  } catch {
    return null;
  }
}

function hasAnyUserTables(db: DatabaseSync): boolean {
  const tables = listTables(db);
  return tables.some((name) => name && !name.startsWith("sqlite_"));
}

function isExpectedSchema(db: DatabaseSync): boolean {
  const required = ["meridia_meta", "meridia_records", "meridia_trace"];
  for (const name of required) {
    if (!tableExists(db, name)) {
      return false;
    }
  }
  return readSchemaVersion(db) === SCHEMA_VERSION;
}

function ensureSchema(db: DatabaseSync): { ftsAvailable: boolean; ftsError?: string } {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meridia_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS meridia_records (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      kind TEXT NOT NULL,
      session_key TEXT,
      session_id TEXT,
      run_id TEXT,
      tool_name TEXT,
      tool_call_id TEXT,
      is_error INTEGER DEFAULT 0,
      score REAL,
      threshold REAL,
      eval_kind TEXT,
      eval_model TEXT,
      eval_reason TEXT,
      tags_json TEXT,
      data_json TEXT NOT NULL,
      data_text TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_meridia_records_ts ON meridia_records(ts);`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_meridia_records_session_key ON meridia_records(session_key);`,
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_meridia_records_tool_name ON meridia_records(tool_name);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_meridia_records_score ON meridia_records(score);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_meridia_records_kind ON meridia_records(kind);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS meridia_trace (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      kind TEXT NOT NULL,
      session_key TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_meridia_trace_ts ON meridia_trace(ts);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_meridia_trace_kind ON meridia_trace(kind);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_meridia_trace_session_key ON meridia_trace(session_key);`);

  let ftsAvailable = false;
  let ftsError: string | undefined;
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS meridia_records_fts USING fts5(
        tool_name,
        eval_reason,
        data_text,
        content=meridia_records,
        content_rowid=rowid
      );
    `);
    ftsAvailable = true;
  } catch (err) {
    ftsError = err instanceof Error ? err.message : String(err);
  }

  db.prepare(`INSERT OR REPLACE INTO meridia_meta (key, value) VALUES ('schema_version', ?)`).run(
    SCHEMA_VERSION,
  );

  return { ftsAvailable, ...(ftsError ? { ftsError } : {}) };
}

function clampText(input: string, maxChars: number): string {
  if (input.length <= maxChars) {
    return input;
  }
  return `${input.slice(0, Math.max(0, maxChars - 12))}…(truncated)`;
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildSearchableText(record: MeridiaExperienceRecord): string {
  const parts: string[] = [];
  if (record.tool?.name) parts.push(record.tool.name);
  if (record.tool?.meta) parts.push(record.tool.meta);
  if (record.capture?.evaluation?.reason) parts.push(record.capture.evaluation.reason);
  if (record.content?.topic) parts.push(record.content.topic);
  if (record.content?.summary) parts.push(record.content.summary);
  if (record.content?.context) parts.push(record.content.context);
  if (record.content?.tags?.length) parts.push(record.content.tags.join(" "));
  if (record.content?.anchors?.length) parts.push(record.content.anchors.join(" "));
  if (record.data?.args !== undefined) parts.push(clampText(safeJsonStringify(record.data.args), 500));
  if (record.data?.result !== undefined) {
    parts.push(clampText(safeJsonStringify(record.data.result), 1000));
  }
  return parts.join(" ");
}

function applyFilters(filters?: RecordQueryFilters): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.sessionKey) {
    conditions.push("r.session_key = ?");
    params.push(filters.sessionKey);
  }
  if (filters?.toolName) {
    conditions.push("r.tool_name = ?");
    params.push(filters.toolName);
  }
  if (filters?.minScore !== undefined) {
    conditions.push("r.score >= ?");
    params.push(filters.minScore);
  }
  if (filters?.from) {
    conditions.push("r.ts >= ?");
    params.push(filters.from);
  }
  if (filters?.to) {
    conditions.push("r.ts <= ?");
    params.push(filters.to);
  }
  if (filters?.tag) {
    conditions.push("r.tags_json LIKE ?");
    params.push(`%\"${filters.tag.replaceAll('"', "")}\"%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

function parseRecordJson(raw: string): MeridiaExperienceRecord {
  return JSON.parse(raw) as MeridiaExperienceRecord;
}

function parseTraceJson(raw: string): MeridiaTraceEvent {
  return JSON.parse(raw) as MeridiaTraceEvent;
}

export class SqliteBackend implements MeridiaDbBackend {
  private db: DatabaseSync;
  private ftsAvailable = false;
  private schemaVersion: string | null = null;

  constructor(params: { dbPath: string; cfg?: OpenClawConfig; hookKey?: string; allowAutoWipe: boolean }) {
    fs.mkdirSync(path.dirname(params.dbPath), { recursive: true, mode: 0o700 });

    const dbExists = fs.existsSync(params.dbPath);
    const dirPath = path.dirname(params.dbPath);
    const dirHasFiles =
      fs.existsSync(dirPath) &&
      (() => {
        try {
          return fs.readdirSync(dirPath).length > 0;
        } catch {
          return false;
        }
      })();
    if (dbExists) {
      const tmp = openDb(params.dbPath);
      const mismatch = hasAnyUserTables(tmp) && !isExpectedSchema(tmp);
      try {
        tmp.close();
      } catch {}

      if (mismatch) {
        if (!params.allowAutoWipe || !isDefaultMeridiaDir(dirPath)) {
          throw new Error(
            `Unsupported Meridia data detected in ${JSON.stringify(dirPath)}. ` +
              `Run: openclaw meridia reset --dir ${JSON.stringify(dirPath)} --force`,
          );
        }
        // eslint-disable-next-line no-console
        console.warn(
          `[meridia] Unsupported existing data detected in ${dirPath}; wiping and recreating.`,
        );
        wipeDir(dirPath);
      }
    } else if (dirHasFiles) {
      if (!params.allowAutoWipe || !isDefaultMeridiaDir(dirPath)) {
        throw new Error(
          `Unsupported Meridia data detected in ${JSON.stringify(dirPath)}. ` +
            `Run: openclaw meridia reset --dir ${JSON.stringify(dirPath)} --force`,
        );
      }
      // eslint-disable-next-line no-console
      console.warn(
        `[meridia] Unsupported existing data detected in ${dirPath}; wiping and recreating.`,
      );
      wipeDir(dirPath);
    }

    this.db = openDb(params.dbPath);
    const result = ensureSchema(this.db);
    this.ftsAvailable = result.ftsAvailable;
    this.schemaVersion = readSchemaVersion(this.db);
  }

  ensureSchema(): { ftsAvailable: boolean; ftsError?: string } {
    const res = ensureSchema(this.db);
    this.ftsAvailable = res.ftsAvailable;
    this.schemaVersion = readSchemaVersion(this.db);
    return res;
  }

  close(): void {
    try {
      this.db.close();
    } catch {
      // ignore
    }
  }

  insertExperienceRecord(record: MeridiaExperienceRecord): boolean {
    const dataJson = JSON.stringify(record);
    const dataText = buildSearchableText(record);
    const tagsJson = record.content?.tags?.length ? JSON.stringify(record.content.tags) : null;
    const evaluation = record.capture.evaluation;

    const result = this.db
      .prepare(`
        INSERT OR IGNORE INTO meridia_records
          (id, ts, kind, session_key, session_id, run_id, tool_name, tool_call_id, is_error,
           score, threshold, eval_kind, eval_model, eval_reason, tags_json, data_json, data_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        record.id,
        record.ts,
        record.kind,
        record.session?.key ?? null,
        record.session?.id ?? null,
        record.session?.runId ?? null,
        record.tool?.name ?? null,
        record.tool?.callId ?? null,
        record.tool?.isError ? 1 : 0,
        record.capture.score,
        record.capture.threshold ?? null,
        evaluation.kind,
        evaluation.model ?? null,
        evaluation.reason ?? null,
        tagsJson,
        dataJson,
        dataText,
      );

    const inserted = (result.changes ?? 0) > 0;
    if (inserted && this.ftsAvailable && tableExists(this.db, "meridia_records_fts")) {
      try {
        const row = this.db
          .prepare(`SELECT rowid FROM meridia_records WHERE id = ?`)
          .get(record.id) as { rowid: number } | undefined;
        if (row) {
          this.db
            .prepare(
              `INSERT INTO meridia_records_fts (rowid, tool_name, eval_reason, data_text) VALUES (?, ?, ?, ?)`,
            )
            .run(row.rowid, record.tool?.name ?? "", evaluation.reason ?? "", dataText);
        }
      } catch {
        // ignore
      }
    }

    return inserted;
  }

  insertExperienceRecordsBatch(records: MeridiaExperienceRecord[]): number {
    if (records.length === 0) {
      return 0;
    }
    this.db.exec("BEGIN");
    try {
      let inserted = 0;
      for (const record of records) {
        if (this.insertExperienceRecord(record)) {
          inserted++;
        }
      }
      this.db.exec("COMMIT");
      return inserted;
    } catch (err) {
      try {
        this.db.exec("ROLLBACK");
      } catch {}
      throw err;
    }
  }

  insertTraceEvent(event: MeridiaTraceEvent): boolean {
    const dataJson = JSON.stringify(event);
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO meridia_trace (id, ts, kind, session_key, data_json) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(event.id, event.ts, event.kind, event.session?.key ?? null, dataJson);
    return (result.changes ?? 0) > 0;
  }

  insertTraceEventsBatch(events: MeridiaTraceEvent[]): number {
    if (events.length === 0) {
      return 0;
    }
    this.db.exec("BEGIN");
    try {
      let inserted = 0;
      for (const event of events) {
        if (this.insertTraceEvent(event)) {
          inserted++;
        }
      }
      this.db.exec("COMMIT");
      return inserted;
    } catch (err) {
      try {
        this.db.exec("ROLLBACK");
      } catch {}
      throw err;
    }
  }

  getRecordById(id: string): RecordQueryResult | null {
    const row = this.db
      .prepare(`SELECT data_json FROM meridia_records WHERE id = ?`)
      .get(id) as { data_json?: string } | undefined;
    if (!row?.data_json) {
      return null;
    }
    return { record: parseRecordJson(row.data_json) };
  }

  searchRecords(query: string, filters?: RecordQueryFilters): RecordQueryResult[] {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    const limit = Math.min(Math.max(filters?.limit ?? 20, 1), 100);
    const { where, params } = applyFilters(filters);
    const hasFts = this.ftsAvailable && tableExists(this.db, "meridia_records_fts");

    if (hasFts) {
      const rows = this.db
        .prepare(
          `
          SELECT r.data_json AS data_json, bm25(meridia_records_fts) AS rank
          FROM meridia_records_fts
          JOIN meridia_records r ON meridia_records_fts.rowid = r.rowid
          ${where ? `${where} AND meridia_records_fts MATCH ?` : "WHERE meridia_records_fts MATCH ?"}
          ORDER BY rank ASC
          LIMIT ${limit}
        `,
        )
        .all(...params, trimmed) as Array<{ data_json: string; rank: number }>;

      return rows.map((row) => ({ record: parseRecordJson(row.data_json), rank: row.rank }));
    }

    const like = `%${trimmed}%`;
    const rows = this.db
      .prepare(
        `
        SELECT r.data_json AS data_json
        FROM meridia_records r
        ${where ? `${where} AND (r.data_text LIKE ? OR r.eval_reason LIKE ?)` : "WHERE (r.data_text LIKE ? OR r.eval_reason LIKE ?)"}
        ORDER BY r.ts DESC
        LIMIT ${limit}
      `,
      )
      .all(...params, like, like) as Array<{ data_json: string }>;
    return rows.map((row) => ({ record: parseRecordJson(row.data_json) }));
  }

  getRecordsByDateRange(from: string, to: string, filters?: RecordQueryFilters): RecordQueryResult[] {
    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 500);
    const merged: RecordQueryFilters = { ...filters, from, to, limit };
    const { where, params } = applyFilters(merged);
    const rows = this.db
      .prepare(
        `
        SELECT r.data_json AS data_json
        FROM meridia_records r
        ${where}
        ORDER BY r.ts DESC
        LIMIT ${limit}
      `,
      )
      .all(...params) as Array<{ data_json: string }>;
    return rows.map((row) => ({ record: parseRecordJson(row.data_json) }));
  }

  getRecordsBySession(sessionKey: string, params?: { limit?: number }): RecordQueryResult[] {
    const limit = Math.min(Math.max(params?.limit ?? 200, 1), 500);
    const rows = this.db
      .prepare(
        `
        SELECT r.data_json AS data_json
        FROM meridia_records r
        WHERE r.session_key = ?
        ORDER BY r.ts DESC
        LIMIT ${limit}
      `,
      )
      .all(sessionKey) as Array<{ data_json: string }>;
    return rows.map((row) => ({ record: parseRecordJson(row.data_json) }));
  }

  getRecordsByTool(toolName: string, params?: { limit?: number }): RecordQueryResult[] {
    const limit = Math.min(Math.max(params?.limit ?? 200, 1), 500);
    const rows = this.db
      .prepare(
        `
        SELECT r.data_json AS data_json
        FROM meridia_records r
        WHERE r.tool_name = ?
        ORDER BY r.ts DESC
        LIMIT ${limit}
      `,
      )
      .all(toolName) as Array<{ data_json: string }>;
    return rows.map((row) => ({ record: parseRecordJson(row.data_json) }));
  }

  getRecentRecords(limit: number = 20, filters?: Omit<RecordQueryFilters, "limit">): RecordQueryResult[] {
    const resolved = Math.min(Math.max(limit, 1), 200);
    const { where, params } = applyFilters({ ...filters, limit: resolved });
    const rows = this.db
      .prepare(
        `
        SELECT r.data_json AS data_json
        FROM meridia_records r
        ${where}
        ORDER BY r.ts DESC
        LIMIT ${resolved}
      `,
      )
      .all(...params) as Array<{ data_json: string }>;
    return rows.map((row) => ({ record: parseRecordJson(row.data_json) }));
  }

  getTraceEventsByDateRange(from: string, to: string, params?: { kind?: string; limit?: number }): MeridiaTraceEvent[] {
    const limit = Math.min(Math.max(params?.limit ?? 2000, 1), 50_000);
    const kind = params?.kind?.trim();
    const rows = kind
      ? (this.db
          .prepare(
            `
            SELECT data_json
            FROM meridia_trace
            WHERE ts >= ? AND ts <= ? AND kind = ?
            ORDER BY ts DESC
            LIMIT ${limit}
          `,
          )
          .all(from, to, kind) as Array<{ data_json: string }>)
      : (this.db
          .prepare(
            `
            SELECT data_json
            FROM meridia_trace
            WHERE ts >= ? AND ts <= ?
            ORDER BY ts DESC
            LIMIT ${limit}
          `,
          )
          .all(from, to) as Array<{ data_json: string }>);
    return rows.map((row) => parseTraceJson(row.data_json));
  }

  getStats(): MeridiaDbStats {
    const recordCount = (
      this.db.prepare(`SELECT COUNT(*) AS cnt FROM meridia_records`).get() as { cnt: number }
    ).cnt;
    const traceCount = (
      this.db.prepare(`SELECT COUNT(*) AS cnt FROM meridia_trace`).get() as { cnt: number }
    ).cnt;
    const sessionCount = (
      this.db
        .prepare(`SELECT COUNT(DISTINCT session_key) AS cnt FROM meridia_records WHERE session_key IS NOT NULL`)
        .get() as { cnt: number }
    ).cnt;
    const oldest = this.db.prepare(`SELECT MIN(ts) AS ts FROM meridia_records`).get() as {
      ts: string | null;
    };
    const newest = this.db.prepare(`SELECT MAX(ts) AS ts FROM meridia_records`).get() as {
      ts: string | null;
    };
    return {
      recordCount,
      traceCount,
      sessionCount,
      oldestRecord: oldest.ts,
      newestRecord: newest.ts,
      schemaVersion: this.schemaVersion,
    };
  }

  getToolStats(): MeridiaToolStatsItem[] {
    const rows = this.db
      .prepare(`
        SELECT
          tool_name,
          COUNT(*) as cnt,
          AVG(score) as avg_score,
          SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) as error_count,
          MAX(ts) as last_used
        FROM meridia_records
        WHERE tool_name IS NOT NULL
        GROUP BY tool_name
        ORDER BY cnt DESC
      `)
      .all() as Array<{
      tool_name: string;
      cnt: number;
      avg_score: number | null;
      error_count: number;
      last_used: string;
    }>;

    return rows.map((row) => ({
      toolName: row.tool_name,
      count: row.cnt,
      avgScore: row.avg_score ?? 0,
      errorCount: row.error_count,
      lastUsed: row.last_used,
    }));
  }

  listSessions(params?: { limit?: number; offset?: number }): MeridiaSessionListItem[] {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const rows = this.db
      .prepare(
        `
        SELECT
          session_key,
          COUNT(*) as record_count,
          MIN(ts) as first_ts,
          MAX(ts) as last_ts
        FROM meridia_records
        WHERE session_key IS NOT NULL
        GROUP BY session_key
        ORDER BY MAX(ts) DESC
        LIMIT ? OFFSET ?
      `,
      )
      .all(limit, offset) as Array<{
      session_key: string;
      record_count: number;
      first_ts: string | null;
      last_ts: string | null;
    }>;
    return rows.map((row) => ({
      sessionKey: row.session_key,
      recordCount: row.record_count,
      firstTs: row.first_ts,
      lastTs: row.last_ts,
    }));
  }

  getSessionSummary(sessionKey: string): MeridiaSessionSummary | null {
    const recordCount = (
      this.db
        .prepare(`SELECT COUNT(*) as cnt FROM meridia_records WHERE session_key = ?`)
        .get(sessionKey) as { cnt: number }
    ).cnt;

    if (recordCount === 0) {
      return null;
    }

    const firstRecord = this.db
      .prepare(`SELECT ts FROM meridia_records WHERE session_key = ? ORDER BY ts ASC LIMIT 1`)
      .get(sessionKey) as { ts: string } | undefined;
    const lastRecord = this.db
      .prepare(`SELECT ts FROM meridia_records WHERE session_key = ? ORDER BY ts DESC LIMIT 1`)
      .get(sessionKey) as { ts: string } | undefined;
    const toolRows = this.db
      .prepare(`SELECT DISTINCT tool_name FROM meridia_records WHERE session_key = ? AND tool_name IS NOT NULL`)
      .all(sessionKey) as Array<{ tool_name: string }>;

    return {
      sessionKey,
      startedAt: firstRecord?.ts ?? null,
      endedAt: lastRecord?.ts ?? null,
      toolsUsed: toolRows.map((r) => r.tool_name).filter(Boolean),
      recordCount,
    };
  }

  getMeta(key: string): string | null {
    try {
      const row = this.db
        .prepare(`SELECT value FROM meridia_meta WHERE key = ?`)
        .get(key) as { value?: string } | undefined;
      return typeof row?.value === "string" ? row.value : null;
    } catch {
      return null;
    }
  }

  setMeta(key: string, value: string): void {
    this.db.prepare(`INSERT OR REPLACE INTO meridia_meta (key, value) VALUES (?, ?)`).run(key, value);
  }
}

export function createSqliteBackend(params: { cfg?: OpenClawConfig; hookKey?: string; dbPath: string }): SqliteBackend {
  const meridiaDir = path.dirname(params.dbPath);
  const allowAutoWipe = isDefaultMeridiaDir(meridiaDir);
  return new SqliteBackend({
    dbPath: params.dbPath,
    cfg: params.cfg,
    hookKey: params.hookKey,
    allowAutoWipe,
  });
}

export function resolveMeridiaDbPath(params?: { cfg?: OpenClawConfig; hookKey?: string; dbPathOverride?: string }): string {
  if (params?.dbPathOverride) {
    return params.dbPathOverride;
  }
  const meridiaDir = resolveMeridiaDir(params?.cfg, params?.hookKey);
  return path.join(meridiaDir, "meridia.sqlite");
}
