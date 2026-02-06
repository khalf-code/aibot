export { MemoryIndexManager } from "./manager.js";
export type {
  MemoryEmbeddingProbeResult,
  MemorySearchManager,
  MemorySearchResult,
} from "./types.js";
export { getMemorySearchManager, type MemorySearchManagerResult } from "./search-manager.js";

// Optimized memory system exports
export { EnhancedEmbeddingCache } from "./embedding-cache.js";
export type { EmbeddingCacheStats } from "./embedding-cache.js";

export { ContextHierarchyManager, getContextManager } from "./context-hierarchy.js";
export type { ModuleType, ContextLevel } from "./context-hierarchy.js";

export { OptimizedMemoryManager, CacheManager, PerformanceMonitor } from "./optimized-manager.js";
export { LazyProviderLoader, createDefaultLazyLoader } from "./lazy-providers.js";

export { initializeOptimizedMemorySystem, getSystemStatus, optimizationUtils } from "./optimized-index.js";

// Memory quality and optimization exports
export { memoryQualityManager, MemoryQualityManager } from "./memory-quality-manager.js";
export type { ContentAnalysis, MemoryQualityMetrics, QualityScore, ContentType } from "./memory-quality-manager.js";

export { createMemoryOptimizer, MemoryOptimizer } from "./memory-optimizer.js";
export type { OptimizationConfig, OptimizationResult } from "./memory-optimizer.js";
