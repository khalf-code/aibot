/**
 * Consolidation Loop for Deep Learning
 *
 * Runs periodic deep consolidation of learned patterns. Unlike continuous
 * online learning, this loop performs comprehensive pattern analysis,
 * clustering, and consolidation at lower frequency.
 *
 * Key features:
 * - Full pattern reanalysis with clustering
 * - Integration with EWC for catastrophic forgetting prevention
 * - Pattern export/import for persistence and transfer
 * - Configurable intervals and batch sizes
 */

import { randomUUID } from "node:crypto";
import { readFile, writeFile, access, constants } from "node:fs/promises";
import { dirname } from "node:path";

import type { LearnedPattern } from "../../types.js";
import { EWCConsolidator, type EWCConfig, type ConsolidationResult } from "../ewc.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for the consolidation loop.
 */
export type ConsolidationLoopConfig = {
  /** Interval between consolidation runs in ms (default: 3600000 = 1 hour) */
  intervalMs?: number;
  /** Minimum patterns before triggering consolidation (default: 100) */
  minPatternsForConsolidation?: number;
  /** K-means clustering iterations (default: 10) */
  clusteringIterations?: number;
  /** Number of clusters for pattern grouping (default: auto) */
  numClusters?: number;
  /** EWC configuration */
  ewc?: EWCConfig;
  /** Whether to auto-start the loop (default: false) */
  autoStart?: boolean;
};

/**
 * Statistics from a consolidation run.
 */
export type ConsolidationStats = {
  /** Total runs completed */
  totalRuns: number;
  /** Timestamp of last run */
  lastRunAt: number | null;
  /** Duration of last run in ms */
  lastRunDurationMs: number;
  /** Total patterns processed */
  totalPatternsProcessed: number;
  /** Total patterns merged */
  totalPatternsMerged: number;
  /** Total patterns pruned */
  totalPatternsPruned: number;
  /** Current pattern count */
  currentPatternCount: number;
  /** Average consolidation time in ms */
  avgConsolidationTimeMs: number;
};

/**
 * Export format for patterns.
 */
export type PatternExport = {
  /** Export version for compatibility */
  version: string;
  /** Export timestamp */
  exportedAt: number;
  /** Exported patterns */
  patterns: LearnedPattern[];
  /** EWC state if available */
  ewcState?: ReturnType<EWCConsolidator["exportState"]>;
  /** Export metadata */
  metadata?: Record<string, unknown>;
};

// =============================================================================
// Consolidation Loop Implementation
// =============================================================================

/**
 * Consolidation Loop for periodic deep pattern consolidation.
 *
 * Manages a background loop that:
 * 1. Collects patterns over time
 * 2. Periodically runs deep consolidation (clustering + EWC)
 * 3. Exports/imports patterns for persistence
 */
export class ConsolidationLoop {
  private config: Required<Omit<ConsolidationLoopConfig, "ewc">> & { ewc: EWCConfig };
  private ewc: EWCConsolidator;
  private patterns: Map<string, LearnedPattern> = new Map();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;

  // Statistics tracking
  private stats: ConsolidationStats = {
    totalRuns: 0,
    lastRunAt: null,
    lastRunDurationMs: 0,
    totalPatternsProcessed: 0,
    totalPatternsMerged: 0,
    totalPatternsPruned: 0,
    currentPatternCount: 0,
    avgConsolidationTimeMs: 0,
  };

  constructor(config: ConsolidationLoopConfig = {}) {
    this.config = {
      intervalMs: config.intervalMs ?? 3600000, // 1 hour
      minPatternsForConsolidation: config.minPatternsForConsolidation ?? 100,
      clusteringIterations: config.clusteringIterations ?? 10,
      numClusters: config.numClusters ?? 0, // 0 = auto
      ewc: config.ewc ?? {},
      autoStart: config.autoStart ?? false,
    };

    this.ewc = new EWCConsolidator(this.config.ewc);

    if (this.config.autoStart) {
      this.start();
    }
  }

  // ===========================================================================
  // Lifecycle Management
  // ===========================================================================

  /**
   * Start the consolidation loop.
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.intervalHandle = setInterval(() => {
      void this.runDeepConsolidation();
    }, this.config.intervalMs);
  }

  /**
   * Stop the consolidation loop.
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Check if the loop is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  // ===========================================================================
  // Pattern Management
  // ===========================================================================

  /**
   * Add a pattern to be tracked for consolidation.
   *
   * @param pattern - Pattern to add
   */
  addPattern(pattern: LearnedPattern): void {
    this.patterns.set(pattern.id, pattern);
    this.stats.currentPatternCount = this.patterns.size;
  }

  /**
   * Add multiple patterns.
   *
   * @param patterns - Patterns to add
   */
  addPatterns(patterns: LearnedPattern[]): void {
    for (const pattern of patterns) {
      this.patterns.set(pattern.id, pattern);
    }
    this.stats.currentPatternCount = this.patterns.size;
  }

  /**
   * Get a pattern by ID.
   *
   * @param id - Pattern ID
   * @returns Pattern or null
   */
  getPattern(id: string): LearnedPattern | null {
    return this.patterns.get(id) ?? null;
  }

  /**
   * Get all current patterns.
   */
  getAllPatterns(): LearnedPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Remove a pattern.
   *
   * @param id - Pattern ID to remove
   * @returns True if removed
   */
  removePattern(id: string): boolean {
    const removed = this.patterns.delete(id);
    this.stats.currentPatternCount = this.patterns.size;
    return removed;
  }

  /**
   * Clear all patterns.
   */
  clearPatterns(): void {
    this.patterns.clear();
    this.stats.currentPatternCount = 0;
  }

  // ===========================================================================
  // Deep Consolidation
  // ===========================================================================

  /**
   * Run deep consolidation process.
   *
   * This performs:
   * 1. K-means clustering to group similar patterns
   * 2. EWC-based consolidation (merge + prune)
   * 3. Statistics update
   *
   * @returns Consolidation result
   */
  async runDeepConsolidation(): Promise<ConsolidationResult | null> {
    const patternCount = this.patterns.size;

    // Skip if below threshold
    if (patternCount < this.config.minPatternsForConsolidation) {
      return null;
    }

    const startTime = Date.now();
    const patternsArray = Array.from(this.patterns.values());

    // Step 1: K-means clustering
    const clusteredPatterns = this.performClustering(patternsArray);

    // Step 2: EWC consolidation
    const { patterns: consolidated, result } = this.ewc.consolidate(clusteredPatterns);

    // Step 3: Update pattern store
    this.patterns.clear();
    for (const pattern of consolidated) {
      this.patterns.set(pattern.id, pattern);
    }

    // Step 4: Update statistics
    const duration = Date.now() - startTime;
    this.stats.totalRuns++;
    this.stats.lastRunAt = Date.now();
    this.stats.lastRunDurationMs = duration;
    this.stats.totalPatternsProcessed += result.patternsBefore;
    this.stats.totalPatternsMerged += result.patternsMerged;
    this.stats.totalPatternsPruned += result.patternsPruned;
    this.stats.currentPatternCount = this.patterns.size;
    this.stats.avgConsolidationTimeMs =
      (this.stats.avgConsolidationTimeMs * (this.stats.totalRuns - 1) + duration) /
      this.stats.totalRuns;

    return result;
  }

  /**
   * Perform K-means clustering on patterns.
   *
   * @param patterns - Patterns to cluster
   * @returns Clustered patterns (centroids become new pattern centroids)
   */
  private performClustering(patterns: LearnedPattern[]): LearnedPattern[] {
    if (patterns.length === 0) return [];

    // Determine number of clusters
    const k = this.config.numClusters > 0
      ? this.config.numClusters
      : Math.max(10, Math.floor(Math.sqrt(patterns.length / 2)));

    // Initialize centroids randomly
    const dimension = patterns[0].centroid.length;
    let centroids = this.initializeCentroids(patterns, k);

    // K-means iterations
    for (let iter = 0; iter < this.config.clusteringIterations; iter++) {
      // Assign patterns to nearest centroid
      const clusters: LearnedPattern[][] = Array.from({ length: k }, () => []);

      for (const pattern of patterns) {
        let nearestIdx = 0;
        let nearestDist = Infinity;

        for (let i = 0; i < centroids.length; i++) {
          const dist = this.euclideanDistance(pattern.centroid, centroids[i]);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestIdx = i;
          }
        }

        clusters[nearestIdx].push(pattern);
      }

      // Update centroids
      const newCentroids: number[][] = [];

      for (let i = 0; i < k; i++) {
        const cluster = clusters[i];
        if (cluster.length === 0) {
          // Keep old centroid if cluster is empty
          newCentroids.push(centroids[i]);
        } else {
          // Compute weighted average of cluster centroids
          const newCentroid = Array.from<number>({ length: dimension }).fill(0);
          let totalWeight = 0;

          for (const pattern of cluster) {
            const weight = pattern.clusterSize;
            totalWeight += weight;
            for (let j = 0; j < dimension; j++) {
              newCentroid[j] += (pattern.centroid[j] ?? 0) * weight;
            }
          }

          for (let j = 0; j < dimension; j++) {
            newCentroid[j] /= totalWeight;
          }

          newCentroids.push(newCentroid);
        }
      }

      centroids = newCentroids;
    }

    // Convert clusters to patterns
    const result: LearnedPattern[] = [];
    const clusters: LearnedPattern[][] = Array.from({ length: k }, () => []);

    for (const pattern of patterns) {
      let nearestIdx = 0;
      let nearestDist = Infinity;

      for (let i = 0; i < centroids.length; i++) {
        const dist = this.euclideanDistance(pattern.centroid, centroids[i]);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }

      clusters[nearestIdx].push(pattern);
    }

    for (let i = 0; i < k; i++) {
      const cluster = clusters[i];
      if (cluster.length === 0) continue;

      // Aggregate cluster into single pattern
      let totalSize = 0;
      let totalQuality = 0;

      for (const pattern of cluster) {
        totalSize += pattern.clusterSize;
        totalQuality += pattern.avgQuality * pattern.clusterSize;
      }

      result.push({
        id: `cluster-${randomUUID().slice(0, 8)}`,
        centroid: centroids[i],
        clusterSize: totalSize,
        avgQuality: totalQuality / totalSize,
      });
    }

    return result;
  }

  /**
   * Initialize K-means centroids using K-means++ algorithm.
   */
  private initializeCentroids(patterns: LearnedPattern[], k: number): number[][] {
    if (patterns.length <= k) {
      return patterns.map((p) => [...p.centroid]);
    }

    const centroids: number[][] = [];

    // First centroid: random pattern
    const firstIdx = Math.floor(Math.random() * patterns.length);
    centroids.push([...patterns[firstIdx].centroid]);

    // Remaining centroids: probability proportional to distance squared
    while (centroids.length < k) {
      const centroidsLengthBefore = centroids.length;
      const distances: number[] = [];
      let totalDist = 0;

      for (const pattern of patterns) {
        // Distance to nearest existing centroid
        let minDist = Infinity;
        for (const centroid of centroids) {
          const dist = this.euclideanDistance(pattern.centroid, centroid);
          if (dist < minDist) minDist = dist;
        }
        distances.push(minDist * minDist);
        totalDist += minDist * minDist;
      }

      // Sample with probability proportional to distance squared
      let threshold = Math.random() * totalDist;
      for (let i = 0; i < patterns.length; i++) {
        threshold -= distances[i];
        if (threshold <= 0) {
          centroids.push([...patterns[i].centroid]);
          break;
        }
      }

      // Fallback in case of numerical issues (loop didn't add a centroid)
      if (centroids.length === centroidsLengthBefore) {
        // Sampling loop completed without adding - pick random
        const idx = Math.floor(Math.random() * patterns.length);
        centroids.push([...patterns[idx].centroid]);
      }
    }

    return centroids;
  }

  // ===========================================================================
  // Export/Import
  // ===========================================================================

  /**
   * Export patterns to a file.
   *
   * @param path - File path to write to
   * @param metadata - Optional metadata to include
   * @throws {Error} If path is invalid or write fails
   */
  async exportPatterns(path: string, metadata?: Record<string, unknown>): Promise<void> {
    // Validate path
    if (!path || typeof path !== "string") {
      throw new Error("Invalid export path: path must be a non-empty string");
    }

    // Ensure parent directory exists and is writable
    const dir = dirname(path);
    try {
      await access(dir, constants.W_OK);
    } catch {
      throw new Error(`Export directory is not writable: ${dir}`);
    }

    const exportData: PatternExport = {
      version: "1.0.0",
      exportedAt: Date.now(),
      patterns: Array.from(this.patterns.values()),
      ewcState: this.ewc.exportState(),
      metadata,
    };

    await writeFile(path, JSON.stringify(exportData, null, 2), "utf-8");
  }

  /**
   * Import patterns from a file.
   *
   * @param path - File path to read from
   * @param replace - If true, replace existing patterns; if false, merge
   * @throws {Error} If path is invalid, file doesn't exist, or format is invalid
   */
  async importPatterns(path: string, replace = false): Promise<PatternExport> {
    // Validate path
    if (!path || typeof path !== "string") {
      throw new Error("Invalid import path: path must be a non-empty string");
    }

    // Check file exists and is readable
    try {
      await access(path, constants.R_OK);
    } catch {
      throw new Error(`Import file not found or not readable: ${path}`);
    }

    const content = await readFile(path, "utf-8");

    // Parse and validate JSON structure
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch (err) {
      throw new Error(`Invalid JSON in pattern file: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Type guard for PatternExport
    if (
      typeof data !== "object" ||
      data === null ||
      !("version" in data) ||
      !("patterns" in data) ||
      typeof (data as Record<string, unknown>).version !== "string" ||
      !Array.isArray((data as Record<string, unknown>).patterns)
    ) {
      throw new Error("Invalid pattern export format: missing or invalid version/patterns fields");
    }

    const typedData = data as PatternExport;

    // Validate pattern structure
    for (const pattern of typedData.patterns) {
      if (
        typeof pattern.id !== "string" ||
        !Array.isArray(pattern.centroid) ||
        typeof pattern.clusterSize !== "number" ||
        typeof pattern.avgQuality !== "number"
      ) {
        throw new Error(`Invalid pattern format for pattern: ${JSON.stringify(pattern).slice(0, 100)}`);
      }
    }

    // Import patterns
    if (replace) {
      this.patterns.clear();
    }

    for (const pattern of typedData.patterns) {
      this.patterns.set(pattern.id, pattern);
    }

    // Import EWC state if available
    if (typedData.ewcState) {
      this.ewc.importState(typedData.ewcState);
    }

    this.stats.currentPatternCount = this.patterns.size;

    return typedData;
  }

  /**
   * Merge patterns into existing patterns using EWC consolidation.
   *
   * @param patterns - Patterns to merge
   * @returns Consolidation result
   */
  mergePatterns(patterns: LearnedPattern[]): ConsolidationResult {
    // Add new patterns
    for (const pattern of patterns) {
      this.patterns.set(pattern.id, pattern);
    }

    // Run consolidation to merge
    const allPatterns = Array.from(this.patterns.values());
    const { patterns: consolidated, result } = this.ewc.consolidate(allPatterns);

    // Update pattern store
    this.patterns.clear();
    for (const pattern of consolidated) {
      this.patterns.set(pattern.id, pattern);
    }

    this.stats.currentPatternCount = this.patterns.size;

    return result;
  }

  // ===========================================================================
  // EWC Access
  // ===========================================================================

  /**
   * Get the EWC consolidator instance for direct access.
   */
  getEWC(): EWCConsolidator {
    return this.ewc;
  }

  /**
   * Protect critical patterns (delegates to EWC).
   */
  protectCritical(patternIds: string[], reason?: string): void {
    this.ewc.protectCritical(patternIds, reason);
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get consolidation statistics.
   */
  getStats(): ConsolidationStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.stats = {
      totalRuns: 0,
      lastRunAt: null,
      lastRunDurationMs: 0,
      totalPatternsProcessed: 0,
      totalPatternsMerged: 0,
      totalPatternsPruned: 0,
      currentPatternCount: this.patterns.size,
      avgConsolidationTimeMs: 0,
    };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Compute Euclidean distance between two vectors.
   */
  private euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) return Infinity;

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = (a[i] ?? 0) - (b[i] ?? 0);
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }
}
