/**
 * TypeScript types for the ruvector memory extension.
 *
 * These types define the interfaces for vector storage, search, and configuration
 * used by the RuvectorClient wrapper.
 */

// =============================================================================
// Vector Entry Types
// =============================================================================

/**
 * Metadata stored alongside each vector entry.
 * The `text` field is required for memory recall; additional fields are optional.
 */
export type VectorMetadata = {
  /** Original text content that was embedded */
  text: string;
  /** Memory category for classification */
  category?: MemoryCategory;
  /** Importance score (0-1) */
  importance?: number;
  /** Unix timestamp when the entry was created */
  createdAt?: number;
  /** Unix timestamp when the entry was last accessed */
  lastAccessedAt?: number;
  /** Additional custom metadata */
  [key: string]: unknown;
};

/**
 * A vector entry stored in the database.
 */
export type VectorEntry = {
  /** Unique identifier for this entry */
  id: string;
  /** Vector embedding as an array of numbers */
  vector: number[];
  /** Associated metadata */
  metadata: VectorMetadata;
};

/**
 * Input for inserting a new vector entry.
 * ID is optional; if not provided, one will be generated.
 */
export type VectorInsertInput = {
  /** Optional custom ID (auto-generated if omitted) */
  id?: string;
  /** Vector embedding */
  vector: number[] | Float32Array;
  /** Metadata to store with the vector */
  metadata: VectorMetadata;
};

// =============================================================================
// Search Types
// =============================================================================

/**
 * Parameters for a vector similarity search.
 */
export type VectorSearchParams = {
  /** Query vector to search for similar entries */
  vector: number[] | Float32Array;
  /** Maximum number of results to return (default: 10) */
  limit?: number;
  /** Minimum similarity score threshold (0-1, default: 0) */
  minScore?: number;
  /** Optional metadata filter (key-value pairs that must match) */
  filter?: Record<string, unknown>;
};

/**
 * A single search result with similarity score.
 */
export type VectorSearchResult = {
  /** The matching vector entry */
  entry: VectorEntry;
  /** Similarity score (0-1, higher is more similar) */
  score: number;
};

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Memory category classification.
 */
export const MEMORY_CATEGORIES = ["preference", "fact", "decision", "entity", "other"] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

/**
 * Distance/similarity metric for vector comparison.
 */
export type DistanceMetric = "cosine" | "euclidean" | "dot";

/**
 * HNSW index configuration for tuning search performance.
 */
export type HnswConfig = {
  /** Maximum number of connections per layer (default: 16) */
  m?: number;
  /** Size of dynamic candidate list during construction (default: 200) */
  efConstruction?: number;
  /** Size of dynamic candidate list during search (default: 50) */
  efSearch?: number;
};

/**
 * Configuration options for the RuvectorClient.
 */
export type RuvectorClientConfig = {
  /** Vector dimension size (must match your embedding model) */
  dimension: number;
  /** Path to persist the database (omit for in-memory only) */
  storagePath?: string;
  /** Distance metric for similarity comparison (default: "cosine") */
  metric?: DistanceMetric;
  /** HNSW index configuration */
  hnsw?: HnswConfig;
  /** Maximum number of elements (used for initial allocation) */
  maxElements?: number;
};

/**
 * Database statistics.
 */
export type RuvectorStats = {
  /** Total number of stored vectors */
  count: number;
  /** Vector dimension */
  dimension: number;
  /** Distance metric in use */
  metric: DistanceMetric;
  /** Whether the database is connected/initialized */
  connected: boolean;
};

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error codes for ruvector operations.
 */
export type RuvectorErrorCode =
  | "NOT_CONNECTED"
  | "ALREADY_CONNECTED"
  | "INSERT_FAILED"
  | "SEARCH_FAILED"
  | "DELETE_FAILED"
  | "INVALID_DIMENSION"
  | "INVALID_ID"
  | "NOT_FOUND"
  | "INITIALIZATION_FAILED";

/**
 * Custom error class for ruvector operations.
 */
export class RuvectorError extends Error {
  readonly code: RuvectorErrorCode;
  readonly cause?: unknown;

  constructor(code: RuvectorErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "RuvectorError";
    this.code = code;
    this.cause = cause;
  }
}

// =============================================================================
// SONA (Self-Organizing Neural Architecture) Types
// =============================================================================

/**
 * Configuration for SONA self-learning capabilities.
 */
export type SONAConfig = {
  /** Whether SONA is enabled */
  enabled: boolean;
  /** Hidden dimension for neural architecture (default: 256) */
  hiddenDim: number;
  /** Learning rate for adaptation (default: 0.01) */
  learningRate?: number;
  /** Minimum quality threshold for learning (0-1, default: 0.5) */
  qualityThreshold?: number;
  /** Interval for background learning cycles in ms (default: 30000) */
  backgroundIntervalMs?: number;
};

/**
 * Statistics from the SONA engine.
 */
export type SONAStats = {
  /** Number of learning trajectories recorded */
  trajectoriesRecorded: number;
  /** Number of patterns learned from trajectories */
  patternsLearned: number;
  /** Number of micro-LoRA weight updates applied */
  microLoraUpdates: number;
  /** Average time for learning operations in ms */
  avgLearningTimeMs: number;
  /** Whether SONA is currently enabled */
  enabled: boolean;
};

/**
 * A learned pattern from SONA clustering.
 */
export type LearnedPattern = {
  /** Unique identifier for this pattern */
  id: string;
  /** Centroid vector of the pattern cluster */
  centroid: number[];
  /** Number of samples in this cluster */
  clusterSize: number;
  /** Average quality score of samples in this cluster */
  avgQuality: number;
};

// =============================================================================
// Graph Neural Network Types
// =============================================================================

/**
 * Configuration for GNN (Graph Neural Network) layer.
 */
export type GNNConfig = {
  /** Whether GNN is enabled */
  enabled: boolean;
  /** Input dimension for node embeddings */
  inputDim: number;
  /** Hidden dimension for the GNN layer */
  hiddenDim: number;
  /** Number of attention heads */
  heads: number;
  /** Dropout rate (optional, 0-1) */
  dropout?: number;
};

/**
 * An edge in the knowledge graph connecting two nodes.
 */
export type GraphEdge = {
  /** Optional edge identifier */
  id?: string;
  /** Source node ID */
  sourceId: string;
  /** Target node ID */
  targetId: string;
  /** Relationship type (e.g., "relates_to", "follows", "references") */
  relationship: string;
  /** Edge weight for GNN propagation (optional, default 1.0) */
  weight?: number;
  /** Additional edge properties */
  properties?: Record<string, unknown>;
};

/**
 * Result from a Cypher graph query.
 */
export type CypherResult = {
  /** Column names returned by the query */
  columns: string[];
  /** Rows of data, each row is an array matching the columns */
  rows: unknown[][];
};

/**
 * A node in the knowledge graph.
 */
export type GraphNode = {
  /** Unique node identifier */
  id: string;
  /** Node labels (e.g., ["Message", "Memory"]) */
  labels: string[];
  /** Node properties */
  properties: Record<string, unknown>;
};

// =============================================================================
// ruvLLM (Ruvector LLM Integration) Types
// =============================================================================

/**
 * Configuration for context injection in ruvLLM.
 * Controls how relevant memories are injected into agent prompts.
 */
export type ContextInjectionConfig = {
  /** Whether context injection is enabled */
  enabled: boolean;
  /** Maximum number of tokens to inject as context */
  maxTokens: number;
  /** Minimum relevance score (0-1) for including results */
  relevanceThreshold: number;
};

/**
 * Configuration for trajectory recording in ruvLLM.
 * Trajectories capture search queries, results, and feedback for learning.
 */
export type TrajectoryRecordingConfig = {
  /** Whether trajectory recording is enabled */
  enabled: boolean;
  /** Maximum number of trajectories to store before pruning */
  maxTrajectories: number;
};

/**
 * Configuration for ruvLLM (Ruvector LLM Integration).
 * Provides advanced features for LLM context enrichment and adaptive learning.
 */
export type RuvLLMConfig = {
  /** Whether ruvLLM features are enabled */
  enabled: boolean;
  /** Context injection settings */
  contextInjection: ContextInjectionConfig;
  /** Trajectory recording settings */
  trajectoryRecording: TrajectoryRecordingConfig;
};

/**
 * A search trajectory recording for learning.
 * Captures the full context of a search operation including feedback.
 */
export type Trajectory = {
  /** Unique trajectory identifier */
  id: string;
  /** The original search query text */
  query: string;
  /** The query vector embedding */
  queryVector: number[];
  /** IDs of results returned by the search */
  resultIds: string[];
  /** Relevance scores for each result */
  resultScores: number[];
  /** User feedback on result quality (0-1, null if no feedback) */
  feedback: number | null;
  /** Unix timestamp when the trajectory was recorded */
  timestamp: number;
  /** Session ID for grouping related trajectories */
  sessionId: string | null;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
};

/**
 * Summary statistics for trajectory recording.
 */
export type TrajectoryStats = {
  /** Total number of recorded trajectories */
  totalTrajectories: number;
  /** Number of trajectories with feedback */
  trajectoriesWithFeedback: number;
  /** Average feedback score (across trajectories with feedback) */
  averageFeedbackScore: number;
  /** Oldest trajectory timestamp */
  oldestTimestamp: number | null;
  /** Newest trajectory timestamp */
  newestTimestamp: number | null;
};

/**
 * Result from context injection operation.
 */
export type InjectedContext = {
  /** The formatted context string to inject */
  contextText: string;
  /** Number of memories included */
  memoriesIncluded: number;
  /** Estimated token count */
  estimatedTokens: number;
  /** IDs of memories that were included */
  memoryIds: string[];
};
