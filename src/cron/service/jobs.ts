import crypto from "node:crypto";
import type {
  CronDelivery,
  CronDeliveryPatch,
  CronJob,
  CronJobCreate,
  CronJobPatch,
  CronPayload,
  CronPayloadPatch,
} from "../types.js";
import type { CronServiceState } from "./state.js";
import { parseAbsoluteTimeMs } from "../parse.js";
import { computeNextRunAtMs } from "../schedule.js";
import {
  normalizeOptionalAgentId,
  normalizeOptionalText,
  normalizePayloadToSystemText,
  normalizeRequiredName,
} from "./normalize.js";

const STUCK_RUN_MS = 2 * 60 * 60 * 1000;

export function assertSupportedJobSpec(job: Pick<CronJob, "sessionTarget" | "payload">) {
  if (job.sessionTarget === "main" && job.payload.kind !== "systemEvent") {
    throw new Error('main cron jobs require payload.kind="systemEvent"');
  }
  if (job.sessionTarget === "isolated" && job.payload.kind !== "agentTurn") {
    throw new Error('isolated cron jobs require payload.kind="agentTurn"');
  }
}

function assertDeliverySupport(job: Pick<CronJob, "sessionTarget" | "delivery">) {
  if (job.delivery && job.sessionTarget !== "isolated") {
    throw new Error('cron delivery config is only supported for sessionTarget="isolated"');
  }
}

export function findJobOrThrow(state: CronServiceState, id: string) {
  const job = state.store?.jobs.find((j) => j.id === id);
  if (!job) {
    throw new Error(`unknown cron job id: ${id}`);
  }
  return job;
}

export function computeJobNextRunAtMs(job: CronJob, nowMs: number): number | undefined {
  if (!job.enabled) {
    return undefined;
  }
  if (job.schedule.kind === "at") {
    // One-shot jobs stay due until they successfully finish.
    if (job.state.lastStatus === "ok" && job.state.lastRunAtMs) {
      return undefined;
    }
    const atMs = parseAbsoluteTimeMs(job.schedule.at);
    return atMs !== null ? atMs : undefined;
  }
  return computeNextRunAtMs(job.schedule, nowMs);
}

function computeExpectedNextRunAtMsForStoredDueTime(
  job: CronJob,
  storedNextRunAtMs: number,
): number | undefined {
  // When a job is due (storedNextRunAtMs <= now), recomputing at "now" usually advances it
  // into the future. That's correct for schedule edits, but wrong for unchanged schedules
  // because it can skip the due run.
  //
  // We detect schedule edits by checking whether the *current* schedule would have produced
  // the stored due time in the first place.
  //
  // For cron + anchored every schedules, computing from just before the due time should
  // reproduce it.
  //
  // For non-anchored "every" schedules (anchorMs omitted), the schedule is effectively
  // relative to the compute time. We approximate the original compute time as
  // (storedNextRunAtMs - everyMs) or, if available, lastRunAtMs (which is what executeJob
  // uses when it recomputes after a run).
  if (job.schedule.kind === "every" && typeof job.schedule.anchorMs !== "number") {
    const everyMs = Math.max(1, Math.floor(job.schedule.everyMs));
    const refNow =
      typeof job.state.lastRunAtMs === "number"
        ? job.state.lastRunAtMs
        : Math.max(0, storedNextRunAtMs - everyMs);
    return computeJobNextRunAtMs(job, refNow);
  }

  return computeJobNextRunAtMs(job, storedNextRunAtMs - 1);
}

export function recomputeNextRuns(state: CronServiceState, opts?: { skipDue?: boolean }) {
  if (!state.store) {
    return;
  }
  const now = state.deps.nowMs();
  for (const job of state.store.jobs) {
    if (!job.state) {
      job.state = {};
    }
    if (!job.enabled) {
      job.state.nextRunAtMs = undefined;
      job.state.runningAtMs = undefined;
      continue;
    }
    const runningAt = job.state.runningAtMs;
    if (typeof runningAt === "number" && now - runningAt > STUCK_RUN_MS) {
      state.deps.log.warn(
        { jobId: job.id, runningAtMs: runningAt },
        "cron: clearing stuck running marker",
      );
      job.state.runningAtMs = undefined;
    }
    // When skipDue is set (force-reload from the timer path), don't
    // recompute jobs that are currently due — runDueJobs needs to see
    // them with their original nextRunAtMs so they actually execute.
    //
    // However, if the on-disk schedule was edited while a job is due, we *must*
    // allow recomputation so the due-ness doesn't get stuck on the stale schedule.
    if (opts?.skipDue) {
      const storedNext = job.state.nextRunAtMs;
      if (typeof storedNext === "number" && now >= storedNext) {
        const expected = computeExpectedNextRunAtMsForStoredDueTime(job, storedNext);
        const recomputedNow = computeJobNextRunAtMs(job, now);

        // If the current schedule still matches the stored due time, only skip recompute
        // when it would advance the job beyond that due time.
        if (
          expected === storedNext &&
          typeof recomputedNow === "number" &&
          recomputedNow > storedNext
        ) {
          continue;
        }

        job.state.nextRunAtMs = recomputedNow;
        continue;
      }
    }

    job.state.nextRunAtMs = computeJobNextRunAtMs(job, now);
  }
}

export function nextWakeAtMs(state: CronServiceState) {
  const jobs = state.store?.jobs ?? [];
  const enabled = jobs.filter((j) => j.enabled && typeof j.state.nextRunAtMs === "number");
  if (enabled.length === 0) {
    return undefined;
  }
  return enabled.reduce(
    (min, j) => Math.min(min, j.state.nextRunAtMs as number),
    enabled[0].state.nextRunAtMs as number,
  );
}

export function createJob(state: CronServiceState, input: CronJobCreate): CronJob {
  const now = state.deps.nowMs();
  const id = crypto.randomUUID();
  const deleteAfterRun =
    typeof input.deleteAfterRun === "boolean"
      ? input.deleteAfterRun
      : input.schedule.kind === "at"
        ? true
        : undefined;
  const enabled = typeof input.enabled === "boolean" ? input.enabled : true;
  const job: CronJob = {
    id,
    agentId: normalizeOptionalAgentId(input.agentId),
    name: normalizeRequiredName(input.name),
    description: normalizeOptionalText(input.description),
    enabled,
    deleteAfterRun,
    createdAtMs: now,
    updatedAtMs: now,
    schedule: input.schedule,
    sessionTarget: input.sessionTarget,
    wakeMode: input.wakeMode,
    payload: input.payload,
    delivery: input.delivery,
    state: {
      ...input.state,
    },
  };
  assertSupportedJobSpec(job);
  assertDeliverySupport(job);
  job.state.nextRunAtMs = computeJobNextRunAtMs(job, now);
  return job;
}

export function applyJobPatch(job: CronJob, patch: CronJobPatch) {
  if ("name" in patch) {
    job.name = normalizeRequiredName(patch.name);
  }
  if ("description" in patch) {
    job.description = normalizeOptionalText(patch.description);
  }
  if (typeof patch.enabled === "boolean") {
    job.enabled = patch.enabled;
  }
  if (typeof patch.deleteAfterRun === "boolean") {
    job.deleteAfterRun = patch.deleteAfterRun;
  }
  if (patch.schedule) {
    job.schedule = patch.schedule;
  }
  if (patch.sessionTarget) {
    job.sessionTarget = patch.sessionTarget;
  }
  if (patch.wakeMode) {
    job.wakeMode = patch.wakeMode;
  }
  if (patch.payload) {
    job.payload = mergeCronPayload(job.payload, patch.payload);
  }
  if (!patch.delivery && patch.payload?.kind === "agentTurn") {
    // Back-compat: legacy clients still update delivery via payload fields.
    const legacyDeliveryPatch = buildLegacyDeliveryPatch(patch.payload);
    if (
      legacyDeliveryPatch &&
      job.sessionTarget === "isolated" &&
      job.payload.kind === "agentTurn"
    ) {
      job.delivery = mergeCronDelivery(job.delivery, legacyDeliveryPatch);
    }
  }
  if (patch.delivery) {
    job.delivery = mergeCronDelivery(job.delivery, patch.delivery);
  }
  if (job.sessionTarget === "main" && job.delivery) {
    job.delivery = undefined;
  }
  if (patch.state) {
    job.state = { ...job.state, ...patch.state };
  }
  if ("agentId" in patch) {
    job.agentId = normalizeOptionalAgentId((patch as { agentId?: unknown }).agentId);
  }
  assertSupportedJobSpec(job);
  assertDeliverySupport(job);
}

function mergeCronPayload(existing: CronPayload, patch: CronPayloadPatch): CronPayload {
  if (patch.kind !== existing.kind) {
    return buildPayloadFromPatch(patch);
  }

  if (patch.kind === "systemEvent") {
    if (existing.kind !== "systemEvent") {
      return buildPayloadFromPatch(patch);
    }
    const text = typeof patch.text === "string" ? patch.text : existing.text;
    return { kind: "systemEvent", text };
  }

  if (existing.kind !== "agentTurn") {
    return buildPayloadFromPatch(patch);
  }

  const next: Extract<CronPayload, { kind: "agentTurn" }> = { ...existing };
  if (typeof patch.message === "string") {
    next.message = patch.message;
  }
  if (typeof patch.model === "string") {
    next.model = patch.model;
  }
  if (typeof patch.thinking === "string") {
    next.thinking = patch.thinking;
  }
  if (typeof patch.timeoutSeconds === "number") {
    next.timeoutSeconds = patch.timeoutSeconds;
  }
  if (typeof patch.deliver === "boolean") {
    next.deliver = patch.deliver;
  }
  if (typeof patch.channel === "string") {
    next.channel = patch.channel;
  }
  if (typeof patch.to === "string") {
    next.to = patch.to;
  }
  if (typeof patch.bestEffortDeliver === "boolean") {
    next.bestEffortDeliver = patch.bestEffortDeliver;
  }
  return next;
}

function buildLegacyDeliveryPatch(
  payload: Extract<CronPayloadPatch, { kind: "agentTurn" }>,
): CronDeliveryPatch | null {
  const deliver = payload.deliver;
  const toRaw = typeof payload.to === "string" ? payload.to.trim() : "";
  const hasLegacyHints =
    typeof deliver === "boolean" ||
    typeof payload.bestEffortDeliver === "boolean" ||
    Boolean(toRaw);
  if (!hasLegacyHints) {
    return null;
  }

  const patch: CronDeliveryPatch = {};
  let hasPatch = false;

  if (deliver === false) {
    patch.mode = "none";
    hasPatch = true;
  } else if (deliver === true || toRaw) {
    patch.mode = "announce";
    hasPatch = true;
  }

  if (typeof payload.channel === "string") {
    const channel = payload.channel.trim().toLowerCase();
    patch.channel = channel ? channel : undefined;
    hasPatch = true;
  }
  if (typeof payload.to === "string") {
    patch.to = payload.to.trim();
    hasPatch = true;
  }
  if (typeof payload.bestEffortDeliver === "boolean") {
    patch.bestEffort = payload.bestEffortDeliver;
    hasPatch = true;
  }

  return hasPatch ? patch : null;
}

function buildPayloadFromPatch(patch: CronPayloadPatch): CronPayload {
  if (patch.kind === "systemEvent") {
    if (typeof patch.text !== "string" || patch.text.length === 0) {
      throw new Error('cron.update payload.kind="systemEvent" requires text');
    }
    return { kind: "systemEvent", text: patch.text };
  }

  if (typeof patch.message !== "string" || patch.message.length === 0) {
    throw new Error('cron.update payload.kind="agentTurn" requires message');
  }

  return {
    kind: "agentTurn",
    message: patch.message,
    model: patch.model,
    thinking: patch.thinking,
    timeoutSeconds: patch.timeoutSeconds,
    deliver: patch.deliver,
    channel: patch.channel,
    to: patch.to,
    bestEffortDeliver: patch.bestEffortDeliver,
  };
}

function mergeCronDelivery(
  existing: CronDelivery | undefined,
  patch: CronDeliveryPatch,
): CronDelivery {
  const next: CronDelivery = {
    mode: existing?.mode ?? "none",
    channel: existing?.channel,
    to: existing?.to,
    bestEffort: existing?.bestEffort,
  };

  if (typeof patch.mode === "string") {
    next.mode = (patch.mode as string) === "deliver" ? "announce" : patch.mode;
  }
  if ("channel" in patch) {
    const channel = typeof patch.channel === "string" ? patch.channel.trim() : "";
    next.channel = channel ? channel : undefined;
  }
  if ("to" in patch) {
    const to = typeof patch.to === "string" ? patch.to.trim() : "";
    next.to = to ? to : undefined;
  }
  if (typeof patch.bestEffort === "boolean") {
    next.bestEffort = patch.bestEffort;
  }

  return next;
}

export function isJobDue(job: CronJob, nowMs: number, opts: { forced: boolean }) {
  if (opts.forced) {
    return true;
  }
  return job.enabled && typeof job.state.nextRunAtMs === "number" && nowMs >= job.state.nextRunAtMs;
}

export function resolveJobPayloadTextForMain(job: CronJob): string | undefined {
  if (job.payload.kind !== "systemEvent") {
    return undefined;
  }
  const text = normalizePayloadToSystemText(job.payload);
  return text.trim() ? text : undefined;
}
