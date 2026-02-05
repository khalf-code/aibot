import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { resolveConfigPath, resolveStateDir } from "../config/paths.js";
import { getAgentRunContext, onAgentEvent } from "./agent-events.js";

const DEFAULT_TTL_SECONDS = 30 * 60;
const MIN_TTL_SECONDS = 30;
const MAX_TTL_SECONDS = 7 * 24 * 60 * 60;

export type DisruptiveOperationLease = {
  id: string;
  sessionKey: string;
  note?: string;
  createdAt: string;
  expiresAt: string;
  pid?: number;
  host?: string;
};

type LockFile = {
  version: 1;
  leases: DisruptiveOperationLease[];
};

export type DisruptiveOperationLockListResult = {
  path: string;
  leases: DisruptiveOperationLease[];
  now: string;
};

export type DisruptiveOperationAcquireParams = {
  sessionKey: string;
  note?: string;
  ttlSeconds?: number;
  env?: NodeJS.ProcessEnv;
  host?: string;
  pid?: number;
};

export type DisruptiveOperationReleaseParams = {
  id: string;
  env?: NodeJS.ProcessEnv;
};

export type DisruptiveOperationLockGuardParams = {
  operation: string;
  subjectSessionKey?: string;
  env?: NodeJS.ProcessEnv;
  force?: boolean;
  forceReason?: string;
  ignoreSessionKeys?: string[];
  /**
   * Optional callback used for incident trail snapshots.
   * Keep this fast and local (no network calls).
   */
  snapshot?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
};

export class DisruptiveOperationLockedError extends Error {
  constructor(
    message: string,
    public readonly leases: DisruptiveOperationLease[],
  ) {
    super(message);
    this.name = "DisruptiveOperationLockedError";
  }
}

type RunLeaseEntry = {
  runId: string;
  sessionKey: string;
  leaseId: string;
};

const activeRunLeases = new Map<string, RunLeaseEntry>();
let runLeaseTrackingStarted = false;

function clampTtlSeconds(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return DEFAULT_TTL_SECONDS;
  const seconds = Math.floor(raw);
  if (seconds < MIN_TTL_SECONDS) return MIN_TTL_SECONDS;
  if (seconds > MAX_TTL_SECONDS) return MAX_TTL_SECONDS;
  return seconds;
}

function resolveLockPath(env: NodeJS.ProcessEnv): string {
  const stateDir = resolveStateDir(env);
  const configPath = resolveConfigPath(env, stateDir);
  const hash = createHash("sha1").update(configPath).digest("hex").slice(0, 8);
  return path.join(stateDir, "locks", `disruptive-ops.${hash}.json`);
}

async function withMutex<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  const dir = path.dirname(lockPath);
  await fs.mkdir(dir, { recursive: true });
  const mutexPath = `${lockPath}.mutex`;
  const started = Date.now();
  const timeoutMs = 1500;
  while (true) {
    try {
      const handle = await fs.open(mutexPath, "wx");
      try {
        return await fn();
      } finally {
        await handle.close().catch(() => undefined);
        await fs.rm(mutexPath, { force: true }).catch(() => undefined);
      }
    } catch (err) {
      const code = (err as { code?: unknown }).code;
      if (code !== "EEXIST") throw err;
      if (Date.now() - started > timeoutMs) {
        // Best-effort recovery: if the mutex is stale (crash), remove it.
        try {
          const st = await fs.stat(mutexPath);
          if (Date.now() - st.mtimeMs > timeoutMs) {
            await fs.rm(mutexPath, { force: true });
            continue;
          }
        } catch {
          // ignore
        }
        throw new Error(`disruptive lock mutex busy: ${mutexPath}`);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

function parseLockFile(raw: string): LockFile {
  const parsed = JSON.parse(raw) as Partial<LockFile>;
  const leases = Array.isArray(parsed.leases) ? (parsed.leases as DisruptiveOperationLease[]) : [];
  return {
    version: 1,
    leases: leases.filter(
      (lease) =>
        lease &&
        typeof lease === "object" &&
        typeof (lease as DisruptiveOperationLease).id === "string" &&
        typeof (lease as DisruptiveOperationLease).sessionKey === "string" &&
        typeof (lease as DisruptiveOperationLease).createdAt === "string" &&
        typeof (lease as DisruptiveOperationLease).expiresAt === "string",
    ),
  };
}

async function readLockFile(lockPath: string): Promise<LockFile> {
  try {
    const raw = await fs.readFile(lockPath, "utf8");
    return parseLockFile(raw);
  } catch {
    return { version: 1, leases: [] };
  }
}

async function writeLockFile(lockPath: string, payload: LockFile): Promise<void> {
  const tmp = `${lockPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
  await fs.rename(tmp, lockPath);
}

function isLeaseActive(lease: DisruptiveOperationLease, nowMs: number): boolean {
  const expires = Date.parse(lease.expiresAt);
  if (!Number.isFinite(expires)) return false;
  return expires > nowMs;
}

async function appendIncident(
  env: NodeJS.ProcessEnv,
  entry: Record<string, unknown>,
): Promise<void> {
  const stateDir = resolveStateDir(env);
  const incidentsDir = path.join(stateDir, "incidents");
  await fs.mkdir(incidentsDir, { recursive: true });
  const outPath = path.join(incidentsDir, "disruptive-ops.jsonl");
  const line = JSON.stringify(entry);
  await fs.appendFile(outPath, `${line}\n`, "utf8");
}

export async function listDisruptiveOperationLeases(
  env: NodeJS.ProcessEnv = process.env,
): Promise<DisruptiveOperationLockListResult> {
  const lockPath = resolveLockPath(env);
  const nowMs = Date.now();
  const result = await withMutex(lockPath, async () => {
    const current = await readLockFile(lockPath);
    const active = current.leases.filter((lease) => isLeaseActive(lease, nowMs));
    if (active.length !== current.leases.length) {
      await writeLockFile(lockPath, { version: 1, leases: active });
    }
    return active;
  });
  return {
    path: lockPath,
    leases: result,
    now: new Date(nowMs).toISOString(),
  };
}

export async function acquireDisruptiveOperationLease(
  params: DisruptiveOperationAcquireParams,
): Promise<DisruptiveOperationLease & { path: string }> {
  const env = params.env ?? process.env;
  const sessionKey = params.sessionKey.trim();
  if (!sessionKey) {
    throw new Error("sessionKey required");
  }
  const lockPath = resolveLockPath(env);
  const ttlSeconds = clampTtlSeconds(params.ttlSeconds);
  const nowMs = Date.now();
  const lease: DisruptiveOperationLease = {
    id: randomUUID(),
    sessionKey,
    note: params.note?.trim() || undefined,
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + ttlSeconds * 1000).toISOString(),
    pid: typeof params.pid === "number" ? params.pid : process.pid,
    host: params.host?.trim() || undefined,
  };

  await withMutex(lockPath, async () => {
    const current = await readLockFile(lockPath);
    const active = current.leases.filter((l) => isLeaseActive(l, nowMs));
    active.push(lease);
    await writeLockFile(lockPath, { version: 1, leases: active });
  });

  await appendIncident(env, {
    ts: lease.createdAt,
    action: "acquire",
    operation: "disruptive-lock.acquire",
    lease,
  }).catch(() => undefined);

  return { ...lease, path: lockPath };
}

export async function releaseDisruptiveOperationLease(
  params: DisruptiveOperationReleaseParams,
): Promise<{ ok: true; path: string; released: boolean }> {
  const env = params.env ?? process.env;
  const id = params.id.trim();
  if (!id) throw new Error("id required");
  const lockPath = resolveLockPath(env);
  const nowMs = Date.now();
  let released = false;
  await withMutex(lockPath, async () => {
    const current = await readLockFile(lockPath);
    const active = current.leases.filter((l) => isLeaseActive(l, nowMs));
    const next = active.filter((l) => l.id !== id);
    released = next.length !== active.length;
    if (released || next.length !== current.leases.length) {
      await writeLockFile(lockPath, { version: 1, leases: next });
    }
  });

  await appendIncident(env, {
    ts: new Date().toISOString(),
    action: "release",
    operation: "disruptive-lock.release",
    id,
    released,
  }).catch(() => undefined);

  return { ok: true, path: lockPath, released };
}

export async function guardDisruptiveOperation(
  params: DisruptiveOperationLockGuardParams,
): Promise<{ ok: true; leases: DisruptiveOperationLease[]; path: string }> {
  const env = params.env ?? process.env;
  const lockPath = resolveLockPath(env);
  const nowMs = Date.now();
  const list = await listDisruptiveOperationLeases(env);
  const ignore = new Set<string>(["agent:main:main"]);
  if (params.subjectSessionKey) ignore.add(params.subjectSessionKey);
  for (const key of params.ignoreSessionKeys ?? []) {
    if (typeof key === "string" && key.trim()) ignore.add(key.trim());
  }
  const blocking = list.leases.filter((lease) => !ignore.has(lease.sessionKey));
  if (blocking.length === 0) {
    return { ok: true, leases: [], path: lockPath };
  }

  const force = params.force === true;
  const forceReason = typeof params.forceReason === "string" ? params.forceReason.trim() : "";
  const snapshot = params.snapshot ? await params.snapshot() : undefined;

  await appendIncident(env, {
    ts: new Date(nowMs).toISOString(),
    action: force ? "force" : "blocked",
    operation: params.operation,
    subjectSessionKey: params.subjectSessionKey ?? null,
    leases: blocking,
    force: force,
    forceReason: forceReason || null,
    snapshot: snapshot ?? null,
  }).catch(() => undefined);

  if (!force) {
    const summary = blocking
      .map((lease) => `${lease.sessionKey}${lease.note ? ` (${lease.note})` : ""}`)
      .join(", ");
    throw new DisruptiveOperationLockedError(
      `Operation blocked by disruptive-operation lock. Active leases: ${summary}. ` +
        `Re-run with { force: true, forceReason: "..." } if you must proceed.`,
      blocking,
    );
  }
  if (!forceReason) {
    throw new Error("forceReason required when force=true");
  }
  return { ok: true, leases: blocking, path: lockPath };
}

export function startDisruptiveOperationRunLeaseTracking(opts?: {
  env?: NodeJS.ProcessEnv;
  log?: { warn: (message: string) => void };
}) {
  if (runLeaseTrackingStarted) return;
  runLeaseTrackingStarted = true;
  const env = opts?.env ?? process.env;
  const log = opts?.log;

  onAgentEvent((evt) => {
    if (!evt || evt.stream !== "lifecycle") return;
    const runContext = getAgentRunContext(evt.runId);
    if (runContext?.isHeartbeat) return;
    const phase = evt.data?.phase;
    if (phase === "start") {
      const sessionKey = typeof evt.sessionKey === "string" ? evt.sessionKey.trim() : "";
      if (!sessionKey || activeRunLeases.has(evt.runId)) return;
      void acquireDisruptiveOperationLease({
        env,
        sessionKey,
        note: `agent-run:${evt.runId}`,
      })
        .then((lease) => {
          activeRunLeases.set(evt.runId, {
            runId: evt.runId,
            sessionKey,
            leaseId: lease.id,
          });
        })
        .catch((err) => {
          log?.warn?.(
            `disruptive-lock: failed to acquire lease for run ${evt.runId}: ${String(err)}`,
          );
        });
      return;
    }

    if (phase !== "end" && phase !== "error") return;
    const lease = activeRunLeases.get(evt.runId);
    if (!lease) return;
    activeRunLeases.delete(evt.runId);
    void releaseDisruptiveOperationLease({ env, id: lease.leaseId }).catch((err) => {
      log?.warn?.(
        `disruptive-lock: failed to release lease ${lease.leaseId} for run ${evt.runId}: ${String(
          err,
        )}`,
      );
    });
  });
}
