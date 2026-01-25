/**
 * Multi-Head Graph Attention
 *
 * Implements multi-head attention mechanism for graph-based context aggregation.
 * Different attention heads specialize in different relationship types, allowing
 * the model to capture diverse semantic relationships in the knowledge graph.
 *
 * Key features:
 * - Multiple attention heads for different relationship types
 * - Weighted neighbor aggregation
 * - Configurable attention depth for multi-hop reasoning
 * - Returns enriched context vectors combining node and neighborhood information
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for a single attention head.
 */
export type AttentionHeadConfig = {
  /** Head name/identifier */
  name: string;
  /** Relationship types this head focuses on (empty = all) */
  relationshipTypes?: string[];
  /** Attention weight multiplier for this head (default: 1.0) */
  weight?: number;
  /** Whether to use dot-product or additive attention (default: dot) */
  attentionType?: "dot" | "additive";
};

/**
 * Configuration for the GraphAttention module.
 */
export type GraphAttentionConfig = {
  /** Input dimension (node embedding size) */
  inputDim: number;
  /** Hidden dimension for attention computation */
  hiddenDim?: number;
  /** Attention heads configuration */
  heads?: AttentionHeadConfig[];
  /** Dropout rate (0-1, default: 0.1) */
  dropout?: number;
  /** Whether to normalize output (default: true) */
  normalize?: boolean;
  /** Temperature for attention softmax (default: 1.0) */
  temperature?: number;
};

/**
 * Represents a node in the graph for attention computation.
 */
export type GraphAttentionNode = {
  /** Node ID */
  id: string;
  /** Node embedding vector */
  embedding: number[];
  /** Node metadata (optional) */
  metadata?: Record<string, unknown>;
};

/**
 * Represents an edge for attention computation.
 */
export type GraphAttentionEdge = {
  /** Source node ID */
  sourceId: string;
  /** Target node ID */
  targetId: string;
  /** Relationship type */
  relationship: string;
  /** Edge weight (optional, default: 1.0) */
  weight?: number;
};

/**
 * Result from attention aggregation.
 */
export type AttentionResult = {
  /** Enriched context vector */
  contextVector: number[];
  /** Attention weights per head */
  attentionWeights: Map<string, Map<string, number>>;
  /** Nodes that contributed to the context */
  contributingNodes: string[];
  /** Total aggregation depth reached */
  depth: number;
};

/**
 * Attention scores for a single head.
 */
type HeadAttentionScores = {
  headName: string;
  scores: Map<string, number>;
  weightedVectors: number[][];
};

// =============================================================================
// Default Attention Heads
// =============================================================================

/**
 * Default attention heads covering common relationship patterns.
 */
const DEFAULT_HEADS: AttentionHeadConfig[] = [
  {
    name: "semantic",
    relationshipTypes: ["relates_to", "similar_to", "synonym"],
    weight: 1.0,
    attentionType: "dot",
  },
  {
    name: "temporal",
    relationshipTypes: ["follows", "precedes", "concurrent"],
    weight: 1.0,
    attentionType: "dot",
  },
  {
    name: "causal",
    relationshipTypes: ["causes", "enables", "prevents"],
    weight: 1.2,
    attentionType: "additive",
  },
  {
    name: "structural",
    relationshipTypes: ["contains", "part_of", "references"],
    weight: 0.8,
    attentionType: "dot",
  },
];

// =============================================================================
// Graph Attention Implementation
// =============================================================================

/**
 * Multi-head graph attention for weighted context aggregation.
 *
 * Computes attention over graph neighbors using multiple specialized heads,
 * each focusing on different relationship types. The final context vector
 * combines information from all heads with learned importance weights.
 */
export class GraphAttention {
  private config: Required<Omit<GraphAttentionConfig, "heads">> & { heads: AttentionHeadConfig[] };

  // Learned parameters (initialized with Xavier/He initialization)
  private queryWeights: Map<string, number[][]> = new Map();
  private keyWeights: Map<string, number[][]> = new Map();
  private valueWeights: Map<string, number[][]> = new Map();
  private outputProjection: number[][] = [];

  constructor(config: GraphAttentionConfig) {
    this.config = {
      inputDim: config.inputDim,
      hiddenDim: config.hiddenDim ?? Math.floor(config.inputDim / 4),
      heads: config.heads ?? DEFAULT_HEADS,
      dropout: config.dropout ?? 0.1,
      normalize: config.normalize ?? true,
      temperature: config.temperature ?? 1.0,
    };

    // Initialize weights for each head
    for (const head of this.config.heads) {
      this.queryWeights.set(head.name, this.initializeWeights(this.config.inputDim, this.config.hiddenDim));
      this.keyWeights.set(head.name, this.initializeWeights(this.config.inputDim, this.config.hiddenDim));
      this.valueWeights.set(head.name, this.initializeWeights(this.config.inputDim, this.config.hiddenDim));
    }

    // Output projection: hiddenDim * numHeads -> inputDim
    const totalHiddenDim = this.config.hiddenDim * this.config.heads.length;
    this.outputProjection = this.initializeWeights(totalHiddenDim, this.config.inputDim);
  }

  // ===========================================================================
  // Core Attention Methods
  // ===========================================================================

  /**
   * Aggregate context from graph neighbors using multi-head attention.
   *
   * @param nodeId - Central node to aggregate context for
   * @param nodes - Map of all nodes (id -> node)
   * @param edges - All edges in the graph
   * @param depth - Maximum traversal depth (default: 2)
   * @param heads - Which heads to use (default: all)
   * @returns Enriched context vector and attention metadata
   */
  aggregateContext(
    nodeId: string,
    nodes: Map<string, GraphAttentionNode>,
    edges: GraphAttentionEdge[],
    depth = 2,
    heads?: string[],
  ): AttentionResult {
    const centerNode = nodes.get(nodeId);
    if (!centerNode) {
      return {
        contextVector: Array.from<number>({ length: this.config.inputDim }).fill(0),
        attentionWeights: new Map(),
        contributingNodes: [],
        depth: 0,
      };
    }

    // Determine which heads to use
    const activeHeads = heads
      ? this.config.heads.filter((h) => heads.includes(h.name))
      : this.config.heads;

    // Collect neighbors at each depth level
    const neighborsByDepth = this.collectNeighbors(nodeId, edges, depth);

    // Compute attention for each head
    const headOutputs: HeadAttentionScores[] = [];
    const allAttentionWeights = new Map<string, Map<string, number>>();
    const contributingNodesSet = new Set<string>();

    for (const head of activeHeads) {
      const { scores, weightedVectors } = this.computeHeadAttention(
        centerNode,
        neighborsByDepth,
        nodes,
        edges,
        head,
      );

      headOutputs.push({ headName: head.name, scores, weightedVectors });
      allAttentionWeights.set(head.name, scores);

      // Track contributing nodes
      for (const neighborId of scores.keys()) {
        if ((scores.get(neighborId) ?? 0) > 0.01) {
          contributingNodesSet.add(neighborId);
        }
      }
    }

    // Aggregate head outputs
    const aggregatedVector = this.aggregateHeadOutputs(
      centerNode.embedding,
      headOutputs,
      activeHeads,
    );

    // Apply output projection
    const contextVector = this.project(aggregatedVector, this.outputProjection);

    // Normalize if configured
    const finalVector = this.config.normalize
      ? this.normalizeVector(contextVector)
      : contextVector;

    return {
      contextVector: finalVector,
      attentionWeights: allAttentionWeights,
      contributingNodes: Array.from(contributingNodesSet),
      depth: Math.min(depth, neighborsByDepth.size),
    };
  }

  /**
   * Compute attention for a single head.
   */
  private computeHeadAttention(
    centerNode: GraphAttentionNode,
    neighborsByDepth: Map<number, Set<string>>,
    nodes: Map<string, GraphAttentionNode>,
    edges: GraphAttentionEdge[],
    head: AttentionHeadConfig,
  ): { scores: Map<string, number>; weightedVectors: number[][] } {
    const queryW = this.queryWeights.get(head.name);
    const keyW = this.keyWeights.get(head.name);
    const valueW = this.valueWeights.get(head.name);

    // Ensure weights exist for this head
    if (!queryW || !keyW || !valueW) {
      return { scores: new Map(), weightedVectors: [] };
    }

    // Compute query from center node
    const query = this.project(centerNode.embedding, queryW);

    // Collect relevant neighbors based on relationship types
    const relevantNeighbors: Array<{ id: string; depth: number; edge?: GraphAttentionEdge }> = [];

    for (const [depthLevel, neighborIds] of neighborsByDepth) {
      for (const neighborId of neighborIds) {
        // Find edge between center and this neighbor
        const edge = edges.find(
          (e) =>
            (e.sourceId === centerNode.id && e.targetId === neighborId) ||
            (e.targetId === centerNode.id && e.sourceId === neighborId),
        );

        // Filter by relationship type if head specifies types
        if (head.relationshipTypes && head.relationshipTypes.length > 0) {
          if (edge && !head.relationshipTypes.includes(edge.relationship)) {
            continue;
          }
        }

        relevantNeighbors.push({ id: neighborId, depth: depthLevel, edge });
      }
    }

    // Compute attention scores
    const scores = new Map<string, number>();
    const weightedVectors: number[][] = [];
    let totalScore = 0;

    for (const { id, depth: depthLevel, edge } of relevantNeighbors) {
      const neighbor = nodes.get(id);
      if (!neighbor) continue;

      // Compute key and value
      const key = this.project(neighbor.embedding, keyW);
      const value = this.project(neighbor.embedding, valueW);

      // Attention score
      let score: number;
      if (head.attentionType === "additive") {
        // Additive attention: v^T * tanh(W_q * q + W_k * k)
        const combined = query.map((q, i) => Math.tanh(q + (key[i] ?? 0)));
        score = combined.reduce((a, b) => a + b, 0);
      } else {
        // Dot-product attention: q^T * k / sqrt(d)
        score = this.dotProduct(query, key) / Math.sqrt(this.config.hiddenDim);
      }

      // Apply temperature scaling
      score /= this.config.temperature;

      // Apply depth decay (further neighbors get lower scores)
      score *= Math.pow(0.7, depthLevel - 1);

      // Apply edge weight if available
      if (edge?.weight !== undefined) {
        score *= edge.weight;
      }

      // Apply head weight
      score *= head.weight ?? 1.0;

      scores.set(id, score);
      totalScore += Math.exp(score);
      weightedVectors.push(value);
    }

    // Softmax normalization
    if (totalScore > 0) {
      for (const [id, score] of scores) {
        const normalizedScore = Math.exp(score) / totalScore;
        scores.set(id, normalizedScore);
      }
    }

    return { scores, weightedVectors };
  }

  /**
   * Aggregate outputs from all attention heads.
   */
  private aggregateHeadOutputs(
    centerEmbedding: number[],
    headOutputs: HeadAttentionScores[],
    heads: AttentionHeadConfig[],
  ): number[] {
    const concatenated: number[] = [];

    for (let i = 0; i < headOutputs.length; i++) {
      const headOutput = headOutputs[i];
      const headConfig = heads[i];

      // Safety check for matching arrays
      if (!headConfig) {
        continue;
      }

      // Compute weighted sum of neighbor values
      const aggregated = Array.from<number>({ length: this.config.hiddenDim }).fill(0);
      let scoreSum = 0;

      for (const [neighborId, score] of headOutput.scores) {
        const idx = Array.from(headOutput.scores.keys()).indexOf(neighborId);
        const valueVec = headOutput.weightedVectors[idx];
        if (valueVec) {
          for (let j = 0; j < this.config.hiddenDim; j++) {
            aggregated[j] += (valueVec[j] ?? 0) * score;
          }
        }
        scoreSum += score;
      }

      // Normalize by score sum and add dropout during training
      if (scoreSum > 0) {
        for (let j = 0; j < this.config.hiddenDim; j++) {
          // Apply dropout (randomly zero out during training simulation)
          const dropoutMask = Math.random() > this.config.dropout ? 1 : 0;
          aggregated[j] *= dropoutMask;
        }
      }

      // Apply head weight from config
      const headWeight = headConfig.weight ?? 1.0;
      concatenated.push(...aggregated.map((v) => v * headWeight));
    }

    // If no neighbors contributed, fall back to center embedding projection
    if (concatenated.every((v) => v === 0)) {
      const fallback = Array.from<number>({ length: this.config.hiddenDim * heads.length }).fill(0);
      // Use center embedding as base
      for (let i = 0; i < Math.min(centerEmbedding.length, fallback.length); i++) {
        fallback[i] = centerEmbedding[i] ?? 0;
      }
      return fallback;
    }

    return concatenated;
  }

  // ===========================================================================
  // Graph Traversal
  // ===========================================================================

  /**
   * Collect neighbors at each depth level using BFS.
   */
  private collectNeighbors(
    startId: string,
    edges: GraphAttentionEdge[],
    maxDepth: number,
  ): Map<number, Set<string>> {
    const neighborsByDepth = new Map<number, Set<string>>();
    const visited = new Set<string>([startId]);
    let currentLevel = new Set([startId]);

    for (let depth = 1; depth <= maxDepth; depth++) {
      const nextLevel = new Set<string>();

      for (const nodeId of currentLevel) {
        // Find all edges connected to this node
        for (const edge of edges) {
          let neighborId: string | null = null;

          if (edge.sourceId === nodeId && !visited.has(edge.targetId)) {
            neighborId = edge.targetId;
          } else if (edge.targetId === nodeId && !visited.has(edge.sourceId)) {
            neighborId = edge.sourceId;
          }

          if (neighborId) {
            nextLevel.add(neighborId);
            visited.add(neighborId);
          }
        }
      }

      if (nextLevel.size > 0) {
        neighborsByDepth.set(depth, nextLevel);
      }
      currentLevel = nextLevel;
    }

    return neighborsByDepth;
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Add or update an attention head.
   */
  addHead(config: AttentionHeadConfig): void {
    // Remove existing head with same name
    this.config.heads = this.config.heads.filter((h) => h.name !== config.name);
    this.config.heads.push(config);

    // Initialize weights for new head
    this.queryWeights.set(config.name, this.initializeWeights(this.config.inputDim, this.config.hiddenDim));
    this.keyWeights.set(config.name, this.initializeWeights(this.config.inputDim, this.config.hiddenDim));
    this.valueWeights.set(config.name, this.initializeWeights(this.config.inputDim, this.config.hiddenDim));

    // Update output projection
    const totalHiddenDim = this.config.hiddenDim * this.config.heads.length;
    this.outputProjection = this.initializeWeights(totalHiddenDim, this.config.inputDim);
  }

  /**
   * Remove an attention head.
   */
  removeHead(name: string): boolean {
    const initialLength = this.config.heads.length;
    this.config.heads = this.config.heads.filter((h) => h.name !== name);

    if (this.config.heads.length < initialLength) {
      this.queryWeights.delete(name);
      this.keyWeights.delete(name);
      this.valueWeights.delete(name);

      // Update output projection
      const totalHiddenDim = this.config.hiddenDim * this.config.heads.length;
      this.outputProjection = this.initializeWeights(totalHiddenDim, this.config.inputDim);

      return true;
    }

    return false;
  }

  /**
   * Get current configuration.
   */
  getConfig(): GraphAttentionConfig {
    return {
      inputDim: this.config.inputDim,
      hiddenDim: this.config.hiddenDim,
      heads: this.config.heads.map((h) => ({ ...h })),
      dropout: this.config.dropout,
      normalize: this.config.normalize,
      temperature: this.config.temperature,
    };
  }

  /**
   * Get head names.
   */
  getHeadNames(): string[] {
    return this.config.heads.map((h) => h.name);
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Initialize weight matrix using Xavier initialization.
   */
  private initializeWeights(inputDim: number, outputDim: number): number[][] {
    const scale = Math.sqrt(2 / (inputDim + outputDim));
    const weights: number[][] = [];

    for (let i = 0; i < outputDim; i++) {
      const row: number[] = [];
      for (let j = 0; j < inputDim; j++) {
        // Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        row.push(normal * scale);
      }
      weights.push(row);
    }

    return weights;
  }

  /**
   * Project a vector through a weight matrix.
   */
  private project(input: number[], weights: number[][]): number[] {
    const output: number[] = [];

    for (let i = 0; i < weights.length; i++) {
      let sum = 0;
      for (let j = 0; j < input.length && j < weights[i].length; j++) {
        sum += (input[j] ?? 0) * (weights[i][j] ?? 0);
      }
      output.push(sum);
    }

    return output;
  }

  /**
   * Compute dot product of two vectors.
   */
  private dotProduct(a: number[], b: number[]): number {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      sum += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return sum;
  }

  /**
   * Normalize a vector to unit length.
   */
  private normalizeVector(v: number[]): number[] {
    let norm = 0;
    for (const val of v) {
      norm += val * val;
    }
    norm = Math.sqrt(norm);

    if (norm === 0) return v;
    return v.map((val) => val / norm);
  }
}
