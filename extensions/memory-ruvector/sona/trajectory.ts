/**
 * Trajectory Recording for ruvLLM
 *
 * Records search trajectories (query -> results -> feedback) for learning.
 * Trajectories capture the full context of search operations to enable
 * adaptive learning and pattern recognition.
 */

import { randomUUID } from "node:crypto";

import type { Trajectory, TrajectoryStats, TrajectoryRecordingConfig } from "../types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Input for recording a new trajectory.
 */
export type TrajectoryInput = {
  /** The search query text */
  query: string;
  /** The query vector embedding */
  queryVector: number[];
  /** IDs of results returned */
  resultIds: string[];
  /** Relevance scores for each result */
  resultScores: number[];
  /** Session ID for grouping */
  sessionId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
};

/**
 * Options for retrieving trajectories.
 */
export type GetTrajectoriesOptions = {
  /** Maximum number of trajectories to return */
  limit?: number;
  /** Filter by session ID */
  sessionId?: string;
  /** Only include trajectories with feedback */
  withFeedbackOnly?: boolean;
  /** Minimum feedback score to include */
  minFeedbackScore?: number;
  /** Start time filter (inclusive) */
  startTime?: number;
  /** End time filter (inclusive) */
  endTime?: number;
};

/**
 * Logger interface for trajectory recorder.
 */
export type TrajectoryLogger = {
  info?: (message: string) => void;
  warn: (message: string) => void;
  debug?: (message: string) => void;
};

// =============================================================================
// TrajectoryRecorder Class
// =============================================================================

/**
 * Records and manages search trajectories for learning.
 *
 * Trajectories capture:
 * - Original search query and vector
 * - Result IDs and scores
 * - User feedback on result quality
 * - Timestamp and session context
 *
 * Usage:
 * ```typescript
 * const recorder = new TrajectoryRecorder({ enabled: true, maxTrajectories: 1000 }, logger);
 *
 * // Record a search trajectory
 * const id = recorder.record({
 *   query: "user preferences",
 *   queryVector: [...],
 *   resultIds: ["id1", "id2"],
 *   resultScores: [0.9, 0.8],
 * });
 *
 * // Add feedback when user selects a result
 * recorder.addFeedback(id, 0.95);
 *
 * // Get recent trajectories for learning
 * const recent = recorder.getRecent(100);
 *
 * // Prune old trajectories
 * recorder.prune();
 * ```
 */
export class TrajectoryRecorder {
  private trajectories: Map<string, Trajectory> = new Map();
  private trajectoryOrder: string[] = []; // Track insertion order for LRU pruning
  private config: TrajectoryRecordingConfig;
  private logger: TrajectoryLogger;

  constructor(config: TrajectoryRecordingConfig, logger: TrajectoryLogger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Check if trajectory recording is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Record a new search trajectory.
   *
   * @param input - Trajectory data to record
   * @returns The trajectory ID
   */
  record(input: TrajectoryInput): string {
    if (!this.config.enabled) {
      return "";
    }

    const id = randomUUID();
    const trajectory: Trajectory = {
      id,
      query: input.query,
      queryVector: input.queryVector,
      resultIds: input.resultIds,
      resultScores: input.resultScores,
      feedback: null,
      timestamp: Date.now(),
      sessionId: input.sessionId ?? null,
      metadata: input.metadata,
    };

    this.trajectories.set(id, trajectory);
    this.trajectoryOrder.push(id);

    this.logger.debug?.(
      `trajectory: recorded ${id} (query: "${input.query.slice(0, 50)}...", results: ${input.resultIds.length})`,
    );

    // Auto-prune if we've exceeded the limit
    if (this.trajectoryOrder.length > this.config.maxTrajectories) {
      this.prune();
    }

    return id;
  }

  /**
   * Add feedback to an existing trajectory.
   *
   * @param trajectoryId - ID of the trajectory to update
   * @param feedback - Feedback score (0-1, higher is better)
   * @returns true if feedback was added, false if trajectory not found
   */
  addFeedback(trajectoryId: string, feedback: number): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const trajectory = this.trajectories.get(trajectoryId);
    if (!trajectory) {
      this.logger.warn(`trajectory: cannot add feedback - trajectory ${trajectoryId} not found`);
      return false;
    }

    // Clamp feedback to valid range
    const clampedFeedback = Math.max(0, Math.min(1, feedback));
    trajectory.feedback = clampedFeedback;

    this.logger.debug?.(
      `trajectory: added feedback ${clampedFeedback.toFixed(2)} to ${trajectoryId}`,
    );

    return true;
  }

  /**
   * Get a specific trajectory by ID.
   *
   * @param trajectoryId - ID of the trajectory to retrieve
   * @returns The trajectory, or null if not found
   */
  get(trajectoryId: string): Trajectory | null {
    return this.trajectories.get(trajectoryId) ?? null;
  }

  /**
   * Get recent trajectories, optionally filtered.
   *
   * @param options - Filter and limit options
   * @returns Array of trajectories, newest first
   */
  getRecent(options: GetTrajectoriesOptions = {}): Trajectory[] {
    const {
      limit = 100,
      sessionId,
      withFeedbackOnly = false,
      minFeedbackScore,
      startTime,
      endTime,
    } = options;

    const results: Trajectory[] = [];

    // Iterate in reverse order (newest first)
    for (let i = this.trajectoryOrder.length - 1; i >= 0 && results.length < limit; i--) {
      const id = this.trajectoryOrder[i];
      const trajectory = this.trajectories.get(id);
      if (!trajectory) continue;

      // Apply filters
      if (sessionId && trajectory.sessionId !== sessionId) continue;
      if (withFeedbackOnly && trajectory.feedback === null) continue;
      if (minFeedbackScore !== undefined && (trajectory.feedback === null || trajectory.feedback < minFeedbackScore)) continue;
      if (startTime !== undefined && trajectory.timestamp < startTime) continue;
      if (endTime !== undefined && trajectory.timestamp > endTime) continue;

      results.push(trajectory);
    }

    return results;
  }

  /**
   * Get all trajectories for a specific session.
   *
   * @param sessionId - Session ID to filter by
   * @returns Array of trajectories for the session
   */
  getBySession(sessionId: string): Trajectory[] {
    return this.getRecent({ sessionId, limit: this.config.maxTrajectories });
  }

  /**
   * Get trajectories with high-quality feedback for learning.
   *
   * @param minScore - Minimum feedback score (default: 0.7)
   * @param limit - Maximum number to return (default: 100)
   * @returns Array of high-quality trajectories
   */
  getHighQuality(minScore = 0.7, limit = 100): Trajectory[] {
    return this.getRecent({
      withFeedbackOnly: true,
      minFeedbackScore: minScore,
      limit,
    });
  }

  /**
   * Find similar trajectories based on query vector.
   *
   * @param queryVector - Query vector to compare against
   * @param limit - Maximum number to return (default: 10)
   * @param minSimilarity - Minimum cosine similarity (default: 0.7)
   * @returns Array of similar trajectories with similarity scores
   */
  findSimilar(
    queryVector: number[],
    limit = 10,
    minSimilarity = 0.7,
  ): Array<{ trajectory: Trajectory; similarity: number }> {
    const results: Array<{ trajectory: Trajectory; similarity: number }> = [];

    for (const trajectory of this.trajectories.values()) {
      const similarity = this.cosineSimilarity(queryVector, trajectory.queryVector);
      if (similarity >= minSimilarity) {
        results.push({ trajectory, similarity });
      }
    }

    // Sort by similarity descending and limit
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Prune old trajectories to stay within the configured limit.
   * Removes oldest trajectories first (LRU), but prefers keeping
   * trajectories with feedback.
   *
   * @returns Number of trajectories pruned
   */
  prune(): number {
    const targetSize = Math.floor(this.config.maxTrajectories * 0.9); // Keep 90% after pruning
    const toRemove = this.trajectoryOrder.length - targetSize;

    if (toRemove <= 0) {
      return 0;
    }

    // Separate trajectories into those with and without feedback
    const withFeedback: string[] = [];
    const withoutFeedback: string[] = [];

    for (const id of this.trajectoryOrder) {
      const trajectory = this.trajectories.get(id);
      if (!trajectory) continue;

      if (trajectory.feedback !== null) {
        withFeedback.push(id);
      } else {
        withoutFeedback.push(id);
      }
    }

    // Remove trajectories without feedback first (oldest first)
    let removed = 0;
    const toDelete: string[] = [];

    for (const id of withoutFeedback) {
      if (removed >= toRemove) break;
      toDelete.push(id);
      removed++;
    }

    // If still need to remove more, remove old feedback trajectories
    if (removed < toRemove) {
      for (const id of withFeedback) {
        if (removed >= toRemove) break;
        toDelete.push(id);
        removed++;
      }
    }

    // Perform deletion - use Set for O(1) lookups instead of O(n) array.includes
    const toDeleteSet = new Set(toDelete);
    for (const id of toDelete) {
      this.trajectories.delete(id);
    }
    this.trajectoryOrder = this.trajectoryOrder.filter((id) => !toDeleteSet.has(id));

    this.logger.info?.(
      `trajectory: pruned ${removed} trajectories (remaining: ${this.trajectories.size})`,
    );

    return removed;
  }

  /**
   * Clear all trajectories.
   */
  clear(): void {
    this.trajectories.clear();
    this.trajectoryOrder = [];
    this.logger.info?.("trajectory: cleared all trajectories");
  }

  /**
   * Get statistics about recorded trajectories.
   */
  getStats(): TrajectoryStats {
    let trajectoriesWithFeedback = 0;
    let totalFeedback = 0;
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    for (const trajectory of this.trajectories.values()) {
      if (trajectory.feedback !== null) {
        trajectoriesWithFeedback++;
        totalFeedback += trajectory.feedback;
      }

      if (oldestTimestamp === null || trajectory.timestamp < oldestTimestamp) {
        oldestTimestamp = trajectory.timestamp;
      }
      if (newestTimestamp === null || trajectory.timestamp > newestTimestamp) {
        newestTimestamp = trajectory.timestamp;
      }
    }

    return {
      totalTrajectories: this.trajectories.size,
      trajectoriesWithFeedback,
      averageFeedbackScore: trajectoriesWithFeedback > 0
        ? totalFeedback / trajectoriesWithFeedback
        : 0,
      oldestTimestamp,
      newestTimestamp,
    };
  }

  /**
   * Export trajectories for persistence or analysis.
   *
   * @param options - Filter options for export
   * @returns Array of trajectory objects
   */
  export(options: GetTrajectoriesOptions = {}): Trajectory[] {
    return this.getRecent({ ...options, limit: this.config.maxTrajectories });
  }

  /**
   * Import trajectories from a previous export.
   *
   * @param trajectories - Array of trajectories to import
   * @returns Number of trajectories imported
   */
  import(trajectories: Trajectory[]): number {
    let imported = 0;

    for (const trajectory of trajectories) {
      // Skip if already exists
      if (this.trajectories.has(trajectory.id)) {
        continue;
      }

      this.trajectories.set(trajectory.id, trajectory);
      this.trajectoryOrder.push(trajectory.id);
      imported++;
    }

    // Sort trajectory order by timestamp
    this.trajectoryOrder.sort((a, b) => {
      const tA = this.trajectories.get(a)?.timestamp ?? 0;
      const tB = this.trajectories.get(b)?.timestamp ?? 0;
      return tA - tB;
    });

    // Prune if needed
    if (this.trajectoryOrder.length > this.config.maxTrajectories) {
      this.prune();
    }

    this.logger.info?.(`trajectory: imported ${imported} trajectories`);
    return imported;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Calculate cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
      return 0;
    }

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
}
