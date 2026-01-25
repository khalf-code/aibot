/**
 * Graph Expansion for ruvLLM Learning Core (P1)
 *
 * Provides automatic edge discovery for the knowledge graph based on
 * vector similarity and search patterns.
 */

import type { GraphEdge, VectorSearchResult } from "../types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for graph expansion.
 */
export type GraphExpansionConfig = {
  /** Minimum similarity threshold for creating edges (default: 0.7) */
  similarityThreshold?: number;
  /** Maximum edges to create per expansion (default: 10) */
  maxEdgesPerExpansion?: number;
  /** Default relationship type for auto-discovered edges (default: "similar_to") */
  defaultRelationship?: string;
  /** Enable bidirectional edges (default: true) */
  bidirectional?: boolean;
  /** Decay factor for edge weights based on similarity (default: 1.0) */
  weightDecayFactor?: number;
};

/**
 * A suggested relationship between nodes.
 */
export type RelationshipSuggestion = {
  /** Source node ID */
  sourceId: string;
  /** Target node ID */
  targetId: string;
  /** Suggested relationship type */
  relationship: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reason for the suggestion */
  reason: string;
};

/**
 * Result of a graph expansion operation.
 */
export type ExpansionResult = {
  /** Edges that were created */
  createdEdges: GraphEdge[];
  /** Edges that were skipped (already exist) */
  skippedEdges: number;
  /** Total processing time in ms */
  processingTimeMs: number;
};

/**
 * Interface for graph operations needed by the expander.
 */
export interface GraphOperations {
  /** Check if an edge exists between two nodes */
  edgeExists(sourceId: string, targetId: string, relationship?: string): Promise<boolean>;
  /** Add an edge to the graph */
  addEdge(edge: GraphEdge): Promise<string>;
  /** Get neighbors of a node */
  getNeighbors(nodeId: string, depth?: number): Promise<Array<{ id: string; labels?: string[] }>>;
  /** Get vector for a node ID */
  getNodeVector(nodeId: string): Promise<number[] | null>;
}

// =============================================================================
// GraphExpander
// =============================================================================

/**
 * Automatic edge discovery for knowledge graphs.
 *
 * Uses vector similarity and search patterns to discover relationships
 * between memory nodes, enriching the graph structure over time.
 */
export class GraphExpander {
  private config: Required<GraphExpansionConfig>;
  private graph: GraphOperations;

  constructor(graph: GraphOperations, config: GraphExpansionConfig = {}) {
    this.graph = graph;
    this.config = {
      similarityThreshold: config.similarityThreshold ?? 0.7,
      maxEdgesPerExpansion: config.maxEdgesPerExpansion ?? 10,
      defaultRelationship: config.defaultRelationship ?? "similar_to",
      bidirectional: config.bidirectional ?? true,
      weightDecayFactor: config.weightDecayFactor ?? 1.0,
    };
  }

  // ===========================================================================
  // Core Expansion Methods
  // ===========================================================================

  /**
   * Expand graph edges based on search results.
   *
   * Creates edges between results that appear together in search results,
   * indicating semantic similarity.
   *
   * @param query - Original search query (for context)
   * @param results - Search results to analyze
   * @returns Expansion result with created edges
   */
  async expandFromSearch(
    query: string,
    results: VectorSearchResult[],
  ): Promise<ExpansionResult> {
    const startTime = Date.now();
    const createdEdges: GraphEdge[] = [];
    let skippedEdges = 0;

    if (results.length < 2) {
      return {
        createdEdges: [],
        skippedEdges: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Create edges between results that appear together
    // Higher-scored results are more strongly connected
    const edgesToCreate: Array<{ source: string; target: string; weight: number }> = [];

    for (let i = 0; i < results.length - 1; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const resultA = results[i];
        const resultB = results[j];

        // Calculate edge weight based on both scores
        const combinedScore = (resultA.score + resultB.score) / 2;
        if (combinedScore < this.config.similarityThreshold) {
          continue;
        }

        const weight = combinedScore * this.config.weightDecayFactor;
        edgesToCreate.push({
          source: resultA.entry.id,
          target: resultB.entry.id,
          weight,
        });
      }
    }

    // Sort by weight and limit
    edgesToCreate.sort((a, b) => b.weight - a.weight);
    const topEdges = edgesToCreate.slice(0, this.config.maxEdgesPerExpansion);

    // Create edges (checking for duplicates)
    for (const { source, target, weight } of topEdges) {
      const exists = await this.graph.edgeExists(source, target, this.config.defaultRelationship);
      if (exists) {
        skippedEdges++;
        continue;
      }

      const edge: GraphEdge = {
        sourceId: source,
        targetId: target,
        relationship: this.config.defaultRelationship,
        weight,
        properties: {
          discoveredFrom: "search",
          query: query.slice(0, 100),
          createdAt: Date.now(),
        },
      };

      await this.graph.addEdge(edge);
      createdEdges.push(edge);

      // Create reverse edge if bidirectional
      if (this.config.bidirectional) {
        const reverseExists = await this.graph.edgeExists(
          target,
          source,
          this.config.defaultRelationship,
        );
        if (!reverseExists) {
          const reverseEdge: GraphEdge = {
            ...edge,
            sourceId: target,
            targetId: source,
          };
          await this.graph.addEdge(reverseEdge);
          createdEdges.push(reverseEdge);
        }
      }
    }

    return {
      createdEdges,
      skippedEdges,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Suggest relationships for a node based on vector similarity.
   *
   * @param nodeId - Node to find relationships for
   * @param candidates - Candidate nodes to consider (optional, uses neighbors if not provided)
   * @returns Array of relationship suggestions
   */
  async suggestRelationships(
    nodeId: string,
    candidates?: VectorSearchResult[],
  ): Promise<RelationshipSuggestion[]> {
    const suggestions: RelationshipSuggestion[] = [];

    // Get the node's vector
    const nodeVector = await this.graph.getNodeVector(nodeId);
    if (!nodeVector) {
      return suggestions;
    }

    // Get existing neighbors to exclude
    const existingNeighbors = await this.graph.getNeighbors(nodeId, 1);
    const neighborIds = new Set(existingNeighbors.map((n) => n.id));

    // Use provided candidates or would need external search (return empty if no candidates)
    if (!candidates || candidates.length === 0) {
      return suggestions;
    }

    // Filter candidates and calculate similarity
    for (const candidate of candidates) {
      // Skip self and existing neighbors
      if (candidate.entry.id === nodeId || neighborIds.has(candidate.entry.id)) {
        continue;
      }

      // Use the search score as similarity
      const similarity = candidate.score;

      if (similarity >= this.config.similarityThreshold) {
        // Determine relationship type based on metadata
        const relationship = this.inferRelationship(
          candidate.entry.metadata,
          similarity,
        );

        suggestions.push({
          sourceId: nodeId,
          targetId: candidate.entry.id,
          relationship: relationship.type,
          confidence: similarity,
          reason: relationship.reason,
        });
      }
    }

    // Sort by confidence descending
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions.slice(0, this.config.maxEdgesPerExpansion);
  }

  /**
   * Expand graph from a set of feedback samples.
   *
   * Creates edges between queries and their selected results,
   * and between results selected from similar queries.
   *
   * @param samples - Feedback samples with query-result pairs
   * @returns Expansion result
   */
  async expandFromFeedback(
    samples: Array<{
      queryId: string;
      resultId: string;
      relevanceScore: number;
    }>,
  ): Promise<ExpansionResult> {
    const startTime = Date.now();
    const createdEdges: GraphEdge[] = [];
    let skippedEdges = 0;

    // Create edges from queries to selected results
    for (const sample of samples) {
      if (sample.relevanceScore < this.config.similarityThreshold) {
        continue;
      }

      try {
        const exists = await this.graph.edgeExists(
          sample.queryId,
          sample.resultId,
          "selected_from",
        );

        if (exists) {
          skippedEdges++;
          continue;
        }

        const edge: GraphEdge = {
          sourceId: sample.queryId,
          targetId: sample.resultId,
          relationship: "selected_from",
          weight: sample.relevanceScore,
          properties: {
            discoveredFrom: "feedback",
            relevanceScore: sample.relevanceScore,
            createdAt: Date.now(),
          },
        };

        await this.graph.addEdge(edge);
        createdEdges.push(edge);
      } catch {
        // Skip this sample if edge operations fail (e.g., invalid node IDs)
        continue;
      }
    }

    // Create edges between co-selected results (results selected from similar queries)
    const resultGroups = new Map<string, string[]>();
    for (const sample of samples) {
      if (sample.relevanceScore < this.config.similarityThreshold) continue;

      const group = resultGroups.get(sample.queryId) ?? [];
      group.push(sample.resultId);
      resultGroups.set(sample.queryId, group);
    }

    for (const results of resultGroups.values()) {
      if (results.length < 2) continue;

      for (let i = 0; i < results.length - 1 && createdEdges.length < this.config.maxEdgesPerExpansion * 2; i++) {
        for (let j = i + 1; j < results.length; j++) {
          try {
            const exists = await this.graph.edgeExists(results[i], results[j], "co_selected");
            if (exists) {
              skippedEdges++;
              continue;
            }

            const edge: GraphEdge = {
              sourceId: results[i],
              targetId: results[j],
              relationship: "co_selected",
              weight: 0.8,
              properties: {
                discoveredFrom: "feedback_coselection",
                createdAt: Date.now(),
              },
            };

            await this.graph.addEdge(edge);
            createdEdges.push(edge);
          } catch {
            // Skip this edge if operations fail
            continue;
          }
        }
      }
    }

    return {
      createdEdges,
      skippedEdges,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Update expansion configuration.
   */
  updateConfig(config: Partial<GraphExpansionConfig>): void {
    if (config.similarityThreshold !== undefined) {
      this.config.similarityThreshold = config.similarityThreshold;
    }
    if (config.maxEdgesPerExpansion !== undefined) {
      this.config.maxEdgesPerExpansion = config.maxEdgesPerExpansion;
    }
    if (config.defaultRelationship !== undefined) {
      this.config.defaultRelationship = config.defaultRelationship;
    }
    if (config.bidirectional !== undefined) {
      this.config.bidirectional = config.bidirectional;
    }
    if (config.weightDecayFactor !== undefined) {
      this.config.weightDecayFactor = config.weightDecayFactor;
    }
  }

  /**
   * Get current configuration.
   */
  getConfig(): Required<GraphExpansionConfig> {
    return { ...this.config };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Infer relationship type from metadata.
   */
  private inferRelationship(
    metadata: Record<string, unknown>,
    similarity: number,
  ): { type: string; reason: string } {
    // Check for category match
    const category = metadata.category as string | undefined;

    if (category) {
      switch (category) {
        case "preference":
          return {
            type: "shares_preference",
            reason: `Both are user preferences (similarity: ${(similarity * 100).toFixed(0)}%)`,
          };
        case "fact":
          return {
            type: "relates_to",
            reason: `Related factual information (similarity: ${(similarity * 100).toFixed(0)}%)`,
          };
        case "decision":
          return {
            type: "informs_decision",
            reason: `Related decision context (similarity: ${(similarity * 100).toFixed(0)}%)`,
          };
        case "entity":
          return {
            type: "references",
            reason: `References similar entities (similarity: ${(similarity * 100).toFixed(0)}%)`,
          };
      }
    }

    // Check for channel/user match
    const channel = metadata.channel as string | undefined;
    if (channel) {
      return {
        type: "same_context",
        reason: `Same channel context: ${channel} (similarity: ${(similarity * 100).toFixed(0)}%)`,
      };
    }

    // Default relationship
    return {
      type: this.config.defaultRelationship,
      reason: `High semantic similarity (${(similarity * 100).toFixed(0)}%)`,
    };
  }
}
