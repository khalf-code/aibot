import type { CommandHandler } from "./commands-types.js";
import { formatTokenCount, formatUsd } from "../../utils/usage-format.js";
import { loadRunUsageRollup } from "../../infra/run-usage-log.js";

function parseArgs(raw: string): { days: number; channel?: string } {
  const parts = raw
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  let days = 1;
  let channel: string | undefined;

  for (const p of parts) {
    if (/^\d+$/.test(p)) {
      days = Math.max(1, Math.min(90, Number.parseInt(p, 10)));
      continue;
    }
    if (p.toLowerCase().startsWith("channel:")) {
      channel = p.slice("channel:".length).trim();
      continue;
    }
  }

  return { days, channel };
}

export const handleUsageRollupCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const normalized = params.command.commandBodyNormalized;
  if (normalized !== "/usage rollup" && !normalized.startsWith("/usage rollup ")) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    return { shouldContinue: false };
  }

  const rawArgs =
    normalized === "/usage rollup" ? "" : normalized.slice("/usage rollup".length).trim();
  const { days, channel } = parseArgs(rawArgs);

  const summary = await loadRunUsageRollup({ days, channel });
  if (summary.entries.length === 0) {
    return {
      shouldContinue: false,
      reply: {
        text: `💸 Usage rollup: no data yet (enable models.routing.usageLog.enabled=true).`,
      },
    };
  }

  const lines: string[] = [];
  lines.push(`💸 Usage rollup (${days}d)${channel ? ` · ${channel}` : ""}`);

  for (const entry of summary.entries) {
    const cost = formatUsd(entry.totalCostUsd);
    const tokens = formatTokenCount(entry.totalTokens);
    const missing =
      entry.missingCostRuns > 0 ? ` (partial ${entry.missingCostRuns}/${entry.runs})` : "";
    const labelParts = [entry.key.date];
    if (entry.key.channel) labelParts.push(entry.key.channel);
    if (entry.key.jobName) labelParts.push(entry.key.jobName);
    const label = labelParts.join(" · ");
    lines.push(`- ${label}: ${cost ?? "n/a"}${missing} · ${tokens} tokens · ${entry.runs} runs`);
  }

  return {
    shouldContinue: false,
    reply: { text: lines.join("\n") },
  };
};
