import type { MeridiaExperienceRecord, MeridiaTraceEvent } from "../types.js";

export type RecordQueryFilters = {
  sessionKey?: string;
  toolName?: string;
  minScore?: number;
  from?: string;
  to?: string;
  limit?: number;
  tag?: string;
};

export type RecordQueryResult = {
  record: MeridiaExperienceRecord;
  rank?: number;
};

export type MeridiaDbStats = {
  recordCount: number;
  traceCount: number;
  sessionCount: number;
  oldestRecord: string | null;
  newestRecord: string | null;
  schemaVersion: string | null;
};

export type MeridiaToolStatsItem = {
  toolName: string;
  count: number;
  avgScore: number;
  errorCount: number;
  lastUsed: string;
};

export type MeridiaSessionListItem = {
  sessionKey: string;
  recordCount: number;
  firstTs: string | null;
  lastTs: string | null;
};

export type MeridiaSessionSummary = {
  sessionKey: string;
  startedAt: string | null;
  endedAt: string | null;
  toolsUsed: string[];
  recordCount: number;
};

export interface MeridiaDbBackend {
  ensureSchema(): { ftsAvailable: boolean; ftsError?: string };
  close(): void;

  insertExperienceRecord(record: MeridiaExperienceRecord): boolean;
  insertExperienceRecordsBatch(records: MeridiaExperienceRecord[]): number;

  insertTraceEvent(event: MeridiaTraceEvent): boolean;
  insertTraceEventsBatch(events: MeridiaTraceEvent[]): number;

  getRecordById(id: string): RecordQueryResult | null;

  searchRecords(query: string, filters?: RecordQueryFilters): RecordQueryResult[];
  getRecordsByDateRange(from: string, to: string, filters?: RecordQueryFilters): RecordQueryResult[];
  getRecordsBySession(
    sessionKey: string,
    params?: { limit?: number },
  ): RecordQueryResult[];
  getRecordsByTool(toolName: string, params?: { limit?: number }): RecordQueryResult[];
  getRecentRecords(limit?: number, filters?: Omit<RecordQueryFilters, "limit">): RecordQueryResult[];

  getTraceEventsByDateRange(
    from: string,
    to: string,
    params?: { kind?: string; limit?: number },
  ): MeridiaTraceEvent[];

  getStats(): MeridiaDbStats;
  getToolStats(): MeridiaToolStatsItem[];
  listSessions(params?: { limit?: number; offset?: number }): MeridiaSessionListItem[];
  getSessionSummary(sessionKey: string): MeridiaSessionSummary | null;

  getMeta(key: string): string | null;
  setMeta(key: string, value: string): void;
}

