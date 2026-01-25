/**
 * Background Learning Loop for SONA (Self-Organizing Neural Architecture)
 *
 * Runs periodic learning cycles to analyze trajectories, update pattern clusters,
 * and adapt the memory system based on accumulated feedback and usage patterns.
 *
 * Part of the P2 (Adaptive Loops) ruvLLM feature set.
 */

import type { PluginLogger } from "clawdbot/plugin-sdk";

import type { RuvectorClient } from "../../client.js";
import type { RuvectorDB, SearchResult } from "../../db.js";
import type { EmbeddingProvider } from "../../embeddings.js";
import type { SONAConfig } from "../../types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Trajectory data for learning analysis.
 */
export type Trajectory = {
  /** Unique trajectory ID */
  id: string;
  /** Query vector that initiated this trajectory */
  queryVector: number[];
  /** Result vectors that were selected/used */
  resultVectors: number[][];
  /** Quality/relevance scores for each result (0-1) */
  scores: number[];
  /** Timestamp when the trajectory was recorded */
  timestamp: number;
  /** Additional context metadata */
  metadata?: Record<string, unknown>;
};

/**
 * Pattern cluster learned from trajectories.
 */
export type PatternCluster = {
  /** Unique cluster ID */
  id: string;
  /** Centroid vector of the cluster */
  centroid: number[];
  /** Number of trajectories in this cluster */
  size: number;
  /** Average quality score of trajectories in this cluster */
  avgQuality: number;
  /** Last time this cluster was updated */
  lastUpdated: number;
  /** Boost factor for search relevance (1.0 = neutral) */
  boostFactor: number;
};

/**
 * Statistics from a learning cycle.
 */
export type LearningCycleStats = {
  /** Number of trajectories processed */
  trajectoriesProcessed: number;
  /** Number of clusters updated */
  clustersUpdated: number;
  /** Number of new patterns detected */
  newPatternsDetected: number;
  /** Time taken for the cycle in milliseconds */
  durationMs: number;
  /** Timestamp when the cycle completed */
  completedAt: number;
};

// =============================================================================
// BackgroundLoop Class
// =============================================================================

/**
 * Background learning loop for continuous pattern adaptation.
 *
 * Features:
 * - Runs on configurable interval (default: 30 seconds)
 * - Analyzes recent trajectories for pattern clustering
 * - Updates pattern boosts based on feedback quality
 * - Merges similar patterns to reduce noise
 *
 * @example
 * ```typescript
 * const loop = new BackgroundLoop({
 *   client,
 *   db,
 *   embeddings,
 *   config: { enabled: true, hiddenDim: 256, backgroundIntervalMs: 30000 },
 *   logger,
 * });
 *
 * loop.start();
 * // ... later ...
 * loop.stop();
 * ```
 */
export class BackgroundLoop {
  private readonly client: RuvectorClient;
  private readonly db: RuvectorDB;
  private readonly embeddings: EmbeddingProvider;
  private readonly config: SONAConfig;
  private readonly logger: PluginLogger;

  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private initialTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;
  private isCycleInProgress = false;

  // Learning state
  private trajectories: Trajectory[] = [];
  private patterns: Map<string, PatternCluster> = new Map();
  private cycleStats: LearningCycleStats[] = [];

  // Configuration
  private readonly maxTrajectories = 1000;
  private readonly maxPatterns = 100;
  private readonly patternMergeThreshold = 0.85;
  private readonly minClusterSize = 3;

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
  // Lifecycle Methods
  // ===========================================================================

  /**
   * Start the background learning loop.
   * Begins periodic learning cycles at the configured interval.
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn("background-loop: already running");
      return;
    }

    if (!this.config.enabled) {
      this.logger.info?.("background-loop: SONA disabled, not starting");
      return;
    }

    const intervalMs = this.config.backgroundIntervalMs ?? 30_000;
    this.logger.info?.(
      `background-loop: starting with interval ${intervalMs}ms`,
    );

    this.isRunning = true;

    // Run first cycle after a short delay to allow system to stabilize
    this.initialTimeoutHandle = setTimeout(() => {
      this.initialTimeoutHandle = null;
      if (this.isRunning) {
        this.runCycle().catch((err) => {
          this.logger.warn(`background-loop: initial cycle failed: ${formatError(err)}`);
        });
      }
    }, 5000);

    // Schedule periodic cycles
    this.intervalHandle = setInterval(() => {
      this.runCycle().catch((err) => {
        this.logger.warn(`background-loop: cycle failed: ${formatError(err)}`);
      });
    }, intervalMs);
  }

  /**
   * Stop the background learning loop.
   * Waits for any in-progress cycle to complete.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info?.("background-loop: stopping");
    this.isRunning = false;

    // Clear the initial timeout if still pending
    if (this.initialTimeoutHandle) {
      clearTimeout(this.initialTimeoutHandle);
      this.initialTimeoutHandle = null;
    }

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    // Wait for any in-progress cycle to complete (with timeout)
    const maxWaitMs = 30_000;
    const startTime = Date.now();
    while (this.isCycleInProgress && Date.now() - startTime < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.info?.("background-loop: stopped");
  }

  /**
   * Run a single learning cycle.
   * Analyzes recent trajectories and updates pattern clusters.
   *
   * @returns Statistics from the learning cycle
   */
  async runCycle(): Promise<LearningCycleStats> {
    if (this.isCycleInProgress) {
      this.logger.debug?.("background-loop: cycle already in progress, skipping");
      return {
        trajectoriesProcessed: 0,
        clustersUpdated: 0,
        newPatternsDetected: 0,
        durationMs: 0,
        completedAt: Date.now(),
      };
    }

    this.isCycleInProgress = true;
    const startTime = Date.now();

    try {
      this.logger.debug?.("background-loop: starting learning cycle");

      let trajectoriesProcessed = 0;
      let clustersUpdated = 0;
      let newPatternsDetected = 0;

      // Step 1: Process pending trajectories
      const pendingTrajectories = this.trajectories.filter(
        (t) => t.timestamp > Date.now() - 3600_000, // Last hour
      );
      trajectoriesProcessed = pendingTrajectories.length;

      if (pendingTrajectories.length === 0) {
        this.logger.debug?.("background-loop: no recent trajectories to process");
        const stats: LearningCycleStats = {
          trajectoriesProcessed: 0,
          clustersUpdated: 0,
          newPatternsDetected: 0,
          durationMs: Date.now() - startTime,
          completedAt: Date.now(),
        };
        this.cycleStats.push(stats);
        return stats;
      }

      // Step 2: Cluster trajectories by query similarity
      const clusterResults = await this.clusterTrajectories(pendingTrajectories);
      clustersUpdated = clusterResults.updated;
      newPatternsDetected = clusterResults.newPatterns;

      // Step 3: Update pattern boosts based on quality
      await this.updatePatternBoosts();

      // Step 4: Prune stale patterns
      this.pruneStalePatterns();

      // Step 5: Merge similar patterns
      const mergedCount = this.mergeSimilarPatterns();
      this.logger.debug?.(`background-loop: merged ${mergedCount} similar patterns`);

      // Step 6: Apply learned patterns to SONA engine
      await this.applyPatternsToSona();

      // Clean up processed trajectories
      this.trajectories = this.trajectories.filter(
        (t) => t.timestamp > Date.now() - 7200_000, // Keep last 2 hours
      );

      const durationMs = Date.now() - startTime;
      const stats: LearningCycleStats = {
        trajectoriesProcessed,
        clustersUpdated,
        newPatternsDetected,
        durationMs,
        completedAt: Date.now(),
      };

      this.cycleStats.push(stats);

      // Keep only recent cycle stats
      if (this.cycleStats.length > 100) {
        this.cycleStats = this.cycleStats.slice(-100);
      }

      this.logger.info?.(
        `background-loop: cycle complete - processed ${trajectoriesProcessed} trajectories, ` +
        `updated ${clustersUpdated} clusters, found ${newPatternsDetected} new patterns ` +
        `(${durationMs}ms)`,
      );

      return stats;
    } finally {
      this.isCycleInProgress = false;
    }
  }

  // ===========================================================================
  // Trajectory Management
  // ===========================================================================

  /**
   * Record a trajectory for learning.
   *
   * @param trajectory - The trajectory to record
   */
  recordTrajectory(trajectory: Trajectory): void {
    this.trajectories.push(trajectory);

    // Limit trajectory buffer size
    if (this.trajectories.length > this.maxTrajectories) {
      this.trajectories = this.trajectories.slice(-this.maxTrajectories);
    }

    this.logger.debug?.(
      `background-loop: recorded trajectory ${trajectory.id} (buffer: ${this.trajectories.length})`,
    );
  }

  /**
   * Get the current pattern clusters.
   */
  getPatterns(): PatternCluster[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get recent cycle statistics.
   */
  getCycleStats(): LearningCycleStats[] {
    return [...this.cycleStats];
  }

  /**
   * Check if the loop is currently running.
   */
  isActive(): boolean {
    return this.isRunning;
  }

  // ===========================================================================
  // Internal Learning Methods
  // ===========================================================================

  /**
   * Cluster trajectories by query similarity.
   */
  private async clusterTrajectories(
    trajectories: Trajectory[],
  ): Promise<{ updated: number; newPatterns: number }> {
    let updated = 0;
    let newPatterns = 0;

    for (const trajectory of trajectories) {
      // Find the best matching existing pattern
      let bestMatch: { pattern: PatternCluster; similarity: number } | null = null;

      for (const pattern of this.patterns.values()) {
        const similarity = cosineSimilarity(trajectory.queryVector, pattern.centroid);
        if (similarity > this.patternMergeThreshold) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { pattern, similarity };
          }
        }
      }

      if (bestMatch) {
        // Update existing pattern
        const pattern = bestMatch.pattern;
        const newSize = pattern.size + 1;
        const weight = 1 / newSize;

        // Update centroid as weighted average
        const newCentroid = pattern.centroid.map(
          (v, i) => v * (1 - weight) + (trajectory.queryVector[i] ?? 0) * weight,
        );

        // Update average quality
        const avgScore =
          trajectory.scores.length > 0
            ? trajectory.scores.reduce((a, b) => a + b, 0) / trajectory.scores.length
            : 0;
        const newAvgQuality =
          (pattern.avgQuality * pattern.size + avgScore) / newSize;

        // Update pattern in place
        pattern.centroid = newCentroid;
        pattern.size = newSize;
        pattern.avgQuality = newAvgQuality;
        pattern.lastUpdated = Date.now();

        updated++;
      } else {
        // Create new pattern
        const avgScore =
          trajectory.scores.length > 0
            ? trajectory.scores.reduce((a, b) => a + b, 0) / trajectory.scores.length
            : 0.5;

        const patternId = `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const newPattern: PatternCluster = {
          id: patternId,
          centroid: [...trajectory.queryVector],
          size: 1,
          avgQuality: avgScore,
          lastUpdated: Date.now(),
          boostFactor: 1.0,
        };

        this.patterns.set(patternId, newPattern);
        newPatterns++;

        // Limit total patterns
        if (this.patterns.size > this.maxPatterns) {
          this.pruneWeakestPatterns();
        }
      }
    }

    return { updated, newPatterns };
  }

  /**
   * Update pattern boost factors based on quality.
   */
  private async updatePatternBoosts(): Promise<void> {
    const qualityThreshold = this.config.qualityThreshold ?? 0.5;
    const learningRate = this.config.learningRate ?? 0.01;

    for (const pattern of this.patterns.values()) {
      if (pattern.size < this.minClusterSize) {
        // Not enough data, keep neutral boost
        continue;
      }

      // Boost high-quality patterns, reduce low-quality ones
      const qualityDelta = pattern.avgQuality - qualityThreshold;
      const boostDelta = qualityDelta * learningRate;

      // Update boost factor with bounds
      pattern.boostFactor = Math.max(0.5, Math.min(2.0, pattern.boostFactor + boostDelta));
    }
  }

  /**
   * Prune patterns that haven't been updated recently.
   */
  private pruneStalePatterns(): void {
    const staleThreshold = Date.now() - 24 * 3600_000; // 24 hours

    for (const [id, pattern] of this.patterns.entries()) {
      if (pattern.lastUpdated < staleThreshold && pattern.size < this.minClusterSize) {
        this.patterns.delete(id);
        this.logger.debug?.(`background-loop: pruned stale pattern ${id}`);
      }
    }
  }

  /**
   * Remove the weakest patterns when limit is exceeded.
   */
  private pruneWeakestPatterns(): void {
    if (this.patterns.size <= this.maxPatterns) return;

    // Score patterns by size * avgQuality * recency
    const scored = Array.from(this.patterns.entries()).map(([id, p]) => {
      const recencyFactor = Math.exp(-(Date.now() - p.lastUpdated) / 3600_000);
      const score = p.size * p.avgQuality * recencyFactor;
      return { id, score };
    });

    // Sort by score ascending and remove weakest
    scored.sort((a, b) => a.score - b.score);
    const toRemove = scored.slice(0, this.patterns.size - this.maxPatterns);

    for (const { id } of toRemove) {
      this.patterns.delete(id);
    }
  }

  /**
   * Merge patterns that are too similar.
   */
  private mergeSimilarPatterns(): number {
    let mergedCount = 0;
    const patternsArray = Array.from(this.patterns.entries());

    for (let i = 0; i < patternsArray.length; i++) {
      const [id1, p1] = patternsArray[i];
      if (!this.patterns.has(id1)) continue;

      for (let j = i + 1; j < patternsArray.length; j++) {
        const [id2, p2] = patternsArray[j];
        if (!this.patterns.has(id2)) continue;

        const similarity = cosineSimilarity(p1.centroid, p2.centroid);
        if (similarity > this.patternMergeThreshold) {
          // Merge p2 into p1
          const totalSize = p1.size + p2.size;
          const weight1 = p1.size / totalSize;
          const weight2 = p2.size / totalSize;

          p1.centroid = p1.centroid.map(
            (v, idx) => v * weight1 + (p2.centroid[idx] ?? 0) * weight2,
          );
          p1.size = totalSize;
          p1.avgQuality = p1.avgQuality * weight1 + p2.avgQuality * weight2;
          p1.boostFactor = Math.max(p1.boostFactor, p2.boostFactor);
          p1.lastUpdated = Math.max(p1.lastUpdated, p2.lastUpdated);

          this.patterns.delete(id2);
          mergedCount++;
        }
      }
    }

    return mergedCount;
  }

  /**
   * Apply learned patterns to the SONA engine.
   */
  private async applyPatternsToSona(): Promise<void> {
    try {
      // Check if SONA is available and enabled
      const sonaStats = await this.client.getSONAStats();
      if (!sonaStats.enabled) {
        return;
      }

      // Apply high-boost patterns as learning signals
      const highBoostPatterns = Array.from(this.patterns.values())
        .filter((p) => p.boostFactor > 1.1 && p.size >= this.minClusterSize)
        .sort((a, b) => b.boostFactor - a.boostFactor)
        .slice(0, 10);

      for (const pattern of highBoostPatterns) {
        // Apply micro-LoRA update for high-quality patterns
        if (pattern.avgQuality >= (this.config.qualityThreshold ?? 0.5)) {
          // The applyMicroLora method updates internal weights
          // We pass the pattern centroid as the input to reinforce
          const client = this.client as RuvectorClient & {
            applyMicroLora?: (vector: number[]) => void;
          };
          if (client.applyMicroLora) {
            client.applyMicroLora(pattern.centroid);
          }
        }
      }
    } catch (err) {
      this.logger.debug?.(`background-loop: failed to apply patterns to SONA: ${formatError(err)}`);
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
