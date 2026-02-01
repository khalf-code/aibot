import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import type { NormalizedUsage } from "../agents/usage.js";
import type { OpenClawConfig } from "../config/config.js";
import { resolveStateDir } from "../config/paths.js";

export type RunUsageEvent = {
  ts: number;
  kind: "chat" | "cron";
  sessionKey?: string;
  sessionId?: string;
  lane?: string;
  channel?: string;
  accountId?: string;
  to?: string;
  /** Cron job context. */
  jobId?: string;
  jobName?: string;
  provider?: string;
  model?: string;
  usage: NormalizedUsage;
  costUsd?: number;
  durationMs?: number;
};

export type RunUsageRollupKey = {
  date: string;
  channel?: string;
  jobName?: string;
};

export type RunUsageRollupEntry = {
  key: RunUsageRollupKey;
  runs: number;
  totalTokens: number;
  totalCostUsd?: number;
  missingCostRuns: number;
};

function dayKey(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-CA", {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

export function resolveRunUsageLogPath(env: NodeJS.ProcessEnv = process.env): string {
  const root = resolveStateDir(env);
  return path.join(root, "usage", "runs.jsonl");
}

export async function appendRunUsageEvent(params: {
  cfg?: OpenClawConfig;
  event: RunUsageEvent;
}): Promise<void> {
  const enabled = params.cfg?.models?.routing?.usageLog?.enabled === true;
  if (!enabled) {
    return;
  }
  const filePath = resolveRunUsageLogPath();
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.appendFile(filePath, `${JSON.stringify(params.event)}\n`, "utf8");
}

function totalTokensFromUsage(usage: NormalizedUsage): number {
  const input = usage.input ?? 0;
  const output = usage.output ?? 0;
  const cacheRead = usage.cacheRead ?? 0;
  const cacheWrite = usage.cacheWrite ?? 0;
  const total = usage.total;
  if (typeof total === "number" && Number.isFinite(total) && total >= 0) {
    return total;
  }
  return input + output + cacheRead + cacheWrite;
}

export async function loadRunUsageRollup(params: {
  days: number;
  /** Optional filter for a specific channel (e.g. "discord"). */
  channel?: string;
}): Promise<{ updatedAt: number; days: number; entries: RunUsageRollupEntry[] }> {
  const filePath = resolveRunUsageLogPath();
  const daysSafe = Math.max(1, Math.floor(params.days));
  const now = Date.now();
  const since = new Date();
  since.setDate(since.getDate() - (daysSafe - 1));
  const sinceMs = since.getTime();

  if (!fs.existsSync(filePath)) {
    return { updatedAt: Date.now(), days: daysSafe, entries: [] };
  }

  const wantedChannel = params.channel?.trim().toLowerCase();

  const map = new Map<string, RunUsageRollupEntry>();
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const evt = JSON.parse(trimmed) as RunUsageEvent;
      if (!evt || typeof evt.ts !== "number" || evt.ts < sinceMs || evt.ts > now + 60_000) {
        continue;
      }
      const evtChannel = evt.channel?.trim().toLowerCase();
      if (wantedChannel && evtChannel !== wantedChannel) {
        continue;
      }

      const key: RunUsageRollupKey = {
        date: dayKey(evt.ts),
        channel: evtChannel,
        jobName: evt.kind === "cron" ? evt.jobName : undefined,
      };
      const mapKey = `${key.date}::${key.channel ?? ""}::${key.jobName ?? ""}`;
      const existing = map.get(mapKey) ?? {
        key,
        runs: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        missingCostRuns: 0,
      };

      existing.runs += 1;
      existing.totalTokens += totalTokensFromUsage(evt.usage);
      if (typeof evt.costUsd === "number" && Number.isFinite(evt.costUsd) && evt.costUsd >= 0) {
        existing.totalCostUsd = (existing.totalCostUsd ?? 0) + evt.costUsd;
      } else {
        existing.missingCostRuns += 1;
      }

      map.set(mapKey, existing);
    } catch {
      // ignore malformed
    }
  }

  const entries = Array.from(map.values()).sort((a, b) => {
    const d = a.key.date.localeCompare(b.key.date);
    if (d !== 0) return d;
    const c = (a.key.channel ?? "").localeCompare(b.key.channel ?? "");
    if (c !== 0) return c;
    return (a.key.jobName ?? "").localeCompare(b.key.jobName ?? "");
  });

  // Normalize totalCostUsd: if every entry is missing, set undefined to avoid implying $0.
  for (const entry of entries) {
    if ((entry.totalCostUsd ?? 0) === 0 && entry.missingCostRuns === entry.runs) {
      delete (entry as { totalCostUsd?: number }).totalCostUsd;
    }
  }

  return { updatedAt: Date.now(), days: daysSafe, entries };
}
