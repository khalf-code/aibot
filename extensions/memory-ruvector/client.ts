/**
 * RuvectorClient - Wrapper for the ruvector npm package.
 *
 * Provides a typed interface for vector storage operations including
 * connect, disconnect, insert, search, and delete.
 */

import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { CodeGraph, RuvectorLayer, SonaEngine, VectorDb } from "ruvector";

import type { PluginLogger } from "clawdbot/plugin-sdk";

import {
  RuvectorError,
  type CypherResult,
  type DistanceMetric,
  type GNNConfig,
  type GraphEdge,
  type GraphNode,
  type LearnedPattern,
  type RuvectorClientConfig,
  type RuvectorStats,
  type RuvLLMConfig,
  type SONAConfig,
  type SONAStats,
  type Trajectory,
  type TrajectoryStats,
  type VectorEntry,
  type VectorInsertInput,
  type VectorSearchParams,
  type VectorSearchResult,
} from "./types.js";
import { PatternStore, type FeedbackSample, type PatternClusterConfig } from "./sona/patterns.js";
import { TrajectoryRecorder, type TrajectoryInput } from "./sona/trajectory.js";

// =============================================================================
// Ruvector Native Types (from ruvector package)
// =============================================================================

type RuvectorDbInstance = InstanceType<typeof VectorDb>;

type RuvectorInsertEntry = {
  id?: string;
  vector: Float32Array | number[];
  metadata?: Record<string, unknown>;
};

type RuvectorSearchQuery = {
  vector: Float32Array | number[];
  k: number;
  filter?: Record<string, unknown>;
  efSearch?: number;
};

type RuvectorSearchResult = {
  id: string;
  score: number;
  vector?: Float32Array;
  metadata?: Record<string, unknown>;
};

type RuvectorGetResult = {
  id?: string;
  vector: Float32Array;
  metadata?: Record<string, unknown>;
} | null;

// =============================================================================
// RuvectorClient
// =============================================================================

/**
 * Client wrapper for the ruvector vector database.
 *
 * Usage:
 * ```typescript
 * const client = new RuvectorClient({
 *   dimension: 1536,
 *   storagePath: "./memory.db",
 *   metric: "cosine",
 * }, logger);
 *
 * await client.connect();
 * const id = await client.insert({ vector: [...], metadata: { text: "..." } });
 * const results = await client.search({ vector: [...], limit: 5 });
 * await client.disconnect();
 * ```
 */
export class RuvectorClient {
  private db: RuvectorDbInstance | null = null;
  private config: RuvectorClientConfig;
  private logger: PluginLogger;
  private initPromise: Promise<void> | null = null;

  // SONA (Self-Organizing Neural Architecture) state
  private sonaEngine: InstanceType<typeof SonaEngine> | null = null;
  private sonaConfig: SONAConfig | null = null;
  private activeTrajectory: string | null = null;
  private sonaStatsInternal = {
    trajectoriesRecorded: 0,
    microLoraUpdates: 0,
    totalLearningTimeMs: 0,
    learningOperations: 0,
  };

  // Graph Neural Network state
  private graph: InstanceType<typeof CodeGraph> | null = null;
  private gnnLayer: InstanceType<typeof RuvectorLayer> | null = null;
  private gnnConfig: GNNConfig | null = null;

  // Pattern store for ruvLLM learning
  private patternStore: PatternStore | null = null;

  // ruvLLM (Ruvector LLM Integration) state
  private ruvllmConfig: RuvLLMConfig | null = null;
  private trajectoryRecorder: TrajectoryRecorder | null = null;
  private learningLoopTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RuvectorClientConfig, logger: PluginLogger) {
    this.config = config;
    this.logger = logger;
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  /**
   * Connect to the vector database.
   * Initializes the ruvector instance with the configured options.
   *
   * @throws {RuvectorError} If already connected or initialization fails
   */
  async connect(): Promise<void> {
    if (this.db) {
      throw new RuvectorError("ALREADY_CONNECTED", "Client is already connected");
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doConnect();
    return this.initPromise;
  }

  private async doConnect(): Promise<void> {
    const { dimension, storagePath, metric = "cosine", hnsw } = this.config;

    this.logger.info(
      `ruvector-client: connecting (dimension: ${dimension}, metric: ${metric}${storagePath ? `, path: ${storagePath}` : ", in-memory"})`,
    );

    try {
      // Map our metric names to ruvector's expected format
      const distanceMetric = mapMetricToRuvector(metric);

      // Create ruvector database instance
      this.db = new VectorDb({
        dimensions: dimension,
        storagePath,
        distanceMetric,
        hnswConfig: hnsw
          ? {
              m: hnsw.m,
              efConstruction: hnsw.efConstruction,
              efSearch: hnsw.efSearch,
            }
          : undefined,
      });

      this.logger.info("ruvector-client: connected successfully");
    } catch (err) {
      this.initPromise = null;
      throw new RuvectorError(
        "INITIALIZATION_FAILED",
        `Failed to initialize ruvector: ${formatError(err)}`,
        err,
      );
    }
  }

  /**
   * Disconnect from the vector database.
   * Cleans up resources and closes any open connections.
   */
  async disconnect(): Promise<void> {
    if (!this.db && !this.sonaEngine && !this.graph) {
      return;
    }

    this.logger.info("ruvector-client: disconnecting");

    // Clean up SONA engine first (may have active trajectories)
    if (this.sonaEngine) {
      try {
        await this.disableSONA();
      } catch (err) {
        this.logger.warn(`ruvector-client: error during SONA cleanup: ${formatError(err)}`);
      }
    }

    // Clean up GNN layer
    if (this.gnnLayer) {
      this.gnnLayer = null;
      this.gnnConfig = null;
    }

    // Clean up graph
    if (this.graph) {
      try {
        this.graph = null;
      } catch (err) {
        this.logger.warn(`ruvector-client: error during graph cleanup: ${formatError(err)}`);
      }
    }

    try {
      // Ruvector doesn't have an explicit close method, but we null the reference
      // to allow garbage collection. If persisted, data is already on disk.
      this.db = null;
      this.initPromise = null;
      this.logger.info("ruvector-client: disconnected");
    } catch (err) {
      this.logger.warn(`ruvector-client: error during disconnect: ${formatError(err)}`);
      this.db = null;
      this.initPromise = null;
    }
  }

  /**
   * Check if the client is connected.
   */
  isConnected(): boolean {
    return this.db !== null;
  }

  // ===========================================================================
  // Vector Operations
  // ===========================================================================

  /**
   * Insert a vector entry into the database.
   *
   * @param input - The vector entry to insert
   * @returns The ID of the inserted entry
   * @throws {RuvectorError} If not connected or insert fails
   */
  async insert(input: VectorInsertInput): Promise<string> {
    const db = this.ensureConnected();

    const id = input.id ?? randomUUID();
    const vector = normalizeVector(input.vector);

    // Validate dimension
    if (vector.length !== this.config.dimension) {
      throw new RuvectorError(
        "INVALID_DIMENSION",
        `Vector dimension mismatch: expected ${this.config.dimension}, got ${vector.length}`,
      );
    }

    try {
      const entry: RuvectorInsertEntry = {
        id,
        vector,
        metadata: input.metadata as Record<string, unknown>,
      };

      await db.insert(entry);

      this.logger.debug?.(`ruvector-client: inserted vector ${id}`);
      return id;
    } catch (err) {
      throw new RuvectorError("INSERT_FAILED", `Failed to insert vector: ${formatError(err)}`, err);
    }
  }

  /**
   * Insert multiple vector entries in batch.
   *
   * @param inputs - Array of vector entries to insert
   * @returns Array of IDs for the inserted entries
   * @throws {RuvectorError} If not connected or insert fails
   */
  async insertBatch(inputs: VectorInsertInput[]): Promise<string[]> {
    const db = this.ensureConnected();

    const entries: RuvectorInsertEntry[] = inputs.map((input) => {
      const id = input.id ?? randomUUID();
      const vector = normalizeVector(input.vector);

      if (vector.length !== this.config.dimension) {
        throw new RuvectorError(
          "INVALID_DIMENSION",
          `Vector dimension mismatch: expected ${this.config.dimension}, got ${vector.length}`,
        );
      }

      return {
        id,
        vector,
        metadata: input.metadata as Record<string, unknown>,
      };
    });

    try {
      const ids = await db.insertBatch(entries);

      this.logger.debug?.(`ruvector-client: batch inserted ${ids.length} vectors`);
      return ids;
    } catch (err) {
      throw new RuvectorError(
        "INSERT_FAILED",
        `Failed to batch insert vectors: ${formatError(err)}`,
        err,
      );
    }
  }

  /**
   * Search for similar vectors.
   *
   * @param params - Search parameters
   * @returns Array of search results with similarity scores
   * @throws {RuvectorError} If not connected or search fails
   */
  async search(params: VectorSearchParams): Promise<VectorSearchResult[]> {
    const db = this.ensureConnected();

    const { vector, limit = 10, minScore = 0, filter } = params;
    const queryVector = normalizeVector(vector);

    // Validate dimension
    if (queryVector.length !== this.config.dimension) {
      throw new RuvectorError(
        "INVALID_DIMENSION",
        `Query vector dimension mismatch: expected ${this.config.dimension}, got ${queryVector.length}`,
      );
    }

    try {
      const query: RuvectorSearchQuery = {
        vector: queryVector,
        k: limit,
        filter: filter as Record<string, unknown>,
        efSearch: this.config.hnsw?.efSearch,
      };

      const results: RuvectorSearchResult[] = await db.search(query);

      // Map results and filter by minimum score
      const mapped: VectorSearchResult[] = results
        .map((result) => ({
          entry: {
            id: result.id,
            vector: result.vector ? Array.from(result.vector) : [],
            metadata: parseMetadata(result.metadata),
          },
          score: result.score,
        }))
        .filter((r) => r.score >= minScore);

      this.logger.debug?.(
        `ruvector-client: search returned ${mapped.length} results (requested ${limit})`,
      );
      return mapped;
    } catch (err) {
      throw new RuvectorError("SEARCH_FAILED", `Failed to search vectors: ${formatError(err)}`, err);
    }
  }

  /**
   * Get a vector entry by ID.
   *
   * @param id - The ID of the entry to retrieve
   * @returns The vector entry, or null if not found
   * @throws {RuvectorError} If not connected
   */
  async get(id: string): Promise<VectorEntry | null> {
    const db = this.ensureConnected();

    try {
      const result: RuvectorGetResult = await db.get(id);

      if (!result) {
        return null;
      }

      return {
        id: result.id ?? id,
        vector: Array.from(result.vector),
        metadata: parseMetadata(result.metadata),
      };
    } catch (err) {
      // Log the error for debugging, but treat as "not found" to maintain API contract
      // Common case: entry doesn't exist, which some backends report as an error
      this.logger.debug?.(`ruvector-client: get(${id}) failed: ${formatError(err)}`);
      return null;
    }
  }

  /**
   * Delete a vector entry by ID.
   *
   * @param id - The ID of the entry to delete
   * @returns true if deleted, false if not found
   * @throws {RuvectorError} If not connected or delete fails
   */
  async delete(id: string): Promise<boolean> {
    const db = this.ensureConnected();

    // Validate ID is non-empty (allow any format since insert accepts custom IDs)
    if (!id || typeof id !== "string") {
      throw new RuvectorError("INVALID_ID", `Invalid ID: ${id}`);
    }

    try {
      const deleted = await db.delete(id);
      this.logger.debug?.(`ruvector-client: delete(${id}) = ${deleted}`);
      return deleted;
    } catch (err) {
      throw new RuvectorError("DELETE_FAILED", `Failed to delete vector: ${formatError(err)}`, err);
    }
  }

  /**
   * Get the number of vectors in the database.
   *
   * @returns The count of stored vectors
   * @throws {RuvectorError} If not connected
   */
  async count(): Promise<number> {
    const db = this.ensureConnected();

    try {
      return await db.len();
    } catch (err) {
      this.logger.warn(`ruvector-client: count failed: ${formatError(err)}`);
      return 0;
    }
  }

  /**
   * Check if the database is empty.
   *
   * @returns true if empty
   * @throws {RuvectorError} If not connected
   */
  async isEmpty(): Promise<boolean> {
    const db = this.ensureConnected();

    try {
      return await db.isEmpty();
    } catch {
      // Fallback to count check if isEmpty is not supported
      const count = await this.count();
      return count === 0;
    }
  }

  /**
   * Get database statistics.
   *
   * @returns Database stats including count, dimension, and metric
   */
  async stats(): Promise<RuvectorStats> {
    const count = this.isConnected() ? await this.count() : 0;

    return {
      count,
      dimension: this.config.dimension,
      metric: this.config.metric ?? "cosine",
      connected: this.isConnected(),
    };
  }

  // ===========================================================================
  // Graph Operations
  // ===========================================================================

  /**
   * Initialize the graph database for relationship tracking.
   *
   * @param storagePath - Optional path to persist the graph (in-memory if omitted)
   * @throws {RuvectorError} If initialization fails
   */
  async initializeGraph(storagePath?: string): Promise<void> {
    if (this.graph) {
      this.logger.debug?.("ruvector-client: graph already initialized");
      return;
    }

    this.logger.info(
      `ruvector-client: initializing graph${storagePath ? ` (path: ${storagePath})` : " (in-memory)"}`,
    );

    try {
      this.graph = new CodeGraph({
        storagePath,
        inMemory: !storagePath,
      });
      this.logger.info("ruvector-client: graph initialized successfully");
    } catch (err) {
      throw new RuvectorError(
        "INITIALIZATION_FAILED",
        `Failed to initialize graph: ${formatError(err)}`,
        err,
      );
    }
  }

  /**
   * Add an edge (relationship) between two nodes in the graph.
   *
   * @param edge - The edge to add
   * @returns The edge ID
   * @throws {RuvectorError} If graph is not initialized or operation fails
   */
  async addEdge(edge: GraphEdge): Promise<string> {
    const graph = this.ensureGraphInitialized();

    const edgeId = edge.id ?? randomUUID();

    try {
      // Ensure source and target nodes exist
      await graph.createNode(edge.sourceId, ["Node"], {});
      await graph.createNode(edge.targetId, ["Node"], {});

      // Create the edge with properties
      await graph.createEdge(edge.sourceId, edge.targetId, edge.relationship, {
        id: edgeId,
        weight: edge.weight ?? 1.0,
        ...edge.properties,
      });

      this.logger.debug?.(
        `ruvector-client: added edge ${edgeId} (${edge.sourceId} -[${edge.relationship}]-> ${edge.targetId})`,
      );
      return edgeId;
    } catch (err) {
      throw new RuvectorError("INSERT_FAILED", `Failed to add edge: ${formatError(err)}`, err);
    }
  }

  /**
   * Remove an edge between two nodes.
   *
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @returns true if edge was removed, false if not found
   * @throws {RuvectorError} If graph is not initialized or operation fails
   */
  async removeEdge(sourceId: string, targetId: string): Promise<boolean> {
    const graph = this.ensureGraphInitialized();

    try {
      // Use Cypher to delete the edge
      const result = await graph.cypher(
        "MATCH (a)-[r]->(b) WHERE a.id = $sourceId AND b.id = $targetId DELETE r RETURN count(r) as deleted",
        { sourceId, targetId },
      );

      const deleted = result.rows.length > 0 && (result.rows[0][0] as number) > 0;
      this.logger.debug?.(`ruvector-client: removeEdge(${sourceId}, ${targetId}) = ${deleted}`);
      return deleted;
    } catch (err) {
      throw new RuvectorError("DELETE_FAILED", `Failed to remove edge: ${formatError(err)}`, err);
    }
  }

  /**
   * Execute a Cypher query on the graph.
   *
   * @param query - Cypher query string
   * @param params - Optional query parameters
   * @returns Query result with columns and rows
   * @throws {RuvectorError} If graph is not initialized or query fails
   */
  async cypherQuery(query: string, params?: Record<string, unknown>): Promise<CypherResult> {
    const graph = this.ensureGraphInitialized();

    try {
      const result = await graph.cypher(query, params);
      this.logger.debug?.(`ruvector-client: cypher query returned ${result.rows.length} rows`);
      return {
        columns: result.columns,
        rows: result.rows,
      };
    } catch (err) {
      throw new RuvectorError("SEARCH_FAILED", `Cypher query failed: ${formatError(err)}`, err);
    }
  }

  /**
   * Get neighboring nodes for a given node ID.
   *
   * @param id - The node ID to find neighbors for
   * @param depth - Maximum traversal depth (default: 1)
   * @returns Array of neighboring nodes
   * @throws {RuvectorError} If graph is not initialized or operation fails
   */
  async getNeighbors(id: string, depth?: number): Promise<GraphNode[]> {
    const graph = this.ensureGraphInitialized();

    try {
      const neighbors = await graph.neighbors(id, depth ?? 1);

      // Map the raw neighbors to GraphNode format
      const nodes: GraphNode[] = neighbors.map(
        (n: { id: string; labels?: string[]; properties?: Record<string, unknown> }) => ({
          id: n.id,
          labels: n.labels ?? ["Node"],
          properties: n.properties ?? {},
        }),
      );

      this.logger.debug?.(
        `ruvector-client: getNeighbors(${id}, ${depth ?? 1}) returned ${nodes.length} nodes`,
      );
      return nodes;
    } catch (err) {
      throw new RuvectorError("SEARCH_FAILED", `Failed to get neighbors: ${formatError(err)}`, err);
    }
  }

  /**
   * Enable and configure the GNN (Graph Neural Network) layer.
   *
   * @param config - GNN configuration
   * @throws {RuvectorError} If initialization fails
   */
  async enableGNN(config: GNNConfig): Promise<void> {
    if (!config.enabled) {
      this.gnnLayer = null;
      this.gnnConfig = null;
      this.logger.info("ruvector-client: GNN disabled");
      return;
    }

    this.logger.info(
      `ruvector-client: enabling GNN (inputDim: ${config.inputDim}, hiddenDim: ${config.hiddenDim}, heads: ${config.heads})`,
    );

    try {
      this.gnnLayer = new RuvectorLayer(
        config.inputDim,
        config.hiddenDim,
        config.heads,
        config.dropout,
      );
      this.gnnConfig = config;
      this.logger.info("ruvector-client: GNN enabled successfully");
    } catch (err) {
      throw new RuvectorError(
        "INITIALIZATION_FAILED",
        `Failed to enable GNN: ${formatError(err)}`,
        err,
      );
    }
  }

  /**
   * Check if the graph is initialized.
   */
  isGraphInitialized(): boolean {
    return this.graph !== null;
  }

  /**
   * Check if GNN is enabled.
   */
  isGNNEnabled(): boolean {
    return this.gnnLayer !== null && this.gnnConfig?.enabled === true;
  }

  // ===========================================================================
  // SONA (Self-Organizing Neural Architecture) Methods
  // ===========================================================================

  /**
   * Enable SONA self-learning capabilities.
   * Initializes the SonaEngine with the provided configuration.
   *
   * @param config - SONA configuration options
   */
  async enableSONA(config: SONAConfig): Promise<void> {
    if (this.sonaEngine) {
      this.logger.warn("ruvector-client: SONA already enabled, reconfiguring");
      await this.disableSONA();
    }

    this.logger.info(
      `ruvector-client: enabling SONA (hiddenDim: ${config.hiddenDim}, enabled: ${config.enabled})`,
    );

    try {
      // Create SONA engine with configuration
      const sonaConfig = {
        hiddenDim: config.hiddenDim,
        learningRate: config.learningRate ?? 0.01,
        qualityThreshold: config.qualityThreshold ?? 0.5,
      };

      this.sonaEngine = SonaEngine.withConfig(sonaConfig);
      this.sonaConfig = config;

      if (config.enabled) {
        this.sonaEngine.setEnabled(true);
      }

      this.logger.info("ruvector-client: SONA enabled successfully");
    } catch (err) {
      this.sonaEngine = null;
      this.sonaConfig = null;
      throw new RuvectorError(
        "INITIALIZATION_FAILED",
        `Failed to initialize SONA: ${formatError(err)}`,
        err,
      );
    }
  }

  /**
   * Disable SONA self-learning capabilities.
   * Cleans up the SONA engine and any active trajectories.
   */
  async disableSONA(): Promise<void> {
    if (!this.sonaEngine) {
      return;
    }

    this.logger.info("ruvector-client: disabling SONA");

    try {
      // End any active trajectory
      if (this.activeTrajectory) {
        try {
          this.sonaEngine.endTrajectory(this.activeTrajectory, 0);
        } catch {
          // Ignore errors when ending trajectory during shutdown
        }
        this.activeTrajectory = null;
      }

      this.sonaEngine.setEnabled(false);
      this.sonaEngine = null;
      this.sonaConfig = null;

      this.logger.info("ruvector-client: SONA disabled");
    } catch (err) {
      this.logger.warn(`ruvector-client: error during SONA disable: ${formatError(err)}`);
      this.sonaEngine = null;
      this.sonaConfig = null;
    }
  }

  /**
   * Record feedback from a search operation for SONA learning.
   * This creates a learning trajectory from the search query to the selected result.
   *
   * @param queryVector - The original query vector used for search
   * @param selectedResultId - ID of the result the user selected/found relevant
   * @param relevanceScore - How relevant the result was (0-1, higher is better)
   */
  async recordSearchFeedback(
    queryVector: number[],
    selectedResultId: string,
    relevanceScore: number,
  ): Promise<void> {
    if (!this.sonaEngine || !this.sonaEngine.isEnabled()) {
      this.logger.debug?.("ruvector-client: SONA not enabled, skipping feedback recording");
      return;
    }

    const startTime = Date.now();

    try {
      // Get the selected result to use its vector as activation
      const selectedEntry = await this.get(selectedResultId);
      if (!selectedEntry) {
        this.logger.warn(`ruvector-client: selected result ${selectedResultId} not found`);
        return;
      }

      // Begin a new learning trajectory
      const trajectoryId = this.sonaEngine.beginTrajectory(queryVector);
      this.activeTrajectory = trajectoryId;

      // Add the search result as a learning step
      // Use the result vector as activations and query as attention weights
      const activations = selectedEntry.vector;
      const resultVector = selectedEntry.vector;
      // Create attention weights by computing element-wise products
      // Both vectors should have the same dimension, but use safe access for robustness
      const attentionWeights: number[] = [];
      for (let i = 0; i < queryVector.length; i++) {
        const qv = queryVector[i] ?? 0;
        const rv = resultVector[i] ?? 0;
        attentionWeights.push(Math.abs(qv * rv));
      }

      this.sonaEngine.addStep(
        trajectoryId,
        activations,
        attentionWeights,
        relevanceScore,
      );

      // End trajectory with the relevance score as quality
      this.sonaEngine.endTrajectory(trajectoryId, relevanceScore);
      this.activeTrajectory = null;

      // Apply micro-LoRA adaptation if relevance is high enough
      const threshold = this.sonaConfig?.qualityThreshold ?? 0.5;
      if (relevanceScore >= threshold) {
        this.sonaEngine.applyMicroLora(queryVector);
        this.sonaStatsInternal.microLoraUpdates++;
      }

      this.sonaStatsInternal.trajectoriesRecorded++;

      const elapsed = Date.now() - startTime;
      this.sonaStatsInternal.totalLearningTimeMs += elapsed;
      this.sonaStatsInternal.learningOperations++;

      this.logger.debug?.(
        `ruvector-client: recorded search feedback (relevance: ${relevanceScore}, time: ${elapsed}ms)`,
      );
    } catch (err) {
      this.activeTrajectory = null;
      this.logger.warn(`ruvector-client: failed to record search feedback: ${formatError(err)}`);
    }
  }

  /**
   * Find similar learned patterns from SONA's pattern memory.
   *
   * @param vector - Query vector to find similar patterns for
   * @param k - Maximum number of patterns to return (default: 5)
   * @returns Array of learned patterns similar to the query
   */
  findSimilarPatterns(vector: number[], k = 5): LearnedPattern[] {
    if (!this.sonaEngine || !this.sonaEngine.isEnabled()) {
      return [];
    }

    try {
      const patterns = this.sonaEngine.findPatterns(vector, k);

      // Map the raw patterns to our LearnedPattern type
      return patterns.map((pattern: { id?: string; centroid?: number[]; clusterSize?: number; avgQuality?: number }, index: number) => ({
        id: pattern.id ?? `pattern-${index}`,
        centroid: pattern.centroid ?? [],
        clusterSize: pattern.clusterSize ?? 0,
        avgQuality: pattern.avgQuality ?? 0,
      }));
    } catch (err) {
      this.logger.warn(`ruvector-client: failed to find similar patterns: ${formatError(err)}`);
      return [];
    }
  }

  /**
   * Get statistics from the SONA engine.
   *
   * @returns SONA statistics including trajectories, patterns, and timing
   */
  async getSONAStats(): Promise<SONAStats> {
    if (!this.sonaEngine) {
      return {
        trajectoriesRecorded: 0,
        patternsLearned: 0,
        microLoraUpdates: 0,
        avgLearningTimeMs: 0,
        enabled: false,
      };
    }

    try {
      const engineStats = this.sonaEngine.getStats();

      const avgLearningTimeMs =
        this.sonaStatsInternal.learningOperations > 0
          ? this.sonaStatsInternal.totalLearningTimeMs / this.sonaStatsInternal.learningOperations
          : 0;

      return {
        trajectoriesRecorded: this.sonaStatsInternal.trajectoriesRecorded,
        patternsLearned: engineStats.patternsLearned ?? 0,
        microLoraUpdates: this.sonaStatsInternal.microLoraUpdates,
        avgLearningTimeMs: Math.round(avgLearningTimeMs * 100) / 100,
        enabled: this.sonaEngine.isEnabled(),
      };
    } catch (err) {
      this.logger.warn(`ruvector-client: failed to get SONA stats: ${formatError(err)}`);
      // Capture sonaEngine reference to avoid race condition
      const engine = this.sonaEngine;
      return {
        trajectoriesRecorded: this.sonaStatsInternal.trajectoriesRecorded,
        patternsLearned: 0,
        microLoraUpdates: this.sonaStatsInternal.microLoraUpdates,
        avgLearningTimeMs: 0,
        enabled: engine?.isEnabled() ?? false,
      };
    }
  }

  /**
   * Force an immediate learning cycle in SONA.
   * Useful for ensuring patterns are learned before shutdown.
   */
  async forceSONALearn(): Promise<void> {
    if (!this.sonaEngine || !this.sonaEngine.isEnabled()) {
      return;
    }

    try {
      this.sonaEngine.forceLearn();
      this.logger.debug?.("ruvector-client: forced SONA learning cycle");
    } catch (err) {
      this.logger.warn(`ruvector-client: failed to force SONA learn: ${formatError(err)}`);
    }
  }

  // ===========================================================================
  // Pattern Store (ruvLLM Learning Core)
  // ===========================================================================

  /**
   * Initialize the pattern store for learned pattern clustering.
   *
   * @param config - Pattern clustering configuration
   */
  initializePatternStore(config?: PatternClusterConfig): void {
    if (this.patternStore) {
      this.logger.debug?.("ruvector-client: pattern store already initialized");
      return;
    }

    this.patternStore = new PatternStore(config);
    this.logger.info("ruvector-client: pattern store initialized");
  }

  /**
   * Get the pattern store instance.
   * Returns null if not initialized.
   */
  getPatternStore(): PatternStore | null {
    return this.patternStore;
  }

  /**
   * Add a feedback sample to the pattern store for learning.
   *
   * @param sample - Feedback sample to add
   */
  addPatternSample(sample: FeedbackSample): void {
    if (!this.patternStore) {
      this.logger.debug?.("ruvector-client: pattern store not initialized, skipping sample");
      return;
    }

    this.patternStore.addSample(sample);
    this.logger.debug?.(`ruvector-client: added pattern sample ${sample.id}`);
  }

  /**
   * Re-rank search results using learned patterns.
   *
   * Boosts results that match high-quality patterns from past interactions.
   * Results are sorted by a combined score that factors in both vector similarity
   * and pattern matching.
   *
   * @param results - Original search results
   * @param queryVector - Original query vector
   * @param boostFactor - How much to boost pattern-matched results (default: 0.2)
   * @returns Re-ranked search results
   */
  rerank(
    results: VectorSearchResult[],
    queryVector: number[],
    boostFactor = 0.2,
  ): VectorSearchResult[] {
    if (!this.patternStore || results.length === 0) {
      return results;
    }

    // Find similar patterns to the query
    const similarPatterns = this.patternStore.findSimilar(queryVector, 5);
    if (similarPatterns.length === 0) {
      return results;
    }

    // Calculate pattern-based boosts for each result
    const boostedResults: Array<{ result: VectorSearchResult; boostedScore: number }> = [];

    for (const result of results) {
      let patternBoost = 0;

      // Check similarity to each pattern centroid (result portion)
      for (const pattern of similarPatterns) {
        // Pattern centroid contains [query, result], extract result portion
        const dim = queryVector.length;
        const patternResultCentroid = pattern.centroid.slice(dim, dim * 2);

        if (patternResultCentroid.length > 0) {
          const similarity = this.cosineSimilarity(result.entry.vector, patternResultCentroid);

          // Boost based on pattern quality and similarity
          patternBoost += similarity * pattern.avgQuality * boostFactor;
        }
      }

      // Normalize boost (cap at boostFactor)
      patternBoost = Math.min(patternBoost / similarPatterns.length, boostFactor);

      boostedResults.push({
        result,
        boostedScore: Math.min(1.0, result.score + patternBoost),
      });
    }

    // Sort by boosted score
    boostedResults.sort((a, b) => b.boostedScore - a.boostedScore);

    // Return results with updated scores (explicit property mapping for type safety)
    return boostedResults.map(({ result, boostedScore }): VectorSearchResult => ({
      entry: result.entry,
      score: boostedScore,
    }));
  }

  /**
   * Search with pattern-aware re-ranking.
   *
   * @param params - Search parameters with optional pattern re-ranking
   * @returns Search results, optionally re-ranked
   */
  async searchWithPatterns(
    params: VectorSearchParams & { usePatterns?: boolean; patternBoost?: number },
  ): Promise<VectorSearchResult[]> {
    const { usePatterns = false, patternBoost = 0.2, ...searchParams } = params;

    // Perform base search
    const results = await this.search(searchParams);

    // Apply pattern re-ranking if requested
    if (usePatterns && this.patternStore) {
      const queryVector = normalizeVector(searchParams.vector);
      return this.rerank(results, queryVector, patternBoost);
    }

    return results;
  }

  /**
   * Trigger pattern clustering on accumulated samples.
   */
  clusterPatterns(): void {
    if (!this.patternStore) {
      return;
    }

    this.patternStore.cluster();
    this.logger.debug?.(
      `ruvector-client: clustered patterns, ${this.patternStore.getClusterCount()} clusters`,
    );
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

  // ===========================================================================
  // Pattern Export/Import (P3 Advanced Features)
  // ===========================================================================

  /**
   * Export format for pattern persistence.
   */
  static readonly PATTERN_EXPORT_VERSION = "1.0.0";

  /**
   * Export learned patterns to a file.
   *
   * Saves the current pattern store state including:
   * - All pattern clusters with centroids
   * - Feedback samples used for learning
   * - Configuration metadata
   *
   * @param path - File path to write patterns to
   * @param metadata - Optional metadata to include in export
   * @throws {RuvectorError} If pattern store is not initialized, path is invalid, or write fails
   */
  async exportPatterns(
    path: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ clusterCount: number; sampleCount: number }> {
    // Validate path
    if (!path || typeof path !== "string" || path.trim() === "") {
      throw new RuvectorError(
        "INVALID_ID",
        "Invalid export path: must be a non-empty string",
      );
    }

    if (!this.patternStore) {
      throw new RuvectorError(
        "NOT_CONNECTED",
        "Pattern store not initialized - call initializePatternStore() first",
      );
    }

    const storeData = this.patternStore.export();

    const exportData = {
      version: RuvectorClient.PATTERN_EXPORT_VERSION,
      exportedAt: Date.now(),
      dimension: this.config.dimension,
      metric: this.config.metric,
      clusters: storeData.clusters,
      samples: storeData.samples,
      metadata: {
        ...metadata,
        clusterCount: storeData.clusters.length,
        sampleCount: storeData.samples.length,
      },
    };

    try {
      await writeFile(path, JSON.stringify(exportData, null, 2), "utf-8");

      this.logger.info(
        `ruvector-client: exported ${storeData.clusters.length} clusters and ${storeData.samples.length} samples to ${path}`,
      );

      return {
        clusterCount: storeData.clusters.length,
        sampleCount: storeData.samples.length,
      };
    } catch (err) {
      throw new RuvectorError(
        "INSERT_FAILED",
        `Failed to export patterns: ${formatError(err)}`,
        err,
      );
    }
  }

  /**
   * Import learned patterns from a file.
   *
   * Loads patterns from a previously exported file. By default, replaces
   * the current pattern store. Use `mergePatterns` to combine with existing.
   *
   * @param path - File path to read patterns from
   * @returns Import statistics
   * @throws {RuvectorError} If path is invalid, read fails, or format is invalid
   */
  async importPatterns(path: string): Promise<{
    clusterCount: number;
    sampleCount: number;
    version: string;
    exportedAt: number;
  }> {
    // Validate path
    if (!path || typeof path !== "string" || path.trim() === "") {
      throw new RuvectorError(
        "INVALID_ID",
        "Invalid import path: must be a non-empty string",
      );
    }

    let content: string;
    try {
      content = await readFile(path, "utf-8");
    } catch (err) {
      throw new RuvectorError(
        "NOT_FOUND",
        `Failed to read pattern file: ${formatError(err)}`,
        err,
      );
    }

    let data: {
      version?: string;
      exportedAt?: number;
      dimension?: number;
      clusters?: Array<{
        id: string;
        centroid: number[];
        members: string[];
        avgQuality: number;
        lastUpdated: number;
      }>;
      samples?: Array<{
        id: string;
        queryVector: number[];
        resultVector: number[];
        relevanceScore: number;
        timestamp: number;
      }>;
    };

    try {
      data = JSON.parse(content);
    } catch (err) {
      throw new RuvectorError(
        "INVALID_DIMENSION",
        `Invalid pattern export format: ${formatError(err)}`,
        err,
      );
    }

    // Validate format
    if (!data.version || !data.clusters || !data.samples) {
      throw new RuvectorError(
        "INVALID_DIMENSION",
        "Invalid pattern export format: missing required fields",
      );
    }

    // Validate dimension compatibility
    if (data.dimension && data.dimension !== this.config.dimension) {
      this.logger.warn(
        `ruvector-client: dimension mismatch (export: ${data.dimension}, config: ${this.config.dimension}). ` +
          "Patterns may not work correctly.",
      );
    }

    // Initialize pattern store if needed
    if (!this.patternStore) {
      this.initializePatternStore();
    }

    // Import into pattern store
    this.patternStore!.import({
      clusters: data.clusters,
      samples: data.samples,
    });

    this.logger.info(
      `ruvector-client: imported ${data.clusters.length} clusters and ${data.samples.length} samples from ${path}`,
    );

    return {
      clusterCount: data.clusters.length,
      sampleCount: data.samples.length,
      version: data.version,
      exportedAt: data.exportedAt ?? 0,
    };
  }

  /**
   * Merge patterns from a file with existing patterns.
   *
   * Unlike `importPatterns`, this combines the imported patterns with
   * existing ones and triggers re-clustering to consolidate.
   *
   * @param path - File path to read patterns from
   * @returns Merge statistics
   * @throws {RuvectorError} If path is invalid, read fails, or format is invalid
   */
  async mergePatterns(path: string): Promise<{
    importedClusters: number;
    importedSamples: number;
    finalClusters: number;
    finalSamples: number;
  }> {
    // Validate path
    if (!path || typeof path !== "string" || path.trim() === "") {
      throw new RuvectorError(
        "INVALID_ID",
        "Invalid merge path: must be a non-empty string",
      );
    }

    // Get current state
    const existingSamples = this.patternStore?.getSampleCount() ?? 0;
    const existingClusters = this.patternStore?.getClusterCount() ?? 0;

    // Read the import file
    let content: string;
    try {
      content = await readFile(path, "utf-8");
    } catch (err) {
      throw new RuvectorError(
        "NOT_FOUND",
        `Failed to read pattern file: ${formatError(err)}`,
        err,
      );
    }

    let data: {
      version?: string;
      dimension?: number;
      samples?: Array<{
        id: string;
        queryVector: number[];
        resultVector: number[];
        relevanceScore: number;
        timestamp: number;
      }>;
    };

    try {
      data = JSON.parse(content);
    } catch (err) {
      throw new RuvectorError(
        "INVALID_DIMENSION",
        `Invalid pattern export format: ${formatError(err)}`,
        err,
      );
    }

    if (!data.samples || !Array.isArray(data.samples)) {
      throw new RuvectorError(
        "INVALID_DIMENSION",
        "Invalid pattern export format: missing samples array",
      );
    }

    // Initialize pattern store if needed
    if (!this.patternStore) {
      this.initializePatternStore();
    }

    // Add imported samples (this will deduplicate by ID)
    const importedCount = data.samples.length;
    for (const sample of data.samples) {
      this.patternStore!.addSample(sample);
    }

    // Force re-clustering to consolidate
    this.patternStore!.cluster();

    const finalClusters = this.patternStore!.getClusterCount();
    const finalSamples = this.patternStore!.getSampleCount();

    this.logger.info(
      `ruvector-client: merged ${importedCount} samples. ` +
        `Before: ${existingClusters} clusters, ${existingSamples} samples. ` +
        `After: ${finalClusters} clusters, ${finalSamples} samples.`,
    );

    return {
      importedClusters: 0, // Clusters are rebuilt during merge
      importedSamples: importedCount,
      finalClusters,
      finalSamples,
    };
  }

  /**
   * Get pattern statistics without full export.
   */
  getPatternStats(): {
    clusterCount: number;
    sampleCount: number;
    initialized: boolean;
  } {
    if (!this.patternStore) {
      return {
        clusterCount: 0,
        sampleCount: 0,
        initialized: false,
      };
    }

    return {
      clusterCount: this.patternStore.getClusterCount(),
      sampleCount: this.patternStore.getSampleCount(),
      initialized: true,
    };
  }

  // ===========================================================================
  // ruvLLM (Ruvector LLM Integration) Methods
  // ===========================================================================

  /**
   * Enable ruvLLM features with the provided configuration.
   * Initializes trajectory recording and sets up learning loops.
   *
   * @param config - ruvLLM configuration
   */
  enableRuvLLM(config: RuvLLMConfig): void {
    if (this.ruvllmConfig) {
      this.logger.warn("ruvector-client: ruvLLM already enabled, reconfiguring");
      this.disableRuvLLM();
    }

    this.ruvllmConfig = config;

    if (!config.enabled) {
      this.logger.info("ruvector-client: ruvLLM disabled by config");
      return;
    }

    this.logger.info(
      `ruvector-client: enabling ruvLLM (contextInjection: ${config.contextInjection.enabled}, trajectoryRecording: ${config.trajectoryRecording.enabled})`,
    );

    // Initialize trajectory recorder if enabled
    if (config.trajectoryRecording.enabled) {
      this.trajectoryRecorder = new TrajectoryRecorder(
        config.trajectoryRecording,
        this.logger,
      );
      this.logger.info(
        `ruvector-client: trajectory recording enabled (max: ${config.trajectoryRecording.maxTrajectories})`,
      );
    }

    // Initialize pattern store for learning if not already present
    if (!this.patternStore) {
      this.initializePatternStore();
    }

    // Start background learning loop (every 5 minutes)
    this.startLearningLoop(5 * 60 * 1000);
  }

  /**
   * Disable ruvLLM features and clean up resources.
   */
  disableRuvLLM(): void {
    if (!this.ruvllmConfig) {
      return;
    }

    this.logger.info("ruvector-client: disabling ruvLLM");

    // Stop learning loop
    this.stopLearningLoop();

    // Clean up trajectory recorder
    this.trajectoryRecorder = null;
    this.ruvllmConfig = null;

    this.logger.info("ruvector-client: ruvLLM disabled");
  }

  /**
   * Check if ruvLLM is enabled.
   */
  isRuvLLMEnabled(): boolean {
    return this.ruvllmConfig?.enabled === true;
  }

  /**
   * Get the ruvLLM configuration.
   */
  getRuvLLMConfig(): RuvLLMConfig | null {
    return this.ruvllmConfig;
  }

  /**
   * Get the trajectory recorder instance.
   * Returns null if trajectory recording is not enabled.
   */
  getTrajectoryRecorder(): TrajectoryRecorder | null {
    return this.trajectoryRecorder;
  }

  /**
   * Record a search trajectory for learning.
   * Called automatically by search methods when ruvLLM is enabled.
   *
   * @param input - Trajectory data to record
   * @returns The trajectory ID, or empty string if recording is disabled
   */
  recordTrajectory(input: TrajectoryInput): string {
    if (!this.trajectoryRecorder) {
      return "";
    }

    return this.trajectoryRecorder.record(input);
  }

  /**
   * Add feedback to a recorded trajectory.
   *
   * @param trajectoryId - ID of the trajectory to update
   * @param feedback - Feedback score (0-1, higher is better)
   * @returns true if feedback was added
   */
  addTrajectoryFeedback(trajectoryId: string, feedback: number): boolean {
    if (!this.trajectoryRecorder) {
      return false;
    }

    const success = this.trajectoryRecorder.addFeedback(trajectoryId, feedback);

    // If feedback is high quality, also create a pattern sample
    if (success && feedback >= 0.5 && this.patternStore) {
      const trajectory = this.trajectoryRecorder.get(trajectoryId);
      if (trajectory && trajectory.resultIds.length > 0) {
        // Create a pattern sample from the trajectory
        this.patternStore.addSample({
          id: trajectoryId,
          queryVector: trajectory.queryVector,
          resultVector: trajectory.queryVector, // Placeholder - ideally fetch result vector
          relevanceScore: feedback,
          timestamp: Date.now(),
        });
      }
    }

    return success;
  }

  /**
   * Get trajectory statistics.
   */
  getTrajectoryStats(): TrajectoryStats {
    if (!this.trajectoryRecorder) {
      return {
        totalTrajectories: 0,
        trajectoriesWithFeedback: 0,
        averageFeedbackScore: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
      };
    }

    return this.trajectoryRecorder.getStats();
  }

  /**
   * Get recent trajectories.
   *
   * @param limit - Maximum number to return (default: 100)
   * @returns Array of recent trajectories
   */
  getRecentTrajectories(limit = 100): Trajectory[] {
    if (!this.trajectoryRecorder) {
      return [];
    }

    return this.trajectoryRecorder.getRecent({ limit });
  }

  /**
   * Find similar past trajectories for a query.
   * Useful for suggesting results based on past successful searches.
   *
   * @param queryVector - Query vector to find similar trajectories for
   * @param limit - Maximum number to return (default: 10)
   * @returns Array of similar trajectories with similarity scores
   */
  findSimilarTrajectories(
    queryVector: number[],
    limit = 10,
  ): Array<{ trajectory: Trajectory; similarity: number }> {
    if (!this.trajectoryRecorder) {
      return [];
    }

    return this.trajectoryRecorder.findSimilar(queryVector, limit);
  }

  /**
   * Search with trajectory recording enabled.
   * Records the search as a trajectory and returns results.
   *
   * @param params - Search parameters
   * @param sessionId - Optional session ID for trajectory grouping
   * @returns Search results with trajectory ID
   */
  async searchWithTrajectory(
    params: VectorSearchParams,
    sessionId?: string,
  ): Promise<{ results: VectorSearchResult[]; trajectoryId: string }> {
    // Perform the search
    const results = await this.search(params);

    // Record trajectory
    const queryVector = normalizeVector(params.vector);
    const trajectoryId = this.recordTrajectory({
      query: "", // Query text not available at this level
      queryVector,
      resultIds: results.map((r) => r.entry.id),
      resultScores: results.map((r) => r.score),
      sessionId,
    });

    return { results, trajectoryId };
  }

  /**
   * Start the background learning loop.
   * Periodically processes trajectories and updates patterns.
   *
   * @param intervalMs - Interval between learning cycles (default: 5 minutes)
   */
  private startLearningLoop(intervalMs = 5 * 60 * 1000): void {
    if (this.learningLoopTimer) {
      return;
    }

    this.learningLoopTimer = setInterval(() => {
      this.runLearningCycle();
    }, intervalMs);

    this.logger.debug?.(
      `ruvector-client: started learning loop (interval: ${intervalMs}ms)`,
    );
  }

  /**
   * Stop the background learning loop.
   */
  private stopLearningLoop(): void {
    if (this.learningLoopTimer) {
      clearInterval(this.learningLoopTimer);
      this.learningLoopTimer = null;
      this.logger.debug?.("ruvector-client: stopped learning loop");
    }
  }

  /**
   * Run a single learning cycle.
   * Processes high-quality trajectories and updates patterns.
   */
  private runLearningCycle(): void {
    if (!this.trajectoryRecorder || !this.patternStore) {
      return;
    }

    try {
      // Get high-quality trajectories for learning
      const highQuality = this.trajectoryRecorder.getHighQuality(0.7, 50);

      if (highQuality.length === 0) {
        this.logger.debug?.("ruvector-client: no high-quality trajectories for learning");
        return;
      }

      // Convert trajectories to pattern samples
      let samplesAdded = 0;
      for (const trajectory of highQuality) {
        if (trajectory.feedback !== null && trajectory.resultIds.length > 0) {
          this.patternStore.addSample({
            id: trajectory.id,
            queryVector: trajectory.queryVector,
            resultVector: trajectory.queryVector,
            relevanceScore: trajectory.feedback,
            timestamp: trajectory.timestamp,
          });
          samplesAdded++;
        }
      }

      // Trigger clustering
      if (samplesAdded > 0) {
        this.patternStore.cluster();
        this.logger.debug?.(
          `ruvector-client: learning cycle completed (${samplesAdded} samples, ${this.patternStore.getClusterCount()} clusters)`,
        );
      }

      // Prune old trajectories
      this.trajectoryRecorder.prune();
    } catch (err) {
      this.logger.warn(`ruvector-client: learning cycle error: ${formatError(err)}`);
    }
  }

  /**
   * Force an immediate learning cycle.
   * Useful before shutdown to ensure patterns are learned.
   */
  forceLearningCycle(): void {
    this.runLearningCycle();
  }

  /**
   * Export ruvLLM state for persistence.
   * Includes trajectories and patterns.
   */
  exportRuvLLMState(): {
    trajectories: Trajectory[];
    patterns: ReturnType<PatternStore["export"]> | null;
  } {
    return {
      trajectories: this.trajectoryRecorder?.export() ?? [],
      patterns: this.patternStore?.export() ?? null,
    };
  }

  /**
   * Import ruvLLM state from a previous export.
   */
  importRuvLLMState(state: {
    trajectories?: Trajectory[];
    patterns?: ReturnType<PatternStore["export"]>;
  }): void {
    if (state.trajectories && this.trajectoryRecorder) {
      this.trajectoryRecorder.import(state.trajectories);
      this.logger.info(
        `ruvector-client: imported ${state.trajectories.length} trajectories`,
      );
    }

    if (state.patterns && this.patternStore) {
      this.patternStore.import(state.patterns);
      this.logger.info(
        `ruvector-client: imported ${state.patterns.clusters.length} clusters, ${state.patterns.samples.length} samples`,
      );
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Ensure the client is connected, throwing if not.
   */
  private ensureConnected(): RuvectorDbInstance {
    if (!this.db) {
      throw new RuvectorError("NOT_CONNECTED", "Client is not connected - call connect() first");
    }
    return this.db;
  }

  /**
   * Ensure the graph is initialized, throwing if not.
   */
  private ensureGraphInitialized(): InstanceType<typeof CodeGraph> {
    if (!this.graph) {
      throw new RuvectorError(
        "NOT_CONNECTED",
        "Graph is not initialized - call initializeGraph() first",
      );
    }
    return this.graph;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert a Float32Array or number array to a plain number array.
 */
function normalizeVector(vector: number[] | Float32Array): number[] {
  if (vector instanceof Float32Array) {
    return Array.from(vector);
  }
  return vector;
}

/**
 * Map our metric names to ruvector's expected format.
 * Uses exhaustive switch for type safety.
 */
function mapMetricToRuvector(metric: DistanceMetric): string {
  switch (metric) {
    case "cosine":
      return "cosine";
    case "euclidean":
      return "euclidean";
    case "dot":
      return "dot";
    default: {
      // Exhaustive check - this will error at compile time if a new metric is added
      const _exhaustive: never = metric;
      return "cosine";
    }
  }
}

/**
 * Parse metadata from ruvector's Record<string, unknown> to our VectorMetadata type.
 * Ensures the required `text` field exists, defaulting to empty string if missing.
 */
function parseMetadata(metadata: Record<string, unknown> | undefined): VectorEntry["metadata"] {
  const raw = metadata ?? {};
  // Build a properly typed result object
  const result: VectorEntry["metadata"] = {
    text: typeof raw.text === "string" ? raw.text : "",
  };
  // Copy over other properties safely
  for (const [key, value] of Object.entries(raw)) {
    if (key !== "text") {
      result[key] = value;
    }
  }
  return result;
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
