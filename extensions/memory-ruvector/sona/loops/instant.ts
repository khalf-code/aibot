/**
 * Instant Learning Loop for SONA (Self-Organizing Neural Architecture)
 *
 * Provides immediate feedback processing with MicroLoRA-style quick weight
 * adjustments. Unlike the background loop which runs periodically, the instant
 * loop processes feedback as soon as it's received for rapid adaptation.
 *
 * Part of the P2 (Adaptive Loops) ruvLLM feature set.
 */

import type { PluginLogger } from "clawdbot/plugin-sdk";

import type { RuvectorClient } from "../../client.js";
import type { RuvectorDB } from "../../db.js";
import type { EmbeddingProvider } from "../../embeddings.js";
import type { SONAConfig } from "../../types.js";
import type { Trajectory } from "./background.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Immediate feedback data for instant learning.
 */
export type ImmediateFeedback = {
  /** ID of the trajectory this feedback relates to */
  trajectoryId?: string;
  /** Query that was performed */
  queryVector: number[];
  /** Result that was selected/used */
  resultVector: number[];
  /** Relevance/quality score (0-1, higher is better) */
  score: number;
  /** Type of feedback */
  feedbackType: "selection" | "correction" | "explicit";
  /** Optional context about the feedback */
  context?: Record<string, unknown>;
};

/**
 * Pattern boost record from instant learning.
 */
export type PatternBoost = {
  /** Pattern ID (derived from vector hash) */
  patternId: string;
  /** Vector that defines this pattern */
  vector: number[];
  /** Current boost factor (1.0 = neutral, >1 = positive, <1 = negative) */
  boost: number;
  /** Number of times this pattern has been updated */
  updateCount: number;
  /** Last update timestamp */
  lastUpdated: number;
  /** Exponentially weighted average score */
  ewmaScore: number;
};

/**
 * Statistics from instant learning operations.
 */
export type InstantLearningStats = {
  /** Total feedback items processed */
  feedbackProcessed: number;
  /** Number of positive boosts applied */
  positiveBoosts: number;
  /** Number of negative boosts applied */
  negativeBoosts: number;
  /** Number of unique patterns tracked */
  patternsTracked: number;
  /** Average processing time in milliseconds */
  avgProcessingTimeMs: number;
};

// =============================================================================
// InstantLoop Class
// =============================================================================

/**
 * Instant learning loop for immediate feedback processing.
 *
 * Features:
 * - Processes feedback immediately without batching
 * - MicroLoRA-style quick weight adjustments stored as pattern boosts
 * - Exponentially weighted moving average for score smoothing
 * - Pattern deduplication via vector hashing
 *
 * @example
 * ```typescript
 * const loop = new InstantLoop({
 *   client,
 *   db,
 *   embeddings,
 *   config: { enabled: true, hiddenDim: 256, learningRate: 0.01 },
 *   logger,
 * });
 *
 * // Process immediate feedback
 * await loop.processImmediateFeedback({
 *   queryVector: [0.1, 0.2, ...],
 *   resultVector: [0.3, 0.4, ...],
 *   score: 0.9,
 *   feedbackType: 'selection',
 * }, trajectory);
 * ```
 */
export class InstantLoop {
  private readonly client: RuvectorClient;
  private readonly db: RuvectorDB;
  private readonly embeddings: EmbeddingProvider;
  private readonly config: SONAConfig;
  private readonly logger: PluginLogger;

  // Pattern boost storage (in-memory with optional persistence)
  private patternBoosts: Map<string, PatternBoost> = new Map();

  // Statistics tracking
  private stats: InstantLearningStats = {
    feedbackProcessed: 0,
    positiveBoosts: 0,
    negativeBoosts: 0,
    patternsTracked: 0,
    avgProcessingTimeMs: 0,
  };
  private totalProcessingTimeMs = 0;

  // Configuration
  private readonly ewmaAlpha = 0.3; // EWMA smoothing factor
  private readonly maxPatternBoosts = 10000;
  private readonly boostDecayRate = 0.995; // Daily decay rate
  private readonly minBoost = 0.1;
  private readonly maxBoost = 5.0;
  private readonly similarityThreshold = 0.9;

  constructor(options: {
    client: RuvectorClient;
    db: RuvectorDB;
    embeddings: EmbeddingProvider;
    config: SONAConfig;
    logger: PluginLogger;
  }) {
    this.client = options.client;
    this.db = options.db;
    this.embeddings = options.embeddings;
    this.config = options.config;
    this.logger = options.logger;
  }

  // ===========================================================================
  // Core Methods
  // ===========================================================================

  /**
   * Process immediate feedback for instant learning.
   *
   * This method is the primary entry point for instant learning. It:
   * 1. Updates pattern boosts for both query and result vectors
   * 2. Applies MicroLoRA-style weight adjustments
   * 3. Tracks statistics for monitoring
   *
   * @param feedback - The immediate feedback to process
   * @param trajectory - Optional full trajectory for context
   */
  async processImmediateFeedback(
    feedback: ImmediateFeedback,
    trajectory?: Trajectory,
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const startTime = Date.now();

    try {
      const learningRate = this.config.learningRate ?? 0.01;
      const qualityThreshold = this.config.qualityThreshold ?? 0.5;

      // Calculate boost delta based on score relative to threshold
      const scoreDelta = feedback.score - qualityThreshold;
      const boostDelta = scoreDelta * learningRate * 10; // Scale for visibility

      // Update pattern boost for the query vector
      const queryPatternId = this.vectorToPatternId(feedback.queryVector);
      this.updatePatternBoost(queryPatternId, feedback.queryVector, boostDelta, feedback.score);

      // Update pattern boost for the result vector (with reduced weight)
      const resultPatternId = this.vectorToPatternId(feedback.resultVector);
      this.updatePatternBoost(
        resultPatternId,
        feedback.resultVector,
        boostDelta * 0.5,
        feedback.score,
      );

      // Track positive/negative boosts
      if (boostDelta > 0) {
        this.stats.positiveBoosts++;
      } else if (boostDelta < 0) {
        this.stats.negativeBoosts++;
      }

      // Apply MicroLoRA update if score is above threshold
      if (feedback.score >= qualityThreshold) {
        await this.applyMicroLoraUpdate(feedback, trajectory);
      }

      // Update statistics
      this.stats.feedbackProcessed++;
      this.stats.patternsTracked = this.patternBoosts.size;
      const processingTime = Date.now() - startTime;
      this.totalProcessingTimeMs += processingTime;
      this.stats.avgProcessingTimeMs =
        this.totalProcessingTimeMs / this.stats.feedbackProcessed;

      this.logger.debug?.(
        `instant-loop: processed feedback (score: ${feedback.score.toFixed(2)}, ` +
        `boost: ${boostDelta > 0 ? "+" : ""}${boostDelta.toFixed(3)}, ` +
        `time: ${processingTime}ms)`,
      );
    } catch (err) {
      this.logger.warn(`instant-loop: failed to process feedback: ${formatError(err)}`);
    }
  }

  /**
   * Get the current boost factor for a vector.
   *
   * @param vector - The vector to look up
   * @returns The boost factor (1.0 if not found)
   */
  getBoostForVector(vector: number[]): number {
    // Find the most similar pattern
    let bestMatch: { patternId: string; similarity: number } | null = null;

    for (const [patternId, boost] of this.patternBoosts.entries()) {
      const similarity = cosineSimilarity(vector, boost.vector);
      if (similarity >= this.similarityThreshold) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { patternId, similarity };
        }
      }
    }

    if (bestMatch) {
      const boost = this.patternBoosts.get(bestMatch.patternId);
      return boost?.boost ?? 1.0;
    }

    return 1.0;
  }

  /**
   * Get all current pattern boosts.
   */
  getPatternBoosts(): PatternBoost[] {
    return Array.from(this.patternBoosts.values());
  }

  /**
   * Get instant learning statistics.
   */
  getStats(): InstantLearningStats {
    return { ...this.stats };
  }

  /**
   * Apply time-based decay to all pattern boosts.
   * Should be called periodically (e.g., daily) to prevent stale boosts.
   */
  applyDecay(): void {
    const decayedPatterns: string[] = [];

    for (const [patternId, boost] of this.patternBoosts.entries()) {
      // Apply decay
      const daysSinceUpdate = (Date.now() - boost.lastUpdated) / (24 * 3600_000);
      const decayFactor = Math.pow(this.boostDecayRate, daysSinceUpdate);

      // Decay towards 1.0 (neutral)
      const newBoost = 1.0 + (boost.boost - 1.0) * decayFactor;

      if (Math.abs(newBoost - 1.0) < 0.01) {
        // Remove nearly-neutral boosts
        decayedPatterns.push(patternId);
      } else {
        boost.boost = newBoost;
      }
    }

    for (const patternId of decayedPatterns) {
      this.patternBoosts.delete(patternId);
    }

    this.stats.patternsTracked = this.patternBoosts.size;

    this.logger.debug?.(
      `instant-loop: applied decay, removed ${decayedPatterns.length} patterns ` +
      `(${this.patternBoosts.size} remaining)`,
    );
  }

  /**
   * Clear all learned patterns.
   */
  reset(): void {
    this.patternBoosts.clear();
    this.stats = {
      feedbackProcessed: 0,
      positiveBoosts: 0,
      negativeBoosts: 0,
      patternsTracked: 0,
      avgProcessingTimeMs: 0,
    };
    this.totalProcessingTimeMs = 0;
    this.logger.info?.("instant-loop: reset");
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  /**
   * Update a pattern's boost factor.
   */
  private updatePatternBoost(
    patternId: string,
    vector: number[],
    boostDelta: number,
    score: number,
  ): void {
    const existing = this.patternBoosts.get(patternId);

    if (existing) {
      // Update existing pattern
      const newBoost = Math.max(
        this.minBoost,
        Math.min(this.maxBoost, existing.boost + boostDelta),
      );

      // Update EWMA score
      const newEwmaScore =
        this.ewmaAlpha * score + (1 - this.ewmaAlpha) * existing.ewmaScore;

      existing.boost = newBoost;
      existing.updateCount++;
      existing.lastUpdated = Date.now();
      existing.ewmaScore = newEwmaScore;
    } else {
      // Create new pattern boost
      const newBoost: PatternBoost = {
        patternId,
        vector: [...vector],
        boost: Math.max(this.minBoost, Math.min(this.maxBoost, 1.0 + boostDelta)),
        updateCount: 1,
        lastUpdated: Date.now(),
        ewmaScore: score,
      };

      this.patternBoosts.set(patternId, newBoost);

      // Prune if over limit
      if (this.patternBoosts.size > this.maxPatternBoosts) {
        this.pruneOldestPatterns();
      }
    }
  }

  /**
   * Apply MicroLoRA-style update to the SONA engine.
   */
  private async applyMicroLoraUpdate(
    feedback: ImmediateFeedback,
    trajectory?: Trajectory,
  ): Promise<void> {
    try {
      // Access SONA engine methods if available
      const sonaStats = await this.client.getSONAStats();
      if (!sonaStats.enabled) {
        return;
      }

      // Record feedback to SONA for micro-LoRA adaptation
      await this.client.recordSearchFeedback(
        feedback.queryVector,
        feedback.trajectoryId ?? `instant-${Date.now()}`,
        feedback.score,
      );

      this.logger.debug?.("instant-loop: applied micro-LoRA update");
    } catch (err) {
      // Non-critical error, log and continue
      this.logger.debug?.(`instant-loop: micro-LoRA update skipped: ${formatError(err)}`);
    }
  }

  /**
   * Generate a pattern ID from a vector.
   * Uses a hash of the vector's significant components for deduplication.
   */
  private vectorToPatternId(vector: number[]): string {
    // Take first 32 components and quantize to 2 decimal places
    const significant = vector.slice(0, 32).map((v) => Math.round(v * 100));

    // Simple hash function
    let hash = 0;
    for (const val of significant) {
      hash = ((hash << 5) - hash + val) | 0;
    }

    return `p-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Find a similar pattern ID if one exists.
   */
  private findSimilarPatternId(vector: number[]): string | null {
    for (const [patternId, boost] of this.patternBoosts.entries()) {
      const similarity = cosineSimilarity(vector, boost.vector);
      if (similarity >= this.similarityThreshold) {
        return patternId;
      }
    }
    return null;
  }

  /**
   * Prune oldest patterns when over limit.
   */
  private pruneOldestPatterns(): void {
    // Sort by lastUpdated ascending
    const sorted = Array.from(this.patternBoosts.entries()).sort(
      (a, b) => a[1].lastUpdated - b[1].lastUpdated,
    );

    // Remove oldest 10%
    const toRemove = Math.ceil(sorted.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.patternBoosts.delete(sorted[i][0]);
    }
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Format an error for logging.
 */
function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
