/**
 * Pattern Clustering for ruvLLM Learning Core (P1)
 *
 * Implements K-means++ clustering for learned patterns from SONA feedback.
 * Patterns are used to re-rank search results based on historical relevance.
 */

import type { LearnedPattern } from "../types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * A cluster of similar patterns learned from user feedback.
 */
export type PatternCluster = {
  /** Unique cluster identifier */
  id: string;
  /** Centroid vector representing the cluster center */
  centroid: number[];
  /** IDs of patterns belonging to this cluster */
  members: string[];
  /** Average quality score of members */
  avgQuality: number;
  /** Timestamp of last update */
  lastUpdated: number;
};

/**
 * A feedback sample used for pattern learning.
 */
export type FeedbackSample = {
  /** Unique sample identifier */
  id: string;
  /** Query vector that was searched */
  queryVector: number[];
  /** Result vector that was selected */
  resultVector: number[];
  /** Relevance score from user (0-1) */
  relevanceScore: number;
  /** Timestamp of the feedback */
  timestamp: number;
};

/**
 * Configuration for pattern clustering.
 */
export type PatternClusterConfig = {
  /** Maximum number of clusters (default: 10) */
  maxClusters?: number;
  /** Minimum samples per cluster (default: 3) */
  minSamplesPerCluster?: number;
  /** Convergence threshold for K-means (default: 0.001) */
  convergenceThreshold?: number;
  /** Maximum iterations for K-means (default: 100) */
  maxIterations?: number;
  /** Minimum quality threshold for learning (default: 0.5) */
  qualityThreshold?: number;
};

// =============================================================================
// PatternStore
// =============================================================================

/**
 * Store for learned patterns with K-means++ clustering.
 *
 * Patterns are learned from search feedback and used to:
 * 1. Re-rank search results based on historical relevance
 * 2. Suggest similar content based on clustered preferences
 * 3. Improve search quality over time through adaptation
 */
export class PatternStore {
  private clusters: Map<string, PatternCluster> = new Map();
  private samples: FeedbackSample[] = [];
  private config: Required<PatternClusterConfig>;
  private clusterIdCounter = 0;

  constructor(config: PatternClusterConfig = {}) {
    this.config = {
      maxClusters: config.maxClusters ?? 10,
      minSamplesPerCluster: config.minSamplesPerCluster ?? 3,
      convergenceThreshold: config.convergenceThreshold ?? 0.001,
      maxIterations: config.maxIterations ?? 100,
      qualityThreshold: config.qualityThreshold ?? 0.5,
    };
  }

  // ===========================================================================
  // Sample Management
  // ===========================================================================

  /**
   * Add a feedback sample to the store.
   * Triggers re-clustering if enough samples have accumulated.
   *
   * @param sample - Feedback sample to add
   */
  addSample(sample: FeedbackSample): void {
    // Only learn from high-quality feedback
    if (sample.relevanceScore < this.config.qualityThreshold) {
      return;
    }

    this.samples.push(sample);

    // Re-cluster periodically (every minSamplesPerCluster * 2 new samples)
    const reclusterThreshold = this.config.minSamplesPerCluster * 2;
    if (this.samples.length % reclusterThreshold === 0) {
      this.cluster();
    }
  }

  /**
   * Get all stored samples.
   */
  getSamples(): readonly FeedbackSample[] {
    return this.samples;
  }

  /**
   * Get sample count.
   */
  getSampleCount(): number {
    return this.samples.length;
  }

  // ===========================================================================
  // Clustering
  // ===========================================================================

  /**
   * Run K-means++ clustering on accumulated samples.
   * Updates the cluster centroids and assignments.
   */
  cluster(): void {
    if (this.samples.length < this.config.minSamplesPerCluster) {
      return;
    }

    // Determine number of clusters (adaptive based on sample count)
    const k = Math.min(
      this.config.maxClusters,
      Math.max(1, Math.floor(this.samples.length / this.config.minSamplesPerCluster)),
    );

    // Extract vectors for clustering (use combined query+result representation)
    const vectors = this.samples.map((s) => this.combineVectors(s.queryVector, s.resultVector));

    // Run K-means++ clustering
    const { centroids, assignments } = this.kMeansPlusPlus(vectors, k);

    // Build new clusters
    const newClusters = new Map<string, PatternCluster>();
    const now = Date.now();

    for (let i = 0; i < k; i++) {
      const memberIndices = assignments
        .map((a, idx) => (a === i ? idx : -1))
        .filter((idx) => idx !== -1);

      if (memberIndices.length < this.config.minSamplesPerCluster) {
        // Skip clusters that are too small
        continue;
      }

      const memberIds: string[] = [];
      let qualitySum = 0;
      for (const idx of memberIndices) {
        const sample = this.samples[idx];
        if (sample) {
          memberIds.push(sample.id);
          qualitySum += sample.relevanceScore;
        }
      }
      const avgQuality = memberIndices.length > 0 ? qualitySum / memberIndices.length : 0;

      const clusterId = `cluster-${this.clusterIdCounter++}`;
      newClusters.set(clusterId, {
        id: clusterId,
        centroid: centroids[i],
        members: memberIds,
        avgQuality,
        lastUpdated: now,
      });
    }

    this.clusters = newClusters;
  }

  /**
   * K-means++ clustering algorithm.
   *
   * @param vectors - Array of vectors to cluster
   * @param k - Number of clusters
   * @returns Centroids and cluster assignments
   */
  private kMeansPlusPlus(
    vectors: number[][],
    k: number,
  ): { centroids: number[][]; assignments: number[] } {
    if (vectors.length === 0 || k <= 0) {
      return { centroids: [], assignments: [] };
    }

    const n = vectors.length;
    const dim = vectors[0].length;

    // Initialize centroids using K-means++ seeding
    const centroids: number[][] = [];
    const assignments = Array.from({ length: n }, () => 0);

    // First centroid: random selection
    const firstIdx = Math.floor(Math.random() * n);
    centroids.push([...vectors[firstIdx]]);

    // Remaining centroids: probability proportional to squared distance
    for (let c = 1; c < k; c++) {
      const distances = vectors.map((v) => {
        const minDist = centroids.reduce(
          (min, centroid) => Math.min(min, this.squaredDistance(v, centroid)),
          Infinity,
        );
        return minDist;
      });

      const totalDist = distances.reduce((sum, d) => sum + d, 0);
      if (totalDist === 0) {
        // All points are at centroids, pick random
        const idx = Math.floor(Math.random() * n);
        centroids.push([...vectors[idx]]);
        continue;
      }

      // Weighted random selection
      let r = Math.random() * totalDist;
      let selectedIdx = 0;
      for (let i = 0; i < n; i++) {
        r -= distances[i];
        if (r <= 0) {
          selectedIdx = i;
          break;
        }
      }
      centroids.push([...vectors[selectedIdx]]);
    }

    // Iterate until convergence
    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      // Assign points to nearest centroid
      for (let i = 0; i < n; i++) {
        let minDist = Infinity;
        let minIdx = 0;
        for (let c = 0; c < k; c++) {
          const dist = this.squaredDistance(vectors[i], centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            minIdx = c;
          }
        }
        assignments[i] = minIdx;
      }

      // Update centroids
      const newCentroids: number[][] = Array.from({ length: k }, () =>
        Array.from({ length: dim }, () => 0),
      );
      const counts = Array.from({ length: k }, () => 0);

      for (let i = 0; i < n; i++) {
        const c = assignments[i];
        counts[c]++;
        const vec = vectors[i];
        const centroid = newCentroids[c];
        if (vec && centroid) {
          for (let d = 0; d < dim; d++) {
            centroid[d] += vec[d] ?? 0;
          }
        }
      }

      // Normalize and check convergence
      let maxShift = 0;
      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
          for (let d = 0; d < dim; d++) {
            newCentroids[c][d] /= counts[c];
          }
          const shift = this.squaredDistance(centroids[c], newCentroids[c]);
          maxShift = Math.max(maxShift, shift);
          centroids[c] = newCentroids[c];
        }
      }

      if (maxShift < this.config.convergenceThreshold) {
        break;
      }
    }

    return { centroids, assignments };
  }

  // ===========================================================================
  // Pattern Matching
  // ===========================================================================

  /**
   * Find patterns similar to a query vector.
   *
   * @param queryVector - Vector to find similar patterns for
   * @param k - Maximum number of patterns to return (default: 5)
   * @returns Array of similar patterns
   */
  findSimilar(queryVector: number[], k = 5): LearnedPattern[] {
    if (this.clusters.size === 0) {
      return [];
    }

    // Score each cluster by similarity to query
    const scored: Array<{ cluster: PatternCluster; similarity: number }> = [];

    for (const cluster of this.clusters.values()) {
      // Compare query to cluster centroid (using only query dimensions)
      const queryDim = queryVector.length;
      const centroidQuery = cluster.centroid.slice(0, queryDim);
      const similarity = this.cosineSimilarity(queryVector, centroidQuery);

      scored.push({ cluster, similarity });
    }

    // Sort by similarity descending
    scored.sort((a, b) => b.similarity - a.similarity);

    // Convert to LearnedPattern format
    return scored.slice(0, k).map(({ cluster }) => ({
      id: cluster.id,
      centroid: cluster.centroid,
      clusterSize: cluster.members.length,
      avgQuality: cluster.avgQuality,
    }));
  }

  /**
   * Get all clusters.
   */
  getClusters(): PatternCluster[] {
    return Array.from(this.clusters.values());
  }

  /**
   * Get cluster count.
   */
  getClusterCount(): number {
    return this.clusters.size;
  }

  // ===========================================================================
  // Feedback Updates
  // ===========================================================================

  /**
   * Update patterns based on new feedback.
   * Adjusts cluster quality scores and may trigger re-clustering.
   *
   * @param sampleId - ID of the sample that received feedback
   * @param newRelevanceScore - Updated relevance score
   */
  updateFromFeedback(sampleId: string, newRelevanceScore: number): void {
    // Find the sample and update it
    const sample = this.samples.find((s) => s.id === sampleId);
    if (!sample) {
      return;
    }

    const oldScore = sample.relevanceScore;
    sample.relevanceScore = newRelevanceScore;

    // Find cluster containing this sample
    for (const cluster of this.clusters.values()) {
      if (cluster.members.includes(sampleId)) {
        // Update average quality
        const n = cluster.members.length;
        cluster.avgQuality = (cluster.avgQuality * n - oldScore + newRelevanceScore) / n;
        cluster.lastUpdated = Date.now();
        break;
      }
    }
  }

  // ===========================================================================
  // Serialization
  // ===========================================================================

  /**
   * Export store state for persistence.
   */
  export(): { clusters: PatternCluster[]; samples: FeedbackSample[] } {
    return {
      clusters: Array.from(this.clusters.values()),
      samples: [...this.samples],
    };
  }

  /**
   * Import previously exported state.
   * @throws {Error} If data structure is invalid
   */
  import(data: { clusters: PatternCluster[]; samples: FeedbackSample[] }): void {
    // Validate input structure
    if (!data || typeof data !== "object") {
      throw new Error("Invalid import data: must be an object");
    }
    if (!Array.isArray(data.clusters)) {
      throw new Error("Invalid import data: clusters must be an array");
    }
    if (!Array.isArray(data.samples)) {
      throw new Error("Invalid import data: samples must be an array");
    }

    this.clusters = new Map(data.clusters.map((c) => [c.id, c]));
    this.samples = [...data.samples];

    // Update counter to avoid ID collisions
    const maxId = data.clusters.reduce((max, c) => {
      const match = c.id.match(/cluster-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10) + 1) : max;
    }, 0);
    this.clusterIdCounter = maxId;
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Combine query and result vectors into a single representation.
   * Uses concatenation for simplicity (could use more sophisticated methods).
   */
  private combineVectors(query: number[], result: number[]): number[] {
    // Ensure same dimension by padding/truncating
    const dim = Math.max(query.length, result.length);
    const combined: number[] = [];

    for (let i = 0; i < dim; i++) {
      combined.push(query[i] ?? 0);
    }
    for (let i = 0; i < dim; i++) {
      combined.push(result[i] ?? 0);
    }

    return combined;
  }

  /**
   * Calculate squared Euclidean distance between two vectors.
   */
  private squaredDistance(a: number[], b: number[]): number {
    const len = Math.max(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < len; i++) {
      const diff = (a[i] ?? 0) - (b[i] ?? 0);
      sum += diff * diff;
    }
    return sum;
  }

  /**
   * Calculate cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    if (len === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
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
