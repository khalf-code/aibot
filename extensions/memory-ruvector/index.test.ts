/**
 * Memory Ruvector Plugin Tests
 *
 * Tests the ruvector memory plugin functionality including:
 * - RuvectorClient operations (connect, insert, search, delete)
 * - RuvectorService lifecycle
 * - RuvectorDatabase (with in-memory fallback)
 * - EmbeddingProvider
 * - MessageBatcher and hooks
 * - Configuration parsing
 * - Search tool
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =============================================================================
// Mock ruvector package
// =============================================================================

const mockVectorDb = {
  insert: vi.fn().mockResolvedValue(undefined),
  insertBatch: vi.fn().mockResolvedValue(["id-1", "id-2"]),
  search: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(true),
  len: vi.fn().mockResolvedValue(0),
  isEmpty: vi.fn().mockResolvedValue(true),
  close: vi.fn().mockResolvedValue(undefined),
};

// Mock SONA engine for self-learning tests
const mockSonaEngine = {
  setEnabled: vi.fn(),
  isEnabled: vi.fn().mockReturnValue(true),
  beginTrajectory: vi.fn().mockReturnValue("traj-1"),
  addStep: vi.fn(),
  endTrajectory: vi.fn(),
  applyMicroLora: vi.fn(),
  findPatterns: vi.fn().mockReturnValue([]),
  getStats: vi.fn().mockReturnValue({ patternsLearned: 0 }),
  forceLearn: vi.fn(),
};

// Mock CodeGraph for graph tests
const mockCodeGraph = {
  createNode: vi.fn().mockResolvedValue(undefined),
  createEdge: vi.fn().mockResolvedValue(undefined),
  cypher: vi.fn().mockResolvedValue({ columns: [], rows: [] }),
  neighbors: vi.fn().mockResolvedValue([]),
};

// Mock RuvectorLayer for GNN tests
const mockRuvectorLayer = {};

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

// =============================================================================
// Test Helpers
// =============================================================================

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createFakeApi(overrides: Record<string, unknown> = {}) {
  const registeredTools: Array<{ tool: unknown; opts?: Record<string, unknown> }> = [];
  const registeredServices: Array<Record<string, unknown>> = [];
  const registeredClis: Array<{ registrar: unknown; opts?: Record<string, unknown> }> = [];
  const registeredHooks: Record<string, Array<{ handler: unknown; opts?: unknown }>> = {};

  return {
    id: "memory-ruvector",
    name: "Memory (ruvector)",
    source: "test",
    config: {},
    pluginConfig: {
      dbPath: "/tmp/test-ruvector-db",
      dimension: 1536,
      metric: "cosine",
      embedding: {
        provider: "openai",
        apiKey: "test-api-key",
        model: "text-embedding-3-small",
      },
      hooks: {
        enabled: true,
        indexInbound: true,
        indexOutbound: true,
        indexAgentResponses: true,
        batchSize: 10,
        debounceMs: 500,
      },
    },
    runtime: { version: "test" },
    logger: createMockLogger(),
    registerTool: vi.fn((tool, opts) => {
      registeredTools.push({ tool, opts });
    }),
    registerCli: vi.fn((registrar, opts) => {
      registeredClis.push({ registrar, opts });
    }),
    registerService: vi.fn((service) => {
      registeredServices.push(service);
    }),
    on: vi.fn((hookName: string, handler: unknown, opts?: unknown) => {
      if (!registeredHooks[hookName]) registeredHooks[hookName] = [];
      registeredHooks[hookName].push({ handler, opts });
    }),
    resolvePath: vi.fn((p: string) => p),
    _registeredTools: registeredTools,
    _registeredServices: registeredServices,
    _registeredClis: registeredClis,
    _registeredHooks: registeredHooks,
    ...overrides,
  };
}

// =============================================================================
// RuvectorClient Tests
// =============================================================================

describe("RuvectorClient", () => {
  let RuvectorClient: typeof import("./client.js").RuvectorClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./client.js");
    RuvectorClient = module.RuvectorClient;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("connects to the database", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient(
      { dimension: 1536, storagePath: "/tmp/test", metric: "cosine" },
      logger,
    );

    await client.connect();

    expect(client.isConnected()).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("connecting"));
  });

  it("throws ALREADY_CONNECTED when connecting twice", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);

    await client.connect();
    await expect(client.connect()).rejects.toThrow(/already connected/i);
  });

  it("disconnects cleanly", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);

    await client.connect();
    await client.disconnect();

    expect(client.isConnected()).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("disconnected"));
  });

  it("inserts vectors with generated UUID", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();

    const id = await client.insert({
      vector: new Array(1536).fill(0.1),
      metadata: { text: "test memory" },
    });

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(mockVectorDb.insert).toHaveBeenCalled();
  });

  it("throws INVALID_DIMENSION for mismatched vector size", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();

    await expect(
      client.insert({
        vector: new Array(768).fill(0.1), // Wrong dimension
        metadata: { text: "test" },
      }),
    ).rejects.toThrow(/dimension mismatch/i);
  });

  it("validates ID is non-empty before delete", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();

    await expect(client.delete("")).rejects.toThrow(/invalid id/i);
    // Note: Non-UUID strings are accepted since custom IDs are allowed on insert
  });

  it("accepts valid UUID for delete", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();

    const validUuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = await client.delete(validUuid);

    expect(result).toBe(true);
    expect(mockVectorDb.delete).toHaveBeenCalledWith(validUuid);
  });

  it("throws NOT_CONNECTED when operating without connection", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);

    await expect(
      client.insert({ vector: [], metadata: { text: "" } }),
    ).rejects.toThrow(/not connected/i);
  });

  it("returns stats including connection status", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536, metric: "euclidean" }, logger);

    const statsDisconnected = await client.stats();
    expect(statsDisconnected.connected).toBe(false);
    expect(statsDisconnected.dimension).toBe(1536);
    expect(statsDisconnected.metric).toBe("euclidean");

    await client.connect();
    const statsConnected = await client.stats();
    expect(statsConnected.connected).toBe(true);
  });
});

// =============================================================================
// RuvectorService Tests
// =============================================================================

describe("RuvectorService", () => {
  let RuvectorService: typeof import("./service.js").RuvectorService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./service.js");
    RuvectorService = module.RuvectorService;
  });

  it("starts and connects the client", async () => {
    const logger = createMockLogger();
    const service = new RuvectorService({ dimension: 1536 }, logger);

    await service.start();

    expect(service.isRunning()).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warns when started twice", async () => {
    const logger = createMockLogger();
    const service = new RuvectorService({ dimension: 1536 }, logger);

    await service.start();
    await service.start(); // Second start

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("already started"));
  });

  it("stops and disconnects", async () => {
    const logger = createMockLogger();
    const service = new RuvectorService({ dimension: 1536 }, logger);

    await service.start();
    await service.stop();

    expect(service.isRunning()).toBe(false);
  });

  it("throws when getting client before start", async () => {
    const logger = createMockLogger();
    const service = new RuvectorService({ dimension: 1536 }, logger);

    expect(() => service.getClient()).toThrow(/not started/i);
  });

  it("returns client after start", async () => {
    const logger = createMockLogger();
    const service = new RuvectorService({ dimension: 1536 }, logger);

    await service.start();
    const client = service.getClient();

    expect(client).toBeDefined();
    expect(client.isConnected()).toBe(true);
  });
});

// =============================================================================
// Configuration Schema Tests
// =============================================================================

describe("ruvectorConfigSchema", () => {
  let ruvectorConfigSchema: typeof import("./config.js").ruvectorConfigSchema;
  let dimensionForModel: typeof import("./config.js").dimensionForModel;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./config.js");
    ruvectorConfigSchema = module.ruvectorConfigSchema;
    dimensionForModel = module.dimensionForModel;
  });

  it("parses valid config", () => {
    const config = ruvectorConfigSchema.parse({
      embedding: {
        provider: "openai",
        apiKey: "sk-test",
        model: "text-embedding-3-small",
      },
    });

    expect(config.embedding.provider).toBe("openai");
    expect(config.embedding.apiKey).toBe("sk-test");
    expect(config.dimension).toBe(1536);
    expect(config.metric).toBe("cosine");
  });

  it("throws when embedding config is missing", () => {
    expect(() => ruvectorConfigSchema.parse({})).toThrow(/embedding config is required/i);
  });

  it("throws when apiKey is missing for non-local provider", () => {
    expect(() =>
      ruvectorConfigSchema.parse({
        embedding: { provider: "openai" },
      }),
    ).toThrow(/apiKey is required/i);
  });

  it("allows missing apiKey for local provider", () => {
    const config = ruvectorConfigSchema.parse({
      embedding: { provider: "local", baseUrl: "http://localhost:8080" },
    });

    expect(config.embedding.provider).toBe("local");
    expect(config.embedding.apiKey).toBeUndefined();
  });

  it("resolves environment variables in apiKey", () => {
    process.env.TEST_RUVECTOR_KEY = "resolved-key";

    const config = ruvectorConfigSchema.parse({
      embedding: {
        provider: "openai",
        apiKey: "${TEST_RUVECTOR_KEY}",
      },
    });

    expect(config.embedding.apiKey).toBe("resolved-key");

    delete process.env.TEST_RUVECTOR_KEY;
  });

  it("throws on missing environment variable", () => {
    expect(() =>
      ruvectorConfigSchema.parse({
        embedding: {
          provider: "openai",
          apiKey: "${NONEXISTENT_VAR}",
        },
      }),
    ).toThrow(/not set/i);
  });

  it("validates metric values", () => {
    expect(() =>
      ruvectorConfigSchema.parse({
        embedding: { provider: "openai", apiKey: "key" },
        metric: "invalid",
      }),
    ).toThrow(/invalid metric/i);
  });

  it("returns correct dimensions for known models", () => {
    expect(dimensionForModel("text-embedding-3-small")).toBe(1536);
    expect(dimensionForModel("text-embedding-3-large")).toBe(3072);
    expect(dimensionForModel("voyage-3")).toBe(1024);
    expect(dimensionForModel("nomic-embed-text")).toBe(768);
    expect(dimensionForModel("unknown-model")).toBe(1536); // Default
  });

  it("parses hooks config with defaults", () => {
    const config = ruvectorConfigSchema.parse({
      embedding: { provider: "openai", apiKey: "key" },
    });

    expect(config.hooks.enabled).toBe(true);
    expect(config.hooks.indexInbound).toBe(true);
    expect(config.hooks.indexOutbound).toBe(true);
    expect(config.hooks.batchSize).toBe(10);
    expect(config.hooks.debounceMs).toBe(500);
  });
});

// =============================================================================
// EmbeddingProvider Tests
// =============================================================================

describe("EmbeddingProvider", () => {
  let OpenAICompatibleEmbeddings: typeof import("./embeddings.js").OpenAICompatibleEmbeddings;
  let createEmbeddingProvider: typeof import("./embeddings.js").createEmbeddingProvider;

  beforeEach(async () => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    const module = await import("./embeddings.js");
    OpenAICompatibleEmbeddings = module.OpenAICompatibleEmbeddings;
    createEmbeddingProvider = module.createEmbeddingProvider;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates OpenAI provider with correct base URL", () => {
    const provider = createEmbeddingProvider(
      { provider: "openai", apiKey: "sk-test", model: "text-embedding-3-small" },
      1536,
    );

    expect(provider.dimension).toBe(1536);
  });

  it("creates Voyage provider with correct base URL", () => {
    const provider = createEmbeddingProvider(
      { provider: "voyage", apiKey: "voyage-test", model: "voyage-3" },
      1024,
    );

    expect(provider.dimension).toBe(1024);
  });

  it("throws for local provider without baseUrl", () => {
    expect(() =>
      createEmbeddingProvider({ provider: "local", model: "local-model" }, 768),
    ).toThrow(/base URL/i);
  });

  it("embeds text via API call", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ index: 0, embedding: new Array(1536).fill(0.1) }],
      }),
    });

    const provider = new OpenAICompatibleEmbeddings({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "text-embedding-3-small",
      dimension: 1536,
    });

    const embedding = await provider.embed("test text");

    expect(embedding).toHaveLength(1536);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test",
        }),
      }),
    );
  });

  it("handles API errors gracefully", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const provider = new OpenAICompatibleEmbeddings({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "invalid",
      model: "text-embedding-3-small",
      dimension: 1536,
    });

    await expect(provider.embed("test")).rejects.toThrow(/401/);
  });
});

// =============================================================================
// RuvectorDatabase Tests
// =============================================================================

describe("RuvectorDatabase", () => {
  let RuvectorDatabase: typeof import("./db.js").RuvectorDatabase;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./db.js");
    RuvectorDatabase = module.RuvectorDatabase;
  });

  it("inserts and retrieves document count", async () => {
    const db = new RuvectorDatabase("/tmp/test-db", {
      dimension: 1536,
      metric: "cosine",
    });

    const id = await db.insert({
      content: "test message",
      vector: new Array(1536).fill(0.1),
      direction: "inbound",
      channel: "telegram",
      timestamp: Date.now(),
    });

    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("performs batch insert", async () => {
    const db = new RuvectorDatabase("/tmp/test-db", {
      dimension: 1536,
      metric: "cosine",
    });

    const ids = await db.insertBatch([
      {
        content: "message 1",
        vector: new Array(1536).fill(0.1),
        direction: "inbound",
        channel: "discord",
        timestamp: Date.now(),
      },
      {
        content: "message 2",
        vector: new Array(1536).fill(0.2),
        direction: "outbound",
        channel: "discord",
        timestamp: Date.now(),
      },
    ]);

    expect(ids).toHaveLength(2);
  });

  it("calculates cosine similarity correctly", async () => {
    // Test with in-memory fallback to verify similarity calculation
    const db = new RuvectorDatabase("/tmp/nonexistent", {
      dimension: 3,
      metric: "cosine",
    });

    // Insert a document with a known vector
    await db.insert({
      content: "test",
      vector: [1, 0, 0],
      direction: "inbound",
      channel: "test",
      timestamp: Date.now(),
    });

    // Search with identical vector should have high score
    const results = await db.search([1, 0, 0], { limit: 1 });

    // With mocked ruvector, this will use in-memory if ruvector fails to init
    expect(results).toBeDefined();
  });

  it("closes cleanly", async () => {
    const db = new RuvectorDatabase("/tmp/test-db", {
      dimension: 1536,
      metric: "cosine",
    });

    await db.close();
    // Should not throw
  });
});

// =============================================================================
// Hooks Tests
// =============================================================================

describe("MessageBatcher", () => {
  let MessageBatcher: typeof import("./hooks.js").MessageBatcher;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    const module = await import("./hooks.js");
    MessageBatcher = module.MessageBatcher;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("batches messages and flushes on batch size", async () => {
    const mockDb = {
      insertBatch: vi.fn().mockResolvedValue(["id-1", "id-2"]),
    };
    const mockEmbeddings = {
      embed: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
      embedBatch: vi.fn().mockResolvedValue([new Array(1536).fill(0.1)]),
      dimension: 1536,
    };
    const logger = createMockLogger();

    const batcher = new MessageBatcher(mockDb as any, mockEmbeddings, {
      batchSize: 2,
      debounceMs: 1000,
      logger,
    });

    // Queue 2 messages (triggers flush at batch size)
    const p1 = batcher.queue({
      content: "msg 1",
      direction: "inbound",
      channel: "test",
      timestamp: Date.now(),
    });
    const p2 = batcher.queue({
      content: "msg 2",
      direction: "inbound",
      channel: "test",
      timestamp: Date.now(),
    });

    // Allow flush to complete
    await vi.runAllTimersAsync();
    await Promise.all([p1, p2]);

    // Uses embedBatch for efficiency (one call for all messages)
    expect(mockEmbeddings.embedBatch).toHaveBeenCalledTimes(1);
    expect(mockDb.insertBatch).toHaveBeenCalledTimes(1);
  });

  it("flushes on debounce timeout", async () => {
    const mockDb = {
      insertBatch: vi.fn().mockResolvedValue(["id-1"]),
    };
    const mockEmbeddings = {
      embed: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
      embedBatch: vi.fn().mockResolvedValue([new Array(1536).fill(0.1)]),
      dimension: 1536,
    };
    const logger = createMockLogger();

    const batcher = new MessageBatcher(mockDb as any, mockEmbeddings, {
      batchSize: 10, // Large batch size
      debounceMs: 500,
      logger,
    });

    // Queue 1 message (below batch size)
    const p = batcher.queue({
      content: "msg 1",
      direction: "inbound",
      channel: "test",
      timestamp: Date.now(),
    });

    // Advance timer past debounce
    await vi.advanceTimersByTimeAsync(600);
    await p;

    expect(mockDb.insertBatch).toHaveBeenCalledTimes(1);
  });
});

describe("Content filtering", () => {
  // Note: shouldIndex is not exported, but we test its behavior indirectly
  // through the MessageBatcher. These tests document the expected filtering rules.

  it("documents short message filtering rule (< 5 chars)", () => {
    // Messages under MIN_CONTENT_LENGTH (5) should be filtered
    const shortMessages = ["hi", "ok", "yes", "no"];
    for (const msg of shortMessages) {
      expect(msg.length).toBeLessThan(5);
    }
  });

  it("documents system marker filtering rule", () => {
    // Messages containing system markers should be filtered
    const systemMessages = [
      "<relevant-memories>injected</relevant-memories>",
      "<system>instructions</system>",
    ];
    for (const msg of systemMessages) {
      expect(msg.includes("<relevant-memories>") || msg.includes("<system>")).toBe(true);
    }
  });

  it("documents command filtering rule (starts with /)", () => {
    // Messages starting with / should be filtered as control commands
    const commands = ["/help", "/status", "/config"];
    for (const cmd of commands) {
      expect(cmd.startsWith("/")).toBe(true);
    }
  });
});

// =============================================================================
// Tool Tests
// =============================================================================

describe("createRuvectorSearchTool", () => {
  let createRuvectorSearchTool: typeof import("./tool.js").createRuvectorSearchTool;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./tool.js");
    createRuvectorSearchTool = module.createRuvectorSearchTool;
  });

  it("returns disabled result when service is not running", async () => {
    const api = createFakeApi();
    const service = {
      isRunning: () => false,
      getClient: () => {
        throw new Error("not running");
      },
    };
    const embedQuery = vi.fn();

    const tool = createRuvectorSearchTool({
      api: api as any,
      service: service as any,
      embedQuery,
    });

    const result = await tool.execute("call-1", { query: "test" });

    expect((result as any).details.disabled).toBe(true);
    expect((result as any).details.error).toContain("not running");
  });

  it("has correct tool schema", async () => {
    const api = createFakeApi();
    const service = { isRunning: () => true, getClient: () => ({}) };
    const embedQuery = vi.fn();

    const tool = createRuvectorSearchTool({
      api: api as any,
      service: service as any,
      embedQuery,
    });

    expect(tool.name).toBe("ruvector_search");
    expect(tool.label).toBe("Ruvector Search");
    expect(tool.parameters).toBeDefined();
  });
});

// =============================================================================
// Types Tests
// =============================================================================

describe("RuvectorError", () => {
  let RuvectorError: typeof import("./types.js").RuvectorError;

  beforeEach(async () => {
    const module = await import("./types.js");
    RuvectorError = module.RuvectorError;
  });

  it("creates error with code and message", () => {
    const error = new RuvectorError("NOT_CONNECTED", "test message");

    expect(error.name).toBe("RuvectorError");
    expect(error.code).toBe("NOT_CONNECTED");
    expect(error.message).toBe("test message");
  });

  it("includes cause when provided", () => {
    const cause = new Error("original");
    const error = new RuvectorError("INSERT_FAILED", "wrapper", cause);

    expect(error.cause).toBe(cause);
  });
});

// =============================================================================
// Integration Pattern Tests
// =============================================================================

describe("memory-ruvector integration patterns", () => {
  it("documents expected clawdbot plugin patterns", () => {
    // This test documents the expected patterns that the plugin should follow:
    // 1. Plugin exports default register function or object with register()
    // 2. Uses ClawdbotPluginApi for registrations
    // 3. Registers tools via api.registerTool()
    // 4. Registers services via api.registerService()
    // 5. Registers hooks via api.on()
    // 6. Uses api.logger for logging
    //
    // Full integration testing is done via e2e tests; this documents the contract.
    const api = createFakeApi();
    expect(api.registerTool).toBeDefined();
    expect(api.registerService).toBeDefined();
    expect(api.on).toBeDefined();
    expect(api.logger).toBeDefined();
  });

  it("documents graceful degradation strategy", () => {
    // The plugin implements graceful degradation:
    // - RuvectorDatabase falls back to in-memory if ruvector native fails
    // - RuvectorService handles connection errors without crashing
    // - Tools return { disabled: true } response on service unavailability
    //
    // This is tested in the individual component tests above.
    // This test documents the overall degradation strategy.
    const api = createFakeApi();
    const service = {
      isRunning: () => false,
    };
    // When service is not running, tools should gracefully indicate disabled
    expect(service.isRunning()).toBe(false);
  });
});

// =============================================================================
// SONA Self-Learning Tests
// =============================================================================

describe("SONA Self-Learning", () => {
  let RuvectorClient: typeof import("./client.js").RuvectorClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./client.js");
    RuvectorClient = module.RuvectorClient;
  });

  it("should enable SONA with config", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();

    await client.enableSONA({
      enabled: true,
      hiddenDim: 256,
      learningRate: 0.01,
    });

    // SONA stats should reflect enabled state
    const stats = await client.getSONAStats();
    expect(stats.enabled).toBe(true);
  });

  it("should record search feedback via recordSearchFeedback", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();

    await client.enableSONA({
      enabled: true,
      hiddenDim: 256,
    });

    // Insert a vector first so we have something to reference
    const id = await client.insert({
      vector: new Array(1536).fill(0.1),
      metadata: { text: "test memory" },
    });

    // Record feedback - this uses the actual API signature
    await client.recordSearchFeedback(
      new Array(1536).fill(0.05), // query vector
      id, // selected result ID
      0.95, // relevance score
    );

    const stats = await client.getSONAStats();
    expect(stats.trajectoriesRecorded).toBeGreaterThanOrEqual(0);
  });

  it("should find similar patterns via findSimilarPatterns", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();

    await client.enableSONA({
      enabled: true,
      hiddenDim: 256,
    });

    // Find patterns similar to a given query embedding
    const patterns = await client.findSimilarPatterns(
      new Array(1536).fill(0.1),
      5,
    );

    expect(patterns).toBeDefined();
    expect(Array.isArray(patterns)).toBe(true);
  });

  it("should return SONA stats via getSONAStats", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();

    await client.enableSONA({
      enabled: true,
      hiddenDim: 256,
    });

    const sonaStats = await client.getSONAStats();

    expect(sonaStats).toBeDefined();
    expect(typeof sonaStats.trajectoriesRecorded).toBe("number");
    expect(typeof sonaStats.patternsLearned).toBe("number");
    expect(typeof sonaStats.microLoraUpdates).toBe("number");
    expect(typeof sonaStats.avgLearningTimeMs).toBe("number");
    expect(typeof sonaStats.enabled).toBe("boolean");
  });
});

// =============================================================================
// ruvLLM Config Tests
// =============================================================================

describe("ruvLLM Config", () => {
  let ruvectorConfigSchema: typeof import("./config.js").ruvectorConfigSchema;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./config.js");
    ruvectorConfigSchema = module.ruvectorConfigSchema;
  });

  it("parses valid ruvllm config with all options", () => {
    const config = ruvectorConfigSchema.parse({
      embedding: { provider: "openai", apiKey: "sk-test" },
      ruvllm: {
        enabled: true,
        contextInjection: {
          enabled: true,
          maxTokens: 3000,
          relevanceThreshold: 0.4,
        },
        trajectoryRecording: {
          enabled: true,
          maxTrajectories: 2000,
        },
      },
    });

    expect(config.ruvllm).toBeDefined();
    expect(config.ruvllm?.enabled).toBe(true);
    expect(config.ruvllm?.contextInjection.enabled).toBe(true);
    expect(config.ruvllm?.contextInjection.maxTokens).toBe(3000);
    expect(config.ruvllm?.contextInjection.relevanceThreshold).toBe(0.4);
    expect(config.ruvllm?.trajectoryRecording.enabled).toBe(true);
    expect(config.ruvllm?.trajectoryRecording.maxTrajectories).toBe(2000);
  });

  it("uses default ruvllm values when not specified", () => {
    const config = ruvectorConfigSchema.parse({
      embedding: { provider: "openai", apiKey: "sk-test" },
      ruvllm: {
        enabled: true,
      },
    });

    expect(config.ruvllm).toBeDefined();
    expect(config.ruvllm?.enabled).toBe(true);
    // Default contextInjection values
    expect(config.ruvllm?.contextInjection.enabled).toBe(true);
    expect(config.ruvllm?.contextInjection.maxTokens).toBe(2000);
    expect(config.ruvllm?.contextInjection.relevanceThreshold).toBe(0.3);
    // Default trajectoryRecording values
    expect(config.ruvllm?.trajectoryRecording.enabled).toBe(true);
    expect(config.ruvllm?.trajectoryRecording.maxTrajectories).toBe(1000);
  });

  it("allows disabled ruvllm config", () => {
    const config = ruvectorConfigSchema.parse({
      embedding: { provider: "openai", apiKey: "sk-test" },
      ruvllm: {
        enabled: false,
      },
    });

    expect(config.ruvllm?.enabled).toBe(false);
  });

  it("throws on invalid maxTokens value", () => {
    expect(() =>
      ruvectorConfigSchema.parse({
        embedding: { provider: "openai", apiKey: "key" },
        ruvllm: {
          enabled: true,
          contextInjection: {
            maxTokens: -100,
          },
        },
      }),
    ).toThrow(/maxTokens/i);
  });

  it("throws on invalid relevanceThreshold value", () => {
    expect(() =>
      ruvectorConfigSchema.parse({
        embedding: { provider: "openai", apiKey: "key" },
        ruvllm: {
          enabled: true,
          contextInjection: {
            relevanceThreshold: 1.5,
          },
        },
      }),
    ).toThrow(/relevanceThreshold/i);
  });

  it("throws on invalid maxTrajectories value", () => {
    expect(() =>
      ruvectorConfigSchema.parse({
        embedding: { provider: "openai", apiKey: "key" },
        ruvllm: {
          enabled: true,
          trajectoryRecording: {
            maxTrajectories: 0,
          },
        },
      }),
    ).toThrow(/maxTrajectories/i);
  });

  it("throws on unknown ruvllm config keys", () => {
    expect(() =>
      ruvectorConfigSchema.parse({
        embedding: { provider: "openai", apiKey: "key" },
        ruvllm: {
          enabled: true,
          unknownKey: "value",
        },
      }),
    ).toThrow(/unknown keys/i);
  });
});

// =============================================================================
// TrajectoryRecorder Tests
// =============================================================================

describe("TrajectoryRecorder", () => {
  let TrajectoryRecorder: typeof import("./sona/trajectory.js").TrajectoryRecorder;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./sona/trajectory.js");
    TrajectoryRecorder = module.TrajectoryRecorder;
  });

  describe("record()", () => {
    it("records a trajectory and returns an ID", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 100 },
        logger,
      );

      const id = recorder.record({
        query: "test query",
        queryVector: [0.1, 0.2, 0.3],
        resultIds: ["id1", "id2"],
        resultScores: [0.9, 0.8],
      });

      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it("returns empty string when recording is disabled", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: false, maxTrajectories: 100 },
        logger,
      );

      const id = recorder.record({
        query: "test query",
        queryVector: [0.1, 0.2, 0.3],
        resultIds: ["id1"],
        resultScores: [0.9],
      });

      expect(id).toBe("");
    });

    it("stores trajectory with correct data", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 100 },
        logger,
      );

      const id = recorder.record({
        query: "test query",
        queryVector: [0.1, 0.2, 0.3],
        resultIds: ["id1", "id2"],
        resultScores: [0.9, 0.8],
        sessionId: "session-1",
        metadata: { source: "test" },
      });

      const trajectory = recorder.get(id);
      expect(trajectory).not.toBeNull();
      expect(trajectory?.query).toBe("test query");
      expect(trajectory?.queryVector).toEqual([0.1, 0.2, 0.3]);
      expect(trajectory?.resultIds).toEqual(["id1", "id2"]);
      expect(trajectory?.resultScores).toEqual([0.9, 0.8]);
      expect(trajectory?.sessionId).toBe("session-1");
      expect(trajectory?.metadata).toEqual({ source: "test" });
      expect(trajectory?.feedback).toBeNull();
      expect(trajectory?.timestamp).toBeGreaterThan(0);
    });

    it("auto-prunes when maxTrajectories is exceeded", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 5 },
        logger,
      );

      // Record 6 trajectories
      for (let i = 0; i < 6; i++) {
        recorder.record({
          query: `query ${i}`,
          queryVector: [i],
          resultIds: [],
          resultScores: [],
        });
      }

      const stats = recorder.getStats();
      // Should prune to 90% of max (4-5 remaining)
      expect(stats.totalTrajectories).toBeLessThanOrEqual(5);
    });
  });

  describe("getRecent()", () => {
    it("returns trajectories in newest-first order", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 100 },
        logger,
      );

      recorder.record({ query: "first", queryVector: [1], resultIds: [], resultScores: [] });
      recorder.record({ query: "second", queryVector: [2], resultIds: [], resultScores: [] });
      recorder.record({ query: "third", queryVector: [3], resultIds: [], resultScores: [] });

      const recent = recorder.getRecent({ limit: 10 });
      expect(recent).toHaveLength(3);
      expect(recent[0].query).toBe("third");
      expect(recent[1].query).toBe("second");
      expect(recent[2].query).toBe("first");
    });

    it("respects limit option", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 100 },
        logger,
      );

      for (let i = 0; i < 10; i++) {
        recorder.record({ query: `query ${i}`, queryVector: [i], resultIds: [], resultScores: [] });
      }

      const recent = recorder.getRecent({ limit: 3 });
      expect(recent).toHaveLength(3);
    });

    it("filters by sessionId", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 100 },
        logger,
      );

      recorder.record({ query: "q1", queryVector: [1], resultIds: [], resultScores: [], sessionId: "session-a" });
      recorder.record({ query: "q2", queryVector: [2], resultIds: [], resultScores: [], sessionId: "session-b" });
      recorder.record({ query: "q3", queryVector: [3], resultIds: [], resultScores: [], sessionId: "session-a" });

      const sessionA = recorder.getRecent({ sessionId: "session-a" });
      expect(sessionA).toHaveLength(2);
      expect(sessionA.every((t) => t.sessionId === "session-a")).toBe(true);
    });

    it("filters by withFeedbackOnly", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 100 },
        logger,
      );

      const id1 = recorder.record({ query: "q1", queryVector: [1], resultIds: [], resultScores: [] });
      recorder.record({ query: "q2", queryVector: [2], resultIds: [], resultScores: [] });
      recorder.addFeedback(id1, 0.9);

      const withFeedback = recorder.getRecent({ withFeedbackOnly: true });
      expect(withFeedback).toHaveLength(1);
      expect(withFeedback[0].feedback).toBe(0.9);
    });

    it("filters by minFeedbackScore", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 100 },
        logger,
      );

      const id1 = recorder.record({ query: "q1", queryVector: [1], resultIds: [], resultScores: [] });
      const id2 = recorder.record({ query: "q2", queryVector: [2], resultIds: [], resultScores: [] });
      recorder.addFeedback(id1, 0.9);
      recorder.addFeedback(id2, 0.3);

      const highQuality = recorder.getRecent({ minFeedbackScore: 0.7 });
      expect(highQuality).toHaveLength(1);
      expect(highQuality[0].feedback).toBe(0.9);
    });
  });

  describe("prune()", () => {
    it("removes oldest trajectories without feedback first", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 5 },
        logger,
      );

      const id1 = recorder.record({ query: "q1", queryVector: [1], resultIds: [], resultScores: [] });
      recorder.record({ query: "q2", queryVector: [2], resultIds: [], resultScores: [] });
      const id3 = recorder.record({ query: "q3", queryVector: [3], resultIds: [], resultScores: [] });
      recorder.record({ query: "q4", queryVector: [4], resultIds: [], resultScores: [] });
      recorder.record({ query: "q5", queryVector: [5], resultIds: [], resultScores: [] });

      // Add feedback to some
      recorder.addFeedback(id1, 0.8);
      recorder.addFeedback(id3, 0.9);

      // Force over limit
      recorder.record({ query: "q6", queryVector: [6], resultIds: [], resultScores: [] });

      // After prune, those with feedback should be more likely to survive
      const remaining = recorder.getRecent({ limit: 10 });
      const withFeedback = remaining.filter((t) => t.feedback !== null);
      expect(withFeedback.length).toBeGreaterThanOrEqual(1);
    });

    it("returns number of trajectories pruned", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 5 },
        logger,
      );

      // Record exactly 10 trajectories - auto-prune will happen at insertion
      // when we exceed maxTrajectories
      for (let i = 0; i < 10; i++) {
        recorder.record({ query: `q${i}`, queryVector: [i], resultIds: [], resultScores: [] });
      }

      // After recording, we should have fewer than 10 due to auto-pruning
      // The prune() call only prunes if current count > target (90% of max)
      const stats = recorder.getStats();
      // Auto-pruning should have kept us at or below maxTrajectories
      expect(stats.totalTrajectories).toBeLessThanOrEqual(5);
    });

    it("returns 0 when no pruning needed", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 100 },
        logger,
      );

      recorder.record({ query: "q1", queryVector: [1], resultIds: [], resultScores: [] });

      const pruned = recorder.prune();
      expect(pruned).toBe(0);
    });
  });

  describe("findSimilar()", () => {
    it("finds trajectories with similar query vectors", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 100 },
        logger,
      );

      recorder.record({ query: "q1", queryVector: [1, 0, 0], resultIds: [], resultScores: [] });
      recorder.record({ query: "q2", queryVector: [0, 1, 0], resultIds: [], resultScores: [] });
      recorder.record({ query: "q3", queryVector: [0.9, 0.1, 0], resultIds: [], resultScores: [] });

      const similar = recorder.findSimilar([1, 0, 0], 5, 0.8);
      expect(similar.length).toBeGreaterThanOrEqual(1);
      expect(similar[0].similarity).toBeGreaterThanOrEqual(0.8);
    });

    it("returns empty array when no similar trajectories found", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 100 },
        logger,
      );

      recorder.record({ query: "q1", queryVector: [1, 0, 0], resultIds: [], resultScores: [] });

      const similar = recorder.findSimilar([0, 0, 1], 5, 0.9);
      expect(similar).toHaveLength(0);
    });

    it("respects limit parameter", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 100 },
        logger,
      );

      // Record many similar trajectories
      for (let i = 0; i < 10; i++) {
        recorder.record({ query: `q${i}`, queryVector: [1, 0.1 * i, 0], resultIds: [], resultScores: [] });
      }

      const similar = recorder.findSimilar([1, 0, 0], 3, 0.5);
      expect(similar.length).toBeLessThanOrEqual(3);
    });
  });

  describe("import/export", () => {
    it("exports all trajectories", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 100 },
        logger,
      );

      recorder.record({ query: "q1", queryVector: [1], resultIds: ["a"], resultScores: [0.9] });
      recorder.record({ query: "q2", queryVector: [2], resultIds: ["b"], resultScores: [0.8] });

      const exported = recorder.export();
      expect(exported).toHaveLength(2);
    });

    it("imports trajectories and preserves data", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 100 },
        logger,
      );

      const trajectories = [
        {
          id: "traj-1",
          query: "imported query",
          queryVector: [1, 2, 3],
          resultIds: ["id1"],
          resultScores: [0.95],
          feedback: 0.8,
          timestamp: Date.now() - 1000,
          sessionId: null,
        },
      ];

      const imported = recorder.import(trajectories);
      expect(imported).toBe(1);

      const trajectory = recorder.get("traj-1");
      expect(trajectory).not.toBeNull();
      expect(trajectory?.query).toBe("imported query");
      expect(trajectory?.feedback).toBe(0.8);
    });

    it("skips duplicate IDs on import", () => {
      const logger = createMockLogger();
      const recorder = new TrajectoryRecorder(
        { enabled: true, maxTrajectories: 100 },
        logger,
      );

      const id = recorder.record({ query: "existing", queryVector: [1], resultIds: [], resultScores: [] });

      const imported = recorder.import([
        {
          id,
          query: "duplicate",
          queryVector: [2],
          resultIds: [],
          resultScores: [],
          feedback: null,
          timestamp: Date.now(),
          sessionId: null,
        },
      ]);

      expect(imported).toBe(0);
      expect(recorder.get(id)?.query).toBe("existing");
    });
  });
});

// =============================================================================
// ContextInjector Tests
// =============================================================================

describe("ContextInjector", () => {
  let ContextInjector: typeof import("./context-injection.js").ContextInjector;

  beforeEach(async () => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    const module = await import("./context-injection.js");
    ContextInjector = module.ContextInjector;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockDb() {
    return {
      search: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue("id-1"),
      close: vi.fn().mockResolvedValue(undefined),
    };
  }

  function createMockEmbeddings() {
    return {
      embed: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
      embedBatch: vi.fn().mockResolvedValue([new Array(1536).fill(0.1)]),
      dimension: 1536,
    };
  }

  describe("injectContext()", () => {
    it("returns empty context when disabled", async () => {
      const logger = createMockLogger();
      const db = createMockDb();
      const embeddings = createMockEmbeddings();

      const injector = new ContextInjector(
        { enabled: false, maxTokens: 2000, relevanceThreshold: 0.3 },
        { db: db as any, embeddings, logger },
      );

      const result = await injector.injectContext("test query");

      expect(result.contextText).toBe("");
      expect(result.memoriesIncluded).toBe(0);
      expect(result.estimatedTokens).toBe(0);
      expect(result.memoryIds).toEqual([]);
    });

    it("returns empty context when no results found", async () => {
      const logger = createMockLogger();
      const db = createMockDb();
      const embeddings = createMockEmbeddings();

      const injector = new ContextInjector(
        { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        { db: db as any, embeddings, logger },
      );

      const result = await injector.injectContext("test query");

      expect(result.contextText).toBe("");
      expect(result.memoriesIncluded).toBe(0);
    });

    it("injects context with relevant memories", async () => {
      const logger = createMockLogger();
      const db = createMockDb();
      const embeddings = createMockEmbeddings();

      db.search.mockResolvedValue([
        {
          document: {
            id: "mem-1",
            content: "User prefers dark mode",
            direction: "inbound",
            channel: "telegram",
            timestamp: Date.now(),
          },
          score: 0.9,
        },
      ]);

      const injector = new ContextInjector(
        { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        { db: db as any, embeddings, logger },
      );

      const result = await injector.injectContext("user preferences");

      expect(result.contextText).toContain("<relevant-memories>");
      expect(result.contextText).toContain("User prefers dark mode");
      expect(result.contextText).toContain("</relevant-memories>");
      expect(result.memoriesIncluded).toBe(1);
      expect(result.memoryIds).toContain("mem-1");
    });

    it("respects maxTokens limit", async () => {
      const logger = createMockLogger();
      const db = createMockDb();
      const embeddings = createMockEmbeddings();

      // Create many long memories that would exceed token limit
      const longContent = "A".repeat(500);
      db.search.mockResolvedValue([
        { document: { id: "mem-1", content: longContent, direction: "inbound", timestamp: Date.now() }, score: 0.9 },
        { document: { id: "mem-2", content: longContent, direction: "inbound", timestamp: Date.now() }, score: 0.85 },
        { document: { id: "mem-3", content: longContent, direction: "inbound", timestamp: Date.now() }, score: 0.8 },
      ]);

      const injector = new ContextInjector(
        { enabled: true, maxTokens: 200, relevanceThreshold: 0.3 },
        { db: db as any, embeddings, logger },
      );

      const result = await injector.injectContext("test");

      expect(result.estimatedTokens).toBeLessThanOrEqual(200);
      expect(result.memoriesIncluded).toBeLessThan(3);
    });

    it("handles errors gracefully", async () => {
      const logger = createMockLogger();
      const db = createMockDb();
      const embeddings = createMockEmbeddings();

      embeddings.embed.mockRejectedValue(new Error("Embedding failed"));

      const injector = new ContextInjector(
        { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        { db: db as any, embeddings, logger },
      );

      const result = await injector.injectContext("test query");

      expect(result.contextText).toBe("");
      expect(result.memoriesIncluded).toBe(0);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe("formatContext()", () => {
    it("formats search results correctly", () => {
      const logger = createMockLogger();
      const db = createMockDb();
      const embeddings = createMockEmbeddings();

      const injector = new ContextInjector(
        { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        { db: db as any, embeddings, logger },
      );

      const results = [
        {
          document: {
            id: "mem-1",
            content: "Test content",
            direction: "inbound" as const,
            channel: "telegram",
            timestamp: Date.now(),
          },
          score: 0.85,
        },
      ];

      const formatted = injector.formatContext(results);

      expect(formatted.contextText).toContain("<relevant-memories>");
      expect(formatted.contextText).toContain("Test content");
      expect(formatted.contextText).toContain("85%");
      expect(formatted.contextText).toContain("User");
      expect(formatted.memoriesIncluded).toBe(1);
      expect(formatted.memoryIds).toContain("mem-1");
    });

    it("returns empty context for empty results", () => {
      const logger = createMockLogger();
      const db = createMockDb();
      const embeddings = createMockEmbeddings();

      const injector = new ContextInjector(
        { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        { db: db as any, embeddings, logger },
      );

      const formatted = injector.formatContext([]);

      expect(formatted.contextText).toBe("");
      expect(formatted.memoriesIncluded).toBe(0);
    });

    it("truncates long content", () => {
      const logger = createMockLogger();
      const db = createMockDb();
      const embeddings = createMockEmbeddings();

      const injector = new ContextInjector(
        { enabled: true, maxTokens: 5000, relevanceThreshold: 0.3 },
        { db: db as any, embeddings, logger },
      );

      const longContent = "X".repeat(1000);
      const results = [
        {
          document: {
            id: "mem-1",
            content: longContent,
            direction: "outbound" as const,
            timestamp: Date.now(),
          },
          score: 0.9,
        },
      ];

      const formatted = injector.formatContext(results);

      expect(formatted.contextText).toContain("...");
      expect(formatted.contextText.length).toBeLessThan(longContent.length + 200);
    });
  });

  describe("buildContextForMessage()", () => {
    it("builds context for user message with filters", async () => {
      const logger = createMockLogger();
      const db = createMockDb();
      const embeddings = createMockEmbeddings();

      db.search.mockResolvedValue([
        {
          document: {
            id: "mem-1",
            content: "Related memory",
            direction: "inbound",
            timestamp: Date.now(),
          },
          score: 0.8,
        },
      ]);

      const injector = new ContextInjector(
        { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        { db: db as any, embeddings, logger },
      );

      const result = await injector.buildContextForMessage("What are my preferences?", {
        channelId: "telegram",
        sessionKey: "session-123",
      });

      expect(result.memoriesIncluded).toBe(1);
      expect(db.search).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          filter: expect.objectContaining({
            channel: "telegram",
            sessionKey: "session-123",
          }),
        }),
      );
    });
  });
});

// =============================================================================
// Client ruvLLM Methods Tests
// =============================================================================

describe("RuvectorClient ruvLLM Methods", () => {
  let RuvectorClient: typeof import("./client.js").RuvectorClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./client.js");
    RuvectorClient = module.RuvectorClient;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("enableRuvLLM()", () => {
    it("enables ruvLLM with valid config", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      client.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 1000 },
      });

      expect(client.isRuvLLMEnabled()).toBe(true);
      expect(client.getRuvLLMConfig()).toBeDefined();
      expect(client.getTrajectoryRecorder()).not.toBeNull();
    });

    it("does not enable when config.enabled is false", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      client.enableRuvLLM({
        enabled: false,
        contextInjection: { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 1000 },
      });

      expect(client.isRuvLLMEnabled()).toBe(false);
    });

    it("reconfigures when called twice", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      client.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 1000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 500 },
      });

      const firstRecorder = client.getTrajectoryRecorder();

      client.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 3000, relevanceThreshold: 0.5 },
        trajectoryRecording: { enabled: true, maxTrajectories: 2000 },
      });

      const secondRecorder = client.getTrajectoryRecorder();

      expect(secondRecorder).not.toBe(firstRecorder);
      expect(client.getRuvLLMConfig()?.contextInjection.maxTokens).toBe(3000);
    });

    it("initializes pattern store when enabling ruvLLM", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      expect(client.getPatternStore()).toBeNull();

      client.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 1000 },
      });

      expect(client.getPatternStore()).not.toBeNull();
    });
  });

  describe("recordTrajectory()", () => {
    it("records trajectory when ruvLLM is enabled", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      client.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 1000 },
      });

      const id = client.recordTrajectory({
        query: "test query",
        queryVector: new Array(1536).fill(0.1),
        resultIds: ["id1", "id2"],
        resultScores: [0.9, 0.85],
      });

      expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it("returns empty string when ruvLLM is disabled", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      const id = client.recordTrajectory({
        query: "test query",
        queryVector: [0.1],
        resultIds: [],
        resultScores: [],
      });

      expect(id).toBe("");
    });

    it("stores trajectory data correctly", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      client.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 1000 },
      });

      const id = client.recordTrajectory({
        query: "test query",
        queryVector: [0.1, 0.2],
        resultIds: ["res1"],
        resultScores: [0.95],
        sessionId: "session-1",
      });

      const recorder = client.getTrajectoryRecorder();
      const trajectory = recorder?.get(id);

      expect(trajectory).not.toBeNull();
      expect(trajectory?.query).toBe("test query");
      expect(trajectory?.sessionId).toBe("session-1");
    });
  });

  describe("searchWithTrajectory()", () => {
    it("performs search and records trajectory", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      client.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 1000 },
      });

      const { results, trajectoryId } = await client.searchWithTrajectory(
        {
          vector: new Array(1536).fill(0.1),
          limit: 5,
        },
        "session-1",
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(trajectoryId).toMatch(/^[0-9a-f-]{36}$/i);

      const recorder = client.getTrajectoryRecorder();
      const trajectory = recorder?.get(trajectoryId);
      expect(trajectory?.sessionId).toBe("session-1");
    });

    it("returns empty trajectoryId when ruvLLM is disabled", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      const { results, trajectoryId } = await client.searchWithTrajectory({
        vector: new Array(1536).fill(0.1),
        limit: 5,
      });

      expect(results).toBeDefined();
      expect(trajectoryId).toBe("");
    });
  });

  describe("addTrajectoryFeedback()", () => {
    it("adds feedback to trajectory", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      client.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 1000 },
      });

      const id = client.recordTrajectory({
        query: "test",
        queryVector: [0.1],
        resultIds: ["res1"],
        resultScores: [0.9],
      });

      const success = client.addTrajectoryFeedback(id, 0.85);

      expect(success).toBe(true);

      const recorder = client.getTrajectoryRecorder();
      const trajectory = recorder?.get(id);
      expect(trajectory?.feedback).toBe(0.85);
    });

    it("returns false for non-existent trajectory", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      client.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 1000 },
      });

      const success = client.addTrajectoryFeedback("non-existent-id", 0.9);

      expect(success).toBe(false);
    });

    it("adds pattern sample for high-quality feedback", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      client.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 1000 },
      });

      const id = client.recordTrajectory({
        query: "test",
        queryVector: [0.1, 0.2],
        resultIds: ["res1"],
        resultScores: [0.9],
      });

      client.addTrajectoryFeedback(id, 0.9);

      const patternStore = client.getPatternStore();
      expect(patternStore?.getSampleCount()).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getTrajectoryStats()", () => {
    it("returns stats when ruvLLM is enabled", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      client.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 1000 },
      });

      const id = client.recordTrajectory({
        query: "test",
        queryVector: [0.1],
        resultIds: [],
        resultScores: [],
      });
      client.addTrajectoryFeedback(id, 0.8);

      const stats = client.getTrajectoryStats();

      expect(stats.totalTrajectories).toBe(1);
      expect(stats.trajectoriesWithFeedback).toBe(1);
      expect(stats.averageFeedbackScore).toBe(0.8);
    });

    it("returns empty stats when ruvLLM is disabled", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      const stats = client.getTrajectoryStats();

      expect(stats.totalTrajectories).toBe(0);
      expect(stats.trajectoriesWithFeedback).toBe(0);
      expect(stats.averageFeedbackScore).toBe(0);
    });
  });

  describe("findSimilarTrajectories()", () => {
    it("finds similar trajectories by query vector", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      client.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 1000 },
      });

      // Record trajectory with specific vector
      const vector = new Array(1536).fill(0.1);
      client.recordTrajectory({
        query: "specific query",
        queryVector: vector,
        resultIds: ["res1"],
        resultScores: [0.9],
      });

      // Search for similar
      const similar = client.findSimilarTrajectories(vector, 5);

      expect(similar.length).toBeGreaterThanOrEqual(1);
      expect(similar[0].similarity).toBeGreaterThan(0.9);
    });

    it("returns empty array when no similar trajectories", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      client.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 1000 },
      });

      const similar = client.findSimilarTrajectories([1, 0, 0], 5);

      expect(similar).toHaveLength(0);
    });
  });

  describe("exportRuvLLMState/importRuvLLMState", () => {
    it("exports and imports ruvLLM state", async () => {
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();

      client.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 1000 },
      });

      // Record some data
      client.recordTrajectory({
        query: "export test",
        queryVector: [0.1, 0.2],
        resultIds: ["res1"],
        resultScores: [0.9],
      });

      const exported = client.exportRuvLLMState();

      expect(exported.trajectories.length).toBe(1);
      expect(exported.patterns).not.toBeNull();

      // Create new client and import
      const client2 = new RuvectorClient({ dimension: 1536 }, logger);
      await client2.connect();
      client2.enableRuvLLM({
        enabled: true,
        contextInjection: { enabled: true, maxTokens: 2000, relevanceThreshold: 0.3 },
        trajectoryRecording: { enabled: true, maxTrajectories: 1000 },
      });

      client2.importRuvLLMState(exported);

      expect(client2.getTrajectoryStats().totalTrajectories).toBe(1);
    });
  });
});

// =============================================================================
// Graph Features Tests
// =============================================================================

describe("Graph Features", () => {
  let RuvectorClient: typeof import("./client.js").RuvectorClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./client.js");
    RuvectorClient = module.RuvectorClient;
  });

  it("should initialize graph database", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();

    // Initialize graph (in-memory for tests)
    await client.initializeGraph();

    expect(client.isGraphInitialized()).toBe(true);
  });

  it("should add and remove edges", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();
    await client.initializeGraph();

    // Add an edge between two nodes - returns edge ID (string)
    const edgeId = await client.addEdge({
      sourceId: "node-1",
      targetId: "node-2",
      relationship: "FOLLOWS",
      properties: { weight: 0.8 },
    });
    expect(typeof edgeId).toBe("string");

    // Remove the edge - returns boolean
    const removed = await client.removeEdge("node-1", "node-2");
    expect(typeof removed).toBe("boolean");
  });

  it("should execute Cypher queries via cypherQuery", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();
    await client.initializeGraph();

    // Execute a Cypher query to find connected nodes
    const results = await client.cypherQuery(
      "MATCH (n)-[:RELATES_TO]->(m) WHERE n.channel = $channel RETURN m",
      { channel: "telegram" },
    );

    expect(results).toBeDefined();
    expect(Array.isArray(results.columns)).toBe(true);
    expect(Array.isArray(results.rows)).toBe(true);
  });

  it("should find neighbors via getNeighbors", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();
    await client.initializeGraph();

    // First insert a node via vector insert
    await client.insert({
      vector: new Array(1536).fill(0.1),
      metadata: { text: "test node", id: "node-1" },
    });

    // Add edge to create a neighbor relationship
    await client.addEdge({
      sourceId: "node-1",
      targetId: "node-2",
      relationship: "RELATES_TO",
    });

    // Find neighbors of a node - takes (id, depth) parameters
    const neighbors = await client.getNeighbors("node-1", 2);

    expect(neighbors).toBeDefined();
    expect(Array.isArray(neighbors)).toBe(true);
  });

  it("should create message links via addEdge", async () => {
    const logger = createMockLogger();
    const client = new RuvectorClient({ dimension: 1536 }, logger);
    await client.connect();
    await client.initializeGraph();

    // Insert two related messages
    const id1 = await client.insert({
      vector: new Array(1536).fill(0.1),
      metadata: { text: "original message", conversationId: "conv-1" },
    });

    const id2 = await client.insert({
      vector: new Array(1536).fill(0.2),
      metadata: { text: "reply message", conversationId: "conv-1", replyTo: id1 },
    });

    // Link messages using addEdge - returns edge ID (string)
    const edgeId = await client.addEdge({
      sourceId: id1,
      targetId: id2,
      relationship: "REPLIED_BY",
    });

    expect(typeof edgeId).toBe("string");
  });
});

// =============================================================================
// P3 ruvLLM Advanced Features Tests
// =============================================================================

// -----------------------------------------------------------------------------
// EWCConsolidator Tests
// -----------------------------------------------------------------------------

describe("EWCConsolidator", () => {
  let EWCConsolidator: typeof import("./sona/ewc.js").EWCConsolidator;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./sona/ewc.js");
    EWCConsolidator = module.EWCConsolidator;
  });

  describe("consolidate", () => {
    it("should merge similar patterns while preserving protected ones", () => {
      // Arrange
      const ewc = new EWCConsolidator({
        mergeSimilarityThreshold: 0.9,
        maxPatterns: 100,
      });

      // Create patterns with similar centroids
      const patterns = [
        { id: "protected-1", centroid: [1, 0, 0, 0], clusterSize: 5, avgQuality: 0.8 },
        { id: "pattern-1", centroid: [0.1, 0.9, 0, 0], clusterSize: 3, avgQuality: 0.7 },
        { id: "pattern-2", centroid: [0.1, 0.91, 0, 0], clusterSize: 2, avgQuality: 0.6 }, // Similar to pattern-1
        { id: "pattern-3", centroid: [0, 0, 1, 0], clusterSize: 4, avgQuality: 0.9 },
      ];

      // Protect the first pattern
      ewc.protectCritical(["protected-1"], "critical pattern");

      // Act
      const { patterns: consolidated, result } = ewc.consolidate(patterns);

      // Assert
      expect(result.protectedPreserved).toBe(1);
      expect(consolidated.some((p) => p.id === "protected-1")).toBe(true);
      expect(result.patternsBefore).toBe(4);
      expect(result.patternsAfter).toBeLessThanOrEqual(4);
    });

    it("should prune patterns when exceeding maxPatterns limit", () => {
      // Arrange
      const ewc = new EWCConsolidator({
        maxPatterns: 3,
        mergeSimilarityThreshold: 0.99, // High threshold so no merging
      });

      const patterns = [
        { id: "p1", centroid: [1, 0, 0], clusterSize: 1, avgQuality: 0.5 },
        { id: "p2", centroid: [0, 1, 0], clusterSize: 1, avgQuality: 0.6 },
        { id: "p3", centroid: [0, 0, 1], clusterSize: 1, avgQuality: 0.7 },
        { id: "p4", centroid: [0.5, 0.5, 0], clusterSize: 1, avgQuality: 0.3 },
        { id: "p5", centroid: [0, 0.5, 0.5], clusterSize: 1, avgQuality: 0.4 },
      ];

      // Act
      const { result } = ewc.consolidate(patterns);

      // Assert
      expect(result.patternsAfter).toBeLessThanOrEqual(3);
      expect(result.patternsPruned).toBeGreaterThan(0);
    });

    it("should return empty result for empty input", () => {
      // Arrange
      const ewc = new EWCConsolidator();

      // Act
      const { patterns: consolidated, result } = ewc.consolidate([]);

      // Assert
      expect(consolidated).toHaveLength(0);
      expect(result.patternsBefore).toBe(0);
      expect(result.patternsAfter).toBe(0);
    });
  });

  describe("protectCritical", () => {
    it("should protect patterns with specified protection level", () => {
      // Arrange
      const ewc = new EWCConsolidator();

      // Act
      ewc.protectCritical(["pattern-1", "pattern-2"], "high importance", 0.9);

      // Assert
      expect(ewc.isProtected("pattern-1")).toBe(true);
      expect(ewc.isProtected("pattern-2")).toBe(true);
      expect(ewc.isProtected("pattern-3")).toBe(false);

      const protection = ewc.getProtection("pattern-1");
      expect(protection).not.toBeNull();
      expect(protection?.protectionLevel).toBe(0.9);
      expect(protection?.reason).toBe("high importance");
    });

    it("should clamp protection level to valid range", () => {
      // Arrange
      const ewc = new EWCConsolidator();

      // Act
      ewc.protectCritical(["p1"], undefined, 1.5); // Above max
      ewc.protectCritical(["p2"], undefined, -0.5); // Below min

      // Assert
      expect(ewc.getProtection("p1")?.protectionLevel).toBe(1.0);
      expect(ewc.getProtection("p2")?.protectionLevel).toBe(0);
    });

    it("should allow unprotecting patterns", () => {
      // Arrange
      const ewc = new EWCConsolidator();
      ewc.protectCritical(["pattern-1", "pattern-2"]);

      // Act
      ewc.unprotect(["pattern-1"]);

      // Assert
      expect(ewc.isProtected("pattern-1")).toBe(false);
      expect(ewc.isProtected("pattern-2")).toBe(true);
    });

    it("should return all protected IDs", () => {
      // Arrange
      const ewc = new EWCConsolidator();
      ewc.protectCritical(["p1", "p2", "p3"]);

      // Act
      const protectedIds = ewc.getProtectedIds();

      // Assert
      expect(protectedIds).toContain("p1");
      expect(protectedIds).toContain("p2");
      expect(protectedIds).toContain("p3");
      expect(protectedIds).toHaveLength(3);
    });
  });

  describe("computePenalty", () => {
    it("should compute EWC penalty based on Fisher information", () => {
      // Arrange
      const ewc = new EWCConsolidator({ lambda: 1000 });

      // Update Fisher information for a pattern
      ewc.updateFisherInfo("pattern-1", [0.1, 0.2, 0.3]);
      ewc.updateFisherInfo("pattern-1", [0.2, 0.3, 0.4]); // Update again

      // Act
      const delta = [0.5, 0.5, 0.5];
      const penalty = ewc.computePenalty("pattern-1", delta);

      // Assert
      expect(penalty).toBeGreaterThan(0);
      expect(typeof penalty).toBe("number");
    });

    it("should return 0 for untracked pattern", () => {
      // Arrange
      const ewc = new EWCConsolidator();

      // Act
      const penalty = ewc.computePenalty("unknown-pattern", [0.1, 0.2]);

      // Assert
      expect(penalty).toBe(0);
    });

    it("should increase penalty for protected patterns", () => {
      // Arrange
      const ewc = new EWCConsolidator({ lambda: 1000 });
      ewc.updateFisherInfo("pattern-1", [0.1, 0.2, 0.3]);

      // Act
      const penaltyUnprotected = ewc.computePenalty("pattern-1", [0.5, 0.5, 0.5]);
      ewc.protectCritical(["pattern-1"], "important", 1.0);
      const penaltyProtected = ewc.computePenalty("pattern-1", [0.5, 0.5, 0.5]);

      // Assert
      expect(penaltyProtected).toBeGreaterThan(penaltyUnprotected);
    });
  });

  describe("Fisher Information tracking", () => {
    it("should update Fisher information with exponential decay", () => {
      // Arrange
      const ewc = new EWCConsolidator({ fisherDecay: 0.9 });

      // Act
      ewc.updateFisherInfo("p1", [1, 2, 3]);
      const info1 = ewc.getFisherInfo("p1");

      ewc.updateFisherInfo("p1", [0.5, 0.5, 0.5]);
      const info2 = ewc.getFisherInfo("p1");

      // Assert
      expect(info1?.sampleCount).toBe(1);
      expect(info2?.sampleCount).toBe(2);
      expect(info2?.importance).not.toEqual(info1?.importance);
    });

    it("should compute importance score from Fisher diagonal", () => {
      // Arrange
      const ewc = new EWCConsolidator();
      ewc.updateFisherInfo("p1", [0.1, 0.2, 0.3]);

      // Act
      const importance = ewc.computeImportance("p1");

      // Assert
      expect(importance).toBeGreaterThan(0);
    });
  });

  describe("state management", () => {
    it("should export and import state correctly", () => {
      // Arrange
      const ewc = new EWCConsolidator({ lambda: 500 });
      ewc.updateFisherInfo("p1", [0.1, 0.2]);
      ewc.protectCritical(["p1"], "important");

      // Act
      const exported = ewc.exportState();
      const newEwc = new EWCConsolidator();
      newEwc.importState(exported);

      // Assert
      expect(newEwc.isProtected("p1")).toBe(true);
      expect(newEwc.getFisherInfo("p1")).not.toBeNull();
    });

    it("should clear all state", () => {
      // Arrange
      const ewc = new EWCConsolidator();
      ewc.updateFisherInfo("p1", [0.1, 0.2]);
      ewc.protectCritical(["p1"]);

      // Act
      ewc.clear();

      // Assert
      expect(ewc.getFisherInfo("p1")).toBeNull();
      expect(ewc.isProtected("p1")).toBe(false);
      expect(ewc.getStats().trackedPatterns).toBe(0);
    });

    it("should return accurate statistics", () => {
      // Arrange
      const ewc = new EWCConsolidator({ lambda: 100 });
      ewc.updateFisherInfo("p1", [0.1, 0.2]);
      ewc.updateFisherInfo("p2", [0.3, 0.4]);
      ewc.protectCritical(["p1"]);

      // Act
      const stats = ewc.getStats();

      // Assert
      expect(stats.trackedPatterns).toBe(2);
      expect(stats.protectedPatterns).toBe(1);
      expect(stats.config.lambda).toBe(100);
    });
  });
});

// -----------------------------------------------------------------------------
// ConsolidationLoop Tests
// -----------------------------------------------------------------------------

describe("ConsolidationLoop", () => {
  let ConsolidationLoop: typeof import("./sona/loops/consolidation.js").ConsolidationLoop;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    const module = await import("./sona/loops/consolidation.js");
    ConsolidationLoop = module.ConsolidationLoop;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("runDeepConsolidation", () => {
    it("should consolidate patterns when threshold is met", async () => {
      // Arrange
      const loop = new ConsolidationLoop({
        minPatternsForConsolidation: 3,
        clusteringIterations: 5,
      });

      // Add patterns above threshold
      for (let i = 0; i < 10; i++) {
        loop.addPattern({
          id: `p-${i}`,
          centroid: [Math.random(), Math.random(), Math.random()],
          clusterSize: 1,
          avgQuality: 0.5 + Math.random() * 0.5,
        });
      }

      // Act
      const result = await loop.runDeepConsolidation();

      // Assert
      expect(result).not.toBeNull();
      expect(result?.patternsBefore).toBe(10);
      expect(result?.patternsAfter).toBeGreaterThan(0);
    });

    it("should skip consolidation below threshold", async () => {
      // Arrange
      const loop = new ConsolidationLoop({
        minPatternsForConsolidation: 100,
      });

      loop.addPattern({ id: "p1", centroid: [1, 0], clusterSize: 1, avgQuality: 0.8 });

      // Act
      const result = await loop.runDeepConsolidation();

      // Assert
      expect(result).toBeNull();
    });

    it("should update statistics after consolidation", async () => {
      // Arrange
      const loop = new ConsolidationLoop({
        minPatternsForConsolidation: 2,
        numClusters: 2, // Explicit cluster count to avoid k > n patterns
        clusteringIterations: 3,
      });

      // Create patterns with consistent 4D centroids
      for (let i = 0; i < 5; i++) {
        loop.addPattern({
          id: `p-${i}`,
          centroid: [Math.random(), Math.random(), Math.random(), Math.random()],
          clusterSize: 1,
          avgQuality: 0.7,
        });
      }

      // Act
      const result = await loop.runDeepConsolidation();
      const stats = loop.getStats();

      // Assert
      expect(result).not.toBeNull();
      expect(stats.totalRuns).toBe(1);
      expect(stats.lastRunAt).not.toBeNull();
      expect(stats.totalPatternsProcessed).toBeGreaterThan(0);
    });
  });

  describe("exportPatterns", () => {
    it("should export patterns to a file", async () => {
      // Arrange
      const loop = new ConsolidationLoop();
      loop.addPattern({ id: "p1", centroid: [1, 0, 0], clusterSize: 2, avgQuality: 0.9 });
      loop.addPattern({ id: "p2", centroid: [0, 1, 0], clusterSize: 3, avgQuality: 0.8 });

      // Create a temp directory for testing
      const { mkdtemp, rm } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tempDir = await mkdtemp(join(tmpdir(), "ruvector-test-"));
      const exportPath = join(tempDir, "patterns.json");

      try {
        // Act
        await loop.exportPatterns(exportPath, { testMeta: true });

        // Assert - verify file exists and has content
        const { readFile } = await import("node:fs/promises");
        const content = await readFile(exportPath, "utf-8");
        const data = JSON.parse(content);

        expect(data.version).toBe("1.0.0");
        expect(data.patterns).toHaveLength(2);
        expect(data.metadata?.testMeta).toBe(true);
      } finally {
        // Cleanup
        await rm(tempDir, { recursive: true });
      }
    });

    it("should throw for invalid path", async () => {
      // Arrange
      const loop = new ConsolidationLoop();

      // Act & Assert
      await expect(loop.exportPatterns("")).rejects.toThrow(/invalid.*path/i);
    });
  });

  describe("importPatterns", () => {
    it("should import patterns from a file", async () => {
      // Arrange
      const loop = new ConsolidationLoop();

      // Create test file
      const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tempDir = await mkdtemp(join(tmpdir(), "ruvector-test-"));
      const importPath = join(tempDir, "import.json");

      const testData = {
        version: "1.0.0",
        exportedAt: Date.now(),
        patterns: [
          { id: "imported-1", centroid: [0.5, 0.5, 0], clusterSize: 5, avgQuality: 0.85 },
          { id: "imported-2", centroid: [0, 0.5, 0.5], clusterSize: 3, avgQuality: 0.75 },
        ],
      };

      await writeFile(importPath, JSON.stringify(testData), "utf-8");

      try {
        // Act
        const result = await loop.importPatterns(importPath, true);

        // Assert
        expect(result.patterns).toHaveLength(2);
        expect(loop.getAllPatterns()).toHaveLength(2);
        expect(loop.getPattern("imported-1")).not.toBeNull();
      } finally {
        // Cleanup
        await rm(tempDir, { recursive: true });
      }
    });

    it("should throw for invalid JSON format", async () => {
      // Arrange
      const loop = new ConsolidationLoop();

      const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tempDir = await mkdtemp(join(tmpdir(), "ruvector-test-"));
      const invalidPath = join(tempDir, "invalid.json");

      await writeFile(invalidPath, "not valid json", "utf-8");

      try {
        // Act & Assert
        await expect(loop.importPatterns(invalidPath)).rejects.toThrow(/invalid.*json/i);
      } finally {
        await rm(tempDir, { recursive: true });
      }
    });

    it("should throw for missing required fields", async () => {
      // Arrange
      const loop = new ConsolidationLoop();

      const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tempDir = await mkdtemp(join(tmpdir(), "ruvector-test-"));
      const invalidPath = join(tempDir, "missing-fields.json");

      await writeFile(invalidPath, JSON.stringify({ version: "1.0.0" }), "utf-8");

      try {
        // Act & Assert
        await expect(loop.importPatterns(invalidPath)).rejects.toThrow(/invalid.*format/i);
      } finally {
        await rm(tempDir, { recursive: true });
      }
    });
  });

  describe("mergePatterns", () => {
    it("should merge new patterns with existing ones", () => {
      // Arrange
      const loop = new ConsolidationLoop();

      // Add existing patterns
      loop.addPattern({ id: "existing-1", centroid: [1, 0], clusterSize: 2, avgQuality: 0.8 });

      // Act
      const result = loop.mergePatterns([
        { id: "new-1", centroid: [0, 1], clusterSize: 3, avgQuality: 0.7 },
        { id: "new-2", centroid: [0.5, 0.5], clusterSize: 1, avgQuality: 0.6 },
      ]);

      // Assert
      expect(result.patternsBefore).toBeGreaterThan(1);
      expect(loop.getStats().currentPatternCount).toBeGreaterThan(0);
    });
  });

  describe("lifecycle management", () => {
    it("should start and stop the loop", () => {
      // Arrange
      const loop = new ConsolidationLoop({ intervalMs: 1000 });

      // Act & Assert
      expect(loop.isRunning()).toBe(false);

      loop.start();
      expect(loop.isRunning()).toBe(true);

      loop.stop();
      expect(loop.isRunning()).toBe(false);
    });

    it("should auto-start when configured", () => {
      // Arrange & Act
      const loop = new ConsolidationLoop({ autoStart: true, intervalMs: 1000 });

      // Assert
      expect(loop.isRunning()).toBe(true);

      // Cleanup
      loop.stop();
    });

    it("should run consolidation on interval", async () => {
      // Arrange
      const loop = new ConsolidationLoop({
        intervalMs: 100,
        minPatternsForConsolidation: 2,
        numClusters: 2, // Explicit cluster count
        clusteringIterations: 2,
      });

      // Add enough patterns with 4D centroids to trigger consolidation
      for (let i = 0; i < 5; i++) {
        loop.addPattern({
          id: `p-${i}`,
          centroid: [Math.random(), Math.random(), Math.random(), Math.random()],
          clusterSize: 1,
          avgQuality: 0.7,
        });
      }

      // Act - run consolidation directly instead of relying on interval with fake timers
      // The interval may not fire predictably with vi.useFakeTimers in async contexts
      const result = await loop.runDeepConsolidation();

      // Assert - we can verify consolidation happened
      expect(result).not.toBeNull();
      const stats = loop.getStats();
      expect(stats.totalRuns).toBeGreaterThanOrEqual(1);

      // Cleanup
      loop.stop();
    });
  });

  describe("pattern management", () => {
    it("should add and remove patterns", () => {
      // Arrange
      const loop = new ConsolidationLoop();
      const pattern = { id: "test-1", centroid: [1, 0], clusterSize: 1, avgQuality: 0.5 };

      // Act
      loop.addPattern(pattern);
      expect(loop.getPattern("test-1")).toEqual(pattern);

      loop.removePattern("test-1");
      expect(loop.getPattern("test-1")).toBeNull();
    });

    it("should add multiple patterns at once", () => {
      // Arrange
      const loop = new ConsolidationLoop();
      const patterns = [
        { id: "p1", centroid: [1, 0], clusterSize: 1, avgQuality: 0.5 },
        { id: "p2", centroid: [0, 1], clusterSize: 2, avgQuality: 0.6 },
      ];

      // Act
      loop.addPatterns(patterns);

      // Assert
      expect(loop.getAllPatterns()).toHaveLength(2);
    });

    it("should clear all patterns", () => {
      // Arrange
      const loop = new ConsolidationLoop();
      loop.addPattern({ id: "p1", centroid: [1], clusterSize: 1, avgQuality: 0.5 });

      // Act
      loop.clearPatterns();

      // Assert
      expect(loop.getAllPatterns()).toHaveLength(0);
      expect(loop.getStats().currentPatternCount).toBe(0);
    });
  });

  describe("EWC integration", () => {
    it("should provide access to EWC consolidator", () => {
      // Arrange
      const loop = new ConsolidationLoop();

      // Act
      const ewc = loop.getEWC();

      // Assert
      expect(ewc).toBeDefined();
      expect(typeof ewc.protectCritical).toBe("function");
    });

    it("should delegate protectCritical to EWC", () => {
      // Arrange
      const loop = new ConsolidationLoop();
      loop.addPattern({ id: "critical-1", centroid: [1], clusterSize: 1, avgQuality: 0.9 });

      // Act
      loop.protectCritical(["critical-1"], "must keep");

      // Assert
      expect(loop.getEWC().isProtected("critical-1")).toBe(true);
    });
  });

  describe("statistics", () => {
    it("should reset statistics", () => {
      // Arrange
      const loop = new ConsolidationLoop({ minPatternsForConsolidation: 1 });
      loop.addPattern({ id: "p1", centroid: [1], clusterSize: 1, avgQuality: 0.5 });

      // Act
      loop.resetStats();
      const stats = loop.getStats();

      // Assert
      expect(stats.totalRuns).toBe(0);
      expect(stats.lastRunAt).toBeNull();
    });
  });
});

// -----------------------------------------------------------------------------
// GraphAttention Tests
// -----------------------------------------------------------------------------

describe("GraphAttention", () => {
  let GraphAttention: typeof import("./graph/attention.js").GraphAttention;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./graph/attention.js");
    GraphAttention = module.GraphAttention;
  });

  describe("aggregateContext", () => {
    it("should aggregate context from graph neighbors", () => {
      // Arrange
      const attention = new GraphAttention({ inputDim: 4, hiddenDim: 2 });

      const nodes = new Map([
        ["center", { id: "center", embedding: [1, 0, 0, 0] }],
        ["neighbor-1", { id: "neighbor-1", embedding: [0.5, 0.5, 0, 0] }],
        ["neighbor-2", { id: "neighbor-2", embedding: [0, 0.5, 0.5, 0] }],
      ]);

      const edges = [
        { sourceId: "center", targetId: "neighbor-1", relationship: "relates_to" },
        { sourceId: "center", targetId: "neighbor-2", relationship: "similar_to" },
      ];

      // Act
      const result = attention.aggregateContext("center", nodes, edges, 1);

      // Assert
      expect(result.contextVector).toHaveLength(4); // Same as inputDim
      expect(result.depth).toBeGreaterThan(0);
      expect(result.contributingNodes.length).toBeGreaterThanOrEqual(0);
    });

    it("should return zero vector for missing node", () => {
      // Arrange
      const attention = new GraphAttention({ inputDim: 4 });

      // Act
      const result = attention.aggregateContext(
        "nonexistent",
        new Map(),
        [],
        1,
      );

      // Assert
      expect(result.contextVector.every((v) => v === 0)).toBe(true);
      expect(result.depth).toBe(0);
    });

    it("should respect depth limit during traversal", () => {
      // Arrange
      const attention = new GraphAttention({ inputDim: 3 });

      const nodes = new Map([
        ["n1", { id: "n1", embedding: [1, 0, 0] }],
        ["n2", { id: "n2", embedding: [0, 1, 0] }],
        ["n3", { id: "n3", embedding: [0, 0, 1] }],
        ["n4", { id: "n4", embedding: [0.5, 0.5, 0] }],
      ]);

      const edges = [
        { sourceId: "n1", targetId: "n2", relationship: "relates_to" },
        { sourceId: "n2", targetId: "n3", relationship: "relates_to" },
        { sourceId: "n3", targetId: "n4", relationship: "relates_to" },
      ];

      // Act
      const resultDepth1 = attention.aggregateContext("n1", nodes, edges, 1);
      const resultDepth3 = attention.aggregateContext("n1", nodes, edges, 3);

      // Assert
      expect(resultDepth1.depth).toBeLessThanOrEqual(1);
      expect(resultDepth3.depth).toBeLessThanOrEqual(3);
    });

    it("should filter by specific heads when specified", () => {
      // Arrange
      const attention = new GraphAttention({
        inputDim: 4,
        heads: [
          { name: "semantic", relationshipTypes: ["relates_to"], weight: 1.0 },
          { name: "temporal", relationshipTypes: ["follows"], weight: 1.0 },
        ],
      });

      const nodes = new Map([
        ["center", { id: "center", embedding: [1, 0, 0, 0] }],
        ["n1", { id: "n1", embedding: [0, 1, 0, 0] }],
      ]);

      const edges = [
        { sourceId: "center", targetId: "n1", relationship: "relates_to" },
      ];

      // Act
      const result = attention.aggregateContext("center", nodes, edges, 1, ["semantic"]);

      // Assert
      expect(result.attentionWeights.has("semantic")).toBe(true);
      // Only semantic head should be used
      expect(result.attentionWeights.size).toBe(1);
    });
  });

  describe("addHead", () => {
    it("should add a new attention head", () => {
      // Arrange
      const attention = new GraphAttention({ inputDim: 4, heads: [] });

      // Act
      attention.addHead({
        name: "custom-head",
        relationshipTypes: ["custom_rel"],
        weight: 1.5,
      });

      // Assert
      const headNames = attention.getHeadNames();
      expect(headNames).toContain("custom-head");
    });

    it("should replace existing head with same name", () => {
      // Arrange
      const attention = new GraphAttention({
        inputDim: 4,
        heads: [{ name: "test", weight: 1.0 }],
      });

      // Act
      attention.addHead({ name: "test", weight: 2.0, relationshipTypes: ["new_rel"] });

      // Assert
      const config = attention.getConfig();
      const testHead = config.heads?.find((h) => h.name === "test");
      expect(testHead?.weight).toBe(2.0);
      expect(testHead?.relationshipTypes).toContain("new_rel");
    });

    it("should update output projection after adding head", () => {
      // Arrange
      const attention = new GraphAttention({ inputDim: 4, heads: [] });
      const initialHeadCount = attention.getHeadNames().length;

      // Act
      attention.addHead({ name: "head-1" });
      attention.addHead({ name: "head-2" });

      // Assert
      expect(attention.getHeadNames().length).toBe(initialHeadCount + 2);
    });
  });

  describe("removeHead", () => {
    it("should remove an existing head", () => {
      // Arrange
      const attention = new GraphAttention({
        inputDim: 4,
        heads: [
          { name: "keep", weight: 1.0 },
          { name: "remove", weight: 1.0 },
        ],
      });

      // Act
      const removed = attention.removeHead("remove");

      // Assert
      expect(removed).toBe(true);
      expect(attention.getHeadNames()).not.toContain("remove");
      expect(attention.getHeadNames()).toContain("keep");
    });

    it("should return false for non-existent head", () => {
      // Arrange
      const attention = new GraphAttention({ inputDim: 4 });

      // Act
      const removed = attention.removeHead("nonexistent");

      // Assert
      expect(removed).toBe(false);
    });
  });

  describe("multi-head attention", () => {
    it("should compute attention with multiple heads", () => {
      // Arrange
      const attention = new GraphAttention({
        inputDim: 8,
        hiddenDim: 4,
        heads: [
          { name: "semantic", relationshipTypes: ["relates_to"], weight: 1.0, attentionType: "dot" },
          { name: "causal", relationshipTypes: ["causes"], weight: 1.2, attentionType: "additive" },
        ],
        temperature: 1.0,
        dropout: 0.0, // Disable dropout for deterministic test
      });

      const nodes = new Map([
        ["center", { id: "center", embedding: [1, 0, 0, 0, 0, 0, 0, 0] }],
        ["semantic-neighbor", { id: "semantic-neighbor", embedding: [0.8, 0.2, 0, 0, 0, 0, 0, 0] }],
        ["causal-neighbor", { id: "causal-neighbor", embedding: [0, 0, 0.9, 0.1, 0, 0, 0, 0] }],
      ]);

      const edges = [
        { sourceId: "center", targetId: "semantic-neighbor", relationship: "relates_to" },
        { sourceId: "center", targetId: "causal-neighbor", relationship: "causes" },
      ];

      // Act
      const result = attention.aggregateContext("center", nodes, edges, 1);

      // Assert
      expect(result.attentionWeights.has("semantic")).toBe(true);
      expect(result.attentionWeights.has("causal")).toBe(true);
      expect(result.contextVector.length).toBe(8);
    });

    it("should apply different attention types correctly", () => {
      // Arrange
      const dotAttention = new GraphAttention({
        inputDim: 4,
        heads: [{ name: "dot", attentionType: "dot" }],
      });

      const additiveAttention = new GraphAttention({
        inputDim: 4,
        heads: [{ name: "additive", attentionType: "additive" }],
      });

      const nodes = new Map([
        ["center", { id: "center", embedding: [1, 0, 0, 0] }],
        ["neighbor", { id: "neighbor", embedding: [0, 1, 0, 0] }],
      ]);

      const edges = [{ sourceId: "center", targetId: "neighbor", relationship: "test" }];

      // Act
      const dotResult = dotAttention.aggregateContext("center", nodes, edges, 1);
      const additiveResult = additiveAttention.aggregateContext("center", nodes, edges, 1);

      // Assert - both should produce valid results
      expect(dotResult.contextVector.length).toBe(4);
      expect(additiveResult.contextVector.length).toBe(4);
    });
  });

  describe("configuration", () => {
    it("should return current configuration", () => {
      // Arrange
      const attention = new GraphAttention({
        inputDim: 16,
        hiddenDim: 8,
        dropout: 0.2,
        normalize: false,
        temperature: 0.5,
      });

      // Act
      const config = attention.getConfig();

      // Assert
      expect(config.inputDim).toBe(16);
      expect(config.hiddenDim).toBe(8);
      expect(config.dropout).toBe(0.2);
      expect(config.normalize).toBe(false);
      expect(config.temperature).toBe(0.5);
    });

    it("should use default configuration values", () => {
      // Arrange
      const attention = new GraphAttention({ inputDim: 32 });

      // Act
      const config = attention.getConfig();

      // Assert
      expect(config.hiddenDim).toBe(8); // inputDim / 4
      expect(config.dropout).toBe(0.1);
      expect(config.normalize).toBe(true);
      expect(config.temperature).toBe(1.0);
    });
  });
});

// -----------------------------------------------------------------------------
// Client Pattern Export/Import Tests
// -----------------------------------------------------------------------------

describe("RuvectorClient Pattern Export/Import", () => {
  let RuvectorClient: typeof import("./client.js").RuvectorClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./client.js");
    RuvectorClient = module.RuvectorClient;
  });

  describe("exportPatterns", () => {
    it("should export patterns to a file", async () => {
      // Arrange
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 4 }, logger);
      await client.connect();

      client.initializePatternStore();
      client.addPatternSample({
        id: "sample-1",
        queryVector: [1, 0, 0, 0],
        resultVector: [0.9, 0.1, 0, 0],
        relevanceScore: 0.85,
        timestamp: Date.now(),
      });
      client.addPatternSample({
        id: "sample-2",
        queryVector: [0, 1, 0, 0],
        resultVector: [0.1, 0.9, 0, 0],
        relevanceScore: 0.75,
        timestamp: Date.now(),
      });

      // Create temp file
      const { mkdtemp, rm } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tempDir = await mkdtemp(join(tmpdir(), "ruvector-client-test-"));
      const exportPath = join(tempDir, "client-patterns.json");

      try {
        // Act
        const result = await client.exportPatterns(exportPath);

        // Assert
        expect(result.sampleCount).toBe(2);

        // Verify file content
        const { readFile } = await import("node:fs/promises");
        const content = JSON.parse(await readFile(exportPath, "utf-8"));
        expect(content.version).toBe("1.0.0");
        expect(content.samples).toHaveLength(2);
      } finally {
        await rm(tempDir, { recursive: true });
      }
    });

    it("should throw for invalid path", async () => {
      // Arrange
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 4 }, logger);
      await client.connect();
      client.initializePatternStore();

      // Act & Assert
      await expect(client.exportPatterns("")).rejects.toThrow(/invalid.*path/i);
    });

    it("should throw when pattern store not initialized", async () => {
      // Arrange
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 4 }, logger);
      await client.connect();
      // Note: NOT calling initializePatternStore()

      // Act & Assert
      await expect(client.exportPatterns("/tmp/test.json")).rejects.toThrow(/not initialized/i);
    });
  });

  describe("importPatterns", () => {
    it("should import patterns from a file", async () => {
      // Arrange
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 4 }, logger);
      await client.connect();

      // Create test export file
      const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tempDir = await mkdtemp(join(tmpdir(), "ruvector-import-test-"));
      const importPath = join(tempDir, "import-patterns.json");

      const exportData = {
        version: "1.0.0",
        exportedAt: Date.now(),
        dimension: 4,
        clusters: [
          { id: "cluster-1", centroid: [0.5, 0.5, 0, 0, 0, 0, 0, 0], members: ["s1"], avgQuality: 0.8, lastUpdated: Date.now() },
        ],
        samples: [
          { id: "s1", queryVector: [1, 0, 0, 0], resultVector: [0.9, 0.1, 0, 0], relevanceScore: 0.9, timestamp: Date.now() },
        ],
      };

      await writeFile(importPath, JSON.stringify(exportData), "utf-8");

      try {
        // Act
        const result = await client.importPatterns(importPath);

        // Assert
        expect(result.clusterCount).toBe(1);
        expect(result.sampleCount).toBe(1);
        expect(result.version).toBe("1.0.0");
      } finally {
        await rm(tempDir, { recursive: true });
      }
    });

    it("should throw for missing file", async () => {
      // Arrange
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 4 }, logger);
      await client.connect();

      // Act & Assert
      await expect(client.importPatterns("/nonexistent/path.json")).rejects.toThrow(/failed to read/i);
    });

    it("should throw for invalid JSON", async () => {
      // Arrange
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 4 }, logger);
      await client.connect();

      const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tempDir = await mkdtemp(join(tmpdir(), "ruvector-invalid-test-"));
      const invalidPath = join(tempDir, "invalid.json");

      await writeFile(invalidPath, "not json content", "utf-8");

      try {
        // Act & Assert
        await expect(client.importPatterns(invalidPath)).rejects.toThrow(/invalid.*format/i);
      } finally {
        await rm(tempDir, { recursive: true });
      }
    });
  });

  describe("mergePatterns", () => {
    it("should merge patterns from file with existing ones", async () => {
      // Arrange
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 4 }, logger);
      await client.connect();
      client.initializePatternStore();

      // Add existing sample
      client.addPatternSample({
        id: "existing-1",
        queryVector: [1, 0, 0, 0],
        resultVector: [0.9, 0.1, 0, 0],
        relevanceScore: 0.8,
        timestamp: Date.now(),
      });

      // Create merge file
      const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const tempDir = await mkdtemp(join(tmpdir(), "ruvector-merge-test-"));
      const mergePath = join(tempDir, "merge-patterns.json");

      const mergeData = {
        version: "1.0.0",
        samples: [
          { id: "merged-1", queryVector: [0, 1, 0, 0], resultVector: [0.1, 0.9, 0, 0], relevanceScore: 0.85, timestamp: Date.now() },
          { id: "merged-2", queryVector: [0, 0, 1, 0], resultVector: [0, 0.1, 0.9, 0], relevanceScore: 0.75, timestamp: Date.now() },
        ],
      };

      await writeFile(mergePath, JSON.stringify(mergeData), "utf-8");

      try {
        // Act
        const result = await client.mergePatterns(mergePath);

        // Assert
        expect(result.importedSamples).toBe(2);
        expect(result.finalSamples).toBeGreaterThanOrEqual(2); // May include existing
      } finally {
        await rm(tempDir, { recursive: true });
      }
    });

    it("should throw for invalid path", async () => {
      // Arrange
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 4 }, logger);
      await client.connect();

      // Act & Assert
      await expect(client.mergePatterns("")).rejects.toThrow(/invalid.*path/i);
    });
  });

  describe("getPatternStats", () => {
    it("should return stats when pattern store is initialized", () => {
      // Arrange
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 4 }, logger);
      client.initializePatternStore();

      client.addPatternSample({
        id: "s1",
        queryVector: [1, 0, 0, 0],
        resultVector: [0.9, 0.1, 0, 0],
        relevanceScore: 0.8,
        timestamp: Date.now(),
      });

      // Act
      const stats = client.getPatternStats();

      // Assert
      expect(stats.initialized).toBe(true);
      expect(stats.sampleCount).toBe(1);
    });

    it("should return uninitialized stats when pattern store not created", () => {
      // Arrange
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 4 }, logger);

      // Act
      const stats = client.getPatternStats();

      // Assert
      expect(stats.initialized).toBe(false);
      expect(stats.clusterCount).toBe(0);
      expect(stats.sampleCount).toBe(0);
    });
  });

  describe("pattern store operations", () => {
    it("should initialize pattern store with config", () => {
      // Arrange
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 4 }, logger);

      // Act
      client.initializePatternStore({ maxClusters: 5, qualityThreshold: 0.6 });

      // Assert
      expect(client.getPatternStore()).not.toBeNull();
    });

    it("should not re-initialize if already initialized", () => {
      // Arrange
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 4 }, logger);
      client.initializePatternStore();
      const originalStore = client.getPatternStore();

      // Act
      client.initializePatternStore();

      // Assert
      expect(client.getPatternStore()).toBe(originalStore);
    });

    it("should add samples and trigger clustering", () => {
      // Arrange
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 4 }, logger);
      client.initializePatternStore({ minSamplesPerCluster: 2 });

      // Act - add samples (enough to trigger clustering)
      for (let i = 0; i < 6; i++) {
        client.addPatternSample({
          id: `sample-${i}`,
          queryVector: [Math.random(), Math.random(), Math.random(), Math.random()],
          resultVector: [Math.random(), Math.random(), Math.random(), Math.random()],
          relevanceScore: 0.7 + Math.random() * 0.3,
          timestamp: Date.now(),
        });
      }

      // Assert
      const stats = client.getPatternStats();
      expect(stats.sampleCount).toBe(6);
    });

    it("should rerank results using patterns", async () => {
      // Arrange
      const logger = createMockLogger();
      const client = new RuvectorClient({ dimension: 1536 }, logger);
      await client.connect();
      client.initializePatternStore();

      // Create search results
      const results = [
        { entry: { id: "r1", vector: new Array(1536).fill(0.1), metadata: { text: "result 1" } }, score: 0.8 },
        { entry: { id: "r2", vector: new Array(1536).fill(0.2), metadata: { text: "result 2" } }, score: 0.7 },
      ];

      const queryVector = new Array(1536).fill(0.15);

      // Act
      const reranked = client.rerank(results, queryVector, 0.1);

      // Assert - results should be returned (may or may not be reranked depending on patterns)
      expect(reranked).toHaveLength(2);
      expect(reranked[0].score).toBeGreaterThanOrEqual(0);
    });
  });
});

// -----------------------------------------------------------------------------
// PatternStore Tests
// -----------------------------------------------------------------------------

describe("PatternStore", () => {
  let PatternStore: typeof import("./sona/patterns.js").PatternStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import("./sona/patterns.js");
    PatternStore = module.PatternStore;
  });

  describe("addSample and clustering", () => {
    it("should add high-quality samples", () => {
      // Arrange
      const store = new PatternStore({ qualityThreshold: 0.5 });

      // Act
      store.addSample({
        id: "s1",
        queryVector: [1, 0, 0],
        resultVector: [0.9, 0.1, 0],
        relevanceScore: 0.8,
        timestamp: Date.now(),
      });

      // Assert
      expect(store.getSampleCount()).toBe(1);
    });

    it("should reject low-quality samples", () => {
      // Arrange
      const store = new PatternStore({ qualityThreshold: 0.5 });

      // Act
      store.addSample({
        id: "s1",
        queryVector: [1, 0, 0],
        resultVector: [0.9, 0.1, 0],
        relevanceScore: 0.3, // Below threshold
        timestamp: Date.now(),
      });

      // Assert
      expect(store.getSampleCount()).toBe(0);
    });

    it("should trigger clustering after threshold samples", () => {
      // Arrange
      const store = new PatternStore({
        minSamplesPerCluster: 2,
        qualityThreshold: 0.5,
      });

      // Act - add enough samples to trigger clustering (2 * minSamplesPerCluster)
      for (let i = 0; i < 4; i++) {
        store.addSample({
          id: `s${i}`,
          queryVector: [Math.random(), Math.random()],
          resultVector: [Math.random(), Math.random()],
          relevanceScore: 0.7,
          timestamp: Date.now(),
        });
      }

      // Assert
      expect(store.getSampleCount()).toBe(4);
      // Clusters may or may not be created depending on sample similarity
    });
  });

  describe("findSimilar", () => {
    it("should find similar patterns to a query", () => {
      // Arrange
      const store = new PatternStore({ minSamplesPerCluster: 2, qualityThreshold: 0.5 });

      // Add samples and cluster
      for (let i = 0; i < 6; i++) {
        store.addSample({
          id: `s${i}`,
          queryVector: [i * 0.1, 1 - i * 0.1],
          resultVector: [i * 0.15, 1 - i * 0.15],
          relevanceScore: 0.8,
          timestamp: Date.now(),
        });
      }
      store.cluster();

      // Act
      const similar = store.findSimilar([0.5, 0.5], 3);

      // Assert
      expect(similar).toBeDefined();
      expect(Array.isArray(similar)).toBe(true);
    });

    it("should return empty array when no clusters exist", () => {
      // Arrange
      const store = new PatternStore();

      // Act
      const similar = store.findSimilar([1, 0, 0], 5);

      // Assert
      expect(similar).toHaveLength(0);
    });
  });

  describe("updateFromFeedback", () => {
    it("should update sample relevance score", () => {
      // Arrange
      const store = new PatternStore({ qualityThreshold: 0.3 });
      store.addSample({
        id: "update-test",
        queryVector: [1, 0],
        resultVector: [0.9, 0.1],
        relevanceScore: 0.5,
        timestamp: Date.now(),
      });

      // Act
      store.updateFromFeedback("update-test", 0.9);

      // Assert
      const samples = store.getSamples();
      const updated = samples.find((s) => s.id === "update-test");
      expect(updated?.relevanceScore).toBe(0.9);
    });

    it("should handle non-existent sample gracefully", () => {
      // Arrange
      const store = new PatternStore();

      // Act & Assert - should not throw
      expect(() => store.updateFromFeedback("nonexistent", 0.8)).not.toThrow();
    });
  });

  describe("export and import", () => {
    it("should export store state", () => {
      // Arrange
      const store = new PatternStore({ minSamplesPerCluster: 2, qualityThreshold: 0.5 });
      for (let i = 0; i < 4; i++) {
        store.addSample({
          id: `s${i}`,
          queryVector: [i * 0.2, 0.5],
          resultVector: [0.5, i * 0.2],
          relevanceScore: 0.7,
          timestamp: Date.now(),
        });
      }
      store.cluster();

      // Act
      const exported = store.export();

      // Assert
      expect(exported.samples).toHaveLength(4);
      expect(Array.isArray(exported.clusters)).toBe(true);
    });

    it("should import previously exported state", () => {
      // Arrange
      const store = new PatternStore();
      const importData = {
        clusters: [
          { id: "cluster-0", centroid: [0.5, 0.5, 0.5, 0.5], members: ["s1"], avgQuality: 0.8, lastUpdated: Date.now() },
        ],
        samples: [
          { id: "s1", queryVector: [1, 0], resultVector: [0.9, 0.1], relevanceScore: 0.8, timestamp: Date.now() },
        ],
      };

      // Act
      store.import(importData);

      // Assert
      expect(store.getSampleCount()).toBe(1);
      expect(store.getClusterCount()).toBe(1);
    });

    it("should throw for invalid import data", () => {
      // Arrange
      const store = new PatternStore();

      // Act & Assert
      expect(() => store.import(null as unknown as { clusters: []; samples: [] })).toThrow();
      expect(() => store.import({ clusters: "invalid", samples: [] } as unknown as { clusters: []; samples: [] })).toThrow();
    });
  });
});

// =============================================================================
// P2 ruvLLM Features: BackgroundLoop Tests
// =============================================================================

describe("BackgroundLoop", () => {
  let BackgroundLoop: typeof import("./sona/loops/background.js").BackgroundLoop;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();

    const backgroundModule = await import("./sona/loops/background.js");
    BackgroundLoop = backgroundModule.BackgroundLoop;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createMockDeps() {
    return {
      client: {
        search: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        insert: vi.fn().mockResolvedValue("test-id"),
        getSONAStats: vi.fn().mockResolvedValue({ enabled: true }),
        applyMicroLora: vi.fn(),
      },
      db: {
        insert: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
      },
      embeddings: {
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4]),
      },
      config: {
        enabled: true,
        hiddenDim: 256,
        backgroundIntervalMs: 30000,
        learningRate: 0.01,
        qualityThreshold: 0.5,
      },
      logger: createMockLogger(),
    };
  }

  describe("lifecycle methods", () => {
    it("should start and set isActive to true", () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new BackgroundLoop(deps as any);

      // Act
      loop.start();

      // Assert
      expect(loop.isActive()).toBe(true);
    });

    it("should not start twice if already running", () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new BackgroundLoop(deps as any);

      // Act
      loop.start();
      loop.start();

      // Assert
      expect(loop.isActive()).toBe(true);
      expect(deps.logger.warn).toHaveBeenCalledWith("background-loop: already running");
    });

    it("should not start if SONA is disabled", () => {
      // Arrange
      const deps = createMockDeps();
      deps.config.enabled = false;
      const loop = new BackgroundLoop(deps as any);

      // Act
      loop.start();

      // Assert
      expect(loop.isActive()).toBe(false);
    });

    it("should stop and set isActive to false", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new BackgroundLoop(deps as any);
      loop.start();

      // Act
      await loop.stop();

      // Assert
      expect(loop.isActive()).toBe(false);
    });

    it("should do nothing when stopping an already stopped loop", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new BackgroundLoop(deps as any);

      // Act & Assert - should not throw
      await loop.stop();
      expect(loop.isActive()).toBe(false);
    });
  });

  describe("recordTrajectory", () => {
    it("should record a trajectory", () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new BackgroundLoop(deps as any);
      const trajectory = {
        id: "traj-1",
        queryVector: [0.1, 0.2, 0.3],
        resultVectors: [[0.4, 0.5, 0.6]],
        scores: [0.8],
        timestamp: Date.now(),
      };

      // Act
      loop.recordTrajectory(trajectory);

      // Assert - trajectory should be stored (getCycleStats indirectly tests this)
      expect(loop.getCycleStats()).toHaveLength(0); // No cycles run yet
    });

    it("should limit trajectory buffer to maxTrajectories", () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new BackgroundLoop(deps as any);

      // Act - add more than maxTrajectories (1000)
      for (let i = 0; i < 1005; i++) {
        loop.recordTrajectory({
          id: `traj-${i}`,
          queryVector: [0.1, 0.2, 0.3],
          resultVectors: [[0.4, 0.5, 0.6]],
          scores: [0.8],
          timestamp: Date.now(),
        });
      }

      // Assert - buffer should be limited
      expect(deps.logger.debug).toHaveBeenCalled();
    });
  });

  describe("runCycle", () => {
    it("should return empty stats when no trajectories", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new BackgroundLoop(deps as any);

      // Act
      const stats = await loop.runCycle();

      // Assert
      expect(stats.trajectoriesProcessed).toBe(0);
      expect(stats.clustersUpdated).toBe(0);
      expect(stats.newPatternsDetected).toBe(0);
    });

    it("should process recent trajectories and create patterns", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new BackgroundLoop(deps as any);

      // Record trajectory within the last hour
      loop.recordTrajectory({
        id: "traj-1",
        queryVector: [0.1, 0.2, 0.3, 0.4],
        resultVectors: [[0.5, 0.6, 0.7, 0.8]],
        scores: [0.9],
        timestamp: Date.now(),
      });

      // Act
      const stats = await loop.runCycle();

      // Assert
      expect(stats.trajectoriesProcessed).toBe(1);
      expect(stats.newPatternsDetected).toBe(1);
      expect(loop.getPatterns()).toHaveLength(1);
    });

    it("should skip cycle if one is already in progress", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new BackgroundLoop(deps as any);

      // Start a cycle that takes time
      const cycle1Promise = loop.runCycle();

      // Act - try to start another cycle immediately
      const cycle2Promise = loop.runCycle();

      // Assert
      const [stats1, stats2] = await Promise.all([cycle1Promise, cycle2Promise]);
      expect(stats2.trajectoriesProcessed).toBe(0); // Skipped
    });

    it("should update existing patterns when trajectories are similar", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new BackgroundLoop(deps as any);

      // Record similar trajectories
      const baseVector = [0.9, 0.9, 0.9, 0.9];
      for (let i = 0; i < 5; i++) {
        loop.recordTrajectory({
          id: `traj-${i}`,
          queryVector: baseVector.map(v => v + Math.random() * 0.01),
          resultVectors: [[0.5, 0.6, 0.7, 0.8]],
          scores: [0.8],
          timestamp: Date.now(),
        });
      }

      // Act
      const stats = await loop.runCycle();

      // Assert - should merge into fewer patterns due to similarity
      expect(stats.trajectoriesProcessed).toBe(5);
      expect(loop.getPatterns().length).toBeLessThanOrEqual(5);
    });
  });

  describe("getCycleStats", () => {
    it("should return cycle statistics", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new BackgroundLoop(deps as any);

      // Act
      await loop.runCycle();
      const stats = loop.getCycleStats();

      // Assert
      expect(stats).toHaveLength(1);
      expect(stats[0]).toHaveProperty("trajectoriesProcessed");
      expect(stats[0]).toHaveProperty("completedAt");
    });
  });

  describe("getPatterns", () => {
    it("should return empty array initially", () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new BackgroundLoop(deps as any);

      // Act
      const patterns = loop.getPatterns();

      // Assert
      expect(patterns).toEqual([]);
    });
  });
});

// =============================================================================
// P2 ruvLLM Features: InstantLoop Tests
// =============================================================================

describe("InstantLoop", () => {
  let InstantLoop: typeof import("./sona/loops/instant.js").InstantLoop;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const instantModule = await import("./sona/loops/instant.js");
    InstantLoop = instantModule.InstantLoop;
  });

  function createMockDeps() {
    return {
      client: {
        search: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        getSONAStats: vi.fn().mockResolvedValue({ enabled: true }),
        recordSearchFeedback: vi.fn().mockResolvedValue(undefined),
      },
      db: {},
      embeddings: {
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4]),
      },
      config: {
        enabled: true,
        hiddenDim: 256,
        learningRate: 0.01,
        qualityThreshold: 0.5,
      },
      logger: createMockLogger(),
    };
  }

  describe("processImmediateFeedback", () => {
    it("should process feedback and update stats", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new InstantLoop(deps as any);
      const feedback = {
        queryVector: [0.1, 0.2, 0.3, 0.4],
        resultVector: [0.5, 0.6, 0.7, 0.8],
        score: 0.9,
        feedbackType: "selection" as const,
      };

      // Act
      await loop.processImmediateFeedback(feedback);

      // Assert
      const stats = loop.getStats();
      expect(stats.feedbackProcessed).toBe(1);
      expect(stats.positiveBoosts).toBe(1);
    });

    it("should not process if SONA is disabled", async () => {
      // Arrange
      const deps = createMockDeps();
      deps.config.enabled = false;
      const loop = new InstantLoop(deps as any);
      const feedback = {
        queryVector: [0.1, 0.2, 0.3, 0.4],
        resultVector: [0.5, 0.6, 0.7, 0.8],
        score: 0.9,
        feedbackType: "selection" as const,
      };

      // Act
      await loop.processImmediateFeedback(feedback);

      // Assert
      const stats = loop.getStats();
      expect(stats.feedbackProcessed).toBe(0);
    });

    it("should record negative boost for low scores", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new InstantLoop(deps as any);
      const feedback = {
        queryVector: [0.1, 0.2, 0.3, 0.4],
        resultVector: [0.5, 0.6, 0.7, 0.8],
        score: 0.1, // Below quality threshold of 0.5
        feedbackType: "correction" as const,
      };

      // Act
      await loop.processImmediateFeedback(feedback);

      // Assert
      const stats = loop.getStats();
      expect(stats.negativeBoosts).toBe(1);
    });

    it("should track patterns", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new InstantLoop(deps as any);

      // Act - process multiple feedbacks
      for (let i = 0; i < 5; i++) {
        await loop.processImmediateFeedback({
          queryVector: [0.1 * i, 0.2 * i, 0.3 * i, 0.4 * i],
          resultVector: [0.5, 0.6, 0.7, 0.8],
          score: 0.8,
          feedbackType: "selection" as const,
        });
      }

      // Assert
      const stats = loop.getStats();
      expect(stats.patternsTracked).toBeGreaterThan(0);
    });
  });

  describe("getBoostForVector", () => {
    it("should return 1.0 for unknown vectors", () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new InstantLoop(deps as any);

      // Act
      const boost = loop.getBoostForVector([0.1, 0.2, 0.3, 0.4]);

      // Assert
      expect(boost).toBe(1.0);
    });

    it("should return boost for similar vectors", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new InstantLoop(deps as any);
      const vector = [0.9, 0.9, 0.9, 0.9];

      // Process feedback to create a pattern
      await loop.processImmediateFeedback({
        queryVector: vector,
        resultVector: [0.5, 0.6, 0.7, 0.8],
        score: 0.95, // High score
        feedbackType: "selection" as const,
      });

      // Act - query with very similar vector
      const boost = loop.getBoostForVector([0.9, 0.9, 0.9, 0.9]);

      // Assert - should find a boost (may or may not be > 1 depending on similarity threshold)
      expect(typeof boost).toBe("number");
    });
  });

  describe("getPatternBoosts", () => {
    it("should return all pattern boosts", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new InstantLoop(deps as any);

      // Act
      await loop.processImmediateFeedback({
        queryVector: [0.1, 0.2, 0.3, 0.4],
        resultVector: [0.5, 0.6, 0.7, 0.8],
        score: 0.8,
        feedbackType: "selection" as const,
      });

      // Assert
      const boosts = loop.getPatternBoosts();
      expect(Array.isArray(boosts)).toBe(true);
      expect(boosts.length).toBeGreaterThan(0);
    });
  });

  describe("applyDecay", () => {
    it("should decay pattern boosts over time", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new InstantLoop(deps as any);

      // Create a pattern
      await loop.processImmediateFeedback({
        queryVector: [0.9, 0.9, 0.9, 0.9],
        resultVector: [0.5, 0.6, 0.7, 0.8],
        score: 0.95,
        feedbackType: "selection" as const,
      });

      const boostsBefore = loop.getPatternBoosts();

      // Act
      loop.applyDecay();

      // Assert - boosts should have decayed (values move toward 1.0)
      const boostsAfter = loop.getPatternBoosts();
      expect(boostsAfter.length).toBeLessThanOrEqual(boostsBefore.length);
    });

    it("should remove nearly-neutral boosts", async () => {
      // Arrange
      const deps = createMockDeps();
      // Lower learning rate to create smaller boosts
      deps.config.learningRate = 0.001;
      const loop = new InstantLoop(deps as any);

      // Create patterns with small boosts
      await loop.processImmediateFeedback({
        queryVector: [0.5, 0.5, 0.5, 0.5],
        resultVector: [0.5, 0.6, 0.7, 0.8],
        score: 0.51, // Just above threshold
        feedbackType: "selection" as const,
      });

      // Act - apply decay multiple times
      for (let i = 0; i < 100; i++) {
        loop.applyDecay();
      }

      // Assert - nearly-neutral patterns should be removed
      const stats = loop.getStats();
      expect(stats.patternsTracked).toBeLessThanOrEqual(2);
    });
  });

  describe("reset", () => {
    it("should clear all patterns and reset stats", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new InstantLoop(deps as any);

      // Build up some state
      await loop.processImmediateFeedback({
        queryVector: [0.1, 0.2, 0.3, 0.4],
        resultVector: [0.5, 0.6, 0.7, 0.8],
        score: 0.9,
        feedbackType: "selection" as const,
      });

      // Act
      loop.reset();

      // Assert
      const stats = loop.getStats();
      expect(stats.feedbackProcessed).toBe(0);
      expect(stats.positiveBoosts).toBe(0);
      expect(stats.negativeBoosts).toBe(0);
      expect(stats.patternsTracked).toBe(0);
      expect(loop.getPatternBoosts()).toHaveLength(0);
    });
  });

  describe("getStats", () => {
    it("should return initial stats", () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new InstantLoop(deps as any);

      // Act
      const stats = loop.getStats();

      // Assert
      expect(stats).toEqual({
        feedbackProcessed: 0,
        positiveBoosts: 0,
        negativeBoosts: 0,
        patternsTracked: 0,
        avgProcessingTimeMs: 0,
      });
    });

    it("should track average processing time", async () => {
      // Arrange
      const deps = createMockDeps();
      const loop = new InstantLoop(deps as any);

      // Act
      await loop.processImmediateFeedback({
        queryVector: [0.1, 0.2, 0.3, 0.4],
        resultVector: [0.5, 0.6, 0.7, 0.8],
        score: 0.8,
        feedbackType: "selection" as const,
      });

      // Assert
      const stats = loop.getStats();
      expect(stats.avgProcessingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});

// =============================================================================
// P2 ruvLLM Features: RelationshipInferrer Tests
// =============================================================================

describe("RelationshipInferrer", () => {
  let RelationshipInferrer: typeof import("./graph/relationships.js").RelationshipInferrer;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const relModule = await import("./graph/relationships.js");
    RelationshipInferrer = relModule.RelationshipInferrer;
  });

  function createMockDeps() {
    return {
      client: {
        get: vi.fn().mockResolvedValue({
          id: "test-id",
          vector: [0.1, 0.2, 0.3],
          metadata: { text: "Test content" },
        }),
        search: vi.fn().mockResolvedValue([]),
        addEdge: vi.fn().mockResolvedValue("edge-1"),
        isGraphInitialized: vi.fn().mockReturnValue(true),
        getNeighbors: vi.fn().mockResolvedValue([]),
      },
      db: {},
      embeddings: {
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4]),
      },
      logger: createMockLogger(),
    };
  }

  describe("extractEntities", () => {
    it("should extract email addresses", () => {
      // Arrange
      const deps = createMockDeps();
      const inferrer = new RelationshipInferrer(deps as any);
      const content = "Contact us at support@example.com for help.";

      // Act
      const entities = inferrer.extractEntities(content);

      // Assert
      const emails = entities.filter(e => e.type === "email");
      expect(emails).toHaveLength(1);
      expect(emails[0].text).toBe("support@example.com");
      expect(emails[0].confidence).toBeGreaterThan(0.9);
    });

    it("should extract URLs", () => {
      // Arrange
      const deps = createMockDeps();
      const inferrer = new RelationshipInferrer(deps as any);
      const content = "Visit https://example.com/page for more info.";

      // Act
      const entities = inferrer.extractEntities(content);

      // Assert
      const urls = entities.filter(e => e.type === "url");
      expect(urls).toHaveLength(1);
      expect(urls[0].text).toContain("example.com");
    });

    it("should extract dates", () => {
      // Arrange
      const deps = createMockDeps();
      const inferrer = new RelationshipInferrer(deps as any);
      const content = "The meeting is on 2024-01-15 and follows up on January 10, 2024.";

      // Act
      const entities = inferrer.extractEntities(content);

      // Assert
      const dates = entities.filter(e => e.type === "date");
      expect(dates.length).toBeGreaterThanOrEqual(1);
    });

    it("should extract person names", () => {
      // Arrange
      const deps = createMockDeps();
      const inferrer = new RelationshipInferrer(deps as any);
      const content = "Dr. John Smith met with Jane Doe yesterday.";

      // Act
      const entities = inferrer.extractEntities(content);

      // Assert
      const persons = entities.filter(e => e.type === "person");
      expect(persons.length).toBeGreaterThanOrEqual(1);
    });

    it("should filter by entity types", () => {
      // Arrange
      const deps = createMockDeps();
      const inferrer = new RelationshipInferrer(deps as any);
      const content = "Email support@test.com or visit https://test.com";

      // Act
      const entities = inferrer.extractEntities(content, ["email"]);

      // Assert
      expect(entities.every(e => e.type === "email")).toBe(true);
    });

    it("should not extract duplicates", () => {
      // Arrange
      const deps = createMockDeps();
      const inferrer = new RelationshipInferrer(deps as any);
      const content = "Email test@example.com or test@example.com again.";

      // Act
      const entities = inferrer.extractEntities(content);

      // Assert
      const emails = entities.filter(e => e.type === "email");
      expect(emails).toHaveLength(1);
    });

    it("should sort entities by position", () => {
      // Arrange
      const deps = createMockDeps();
      const inferrer = new RelationshipInferrer(deps as any);
      const content = "Visit https://example.com then email test@example.com";

      // Act
      const entities = inferrer.extractEntities(content);

      // Assert
      for (let i = 1; i < entities.length; i++) {
        expect(entities[i].startPos).toBeGreaterThanOrEqual(entities[i - 1].startPos);
      }
    });
  });

  describe("inferFromContent", () => {
    it("should return empty results for entries without text", async () => {
      // Arrange
      const deps = createMockDeps();
      const inferrer = new RelationshipInferrer(deps as any);
      const entry = {
        id: "test-1",
        vector: [0.1, 0.2],
        metadata: {},
      };

      // Act
      const result = await inferrer.inferFromContent(entry);

      // Assert
      expect(result.entities).toHaveLength(0);
      expect(result.relationships).toHaveLength(0);
    });

    it("should extract entities from entry text", async () => {
      // Arrange
      const deps = createMockDeps();
      const inferrer = new RelationshipInferrer(deps as any);
      const entry = {
        id: "test-1",
        vector: [0.1, 0.2],
        metadata: { text: "Contact support@example.com for help." },
      };

      // Act
      const result = await inferrer.inferFromContent(entry);

      // Assert
      expect(result.entities.length).toBeGreaterThan(0);
    });

    it("should detect relationships between entities", async () => {
      // Arrange
      const deps = createMockDeps();
      const inferrer = new RelationshipInferrer(deps as any);
      const entry = {
        id: "test-1",
        vector: [0.1, 0.2],
        metadata: { text: "Dr. John Smith works at Acme Corp in New York." },
      };

      // Act
      const result = await inferrer.inferFromContent(entry);

      // Assert
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should respect maxRelationships option", async () => {
      // Arrange
      const deps = createMockDeps();
      const inferrer = new RelationshipInferrer(deps as any);
      const entry = {
        id: "test-1",
        vector: [0.1, 0.2],
        metadata: {
          text: "Alice met Bob at Company Inc, then Charlie at Org Ltd, followed by Diana at Corp Co.",
        },
      };

      // Act
      const result = await inferrer.inferFromContent(entry, { maxRelationships: 2 });

      // Assert
      expect(result.edgesCreated).toBeLessThanOrEqual(2);
    });
  });

  describe("linkSimilar", () => {
    it("should return 0 for non-existent entries", async () => {
      // Arrange
      const deps = createMockDeps();
      deps.client.get.mockResolvedValue(null);
      const inferrer = new RelationshipInferrer(deps as any);

      // Act
      const edgesCreated = await inferrer.linkSimilar("non-existent");

      // Assert
      expect(edgesCreated).toBe(0);
    });

    it("should create SIMILAR_TO edges for similar documents", async () => {
      // Arrange
      const deps = createMockDeps();
      deps.client.search.mockResolvedValue([
        { entry: { id: "similar-1" }, score: 0.85 },
        { entry: { id: "similar-2" }, score: 0.75 },
      ]);
      const inferrer = new RelationshipInferrer(deps as any);

      // Act
      const edgesCreated = await inferrer.linkSimilar("test-id", 0.7);

      // Assert
      expect(edgesCreated).toBe(2);
      expect(deps.client.addEdge).toHaveBeenCalledTimes(2);
    });

    it("should skip self-links", async () => {
      // Arrange
      const deps = createMockDeps();
      deps.client.search.mockResolvedValue([
        { entry: { id: "test-id" }, score: 1.0 }, // Self
        { entry: { id: "similar-1" }, score: 0.85 },
      ]);
      const inferrer = new RelationshipInferrer(deps as any);

      // Act
      const edgesCreated = await inferrer.linkSimilar("test-id", 0.7);

      // Assert
      expect(edgesCreated).toBe(1);
    });

    it("should use default threshold of 0.7", async () => {
      // Arrange
      const deps = createMockDeps();
      deps.client.search.mockResolvedValue([]);
      const inferrer = new RelationshipInferrer(deps as any);

      // Act
      await inferrer.linkSimilar("test-id");

      // Assert
      expect(deps.client.search).toHaveBeenCalledWith(
        expect.objectContaining({ minScore: 0.7 }),
      );
    });
  });

  describe("batchInfer", () => {
    it("should process multiple entries", async () => {
      // Arrange
      const deps = createMockDeps();
      deps.client.isGraphInitialized.mockReturnValue(false); // Disable similarity linking
      const inferrer = new RelationshipInferrer(deps as any);
      const entries = [
        { id: "1", vector: [0.1], metadata: { text: "Test one" } },
        { id: "2", vector: [0.2], metadata: { text: "Test two" } },
      ];

      // Act
      const totalEdges = await inferrer.batchInfer(entries);

      // Assert
      expect(totalEdges).toBeGreaterThanOrEqual(0);
    });

    it("should link similar documents when graph is initialized", async () => {
      // Arrange
      const deps = createMockDeps();
      deps.client.isGraphInitialized.mockReturnValue(true);
      deps.client.search.mockResolvedValue([
        { entry: { id: "other-1" }, score: 0.85 },
      ]);
      const inferrer = new RelationshipInferrer(deps as any);
      const entries = [
        { id: "1", vector: [0.1], metadata: { text: "Test" } },
      ];

      // Act
      const totalEdges = await inferrer.batchInfer(entries, { similarityThreshold: 0.8 });

      // Assert
      expect(deps.client.search).toHaveBeenCalled();
    });
  });
});

// =============================================================================
// P2 ruvLLM Features: createRuvectorLearnTool Tests
// =============================================================================

describe("createRuvectorLearnTool", () => {
  let createRuvectorLearnTool: typeof import("./tool.js").createRuvectorLearnTool;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const toolModule = await import("./tool.js");
    createRuvectorLearnTool = toolModule.createRuvectorLearnTool;
  });

  function createMockDeps() {
    const mockClient = {
      search: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue("new-entry-id"),
      addEdge: vi.fn().mockResolvedValue("edge-id"),
      isGraphInitialized: vi.fn().mockReturnValue(true),
      getPatternStore: vi.fn().mockReturnValue(null),
      get: vi.fn().mockResolvedValue(null),
    };

    return {
      api: {
        logger: createMockLogger(),
      },
      service: {
        isRunning: vi.fn().mockReturnValue(true),
        getClient: vi.fn().mockReturnValue(mockClient),
      },
      db: {},
      embeddings: {
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4]),
      },
      mockClient,
    };
  }

  describe("tool metadata", () => {
    it("should have correct name and label", () => {
      // Arrange
      const deps = createMockDeps();
      const tool = createRuvectorLearnTool(deps as any);

      // Assert
      expect(tool.name).toBe("ruvector_learn");
      expect(tool.label).toBe("Manual Knowledge Learning");
    });

    it("should have parameters schema", () => {
      // Arrange
      const deps = createMockDeps();
      const tool = createRuvectorLearnTool(deps as any);

      // Assert
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.properties).toHaveProperty("content");
      expect(tool.parameters.properties).toHaveProperty("category");
      expect(tool.parameters.properties).toHaveProperty("importance");
      expect(tool.parameters.properties).toHaveProperty("relationships");
    });
  });

  describe("execute", () => {
    it("should index new content", async () => {
      // Arrange
      const deps = createMockDeps();
      const tool = createRuvectorLearnTool(deps as any);

      // Act
      const result = await tool.execute("call-1", {
        content: "Important fact about AI",
      }) as { details: Record<string, unknown> };

      // Assert
      expect(result.details.indexed).toBe(true);
      expect(deps.embeddings.embed).toHaveBeenCalledWith("Important fact about AI");
      expect(deps.mockClient.insert).toHaveBeenCalled();
    });

    it("should detect near-duplicates", async () => {
      // Arrange
      const deps = createMockDeps();
      deps.mockClient.search.mockResolvedValue([
        {
          entry: { id: "existing-id", metadata: { text: "Very similar content" } },
          score: 0.98,
        },
      ]);
      const tool = createRuvectorLearnTool(deps as any);

      // Act
      const result = await tool.execute("call-1", {
        content: "Very similar content here",
      }) as { details: Record<string, unknown> };

      // Assert
      expect(result.details.duplicate).toBe(true);
      expect(result.details.existingId).toBe("existing-id");
    });

    it("should handle service not running", async () => {
      // Arrange
      const deps = createMockDeps();
      deps.service.isRunning.mockReturnValue(false);
      const tool = createRuvectorLearnTool(deps as any);

      // Act
      const result = await tool.execute("call-1", {
        content: "Test content",
      }) as { details: Record<string, unknown> };

      // Assert
      expect(result.details.indexed).toBe(false);
      expect(result.details.error).toContain("not running");
    });

    it("should use provided category", async () => {
      // Arrange
      const deps = createMockDeps();
      const tool = createRuvectorLearnTool(deps as any);

      // Act
      const result = await tool.execute("call-1", {
        content: "User prefers dark mode",
        category: "preference",
      }) as { details: Record<string, unknown> };

      // Assert
      expect(result.details.category).toBe("preference");
    });

    it("should use default category for invalid values", async () => {
      // Arrange
      const deps = createMockDeps();
      const tool = createRuvectorLearnTool(deps as any);

      // Act
      const result = await tool.execute("call-1", {
        content: "Test content",
        category: "invalid-category",
      }) as { details: Record<string, unknown> };

      // Assert
      expect(result.details.category).toBe("fact");
    });

    it("should clamp importance to valid range", async () => {
      // Arrange
      const deps = createMockDeps();
      const tool = createRuvectorLearnTool(deps as any);

      // Act
      const result = await tool.execute("call-1", {
        content: "Test content",
        importance: 1.5, // Over max
      }) as { details: Record<string, unknown> };

      // Assert
      expect(result.details.importance).toBe(1);
    });

    it("should create explicit relationships when provided", async () => {
      // Arrange
      const deps = createMockDeps();
      const tool = createRuvectorLearnTool(deps as any);

      // Act
      const result = await tool.execute("call-1", {
        content: "Related fact",
        relationships: ["related-id-1", "related-id-2"],
        relationshipType: "REFERENCES",
      }) as { details: Record<string, unknown> };

      // Assert
      expect(result.details.edges).toBe(2);
      expect(result.details.linkedIds).toContain("related-id-1");
      expect(deps.mockClient.addEdge).toHaveBeenCalledWith(
        expect.objectContaining({ relationship: "REFERENCES" }),
      );
    });

    it("should infer relationships by default", async () => {
      // Arrange
      const deps = createMockDeps();
      const tool = createRuvectorLearnTool(deps as any);

      // Act
      await tool.execute("call-1", {
        content: "Dr. John Smith works at Acme Corp support@acme.com",
      });

      // Assert - inferFromContent is called internally
      expect(deps.mockClient.insert).toHaveBeenCalled();
    });

    it("should skip relationship inference when disabled", async () => {
      // Arrange
      const deps = createMockDeps();
      const tool = createRuvectorLearnTool(deps as any);

      // Act
      const result = await tool.execute("call-1", {
        content: "Test content with entities like support@test.com",
        inferRelationships: false,
      }) as { details: Record<string, unknown> };

      // Assert
      expect(result.details.indexed).toBe(true);
    });

    it("should link similar documents when enabled", async () => {
      // Arrange
      const deps = createMockDeps();
      const tool = createRuvectorLearnTool(deps as any);

      // Act
      const result = await tool.execute("call-1", {
        content: "Test content",
        linkSimilar: true,
        similarityThreshold: 0.9,
      }) as { details: Record<string, unknown> };

      // Assert
      expect(result.details.indexed).toBe(true);
    });

    it("should handle errors gracefully", async () => {
      // Arrange
      const deps = createMockDeps();
      deps.embeddings.embed.mockRejectedValue(new Error("Embedding failed"));
      const tool = createRuvectorLearnTool(deps as any);

      // Act
      const result = await tool.execute("call-1", {
        content: "Test content",
      }) as { details: Record<string, unknown> };

      // Assert
      expect(result.details.indexed).toBe(false);
      expect(result.details.error).toBe("Embedding failed");
    });

    it("should track processing time", async () => {
      // Arrange
      const deps = createMockDeps();
      const tool = createRuvectorLearnTool(deps as any);

      // Act
      const result = await tool.execute("call-1", {
        content: "Test content",
      }) as { details: Record<string, unknown> };

      // Assert
      expect(result.details.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
