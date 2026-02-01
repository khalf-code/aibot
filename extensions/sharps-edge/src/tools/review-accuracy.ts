/**
 * SHARPS EDGE - Review Accuracy Tool (Recursive Learning Engine)
 *
 * The brain of the system. Analyzes past picks to identify what's working
 * and what isn't. Generates model weight adjustments and stores lessons
 * that feed back into future analysis.
 *
 * Run weekly minimum. Every review makes the system smarter.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { Type } from "@sinclair/typebox";

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

export const ReviewAccuracySchema = Type.Object(
  {
    action: Type.Unsafe<"weekly" | "model_performance" | "sport_breakdown" | "lessons" | "weights">({
      type: "string",
      enum: ["weekly", "model_performance", "sport_breakdown", "lessons", "weights"],
      description:
        "Action: 'weekly' full review, 'model_performance' per-model stats, " +
        "'sport_breakdown' by sport, 'lessons' view learned lessons, " +
        "'weights' view/suggest model weight adjustments",
    }),
    period: Type.Optional(
      Type.String({
        description: "Period: 'week', 'month', 'all'. Default: week",
      }),
    ),
  },
  { additionalProperties: false },
);

type Pick = {
  id: string;
  timestamp: string;
  game: string;
  sport: string;
  pick_type: string;
  direction: string;
  line_at_pick: number;
  edge_score: number;
  models_fired: string[];
  reasoning: string;
  closing_line?: number;
  clv?: number;
  outcome?: "win" | "loss" | "push";
  actual_score?: string;
  resolved_at?: string;
};

type Lesson = {
  id: string;
  timestamp: string;
  category: string;
  lesson: string;
  evidence: string;
  suggested_action: string;
};

type WeightAdjustment = {
  model: string;
  current_weight: number;
  suggested_weight: number;
  reason: string;
  confidence: string;
};

export function createReviewAccuracyTool(api: OpenClawPluginApi) {
  const dataDir = api.resolvePath("~/.openclaw/workspace/data");
  const picksDir = path.join(dataDir, "picks");
  const lessonsDir = path.join(dataDir, "lessons");
  const weightsFile = path.join(dataDir, "model-weights.json");

  // Default model weights
  const DEFAULT_WEIGHTS: Record<string, number> = {
    line_value: 6,
    reverse_line_movement: 8,
    weather_impact: 7,
    injury_context: 5,
    social_signals: 4,
    stale_line_detection: 9,
  };

  return {
    name: "review_accuracy",
    label: "Review Accuracy",
    description:
      "Recursive learning engine. Analyzes past pick accuracy, CLV performance, " +
      "and model effectiveness. Generates lessons learned and suggests model weight " +
      "adjustments. Run 'weekly' every Sunday. The system gets smarter with every review.",
    parameters: ReviewAccuracySchema,

    async execute(
      _toolCallId: string,
      params: Record<string, unknown>,
    ): Promise<{
      content: Array<{ type: string; text: string }>;
      details: unknown;
    }> {
      const action = params.action as string;
      const period = (params.period as string) ?? "week";

      try {
        await fs.mkdir(picksDir, { recursive: true });
        await fs.mkdir(lessonsDir, { recursive: true });

        const allPicks = await loadAllPicks(picksDir);
        const resolved = allPicks.filter((p) => p.outcome);
        const filtered = filterByPeriod(resolved, period);

        switch (action) {
          case "weekly": {
            if (filtered.length === 0) {
              return ok(
                { message: "No resolved picks in this period. Need more data." },
                "Weekly review - insufficient data",
              );
            }

            const wins = filtered.filter((p) => p.outcome === "win").length;
            const losses = filtered.filter((p) => p.outcome === "loss").length;
            const pushes = filtered.filter((p) => p.outcome === "push").length;
            const total = wins + losses; // Exclude pushes from win rate
            const winRate = total > 0 ? wins / total : 0;

            // CLV analysis
            const clvPicks = filtered.filter((p) => p.clv != null);
            const avgClv =
              clvPicks.length > 0
                ? clvPicks.reduce((s, p) => s + (p.clv ?? 0), 0) / clvPicks.length
                : 0;

            // Edge score calibration: did higher scores win more?
            const highEdge = filtered.filter((p) => p.edge_score >= 60);
            const lowEdge = filtered.filter((p) => p.edge_score < 60 && p.edge_score >= 30);
            const highWinRate =
              highEdge.length > 0
                ? highEdge.filter((p) => p.outcome === "win").length /
                  highEdge.filter((p) => p.outcome !== "push").length
                : 0;
            const lowWinRate =
              lowEdge.length > 0
                ? lowEdge.filter((p) => p.outcome === "win").length /
                  lowEdge.filter((p) => p.outcome !== "push").length
                : 0;

            // By pick type
            const byType = groupBy(filtered, "pick_type");
            const typeBreakdown = Object.entries(byType).map(([type, picks]) => {
              const w = picks.filter((p) => p.outcome === "win").length;
              const t = picks.filter((p) => p.outcome !== "push").length;
              return { type, picks: picks.length, win_rate: t > 0 ? (w / t * 100).toFixed(1) + "%" : "N/A" };
            });

            // Generate lessons
            const lessons: string[] = [];
            if (winRate < 0.524) {
              lessons.push("Win rate below breakeven (52.4%). Tighten edge score thresholds or reduce volume.");
            }
            if (winRate > 0.57) {
              lessons.push("Strong win rate. Consider increasing volume on high-confidence picks.");
            }
            if (avgClv < 0) {
              lessons.push("Negative average CLV. The market is correcting against us. Review model inputs.");
            }
            if (avgClv > 0.5) {
              lessons.push("Positive CLV. We're consistently finding value before the market. Keep it up.");
            }
            if (highEdge.length > 0 && highWinRate < lowWinRate) {
              lessons.push("High edge scores performing worse than low edge scores. Edge scoring is miscalibrated.");
            }
            if (filtered.length < 30) {
              lessons.push(`Sample size (${filtered.length}) too small for reliable conclusions. Need 30+ resolved picks.`);
            }

            // Save lessons
            await saveLessons(lessonsDir, lessons, period);

            const review = {
              period,
              total_picks: filtered.length,
              record: `${wins}-${losses}-${pushes}`,
              win_rate: `${(winRate * 100).toFixed(1)}%`,
              breakeven_target: "52.4%",
              above_breakeven: winRate > 0.524,
              avg_clv: avgClv.toFixed(3),
              clv_positive: avgClv > 0,
              edge_calibration: {
                high_edge_win_rate: highEdge.length > 0 ? `${(highWinRate * 100).toFixed(1)}%` : "N/A",
                low_edge_win_rate: lowEdge.length > 0 ? `${(lowWinRate * 100).toFixed(1)}%` : "N/A",
                calibrated: highWinRate >= lowWinRate,
              },
              by_type: typeBreakdown,
              lessons,
              next_actions:
                lessons.length > 0
                  ? "Review lessons above. Run 'weights' to see suggested model adjustments."
                  : "Performance on track. Continue current approach.",
            };

            return ok(review, `Weekly review: ${wins}-${losses}-${pushes}`);
          }

          case "model_performance": {
            // Which models contributed to winning picks?
            const modelStats: Record<
              string,
              { total: number; wins: number; losses: number }
            > = {};

            for (const pick of filtered) {
              for (const model of pick.models_fired) {
                if (!modelStats[model]) {
                  modelStats[model] = { total: 0, wins: 0, losses: 0 };
                }
                modelStats[model].total++;
                if (pick.outcome === "win") modelStats[model].wins++;
                if (pick.outcome === "loss") modelStats[model].losses++;
              }
            }

            const performance = Object.entries(modelStats)
              .map(([model, stats]) => ({
                model,
                ...stats,
                win_rate:
                  stats.total > 0
                    ? `${((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)}%`
                    : "N/A",
              }))
              .sort(
                (a, b) =>
                  b.wins / Math.max(b.wins + b.losses, 1) -
                  a.wins / Math.max(a.wins + a.losses, 1),
              );

            return ok(
              { period, resolved_picks: filtered.length, models: performance },
              "Model performance breakdown",
            );
          }

          case "sport_breakdown": {
            const bySport = groupBy(filtered, "sport");
            const breakdown = Object.entries(bySport).map(([sport, picks]) => {
              const w = picks.filter((p) => p.outcome === "win").length;
              const l = picks.filter((p) => p.outcome === "loss").length;
              const t = w + l;
              const clvPicks = picks.filter((p) => p.clv != null);
              const avgClv =
                clvPicks.length > 0
                  ? clvPicks.reduce((s, p) => s + (p.clv ?? 0), 0) / clvPicks.length
                  : 0;

              return {
                sport,
                picks: picks.length,
                record: `${w}-${l}`,
                win_rate: t > 0 ? `${((w / t) * 100).toFixed(1)}%` : "N/A",
                avg_clv: avgClv.toFixed(3),
              };
            });

            return ok({ period, breakdown }, "Performance by sport");
          }

          case "lessons": {
            const files = await fs.readdir(lessonsDir).catch(() => []);
            const allLessons: Lesson[] = [];

            for (const file of files.sort().reverse()) {
              if (!file.endsWith(".jsonl")) continue;
              const content = await fs.readFile(path.join(lessonsDir, file), "utf-8");
              for (const line of content.trim().split("\n")) {
                if (!line.trim()) continue;
                try {
                  allLessons.push(JSON.parse(line));
                } catch { /* skip */ }
              }
            }

            return ok(
              { total_lessons: allLessons.length, lessons: allLessons.slice(0, 50) },
              "Learned lessons",
            );
          }

          case "weights": {
            // Load current weights or defaults
            let currentWeights: Record<string, number>;
            try {
              const raw = await fs.readFile(weightsFile, "utf-8");
              currentWeights = JSON.parse(raw);
            } catch {
              currentWeights = { ...DEFAULT_WEIGHTS };
            }

            // Suggest adjustments based on model performance
            const adjustments: WeightAdjustment[] = [];
            const modelStats: Record<
              string,
              { wins: number; losses: number }
            > = {};

            for (const pick of filtered) {
              for (const model of pick.models_fired) {
                if (!modelStats[model]) modelStats[model] = { wins: 0, losses: 0 };
                if (pick.outcome === "win") modelStats[model].wins++;
                if (pick.outcome === "loss") modelStats[model].losses++;
              }
            }

            for (const [model, current] of Object.entries(currentWeights)) {
              const stats = modelStats[model];
              if (!stats || stats.wins + stats.losses < 5) {
                adjustments.push({
                  model,
                  current_weight: current,
                  suggested_weight: current,
                  reason: "Insufficient data (<5 picks). No adjustment.",
                  confidence: "low",
                });
                continue;
              }

              const winRate = stats.wins / (stats.wins + stats.losses);
              let suggested = current;
              let reason = "";

              // Max ±5% per review to avoid overcorrection
              if (winRate > 0.6) {
                suggested = Math.min(current + 0.5, 10);
                reason = `Win rate ${(winRate * 100).toFixed(0)}% > 60%. Increase weight.`;
              } else if (winRate < 0.45) {
                suggested = Math.max(current - 0.5, 1);
                reason = `Win rate ${(winRate * 100).toFixed(0)}% < 45%. Decrease weight.`;
              } else {
                reason = `Win rate ${(winRate * 100).toFixed(0)}% is acceptable. No change.`;
              }

              adjustments.push({
                model,
                current_weight: current,
                suggested_weight: suggested,
                reason,
                confidence: stats.wins + stats.losses >= 20 ? "high" : "medium",
              });
            }

            // Save updated weights if any changed
            const hasChanges = adjustments.some(
              (a) => a.current_weight !== a.suggested_weight,
            );

            if (hasChanges) {
              const newWeights: Record<string, number> = {};
              for (const adj of adjustments) {
                newWeights[adj.model] = adj.suggested_weight;
              }
              await fs.writeFile(weightsFile, JSON.stringify(newWeights, null, 2));
            }

            return ok(
              {
                period,
                changes_applied: hasChanges,
                adjustments,
                note: hasChanges
                  ? "Weights updated. Changes take effect on next check_edge call."
                  : "No weight changes needed this review cycle.",
              },
              "Model weight review",
            );
          }

          default:
            return err(
              `Unknown action '${action}'. Use: weekly, model_performance, sport_breakdown, lessons, weights`,
            );
        }
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  };
}

async function loadAllPicks(picksDir: string): Promise<Pick[]> {
  const files = await fs.readdir(picksDir).catch(() => []);
  const picks: Pick[] = [];

  for (const file of files.sort()) {
    if (!file.endsWith(".jsonl")) continue;
    const content = await fs.readFile(path.join(picksDir, file), "utf-8");
    for (const line of content.trim().split("\n")) {
      if (!line.trim()) continue;
      try {
        picks.push(JSON.parse(line));
      } catch { /* skip */ }
    }
  }

  return picks;
}

function filterByPeriod(picks: Pick[], period: string): Pick[] {
  const now = Date.now();
  const cutoff: Record<string, number> = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    all: Infinity,
  };

  const ms = cutoff[period] ?? cutoff.week;
  return picks.filter((p) => now - new Date(p.timestamp).getTime() < ms);
}

function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const k = String(item[key]);
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  return groups;
}

async function saveLessons(
  lessonsDir: string,
  lessons: string[],
  period: string,
): Promise<void> {
  if (lessons.length === 0) return;

  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(lessonsDir, `${date}.jsonl`);

  const entries = lessons.map((lesson) => ({
    id: `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    category: "weekly_review",
    lesson,
    evidence: `Based on ${period} performance data`,
    suggested_action: "Review and apply to edge scoring",
  }));

  const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await fs.appendFile(file, lines);
}

function ok(data: unknown, label: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ label, data }, null, 2) }],
    details: { label, data },
  };
}

function err(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    details: { error: message },
  };
}
