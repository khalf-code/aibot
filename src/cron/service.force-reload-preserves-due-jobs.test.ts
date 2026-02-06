import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CronService } from "./service.js";

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

async function makeStorePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cron-"));
  return {
    storePath: path.join(dir, "cron", "jobs.json"),
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

describe("CronService force-reload preserves due jobs", () => {
  const cleanups: Array<() => Promise<void>> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-06T00:00:00.000Z"));
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  afterEach(async () => {
    vi.useRealTimers();
    for (const cleanup of cleanups) {
      await cleanup().catch(() => {});
    }
    cleanups.length = 0;
  });

  it("does not skip an isolated job when the timer fires", async () => {
    // Regression test: recomputeNextRuns during force-reload was advancing
    // due jobs past their nextRunAtMs before runDueJobs could see them.
    const store = await makeStorePath();
    cleanups.push(store.cleanup);

    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();
    const runIsolatedAgentJob = vi.fn(async () => ({
      status: "ok" as const,
      summary: "standup done",
    }));

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob,
    });

    await cron.start();

    const atMs = Date.parse("2026-02-06T00:00:01.000Z");
    await cron.add({
      name: "daily standup",
      enabled: true,
      schedule: { kind: "at", at: new Date(atMs).toISOString() },
      sessionTarget: "isolated",
      wakeMode: "now",
      payload: { kind: "agentTurn", message: "generate standup" },
      delivery: { mode: "announce" },
    });

    vi.setSystemTime(new Date("2026-02-06T00:00:01.000Z"));
    await vi.runOnlyPendingTimersAsync();

    await cron.list({ includeDisabled: true });
    // The job MUST have been executed, not silently skipped.
    expect(runIsolatedAgentJob).toHaveBeenCalledTimes(1);
    expect(enqueueSystemEvent).toHaveBeenCalledWith("Cron: standup done", {
      agentId: undefined,
    });
    expect(requestHeartbeatNow).toHaveBeenCalled();

    cron.stop();
  });

  it("executes due jobs after store force-reload via manual run", async () => {
    const store = await makeStorePath();
    cleanups.push(store.cleanup);

    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();
    const runIsolatedAgentJob = vi.fn(async () => ({
      status: "ok" as const,
      summary: "email checked",
    }));

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob,
    });

    await cron.start();

    const job = await cron.add({
      name: "email check",
      enabled: true,
      schedule: { kind: "every", everyMs: 30 * 60 * 1000 },
      sessionTarget: "isolated",
      wakeMode: "now",
      payload: { kind: "agentTurn", message: "check email" },
      delivery: { mode: "none" },
    });

    await cron.run(job.id, "force");

    expect(runIsolatedAgentJob).toHaveBeenCalledTimes(1);
    expect(runIsolatedAgentJob).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "check email",
      }),
    );

    const jobs = await cron.list();
    const updated = jobs.find((j) => j.id === job.id);
    expect(updated).toBeDefined();
    expect(updated!.state.lastStatus).toBe("ok");
    expect(updated!.state.nextRunAtMs).toBeGreaterThan(Date.now());

    cron.stop();
  });

  it("allows recompute for due jobs when schedule was edited on disk", async () => {
    // Greptile review: if a due job's schedule was changed in the store file
    // (e.g. by another process), the force-reload skipDue logic should detect
    // the schedule mismatch and allow recomputation instead of preserving the
    // stale nextRunAtMs.
    //
    // We test this by writing a modified store file directly (simulating a
    // cross-service edit), then triggering force-reload via the timer path.
    const store = await makeStorePath();
    cleanups.push(store.cleanup);

    const enqueueSystemEvent = vi.fn();
    const requestHeartbeatNow = vi.fn();
    const runIsolatedAgentJob = vi.fn(async () => ({
      status: "ok" as const,
      summary: "ran",
    }));

    const cron = new CronService({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent,
      requestHeartbeatNow,
      runIsolatedAgentJob,
    });

    await cron.start();

    // Add a job at 00:05 UTC. The cron service is at midnight, so
    // nextRunAtMs = 00:05.
    const job = await cron.add({
      name: "schedule-change test",
      enabled: true,
      schedule: { kind: "cron", expr: "5 0 * * *", tz: "UTC" },
      sessionTarget: "isolated",
      wakeMode: "now",
      payload: { kind: "agentTurn", message: "do work" },
      delivery: { mode: "none" },
    });

    const initial = await cron.list();
    const initialJob = initial.find((j) => j.id === job.id)!;
    expect(initialJob.state.nextRunAtMs).toBe(Date.parse("2026-02-06T00:05:00.000Z"));

    // Now directly edit the store file to change the schedule to 02:00 UTC,
    // simulating a cross-service edit. We read, patch, and write.
    const storeData = JSON.parse(await fs.readFile(store.storePath, "utf-8"));
    const storedJob = storeData.jobs.find((j: { id: string }) => j.id === job.id);
    storedJob.schedule = { kind: "cron", expr: "0 2 * * *", tz: "UTC" };
    await fs.writeFile(store.storePath, JSON.stringify(storeData));

    // Advance time past 00:05 so the job would be due under the OLD schedule.
    vi.setSystemTime(new Date("2026-02-06T00:05:01.000Z"));

    // Let the timer fire — force-reload reads the edited file.
    await vi.runOnlyPendingTimersAsync();

    // The job should NOT have run — the new schedule says 02:00, not 00:05.
    // The skipDue logic should detect the schedule mismatch and recompute.
    const jobs = await cron.list();
    const updated = jobs.find((j) => j.id === job.id);
    expect(updated).toBeDefined();
    // nextRunAtMs should reflect the new 02:00 UTC schedule.
    expect(updated!.state.nextRunAtMs).toBe(Date.parse("2026-02-06T02:00:00.000Z"));
    // The job should not have executed since the schedule changed.
    expect(runIsolatedAgentJob).not.toHaveBeenCalled();

    cron.stop();
  });
});
