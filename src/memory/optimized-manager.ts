import type { ContextHierarchyManager } from "./context-hierarchy.js";

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
  hits: number;
  lastAccessed: number;
}

export interface PerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  memoryUsage: number;
  queryCount: number;
  errorCount: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 3600000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      ttl: ttl ?? this.defaultTTL,
      hits: 0,
      lastAccessed: now
    };

    // Evict if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, entry);
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      return undefined;
    }

    const now = Date.now();
    
    // Check if entry has expired
    if (entry.ttl && (now - entry.timestamp) > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access stats
    entry.hits++;
    entry.lastAccessed = now;

    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (entry.ttl && (now - entry.timestamp) > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  getStats(): {
    size: number;
    hitRate: number;
    totalHits: number;
    averageAge: number;
  } {
    const now = Date.now();
    let totalHits = 0;
    let totalAge = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalAge += (now - entry.timestamp);
    }

    const averageAge = this.cache.size > 0 ? totalAge / this.cache.size : 0;
    const hitRate = totalHits > 0 ? totalHits / (totalHits + this.cache.size) : 0;

    return {
      size: this.cache.size,
      hitRate,
      totalHits,
      averageAge
    };
  }
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    queryCount: 0,
    errorCount: 0
  };

  private responseTimes: number[] = [];
  private maxSamples: number = 100;

  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  recordResponseTime(timeMs: number): void {
    this.responseTimes.push(timeMs);
    if (this.responseTimes.length > this.maxSamples) {
      this.responseTimes.shift();
    }
    
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageResponseTime = sum / this.responseTimes.length;
  }

  recordQuery(): void {
    this.metrics.queryCount++;
  }

  recordError(): void {
    this.metrics.errorCount++;
  }

  updateMemoryUsage(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      this.metrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    }
  }

  getMetrics(): PerformanceMetrics {
    this.updateMemoryUsage();
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      queryCount: 0,
      errorCount: 0
    };
    this.responseTimes = [];
  }
}

export class OptimizedMemoryManager {
  private cacheManager: CacheManager;
  private performanceMonitor: PerformanceMonitor;
  private contextManager: ContextHierarchyManager;

  constructor(
    cacheManager?: CacheManager,
    performanceMonitor?: PerformanceMonitor,
    contextManager?: ContextHierarchyManager
  ) {
    this.cacheManager = cacheManager ?? new CacheManager();
    this.performanceMonitor = performanceMonitor ?? new PerformanceMonitor();
    this.contextManager = contextManager ?? (() => {
      // Lazy import to avoid circular dependencies
      const { getContextManager } = require("./context-hierarchy.js");
      return getContextManager();
    })();
  }

  async getWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const startTime = Date.now();
    this.performanceMonitor.recordQuery();

    // Try cache first
    const cached = this.cacheManager.get<T>(key);
    if (cached !== undefined) {
      this.performanceMonitor.recordCacheHit();
      this.performanceMonitor.recordResponseTime(Date.now() - startTime);
      return cached;
    }

    this.performanceMonitor.recordCacheMiss();
    
    // Fetch fresh data
    try {
      const result = await fetcher();
      this.cacheManager.set(key, result, ttl);
      
      const responseTime = Date.now() - startTime;
      this.performanceMonitor.recordResponseTime(responseTime);
      
      return result;
    } catch (error) {
      this.performanceMonitor.recordError();
      throw error;
    }
  }

  invalidate(key: string): boolean {
    return this.cacheManager.delete(key);
  }

  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cacheManager['cache'].keys()) {
      if (pattern.test(key)) {
        this.cacheManager.delete(key);
        count++;
      }
    }
    return count;
  }

  getCacheStats() {
    return this.cacheManager.getStats();
  }

  getPerformanceMetrics() {
    return this.performanceMonitor.getMetrics();
  }

  getContextHierarchy() {
    return this.contextManager.getTree();
  }

  optimize(): void {
    // Perform optimization routines
    this.performanceMonitor.updateMemoryUsage();
    
    // In practice, this would run various optimization strategies
    console.log('Optimization routine executed');
  }
}