/**
 * EWC (Elastic Weight Consolidation) Consolidator
 *
 * Implements a simplified EWC++ approach for preventing catastrophic forgetting
 * in learned patterns. Uses Fisher Information Matrix approximation to identify
 * and protect important patterns during consolidation.
 *
 * Key concepts:
 * - Fisher Information: Measures how much changing a pattern affects predictions
 * - Protected Patterns: Critical patterns that should not be modified during consolidation
 * - Pattern Consolidation: Merges similar patterns while preserving important ones
 */

import type { LearnedPattern } from "../types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Fisher information entry for a pattern dimension.
 * Tracks how important each dimension is for the pattern's behavior.
 */
export type FisherInfo = {
  /** Pattern ID this information belongs to */
  patternId: string;
  /** Diagonal of Fisher Information Matrix (importance per dimension) */
  importance: number[];
  /** Number of samples used to compute this estimate */
  sampleCount: number;
  /** Timestamp of last update */
  lastUpdated: number;
};

/**
 * Protected pattern entry with consolidation metadata.
 */
export type ProtectedPattern = {
  /** Pattern ID */
  id: string;
  /** Protection level (0-1, higher = more protected) */
  protectionLevel: number;
  /** Reason for protection */
  reason?: string;
  /** Timestamp when protection was set */
  protectedAt: number;
};

/**
 * Configuration for the EWC Consolidator.
 */
export type EWCConfig = {
  /** Lambda parameter controlling protection strength (default: 1000) */
  lambda?: number;
  /** Minimum similarity for pattern merging (default: 0.85) */
  mergeSimilarityThreshold?: number;
  /** Maximum patterns to keep after consolidation (default: 1000) */
  maxPatterns?: number;
  /** Decay rate for Fisher information (default: 0.99) */
  fisherDecay?: number;
};

/**
 * Result from a consolidation operation.
 */
export type ConsolidationResult = {
  /** Number of patterns before consolidation */
  patternsBefore: number;
  /** Number of patterns after consolidation */
  patternsAfter: number;
  /** Number of patterns merged */
  patternsMerged: number;
  /** Number of patterns pruned */
  patternsPruned: number;
  /** Number of protected patterns preserved */
  protectedPreserved: number;
  /** Time taken in milliseconds */
  durationMs: number;
};

// =============================================================================
// EWC Consolidator Implementation
// =============================================================================

/**
 * EWC Consolidator for preventing catastrophic forgetting.
 *
 * Uses a simplified EWC++ approach where Fisher Information approximates
 * the importance of pattern dimensions. Protected patterns are preserved
 * during consolidation while similar patterns are merged.
 */
export class EWCConsolidator {
  private config: Required<EWCConfig>;
  private fisherInfo: Map<string, FisherInfo> = new Map();
  private protectedPatterns: Map<string, ProtectedPattern> = new Map();

  constructor(config: EWCConfig = {}) {
    this.config = {
      lambda: config.lambda ?? 1000,
      mergeSimilarityThreshold: config.mergeSimilarityThreshold ?? 0.85,
      maxPatterns: config.maxPatterns ?? 1000,
      fisherDecay: config.fisherDecay ?? 0.99,
    };
  }

  // ===========================================================================
  // Fisher Information Tracking
  // ===========================================================================

  /**
   * Update Fisher Information for a pattern based on gradient observations.
   * Uses running average with exponential decay for online estimation.
   *
   * @param patternId - Pattern to update
   * @param gradients - Observed gradients (approximated from relevance feedback)
   */
  updateFisherInfo(patternId: string, gradients: number[]): void {
    const existing = this.fisherInfo.get(patternId);

    if (existing) {
      // Exponential moving average update
      const decay = this.config.fisherDecay;
      const newImportance = existing.importance.map((imp, i) => {
        const grad = gradients[i] ?? 0;
        return decay * imp + (1 - decay) * grad * grad;
      });

      this.fisherInfo.set(patternId, {
        patternId,
        importance: newImportance,
        sampleCount: existing.sampleCount + 1,
        lastUpdated: Date.now(),
      });
    } else {
      // Initialize with squared gradients
      this.fisherInfo.set(patternId, {
        patternId,
        importance: gradients.map((g) => g * g),
        sampleCount: 1,
        lastUpdated: Date.now(),
      });
    }
  }

  /**
   * Get Fisher Information for a pattern.
   *
   * @param patternId - Pattern ID to lookup
   * @returns Fisher information or null if not tracked
   */
  getFisherInfo(patternId: string): FisherInfo | null {
    return this.fisherInfo.get(patternId) ?? null;
  }

  /**
   * Compute total importance score for a pattern.
   * Higher values indicate more important patterns.
   *
   * @param patternId - Pattern to score
   * @returns Importance score or 0 if not tracked
   */
  computeImportance(patternId: string): number {
    const info = this.fisherInfo.get(patternId);
    if (!info || info.importance.length === 0) return 0;

    // Sum of Fisher diagonal gives overall importance
    let total = 0;
    for (const imp of info.importance) {
      total += imp;
    }
    return total / info.importance.length;
  }

  // ===========================================================================
  // Pattern Protection
  // ===========================================================================

  /**
   * Mark patterns as protected (critical patterns that should not be modified).
   *
   * @param patternIds - Array of pattern IDs to protect
   * @param reason - Optional reason for protection
   * @param protectionLevel - Protection strength (0-1, default: 1.0)
   */
  protectCritical(
    patternIds: string[],
    reason?: string,
    protectionLevel = 1.0,
  ): void {
    const now = Date.now();
    for (const id of patternIds) {
      this.protectedPatterns.set(id, {
        id,
        protectionLevel: Math.max(0, Math.min(1, protectionLevel)),
        reason,
        protectedAt: now,
      });
    }
  }

  /**
   * Remove protection from patterns.
   *
   * @param patternIds - Array of pattern IDs to unprotect
   */
  unprotect(patternIds: string[]): void {
    for (const id of patternIds) {
      this.protectedPatterns.delete(id);
    }
  }

  /**
   * Check if a pattern is protected.
   *
   * @param patternId - Pattern ID to check
   * @returns True if protected
   */
  isProtected(patternId: string): boolean {
    return this.protectedPatterns.has(patternId);
  }

  /**
   * Get protection info for a pattern.
   *
   * @param patternId - Pattern ID to lookup
   * @returns Protection info or null
   */
  getProtection(patternId: string): ProtectedPattern | null {
    return this.protectedPatterns.get(patternId) ?? null;
  }

  /**
   * Get all protected pattern IDs.
   *
   * @returns Array of protected pattern IDs
   */
  getProtectedIds(): string[] {
    return Array.from(this.protectedPatterns.keys());
  }

  // ===========================================================================
  // Pattern Consolidation
  // ===========================================================================

  /**
   * Consolidate patterns by merging similar ones and pruning low-importance ones.
   * Protected patterns are always preserved.
   *
   * Algorithm:
   * 1. Separate protected patterns (always kept)
   * 2. Sort remaining patterns by importance (Fisher-based)
   * 3. Merge similar patterns using centroid averaging
   * 4. Prune lowest importance patterns if over limit
   *
   * @param patterns - Array of patterns to consolidate
   * @returns Consolidated patterns and result statistics
   */
  consolidate(patterns: LearnedPattern[]): {
    patterns: LearnedPattern[];
    result: ConsolidationResult;
  } {
    const startTime = Date.now();
    const patternsBefore = patterns.length;

    // Separate protected and unprotected patterns
    const protectedList: LearnedPattern[] = [];
    const unprotectedList: LearnedPattern[] = [];

    for (const pattern of patterns) {
      if (this.protectedPatterns.has(pattern.id)) {
        protectedList.push(pattern);
      } else {
        unprotectedList.push(pattern);
      }
    }

    // Sort unprotected by importance (descending)
    const withImportance = unprotectedList.map((p) => ({
      pattern: p,
      importance: this.computeImportance(p.id),
    }));
    withImportance.sort((a, b) => b.importance - a.importance);

    // Merge similar patterns
    const merged: LearnedPattern[] = [];
    const mergedIds = new Set<string>();
    let mergeCount = 0;

    for (const { pattern } of withImportance) {
      if (mergedIds.has(pattern.id)) continue;

      // Find similar patterns to merge with
      const toMerge = [pattern];

      for (const { pattern: other } of withImportance) {
        if (other.id === pattern.id || mergedIds.has(other.id)) continue;

        const similarity = this.cosineSimilarity(pattern.centroid, other.centroid);
        if (similarity >= this.config.mergeSimilarityThreshold) {
          toMerge.push(other);
          mergedIds.add(other.id);
        }
      }

      // Merge patterns
      if (toMerge.length > 1) {
        const mergedPattern = this.mergePatterns(toMerge);
        merged.push(mergedPattern);
        mergeCount += toMerge.length - 1;
      } else {
        merged.push(pattern);
      }
      mergedIds.add(pattern.id);
    }

    // Prune if over limit (accounting for protected patterns)
    const maxUnprotected = Math.max(0, this.config.maxPatterns - protectedList.length);
    let prunedCount = 0;
    let finalMerged = merged;

    if (merged.length > maxUnprotected) {
      prunedCount = merged.length - maxUnprotected;
      finalMerged = merged.slice(0, maxUnprotected);
    }

    // Combine protected and consolidated patterns
    const finalPatterns = [...protectedList, ...finalMerged];

    return {
      patterns: finalPatterns,
      result: {
        patternsBefore,
        patternsAfter: finalPatterns.length,
        patternsMerged: mergeCount,
        patternsPruned: prunedCount,
        protectedPreserved: protectedList.length,
        durationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Compute EWC penalty for modifying a pattern.
   * Higher penalty indicates pattern is more important and should not change.
   *
   * @param patternId - Pattern ID
   * @param delta - Proposed change vector
   * @returns EWC penalty value
   */
  computePenalty(patternId: string, delta: number[]): number {
    const info = this.fisherInfo.get(patternId);
    if (!info) return 0;

    // EWC penalty: (lambda/2) * sum(F_i * delta_i^2)
    let penalty = 0;
    for (let i = 0; i < delta.length; i++) {
      const f = info.importance[i] ?? 0;
      const d = delta[i] ?? 0;
      penalty += f * d * d;
    }

    // Check if protected
    const protection = this.protectedPatterns.get(patternId);
    const protectionMultiplier = protection ? 1 + protection.protectionLevel * 10 : 1;

    return (this.config.lambda / 2) * penalty * protectionMultiplier;
  }

  // ===========================================================================
  // State Management
  // ===========================================================================

  /**
   * Clear all Fisher information and protection data.
   */
  clear(): void {
    this.fisherInfo.clear();
    this.protectedPatterns.clear();
  }

  /**
   * Export current state for persistence.
   */
  exportState(): {
    fisherInfo: FisherInfo[];
    protectedPatterns: ProtectedPattern[];
    config: Required<EWCConfig>;
  } {
    return {
      fisherInfo: Array.from(this.fisherInfo.values()),
      protectedPatterns: Array.from(this.protectedPatterns.values()),
      config: this.config,
    };
  }

  /**
   * Import state from persistence.
   *
   * @param state - Previously exported state
   */
  importState(state: {
    fisherInfo: FisherInfo[];
    protectedPatterns: ProtectedPattern[];
    config?: Partial<EWCConfig>;
  }): void {
    this.fisherInfo.clear();
    for (const info of state.fisherInfo) {
      this.fisherInfo.set(info.patternId, info);
    }

    this.protectedPatterns.clear();
    for (const prot of state.protectedPatterns) {
      this.protectedPatterns.set(prot.id, prot);
    }

    if (state.config) {
      this.config = {
        ...this.config,
        ...state.config,
      };
    }
  }

  /**
   * Get statistics about current state.
   */
  getStats(): {
    trackedPatterns: number;
    protectedPatterns: number;
    avgImportance: number;
    config: Required<EWCConfig>;
  } {
    let totalImportance = 0;
    for (const info of this.fisherInfo.values()) {
      totalImportance += info.importance.reduce((a, b) => a + b, 0) / info.importance.length;
    }

    return {
      trackedPatterns: this.fisherInfo.size,
      protectedPatterns: this.protectedPatterns.size,
      avgImportance: this.fisherInfo.size > 0 ? totalImportance / this.fisherInfo.size : 0,
      config: this.config,
    };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Merge multiple patterns into one by averaging centroids.
   */
  private mergePatterns(patterns: LearnedPattern[]): LearnedPattern {
    if (patterns.length === 0) {
      throw new Error("Cannot merge empty pattern array");
    }

    if (patterns.length === 1) {
      return patterns[0];
    }

    // Average the centroids
    const dimension = patterns[0].centroid.length;
    const mergedCentroid = Array.from<number>({ length: dimension }).fill(0);
    let totalSize = 0;
    let totalQuality = 0;

    for (const pattern of patterns) {
      const weight = pattern.clusterSize;
      totalSize += pattern.clusterSize;
      totalQuality += pattern.avgQuality * pattern.clusterSize;

      for (let i = 0; i < dimension; i++) {
        mergedCentroid[i] += (pattern.centroid[i] ?? 0) * weight;
      }
    }

    // Normalize by total weight
    for (let i = 0; i < dimension; i++) {
      mergedCentroid[i] /= totalSize;
    }

    return {
      id: `merged-${patterns[0].id}`,
      centroid: mergedCentroid,
      clusterSize: totalSize,
      avgQuality: totalQuality / totalSize,
    };
  }

  /**
   * Compute cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
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
}
