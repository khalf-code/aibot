/**
 * SHARPS EDGE - Check Edge Tool
 *
 * The core analysis tool. Combines all data sources and edge models
 * into a single confidence-weighted edge score for a game.
 *
 * This is what the x402 endpoints will serve.
 */

import { Type } from "@sinclair/typebox";

import type { CostTracker } from "../cost-tracker.js";

export const CheckEdgeSchema = Type.Object(
  {
    sport: Type.String({
      description: "Sport: nfl, nba, mlb, nhl",
    }),
    game: Type.String({
      description:
        "Game identifier: 'AWAY@HOME' format (e.g. DAL@PHI, BOS@NYK). " +
        "Or use an event ID from get_odds.",
    }),
    depth: Type.Optional(
      Type.String({
        description:
          "Analysis depth: 'quick' (lines + RLM only), 'standard' (+ weather + injuries), " +
          "'full' (all models including social). Default: standard",
      }),
    ),
  },
  { additionalProperties: false },
);

type CheckEdgeParams = {
  sport: string;
  game: string;
  depth?: string;
};

// Edge model results
type ModelResult = {
  model: string;
  signal: boolean;
  direction: "home" | "away" | "over" | "under" | "neutral";
  confidence: number; // 0-100
  weight: number;
  reasoning: string;
};

type EdgeAnalysis = {
  game: string;
  sport: string;
  depth: string;
  models_run: number;
  models_fired: number;
  edge_score: number;
  direction: string;
  recommendation: string;
  confidence_tier: string;
  models: ModelResult[];
  caveats: string[];
  disclaimer: string;
};

export function createCheckEdgeTool(costTracker: CostTracker) {
  return {
    name: "check_edge",
    label: "Check Edge",
    description:
      "Run edge detection models against a specific game. Combines line analysis, " +
      "reverse line movement, weather impact, injury context, and social signals " +
      "into a confidence-weighted edge score. Use depth='quick' for fast checks, " +
      "'full' for all models. Always includes confidence intervals and caveats.",
    parameters: CheckEdgeSchema,

    async execute(
      _toolCallId: string,
      params: Record<string, unknown>,
    ): Promise<{
      content: Array<{ type: string; text: string }>;
      details: unknown;
    }> {
      const p = params as CheckEdgeParams;
      const depth = p.depth ?? "standard";
      const sport = p.sport.toLowerCase();
      const game = p.game.toUpperCase();

      try {
        const models: ModelResult[] = [];
        const caveats: string[] = [];

        // Always run: Line value analysis
        models.push(analyzeLineValue(game, sport));

        // Always run: Reverse line movement
        models.push(analyzeRLM(game, sport));

        if (depth === "standard" || depth === "full") {
          // Weather impact (outdoor sports)
          models.push(analyzeWeatherImpact(game, sport));

          // Injury context
          models.push(analyzeInjuryContext(game, sport));
        }

        if (depth === "full") {
          // Social / locker room
          models.push(analyzeSocialSignals(game, sport));

          // Stale line detection
          models.push(analyzeStaleLines(game, sport));
        }

        // Aggregate
        const firedModels = models.filter((m) => m.signal);
        const modelsRun = models.length;
        const modelsFired = firedModels.length;

        let edgeScore = 0;
        let direction = "neutral";

        if (modelsFired > 0) {
          // Check for conflicting directions
          const directions = new Set(firedModels.map((m) => m.direction));
          const hasConflict =
            (directions.has("home") && directions.has("away")) ||
            (directions.has("over") && directions.has("under"));

          // Weighted average of fired models
          const totalWeight = firedModels.reduce((s, m) => s + m.weight, 0);
          edgeScore = Math.round(
            firedModels.reduce((s, m) => s + m.confidence * m.weight, 0) / totalWeight,
          );

          if (hasConflict) {
            edgeScore = Math.round(edgeScore * 0.7); // 30% penalty for conflicting signals
            caveats.push("Models show conflicting directions - confidence reduced 30%");
          }

          // Determine majority direction
          const dirCounts: Record<string, number> = {};
          for (const m of firedModels) {
            dirCounts[m.direction] = (dirCounts[m.direction] ?? 0) + m.weight;
          }
          direction = Object.entries(dirCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral";
        }

        // Confidence tier
        let confidenceTier: string;
        let recommendation: string;

        if (edgeScore < 30) {
          confidenceTier = "NO EDGE";
          recommendation = "No actionable edge detected. Pass on this game.";
        } else if (edgeScore < 50) {
          confidenceTier = "MARGINAL";
          recommendation = `Marginal ${direction} lean (${edgeScore}%). Small sample / weak signals. Proceed with caution.`;
          caveats.push("Marginal edges are often noise - requires larger sample to validate");
        } else if (edgeScore < 70) {
          confidenceTier = "MODERATE";
          recommendation = `Moderate ${direction} edge detected (${edgeScore}%). Multiple confirming signals.`;
        } else {
          confidenceTier = "STRONG";
          recommendation = `Strong ${direction} edge (${edgeScore}%). High confidence, multiple converging signals.`;
        }

        // Standard caveats
        if (modelsFired <= 1) {
          caveats.push("Only 1 model fired - single-signal edges are less reliable");
        }

        // Note: These models return placeholder data until wired to live tool calls.
        // When deployed, check_edge will call get_odds, get_weather, get_injuries,
        // get_social internally and synthesize their outputs.
        caveats.push(
          "Edge scores are probabilistic estimates, not predictions. " +
            "Past performance does not guarantee future results.",
        );

        const analysis: EdgeAnalysis = {
          game,
          sport,
          depth,
          models_run: modelsRun,
          models_fired: modelsFired,
          edge_score: edgeScore,
          direction,
          recommendation,
          confidence_tier: confidenceTier,
          models,
          caveats,
          disclaimer:
            "For informational purposes only. Sports betting involves risk. " +
            "Never bet more than you can afford to lose.",
        };

        // Track the analysis cost
        costTracker.trackApiCall("check-edge");

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { label: `Edge analysis: ${game}`, data: analysis },
                null,
                2,
              ),
            },
          ],
          details: analysis,
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: e instanceof Error ? e.message : String(e),
              }),
            },
          ],
          details: { error: e instanceof Error ? e.message : String(e) },
        };
      }
    },
  };
}

// --- Individual model stubs ---
// In production, these call the other tools (get_odds, get_weather, etc.)
// and analyze their output. For now they return structured placeholders
// that show the agent what to expect and how to interpret results.

function analyzeLineValue(_game: string, _sport: string): ModelResult {
  return {
    model: "line_value",
    signal: false,
    direction: "neutral",
    confidence: 0,
    weight: 6,
    reasoning:
      "Line value model requires live odds data. Call get_odds first, " +
      "then compare opening vs current line. Look for moves through key numbers.",
  };
}

function analyzeRLM(_game: string, _sport: string): ModelResult {
  return {
    model: "reverse_line_movement",
    signal: false,
    direction: "neutral",
    confidence: 0,
    weight: 8,
    reasoning:
      "RLM model requires public betting % and line movement data. " +
      "When >70% public on one side and line moves opposite = sharp money signal.",
  };
}

function analyzeWeatherImpact(_game: string, _sport: string): ModelResult {
  return {
    model: "weather_impact",
    signal: false,
    direction: "neutral",
    confidence: 0,
    weight: 7,
    reasoning:
      "Weather model requires get_weather data for game venue + time. " +
      "Wind >15mph, precipitation, extreme temps create under signals.",
  };
}

function analyzeInjuryContext(_game: string, _sport: string): ModelResult {
  return {
    model: "injury_context",
    signal: false,
    direction: "neutral",
    confidence: 0,
    weight: 5,
    reasoning:
      "Injury model requires get_injuries for both teams. " +
      "Focus on underpriced role player injuries (O-line, bullpen, corners).",
  };
}

function analyzeSocialSignals(_game: string, _sport: string): ModelResult {
  return {
    model: "social_signals",
    signal: false,
    direction: "neutral",
    confidence: 0,
    weight: 4,
    reasoning:
      "Social model requires get_social for both teams. " +
      "Locker room issues, coaching conflicts, and motivation factors.",
  };
}

function analyzeStaleLines(_game: string, _sport: string): ModelResult {
  return {
    model: "stale_line_detection",
    signal: false,
    direction: "neutral",
    confidence: 0,
    weight: 9,
    reasoning:
      "Stale line model requires multi-book odds comparison from get_odds. " +
      "When one book lags 2+ points after news = immediate opportunity.",
  };
}
