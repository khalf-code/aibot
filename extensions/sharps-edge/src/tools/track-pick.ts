/**
 * SHARPS EDGE - Track Pick Tool
 *
 * Records every recommendation for CLV tracking and recursive learning.
 * Every pick is stored with its context so the system can learn from
 * every interaction.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { Type } from "@sinclair/typebox";

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

export const TrackPickSchema = Type.Object(
  {
    action: Type.Unsafe<"record" | "result" | "list" | "pending">({
      type: "string",
      enum: ["record", "result", "list", "pending"],
      description:
        "Action: 'record' a new pick, 'result' to log outcome, 'list' recent picks, 'pending' for unresolved",
    }),
    // For 'record'
    game: Type.Optional(Type.String({ description: "Game: AWAY@HOME" })),
    sport: Type.Optional(Type.String({ description: "Sport: nfl, nba, mlb, nhl" })),
    pick_type: Type.Optional(
      Type.String({ description: "Type: spread, total, moneyline" }),
    ),
    direction: Type.Optional(
      Type.String({ description: "Pick direction: home, away, over, under" }),
    ),
    line_at_pick: Type.Optional(
      Type.Number({ description: "The line/total when pick was made" }),
    ),
    edge_score: Type.Optional(
      Type.Number({ description: "Edge score from check_edge (0-100)" }),
    ),
    models_fired: Type.Optional(
      Type.String({ description: "Comma-separated model names that contributed" }),
    ),
    reasoning: Type.Optional(
      Type.String({ description: "Brief reasoning for the pick" }),
    ),
    // For 'result'
    pick_id: Type.Optional(Type.String({ description: "Pick ID to update with result" })),
    closing_line: Type.Optional(
      Type.Number({ description: "The closing line at game start" }),
    ),
    outcome: Type.Optional(
      Type.String({ description: "Result: win, loss, push" }),
    ),
    actual_score: Type.Optional(
      Type.String({ description: "Final score: 'AWAY XX - HOME YY'" }),
    ),
    // For 'list'
    limit: Type.Optional(
      Type.Number({ description: "Number of picks to return. Default: 20" }),
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
  // Backfilled after game
  closing_line?: number;
  clv?: number; // Closing line value (positive = sharp)
  outcome?: "win" | "loss" | "push";
  actual_score?: string;
  resolved_at?: string;
};

export function createTrackPickTool(api: OpenClawPluginApi) {
  const picksDir = api.resolvePath("~/.openclaw/workspace/data/picks");

  return {
    name: "track_pick",
    label: "Track Pick",
    description:
      "Record picks and outcomes for CLV tracking. Every recommendation must be " +
      "tracked so the system can measure accuracy and learn. Use 'record' to log " +
      "a new pick, 'result' to backfill outcomes, 'list' to see recent picks, " +
      "'pending' for picks awaiting results.",
    parameters: TrackPickSchema,

    async execute(
      _toolCallId: string,
      params: Record<string, unknown>,
    ): Promise<{
      content: Array<{ type: string; text: string }>;
      details: unknown;
    }> {
      const action = params.action as string;

      try {
        await fs.mkdir(picksDir, { recursive: true });
        const month = new Date().toISOString().slice(0, 7);
        const picksFile = path.join(picksDir, `${month}.jsonl`);

        switch (action) {
          case "record": {
            if (!params.game || !params.sport || !params.direction) {
              return err("Required: game, sport, direction");
            }

            const pick: Pick = {
              id: `pick_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              timestamp: new Date().toISOString(),
              game: (params.game as string).toUpperCase(),
              sport: (params.sport as string).toLowerCase(),
              pick_type: (params.pick_type as string) ?? "spread",
              direction: (params.direction as string).toLowerCase(),
              line_at_pick: (params.line_at_pick as number) ?? 0,
              edge_score: (params.edge_score as number) ?? 0,
              models_fired: params.models_fired
                ? (params.models_fired as string).split(",").map((s) => s.trim())
                : [],
              reasoning: (params.reasoning as string) ?? "",
            };

            await fs.appendFile(picksFile, JSON.stringify(pick) + "\n");

            return ok(
              { pick_id: pick.id, recorded: true, pick },
              `Pick recorded: ${pick.game} ${pick.direction}`,
            );
          }

          case "result": {
            if (!params.pick_id || !params.outcome) {
              return err("Required: pick_id, outcome");
            }

            // Read all month files to find the pick
            const files = await fs.readdir(picksDir).catch(() => []);
            let found = false;
            let updatedPick: Pick | null = null;

            for (const file of files) {
              if (!file.endsWith(".jsonl")) continue;
              const filePath = path.join(picksDir, file);
              const content = await fs.readFile(filePath, "utf-8");
              const lines = content.trim().split("\n");
              const newLines: string[] = [];
              let modified = false;

              for (const line of lines) {
                if (!line.trim()) continue;
                const pick: Pick = JSON.parse(line);

                if (pick.id === params.pick_id) {
                  pick.outcome = params.outcome as "win" | "loss" | "push";
                  pick.closing_line =
                    (params.closing_line as number) ?? pick.closing_line;
                  pick.actual_score =
                    (params.actual_score as string) ?? pick.actual_score;
                  pick.resolved_at = new Date().toISOString();

                  // Calculate CLV
                  if (pick.closing_line != null && pick.line_at_pick != null) {
                    pick.clv = pick.closing_line - pick.line_at_pick;
                    // For unders, invert CLV direction
                    if (
                      pick.direction === "under" ||
                      pick.direction === "away"
                    ) {
                      pick.clv = -pick.clv;
                    }
                  }

                  found = true;
                  modified = true;
                  updatedPick = pick;
                }
                newLines.push(JSON.stringify(pick));
              }

              if (modified) {
                await fs.writeFile(filePath, newLines.join("\n") + "\n");
              }
            }

            if (!found) {
              return err(`Pick ${params.pick_id} not found`);
            }

            return ok(
              { updated: true, pick: updatedPick },
              `Result recorded: ${updatedPick?.outcome} (CLV: ${updatedPick?.clv ?? "N/A"})`,
            );
          }

          case "list": {
            const limit = (params.limit as number) ?? 20;
            const picks = await loadAllPicks(picksDir);
            const recent = picks.slice(-limit);

            return ok(
              {
                total_picks: picks.length,
                showing: recent.length,
                picks: recent,
              },
              `Recent picks (${recent.length}/${picks.length})`,
            );
          }

          case "pending": {
            const picks = await loadAllPicks(picksDir);
            const pending = picks.filter((p) => !p.outcome);

            return ok(
              {
                total_pending: pending.length,
                picks: pending,
              },
              `Pending picks: ${pending.length}`,
            );
          }

          default:
            return err(`Unknown action '${action}'. Use: record, result, list, pending`);
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
      } catch {
        // Skip malformed lines
      }
    }
  }

  return picks;
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
