/**
 * MeshGuard — Trust Score Computation
 *
 * Computes a numeric trust score (0–100) for an agent based on anomaly history.
 */

import type { AnomalySeverity, AnomalyType, TrustTier } from "./types.js";

// ---------------------------------------------------------------------------
// Severity weights (higher = worse)
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHT: Record<AnomalySeverity, number> = {
  info: 1,
  warning: 3,
  critical: 8,
  emergency: 15,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TrustScoreInput {
  severityCounts: Record<AnomalySeverity, number>;
  unresolvedCount: number;
  windowDays: number;
}

/**
 * Compute a trust score between 0 (no trust) and 100 (fully trusted).
 * Starts at 100 and deducts based on anomaly history.
 */
export function computeTrustScore(input: TrustScoreInput): number {
  let penalty = 0;
  for (const [sev, count] of Object.entries(input.severityCounts)) {
    penalty += count * SEVERITY_WEIGHT[sev as AnomalySeverity];
  }
  // Unresolved anomalies carry extra weight
  penalty += input.unresolvedCount * 2;

  // Normalise: cap penalty at 100
  const score = Math.max(0, 100 - penalty);
  return Math.round(score);
}

/** Map a numeric trust score to a TrustTier. */
export function scoreToTier(score: number): TrustTier {
  if (score >= 90) return "core";
  if (score >= 75) return "elevated";
  if (score >= 50) return "standard";
  if (score >= 25) return "basic";
  return "untrusted";
}
