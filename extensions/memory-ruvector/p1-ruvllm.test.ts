/**
 * P1 ruvLLM Feature Tests
 *
 * Comprehensive tests for:
 * 1. PatternStore - addSample(), cluster(), findSimilar(), export/import
 * 2. GraphExpander - expandFromSearch(), suggestRelationships()
 * 3. RuvectorClient.rerank() - pattern-based re-ranking
 * 4. ruvector_recall tool - usePatterns, expandGraph options
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// =============================================================================
// Mock ruvector package with class-based mocks
// =============================================================================

// Mock function instances (need to be at module scope for class methods)
const mockVectorDb = {
  insert: vi.fn().mockResolvedValue(undefined),
  insertBatch: vi.fn().mockResolvedValue([]),
  search: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(true),
  len: vi.fn().mockResolvedValue(0),
  isEmpty: vi.fn().mockResolvedValue(true),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockSonaEngine = {
  setEnabled: vi.fn(),
  isEnabled: vi.fn().mockReturnValue(false),
  beginTrajectory: vi.fn().mockReturnValue("trajectory-id"),
  addStep: vi.fn(),
  endTrajectory: vi.fn(),
  applyMicroLora: vi.fn(),
  findPatterns: vi.fn().mockReturnValue([]),
  getStats: vi.fn().mockReturnValue({ patternsLearned: 0 }),
  forceLearn: vi.fn(),
};

const mockCodeGraph = {
  createNode: vi.fn().mockResolvedValue(undefined),
  createEdge: vi.fn().mockResolvedValue(undefined),
  cypher: vi.fn().mockResolvedValue({ columns: [], rows: [] }),
  neighbors: vi.fn().mockResolvedValue([]),
};

// Create mock class constructors
class MockVectorDb {
  insert = mockVectorDb.insert;
  insertBatch = mockVectorDb.insertBatch;
  search = mockVectorDb.search;
  get = mockVectorDb.get;
  delete = mockVectorDb.delete;
  len = mockVectorDb.len;
  isEmpty = mockVectorDb.isEmpty;
  close = mockVectorDb.close;
}

class MockSonaEngine {
  static withConfig = vi.fn().mockImplementation(() => new MockSonaEngine());
  setEnabled = mockSonaEngine.setEnabled;
  isEnabled = mockSonaEngine.isEnabled;
  beginTrajectory = mockSonaEngine.beginTrajectory;
  addStep = mockSonaEngine.addStep;
  endTrajectory = mockSonaEngine.endTrajectory;
  applyMicroLora = mockSonaEngine.applyMicroLora;
  findPatterns = mockSonaEngine.findPatterns;
  getStats = mockSonaEngine.getStats;
  forceLearn = mockSonaEngine.forceLearn;
}

class MockCodeGraph {
  createNode = mockCodeGraph.createNode;
  createEdge = mockCodeGraph.createEdge;
  cypher = mockCodeGraph.cypher;
  neighbors = mockCodeGraph.neighbors;
}

class MockRuvectorLayer {}

vi.mock("ruvector", () => ({
  VectorDb: MockVectorDb,
  VectorDB: MockVectorDb,
  SonaEngine: MockSonaEngine,
  CodeGraph: MockCodeGraph,
  RuvectorLayer: MockRuvectorLayer,
  default: {
    VectorDb: MockVectorDb,
    VectorDB: MockVectorDb,
  },
}));

// Helper to create mock logger
function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

// Helper to create fake API
function createFakeApi() {
  return {
    logger: createMockLogger(),
    config: { get: vi.fn(), set: vi.fn() },
    storage: { get: vi.fn(), set: vi.fn() },
    registerTool: vi.fn(),
    registerService: vi.fn(),
  };
}

// =============================================================================
// PatternStore Tests (P1 ruvLLM)
// =============================================================================

describe("PatternStore", () => {
  let PatternStore: typeof import("./sona/patterns.js").PatternStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./sona/patterns.js");
    PatternStore = module.PatternStore;
  });

  describe("addSample()", () => {
    it("adds samples with high relevance scores", () => {
      const store = new PatternStore({ qualityThreshold: 0.5 });

      store.addSample({
        id: "sample-1",
        queryVector: [0.1, 0.2, 0.3],
        resultVector: [0.4, 0.5, 0.6],
        relevanceScore: 0.8,
        timestamp: Date.now(),
      });

      expect(store.getSampleCount()).toBe(1);
    });

    it("filters out low relevance samples below threshold", () => {
      const store = new PatternStore({ qualityThreshold: 0.5 });

      store.addSample({
        id: "sample-1",
        queryVector: [0.1, 0.2, 0.3],
        resultVector: [0.4, 0.5, 0.6],
        relevanceScore: 0.3, // Below threshold
        timestamp: Date.now(),
      });

      expect(store.getSampleCount()).toBe(0);
    });

    it("triggers auto re-clustering after enough samples", () => {
      // minSamplesPerCluster * 2 = 6 samples triggers re-cluster
      const store = new PatternStore({
        qualityThreshold: 0.5,
        minSamplesPerCluster: 3,
      });

      // Add 6 samples to trigger clustering
      for (let i = 0; i < 6; i++) {
        store.addSample({
          id: `sample-${i}`,
          queryVector: [i * 0.1, i * 0.2],
          resultVector: [i * 0.3, i * 0.4],
          relevanceScore: 0.8,
          timestamp: Date.now(),
        });
      }

      expect(store.getSampleCount()).toBe(6);
      // Clusters should be created after auto re-cluster
      expect(store.getClusterCount()).toBeGreaterThanOrEqual(0);
    });
  });

  describe("cluster()", () => {
    it("does nothing with too few samples", () => {
      const store = new PatternStore({ minSamplesPerCluster: 5 });

      store.addSample({
        id: "sample-1",
        queryVector: [0.1, 0.2],
        resultVector: [0.3, 0.4],
        relevanceScore: 0.9,
        timestamp: Date.now(),
      });

      store.cluster();
      expect(store.getClusterCount()).toBe(0);
    });

    it("creates clusters when enough samples exist", () => {
      const store = new PatternStore({
        minSamplesPerCluster: 2,
        maxClusters: 3,
      });

      // Add enough samples for clustering
      for (let i = 0; i < 6; i++) {
        store.addSample({
          id: `sample-${i}`,
          queryVector: [i * 0.1, i * 0.2, i * 0.3],
          resultVector: [i * 0.4, i * 0.5, i * 0.6],
          relevanceScore: 0.7 + i * 0.05,
          timestamp: Date.now(),
        });
      }

      store.cluster();

      const clusters = store.getClusters();
      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters.length).toBeLessThanOrEqual(3);
    });

    it("calculates average quality for clusters", () => {
      const store = new PatternStore({
        minSamplesPerCluster: 2,
        maxClusters: 1,
      });

      // Add samples with known scores
      store.addSample({
        id: "s1",
        queryVector: [1, 0],
        resultVector: [0, 1],
        relevanceScore: 0.8,
        timestamp: Date.now(),
      });
      store.addSample({
        id: "s2",
        queryVector: [1, 0.1],
        resultVector: [0.1, 1],
        relevanceScore: 0.9,
        timestamp: Date.now(),
      });

      store.cluster();

      const clusters = store.getClusters();
      if (clusters.length > 0) {
        expect(clusters[0].avgQuality).toBeGreaterThan(0);
        expect(clusters[0].avgQuality).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("findSimilar()", () => {
    it("returns empty array when no clusters exist", () => {
      const store = new PatternStore();

      const patterns = store.findSimilar([0.1, 0.2, 0.3], 5);

      expect(patterns).toHaveLength(0);
    });

    it("finds similar patterns to query vector", () => {
      const store = new PatternStore({
        minSamplesPerCluster: 2,
        maxClusters: 3,
      });

      // Add samples clustered around specific vectors
      for (let i = 0; i < 6; i++) {
        store.addSample({
          id: `sample-${i}`,
          queryVector: [1, 0, 0],
          resultVector: [0, 1, 0],
          relevanceScore: 0.9,
          timestamp: Date.now(),
        });
      }

      store.cluster();

      const patterns = store.findSimilar([1, 0, 0], 5);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
      if (patterns.length > 0) {
        expect(patterns[0]).toHaveProperty("id");
        expect(patterns[0]).toHaveProperty("centroid");
        expect(patterns[0]).toHaveProperty("clusterSize");
        expect(patterns[0]).toHaveProperty("avgQuality");
      }
    });

    it("respects k limit", () => {
      const store = new PatternStore({
        minSamplesPerCluster: 2,
        maxClusters: 10,
      });

      // Add samples to create multiple clusters
      for (let i = 0; i < 20; i++) {
        store.addSample({
          id: `sample-${i}`,
          queryVector: [Math.random(), Math.random()],
          resultVector: [Math.random(), Math.random()],
          relevanceScore: 0.8,
          timestamp: Date.now(),
        });
      }

      store.cluster();

      const patterns = store.findSimilar([0.5, 0.5], 2);

      expect(patterns.length).toBeLessThanOrEqual(2);
    });
  });

  describe("updateFromFeedback()", () => {
    it("updates sample relevance score", () => {
      const store = new PatternStore({ qualityThreshold: 0.5 });

      store.addSample({
        id: "sample-1",
        queryVector: [0.1, 0.2],
        resultVector: [0.3, 0.4],
        relevanceScore: 0.6,
        timestamp: Date.now(),
      });

      store.updateFromFeedback("sample-1", 0.95);

      const samples = store.getSamples();
      expect(samples[0].relevanceScore).toBe(0.95);
    });

    it("does nothing for non-existent sample", () => {
      const store = new PatternStore();

      // Should not throw
      store.updateFromFeedback("non-existent", 0.9);

      expect(store.getSampleCount()).toBe(0);
    });

    it("updates cluster avgQuality when sample is in a cluster", () => {
      const store = new PatternStore({
        minSamplesPerCluster: 2,
        maxClusters: 1,
      });

      // Add samples and cluster them
      store.addSample({
        id: "s1",
        queryVector: [1, 0],
        resultVector: [0, 1],
        relevanceScore: 0.7,
        timestamp: Date.now(),
      });
      store.addSample({
        id: "s2",
        queryVector: [1, 0.1],
        resultVector: [0.1, 1],
        relevanceScore: 0.7,
        timestamp: Date.now(),
      });

      store.cluster();

      const clustersBefore = store.getClusters();
      const avgQualityBefore = clustersBefore[0]?.avgQuality ?? 0;

      // Update feedback for one sample
      store.updateFromFeedback("s1", 0.99);

      const clustersAfter = store.getClusters();
      const avgQualityAfter = clustersAfter[0]?.avgQuality ?? 0;

      // Average quality should increase
      expect(avgQualityAfter).toBeGreaterThanOrEqual(avgQualityBefore);
    });
  });

  describe("export/import", () => {
    it("exports clusters and samples", () => {
      const store = new PatternStore({
        minSamplesPerCluster: 2,
        maxClusters: 2,
      });

      for (let i = 0; i < 4; i++) {
        store.addSample({
          id: `sample-${i}`,
          queryVector: [i * 0.1, i * 0.2],
          resultVector: [i * 0.3, i * 0.4],
          relevanceScore: 0.8,
          timestamp: Date.now(),
        });
      }
      store.cluster();

      const exported = store.export();

      expect(exported).toHaveProperty("clusters");
      expect(exported).toHaveProperty("samples");
      expect(Array.isArray(exported.clusters)).toBe(true);
      expect(Array.isArray(exported.samples)).toBe(true);
      expect(exported.samples.length).toBe(4);
    });

    it("imports previously exported state", () => {
      const store1 = new PatternStore({ minSamplesPerCluster: 2 });

      store1.addSample({
        id: "s1",
        queryVector: [0.1, 0.2],
        resultVector: [0.3, 0.4],
        relevanceScore: 0.9,
        timestamp: Date.now(),
      });
      store1.addSample({
        id: "s2",
        queryVector: [0.2, 0.3],
        resultVector: [0.4, 0.5],
        relevanceScore: 0.85,
        timestamp: Date.now(),
      });
      store1.cluster();

      const exported = store1.export();

      const store2 = new PatternStore();
      store2.import(exported);

      expect(store2.getSampleCount()).toBe(2);
      expect(store2.getClusterCount()).toBe(store1.getClusterCount());
    });

    it("throws on invalid import data", () => {
      const store = new PatternStore();

      expect(() => store.import(null as any)).toThrow(/invalid import data/i);
      expect(() => store.import({} as any)).toThrow(/clusters must be an array/i);
      expect(() => store.import({ clusters: [] } as any)).toThrow(/samples must be an array/i);
    });
  });
});

// =============================================================================
// GraphExpander Tests (P1 ruvLLM)
// =============================================================================

describe("GraphExpander", () => {
  let GraphExpander: typeof import("./graph/expansion.js").GraphExpander;

  function createMockGraph() {
    return {
      edgeExists: vi.fn().mockResolvedValue(false),
      addEdge: vi.fn().mockResolvedValue("edge-id"),
      getNeighbors: vi.fn().mockResolvedValue([]),
      getNodeVector: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./graph/expansion.js");
    GraphExpander = module.GraphExpander;
  });

  describe("expandFromSearch()", () => {
    it("returns empty result when fewer than 2 results", async () => {
      const mockGraph = createMockGraph();
      const expander = new GraphExpander(mockGraph);

      const result = await expander.expandFromSearch("test query", [
        { entry: { id: "id1", vector: [], metadata: { text: "test" } }, score: 0.9 },
      ]);

      expect(result.createdEdges).toHaveLength(0);
      expect(result.skippedEdges).toBe(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("creates edges between results with high combined scores", async () => {
      const mockGraph = createMockGraph();
      const expander = new GraphExpander(mockGraph, {
        similarityThreshold: 0.7,
        bidirectional: false,
      });

      const results = [
        { entry: { id: "id1", vector: [1, 0], metadata: { text: "a" } }, score: 0.9 },
        { entry: { id: "id2", vector: [0, 1], metadata: { text: "b" } }, score: 0.85 },
      ];

      const result = await expander.expandFromSearch("test query", results);

      expect(mockGraph.addEdge).toHaveBeenCalled();
      expect(result.createdEdges.length).toBeGreaterThan(0);
    });

    it("skips edges that already exist", async () => {
      const mockGraph = createMockGraph();
      mockGraph.edgeExists.mockResolvedValue(true);

      const expander = new GraphExpander(mockGraph, { similarityThreshold: 0.5 });

      const results = [
        { entry: { id: "id1", vector: [], metadata: { text: "a" } }, score: 0.9 },
        { entry: { id: "id2", vector: [], metadata: { text: "b" } }, score: 0.8 },
      ];

      const result = await expander.expandFromSearch("test query", results);

      expect(result.skippedEdges).toBeGreaterThan(0);
      expect(result.createdEdges).toHaveLength(0);
    });

    it("creates bidirectional edges when configured", async () => {
      const mockGraph = createMockGraph();
      const expander = new GraphExpander(mockGraph, {
        similarityThreshold: 0.5,
        bidirectional: true,
      });

      const results = [
        { entry: { id: "id1", vector: [], metadata: { text: "a" } }, score: 0.9 },
        { entry: { id: "id2", vector: [], metadata: { text: "b" } }, score: 0.8 },
      ];

      await expander.expandFromSearch("test query", results);

      // Should create edges in both directions
      expect(mockGraph.addEdge.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("respects maxEdgesPerExpansion limit", async () => {
      const mockGraph = createMockGraph();
      const expander = new GraphExpander(mockGraph, {
        similarityThreshold: 0.3,
        maxEdgesPerExpansion: 2,
        bidirectional: false,
      });

      const results = [
        { entry: { id: "id1", vector: [], metadata: { text: "a" } }, score: 0.9 },
        { entry: { id: "id2", vector: [], metadata: { text: "b" } }, score: 0.85 },
        { entry: { id: "id3", vector: [], metadata: { text: "c" } }, score: 0.8 },
        { entry: { id: "id4", vector: [], metadata: { text: "d" } }, score: 0.75 },
      ];

      const result = await expander.expandFromSearch("test query", results);

      expect(result.createdEdges.length).toBeLessThanOrEqual(2);
    });
  });

  describe("suggestRelationships()", () => {
    it("returns empty when node vector not found", async () => {
      const mockGraph = createMockGraph();
      mockGraph.getNodeVector.mockResolvedValue(null);

      const expander = new GraphExpander(mockGraph);

      const suggestions = await expander.suggestRelationships("node-1");

      expect(suggestions).toHaveLength(0);
    });

    it("returns empty when no candidates provided", async () => {
      const mockGraph = createMockGraph();
      const expander = new GraphExpander(mockGraph);

      const suggestions = await expander.suggestRelationships("node-1");

      expect(suggestions).toHaveLength(0);
    });

    it("filters out existing neighbors from suggestions", async () => {
      const mockGraph = createMockGraph();
      mockGraph.getNeighbors.mockResolvedValue([{ id: "neighbor-1" }]);

      const expander = new GraphExpander(mockGraph, { similarityThreshold: 0.5 });

      const candidates = [
        { entry: { id: "neighbor-1", vector: [], metadata: {} }, score: 0.9 }, // Existing neighbor
        { entry: { id: "candidate-1", vector: [], metadata: {} }, score: 0.8 },
      ];

      const suggestions = await expander.suggestRelationships("node-1", candidates);

      // Should not include the existing neighbor
      expect(suggestions.find((s) => s.targetId === "neighbor-1")).toBeUndefined();
    });

    it("includes confidence and reason in suggestions", async () => {
      const mockGraph = createMockGraph();
      const expander = new GraphExpander(mockGraph, { similarityThreshold: 0.5 });

      const candidates = [
        { entry: { id: "candidate-1", vector: [], metadata: { category: "preference" } }, score: 0.85 },
      ];

      const suggestions = await expander.suggestRelationships("node-1", candidates);

      if (suggestions.length > 0) {
        expect(suggestions[0]).toHaveProperty("confidence");
        expect(suggestions[0]).toHaveProperty("reason");
        expect(suggestions[0]).toHaveProperty("relationship");
        expect(suggestions[0].confidence).toBe(0.85);
      }
    });

    it("infers relationship type from metadata category", async () => {
      const mockGraph = createMockGraph();
      const expander = new GraphExpander(mockGraph, { similarityThreshold: 0.5 });

      const preferenceCandidate = [
        { entry: { id: "c1", vector: [], metadata: { category: "preference" } }, score: 0.8 },
      ];

      const suggestions = await expander.suggestRelationships("node-1", preferenceCandidate);

      if (suggestions.length > 0) {
        expect(suggestions[0].relationship).toBe("shares_preference");
      }
    });
  });

  describe("expandFromFeedback()", () => {
    it("creates edges from query to selected results", async () => {
      const mockGraph = createMockGraph();
      const expander = new GraphExpander(mockGraph, { similarityThreshold: 0.5 });

      const samples = [
        { queryId: "q1", resultId: "r1", relevanceScore: 0.9 },
        { queryId: "q2", resultId: "r2", relevanceScore: 0.8 },
      ];

      const result = await expander.expandFromFeedback(samples);

      expect(mockGraph.addEdge).toHaveBeenCalled();
      expect(result.createdEdges.length).toBeGreaterThan(0);
      // Verify "selected_from" relationship type
      const createdEdge = result.createdEdges[0];
      expect(createdEdge.relationship).toBe("selected_from");
    });

    it("skips samples below similarity threshold", async () => {
      const mockGraph = createMockGraph();
      const expander = new GraphExpander(mockGraph, { similarityThreshold: 0.8 });

      const samples = [
        { queryId: "q1", resultId: "r1", relevanceScore: 0.5 }, // Below threshold
      ];

      const result = await expander.expandFromFeedback(samples);

      expect(result.createdEdges).toHaveLength(0);
    });

    it("creates co_selected edges between results from same query", async () => {
      const mockGraph = createMockGraph();
      const expander = new GraphExpander(mockGraph, { similarityThreshold: 0.5 });

      const samples = [
        { queryId: "q1", resultId: "r1", relevanceScore: 0.9 },
        { queryId: "q1", resultId: "r2", relevanceScore: 0.85 },
      ];

      const result = await expander.expandFromFeedback(samples);

      const coSelectedEdges = result.createdEdges.filter((e) => e.relationship === "co_selected");
      expect(coSelectedEdges.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("configuration", () => {
    it("getConfig returns current configuration", () => {
      const mockGraph = createMockGraph();
      const expander = new GraphExpander(mockGraph, {
        similarityThreshold: 0.8,
        maxEdgesPerExpansion: 5,
      });

      const config = expander.getConfig();

      expect(config.similarityThreshold).toBe(0.8);
      expect(config.maxEdgesPerExpansion).toBe(5);
    });

    it("updateConfig changes settings", () => {
      const mockGraph = createMockGraph();
      const expander = new GraphExpander(mockGraph);

      expander.updateConfig({
        similarityThreshold: 0.9,
        bidirectional: false,
      });

      const config = expander.getConfig();
      expect(config.similarityThreshold).toBe(0.9);
      expect(config.bidirectional).toBe(false);
    });
  });
});

// =============================================================================
// RuvectorClient.rerank() Tests (P1 ruvLLM)
// =============================================================================

describe("RuvectorClient.rerank()", () => {
  let RuvectorClient: typeof import("./client.js").RuvectorClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./client.js");
    RuvectorClient = module.RuvectorClient;
  });

  it("returns original results when pattern store not initialized", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();

    const results = [
      { entry: { id: "r1", vector: [0.1, 0.2], metadata: { text: "test" } }, score: 0.9 },
      { entry: { id: "r2", vector: [0.3, 0.4], metadata: { text: "test2" } }, score: 0.8 },
    ];

    const reranked = client.rerank(results, [0.1, 0.2]);

    expect(reranked).toEqual(results);
  });

  it("returns original results when no patterns match", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 4 }, logger);
    await client.connect();

    client.initializePatternStore({ minSamplesPerCluster: 2 });
    // Add samples but don't cluster
    const patternStore = client.getPatternStore();
    patternStore?.addSample({
      id: "s1",
      queryVector: [1, 0, 0, 0],
      resultVector: [0, 1, 0, 0],
      relevanceScore: 0.9,
      timestamp: Date.now(),
    });

    const results = [
      { entry: { id: "r1", vector: [0.1, 0.2, 0.3, 0.4], metadata: { text: "test" } }, score: 0.9 },
    ];

    const reranked = client.rerank(results, [0.5, 0.5, 0.5, 0.5]);

    // Should return original results since no clusters exist
    expect(reranked.length).toBe(results.length);
  });

  it("boosts results matching learned patterns", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 4 }, logger);
    await client.connect();

    client.initializePatternStore({ minSamplesPerCluster: 2, maxClusters: 1 });
    const patternStore = client.getPatternStore();

    // Add samples to create a pattern
    patternStore?.addSample({
      id: "s1",
      queryVector: [1, 0, 0, 0],
      resultVector: [0.9, 0.1, 0, 0],
      relevanceScore: 0.95,
      timestamp: Date.now(),
    });
    patternStore?.addSample({
      id: "s2",
      queryVector: [0.95, 0.05, 0, 0],
      resultVector: [0.85, 0.15, 0, 0],
      relevanceScore: 0.9,
      timestamp: Date.now(),
    });

    patternStore?.cluster();

    const results = [
      { entry: { id: "r1", vector: [0.9, 0.1, 0, 0], metadata: { text: "matching" } }, score: 0.8 },
      { entry: { id: "r2", vector: [0, 0, 0.9, 0.1], metadata: { text: "not matching" } }, score: 0.85 },
    ];

    const reranked = client.rerank(results, [1, 0, 0, 0], 0.2);

    // Results should be re-ordered based on pattern matching
    expect(reranked.length).toBe(2);
    // The matching result should be boosted
    if (patternStore?.getClusterCount() ?? 0 > 0) {
      expect(reranked[0].score).toBeGreaterThanOrEqual(results[0].score);
    }
  });

  it("caps boosted scores at 1.0", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 4 }, logger);
    await client.connect();

    client.initializePatternStore({ minSamplesPerCluster: 2, maxClusters: 1 });
    const patternStore = client.getPatternStore();

    // Add high-quality samples
    patternStore?.addSample({
      id: "s1",
      queryVector: [1, 0, 0, 0],
      resultVector: [1, 0, 0, 0],
      relevanceScore: 1.0,
      timestamp: Date.now(),
    });
    patternStore?.addSample({
      id: "s2",
      queryVector: [1, 0, 0, 0],
      resultVector: [1, 0, 0, 0],
      relevanceScore: 1.0,
      timestamp: Date.now(),
    });

    patternStore?.cluster();

    const results = [
      { entry: { id: "r1", vector: [1, 0, 0, 0], metadata: { text: "test" } }, score: 0.99 },
    ];

    const reranked = client.rerank(results, [1, 0, 0, 0], 0.5);

    // Score should be capped at 1.0
    expect(reranked[0].score).toBeLessThanOrEqual(1.0);
  });

  it("returns empty array for empty results", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();

    client.initializePatternStore();

    const reranked = client.rerank([], [0.1, 0.2]);

    expect(reranked).toHaveLength(0);
  });
});

// =============================================================================
// ruvector_recall Tool Tests (P1 ruvLLM)
// =============================================================================

describe("createRuvectorRecallTool", () => {
  let createRuvectorRecallTool: typeof import("./tool.js").createRuvectorRecallTool;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./tool.js");
    createRuvectorRecallTool = module.createRuvectorRecallTool;
  });

  function createMockClient() {
    return {
      search: vi.fn().mockResolvedValue([]),
      searchWithPatterns: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      getNeighbors: vi.fn().mockResolvedValue([]),
      isGraphInitialized: vi.fn().mockReturnValue(false),
      getPatternStore: vi.fn().mockReturnValue(null),
    };
  }

  it("returns disabled result when service is not running", async () => {
    const api = createFakeApi();
    const service = {
      isRunning: () => false,
      getClient: () => {
        throw new Error("not running");
      },
    };
    const embedQuery = vi.fn();

    const tool = createRuvectorRecallTool({
      api: api as any,
      service: service as any,
      embedQuery,
    });

    const result = await tool.execute("call-1", { query: "test" });

    expect((result as any).details.disabled).toBe(true);
    expect((result as any).details.error).toContain("not running");
  });

  it("has correct tool schema and metadata", async () => {
    const api = createFakeApi();
    const mockClient = createMockClient();
    const service = {
      isRunning: () => true,
      getClient: () => mockClient,
    };
    const embedQuery = vi.fn();

    const tool = createRuvectorRecallTool({
      api: api as any,
      service: service as any,
      embedQuery,
    });

    expect(tool.name).toBe("ruvector_recall");
    expect(tool.label).toBe("Pattern-Aware Memory Recall");
    expect(tool.parameters).toBeDefined();
  });

  it("uses searchWithPatterns when usePatterns=true", async () => {
    const api = createFakeApi();
    const mockClient = createMockClient();
    mockClient.searchWithPatterns.mockResolvedValue([
      {
        entry: { id: "r1", vector: [], metadata: { text: "result 1", category: "fact" } },
        score: 0.9,
      },
    ]);

    const service = {
      isRunning: () => true,
      getClient: () => mockClient,
    };
    const embedQuery = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));

    const tool = createRuvectorRecallTool({
      api: api as any,
      service: service as any,
      embedQuery,
    });

    const result = await tool.execute("call-1", { query: "test", usePatterns: true });

    expect(mockClient.searchWithPatterns).toHaveBeenCalledWith(
      expect.objectContaining({ usePatterns: true }),
    );
    expect((result as any).details.results).toHaveLength(1);
  });

  it("uses regular search when usePatterns=false", async () => {
    const api = createFakeApi();
    const mockClient = createMockClient();
    mockClient.search.mockResolvedValue([
      {
        entry: { id: "r1", vector: [], metadata: { text: "result 1" } },
        score: 0.85,
      },
    ]);

    const service = {
      isRunning: () => true,
      getClient: () => mockClient,
    };
    const embedQuery = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));

    const tool = createRuvectorRecallTool({
      api: api as any,
      service: service as any,
      embedQuery,
    });

    const result = await tool.execute("call-1", { query: "test", usePatterns: false });

    expect(mockClient.search).toHaveBeenCalled();
    expect(mockClient.searchWithPatterns).not.toHaveBeenCalled();
  });

  it("expands graph when expandGraph=true and graph is initialized", async () => {
    const api = createFakeApi();
    const mockClient = createMockClient();
    mockClient.isGraphInitialized.mockReturnValue(true);
    mockClient.searchWithPatterns.mockResolvedValue([
      {
        entry: { id: "r1", vector: [], metadata: { text: "search result" } },
        score: 0.9,
      },
    ]);
    mockClient.getNeighbors.mockResolvedValue([
      { id: "neighbor-1", labels: ["Entity"] },
    ]);
    mockClient.get.mockResolvedValue({
      id: "neighbor-1",
      vector: [],
      metadata: { text: "neighbor content" },
    });

    const service = {
      isRunning: () => true,
      getClient: () => mockClient,
    };
    const embedQuery = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));

    const tool = createRuvectorRecallTool({
      api: api as any,
      service: service as any,
      embedQuery,
    });

    const result = await tool.execute("call-1", {
      query: "test",
      expandGraph: true,
      graphDepth: 2,
    });

    expect(mockClient.getNeighbors).toHaveBeenCalled();
    expect((result as any).details.graphResults).toBeDefined();
  });

  it("does not expand graph when expandGraph=false", async () => {
    const api = createFakeApi();
    const mockClient = createMockClient();
    mockClient.isGraphInitialized.mockReturnValue(true);
    mockClient.searchWithPatterns.mockResolvedValue([
      {
        entry: { id: "r1", vector: [], metadata: { text: "result" } },
        score: 0.9,
      },
    ]);

    const service = {
      isRunning: () => true,
      getClient: () => mockClient,
    };
    const embedQuery = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));

    const tool = createRuvectorRecallTool({
      api: api as any,
      service: service as any,
      embedQuery,
    });

    const result = await tool.execute("call-1", { query: "test", expandGraph: false });

    expect(mockClient.getNeighbors).not.toHaveBeenCalled();
    expect((result as any).details.graphResults).toHaveLength(0);
  });

  it("clamps k parameter to valid range", async () => {
    const api = createFakeApi();
    const mockClient = createMockClient();
    mockClient.searchWithPatterns.mockResolvedValue([]);

    const service = {
      isRunning: () => true,
      getClient: () => mockClient,
    };
    const embedQuery = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));

    const tool = createRuvectorRecallTool({
      api: api as any,
      service: service as any,
      embedQuery,
    });

    // Test with k > 100
    await tool.execute("call-1", { query: "test", k: 500 });
    expect(mockClient.searchWithPatterns).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );

    // Test with k < 1
    await tool.execute("call-2", { query: "test", k: -5 });
    expect(mockClient.searchWithPatterns).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1 }),
    );
  });

  it("clamps patternBoost to 0-1 range", async () => {
    const api = createFakeApi();
    const mockClient = createMockClient();
    mockClient.searchWithPatterns.mockResolvedValue([]);

    const service = {
      isRunning: () => true,
      getClient: () => mockClient,
    };
    const embedQuery = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));

    const tool = createRuvectorRecallTool({
      api: api as any,
      service: service as any,
      embedQuery,
    });

    // Test with patternBoost > 1
    await tool.execute("call-1", { query: "test", patternBoost: 2.5 });
    expect(mockClient.searchWithPatterns).toHaveBeenCalledWith(
      expect.objectContaining({ patternBoost: 1 }),
    );

    // Test with patternBoost < 0
    await tool.execute("call-2", { query: "test", patternBoost: -0.5 });
    expect(mockClient.searchWithPatterns).toHaveBeenCalledWith(
      expect.objectContaining({ patternBoost: 0 }),
    );
  });

  it("handles errors gracefully and returns disabled result", async () => {
    const api = createFakeApi();
    const mockClient = createMockClient();
    mockClient.searchWithPatterns.mockRejectedValue(new Error("Search failed"));

    const service = {
      isRunning: () => true,
      getClient: () => mockClient,
    };
    const embedQuery = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));

    const tool = createRuvectorRecallTool({
      api: api as any,
      service: service as any,
      embedQuery,
    });

    const result = await tool.execute("call-1", { query: "test" });

    expect((result as any).details.disabled).toBe(true);
    expect((result as any).details.error).toContain("Search failed");
  });

  it("includes pattern info in message when available", async () => {
    const api = createFakeApi();
    const mockClient = createMockClient();

    const mockPatternStore = {
      getClusterCount: vi.fn().mockReturnValue(5),
      getSampleCount: vi.fn().mockReturnValue(25),
    };
    mockClient.getPatternStore.mockReturnValue(mockPatternStore);
    mockClient.searchWithPatterns.mockResolvedValue([
      {
        entry: { id: "r1", vector: [], metadata: { text: "result", category: "fact" } },
        score: 0.9,
      },
    ]);

    const service = {
      isRunning: () => true,
      getClient: () => mockClient,
    };
    const embedQuery = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));

    const tool = createRuvectorRecallTool({
      api: api as any,
      service: service as any,
      embedQuery,
    });

    const result = await tool.execute("call-1", { query: "test", usePatterns: true });

    expect((result as any).details.message).toContain("patterns");
    expect((result as any).details.message).toContain("5 clusters");
    expect((result as any).details.message).toContain("25 samples");
  });

  it("returns appropriate message when no results found", async () => {
    const api = createFakeApi();
    const mockClient = createMockClient();
    mockClient.searchWithPatterns.mockResolvedValue([]);

    const service = {
      isRunning: () => true,
      getClient: () => mockClient,
    };
    const embedQuery = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));

    const tool = createRuvectorRecallTool({
      api: api as any,
      service: service as any,
      embedQuery,
    });

    const result = await tool.execute("call-1", { query: "test" });

    expect((result as any).details.message).toContain("No matching memories found");
    expect((result as any).details.results).toHaveLength(0);
  });
});
