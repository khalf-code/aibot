import type { ContextHierarchyManager } from "./context-hierarchy.js";
import { OptimizedMemoryManager, CacheManager, PerformanceMonitor } from "./optimized-manager.js";
import type { LazyProviderLoader } from "./lazy-providers.js";

export interface SystemStatus {
  initialized: boolean;
  cacheEnabled: boolean;
  providersLoaded: number;
  totalProviders: number;
  memoryUsage: number;
  uptime: number;
  lastOptimization: Date | null;
  errors: string[];
}

export interface OptimizationConfig {
  cacheEnabled: boolean;
  maxCacheSize: number;
  defaultTTL: number;
  autoOptimizeInterval: number;
  lazyLoading: boolean;
  providerPriorities: Record<string, number>;
}

export class OptimizedMemorySystem {
  private static instance: OptimizedMemorySystem | null = null;
  
  private contextManager: ContextHierarchyManager;
  private cacheManager: CacheManager;
  private performanceMonitor: PerformanceMonitor;
  private optimizedManager: OptimizedMemoryManager;
  private providerLoader: LazyProviderLoader;
  
  private config: OptimizationConfig;
  private initialized: boolean = false;
  private startTime: number = 0;
  private lastOptimization: Date | null = null;
  private errors: string[] = [];

  private constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      cacheEnabled: true,
      maxCacheSize: 1000,
      defaultTTL: 3600000,
      autoOptimizeInterval: 300000, // 5 minutes
      lazyLoading: true,
      providerPriorities: {},
      ...config
    };

    // Initialize components
    const { getContextManager } = require("./context-hierarchy.js");
    this.contextManager = getContextManager();
    
    this.cacheManager = new CacheManager(
      this.config.maxCacheSize,
      this.config.defaultTTL
    );
    
    this.performanceMonitor = new PerformanceMonitor();
    
    this.optimizedManager = new OptimizedMemoryManager(
      this.cacheManager,
      this.performanceMonitor,
      this.contextManager
    );

    const { createDefaultLazyLoader } = require("./lazy-providers.js");
    this.providerLoader = createDefaultLazyLoader();
  }

  static getInstance(config?: Partial<OptimizationConfig>): OptimizedMemorySystem {
    if (!OptimizedMemorySystem.instance) {
      OptimizedMemorySystem.instance = new OptimizedMemorySystem(config);
    }
    return OptimizedMemorySystem.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.startTime = Date.now();
      
      // Initialize context hierarchy
      this.contextManager.addNode({
        id: 'optimized-system',
        type: 'system',
        level: 'global',
        parentId: 'system-root',
        metadata: { 
          version: '1.0.0',
          config: this.config 
        }
      });

      // Load essential providers if not lazy loading
      if (!this.config.lazyLoading) {
        await this.providerLoader.loadProvider('default-cache');
        await this.providerLoader.loadProvider('default-embedding');
      }

      this.initialized = true;
      console.log('Optimized memory system initialized');
      
    } catch (error) {
      this.errors.push(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.config.cacheEnabled) {
      return await fetcher();
    }

    return this.optimizedManager.getWithCache(key, fetcher, ttl);
  }

  async loadProvider(providerId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.providerLoader.loadProvider(providerId);
  }

  async unloadProvider(providerId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.providerLoader.unloadProvider(providerId);
  }

  getProvider<T>(providerId: string): Promise<T> {
    if (!this.initialized) {
      return this.initialize().then(() => this.providerLoader.getProvider<T>(providerId));
    }

    return this.providerLoader.getProvider<T>(providerId);
  }

  getSystemStatus(): SystemStatus {
    const now = Date.now();
    const loadedProviders = this.providerLoader.listLoadedProviders();
    const allProviders = this.providerLoader.listProviders();

    let memoryUsage = 0;
    if (typeof process !== 'undefined' && process.memoryUsage) {
      memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    }

    return {
      initialized: this.initialized,
      cacheEnabled: this.config.cacheEnabled,
      providersLoaded: loadedProviders.length,
      totalProviders: allProviders.length,
      memoryUsage,
      uptime: this.initialized ? now - this.startTime : 0,
      lastOptimization: this.lastOptimization,
      errors: [...this.errors]
    };
  }

  async optimize(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Run optimization routines
      this.optimizedManager.optimize();
      
      // Unload unused providers if memory is high
      const status = this.getSystemStatus();
      if (status.memoryUsage > 100) { // 100 MB threshold
        const loadedProviders = this.providerLoader.listLoadedProviders();
        const lowPriorityProviders = loadedProviders.filter(
          p => (this.config.providerPriorities[p.id] ?? 5) > 3
        );
        
        for (const provider of lowPriorityProviders) {
          await this.providerLoader.unloadProvider(provider.id);
        }
      }

      this.lastOptimization = new Date();
      console.log('System optimization completed');
      
    } catch (error) {
      this.errors.push(`Optimization failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  invalidateCache(key: string): boolean {
    return this.optimizedManager.invalidate(key);
  }

  invalidateCachePattern(pattern: RegExp): number {
    return this.optimizedManager.invalidatePattern(pattern);
  }

  clearCache(): void {
    this.cacheManager.clear();
  }

  getCacheStats() {
    return this.optimizedManager.getCacheStats();
  }

  getPerformanceMetrics() {
    return this.optimizedManager.getPerformanceMetrics();
  }

  getContextHierarchy() {
    return this.optimizedManager.getContextHierarchy();
  }

  updateConfig(updates: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Update cache manager if config changed
    if (updates.maxCacheSize !== undefined || updates.defaultTTL !== undefined) {
      this.cacheManager = new CacheManager(
        this.config.maxCacheSize,
        this.config.defaultTTL
      );
      this.optimizedManager = new OptimizedMemoryManager(
        this.cacheManager,
        this.performanceMonitor,
        this.contextManager
      );
    }
  }

  getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  async shutdown(): Promise<void> {
    try {
      await this.providerLoader.unloadAll();
      this.clearCache();
      this.initialized = false;
      console.log('Optimized memory system shutdown');
    } catch (error) {
      this.errors.push(`Shutdown failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

// Utility functions
export const optimizationUtils = {
  generateCacheKey(prefix: string, ...args: any[]): string {
    const argsString = args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg);
      }
      return String(arg);
    }).join(':');
    
    return `${prefix}:${Buffer.from(argsString).toString('base64').slice(0, 32)}`;
  },

  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        func(...args);
        timeout = null;
      }, wait);
    };
  },

  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean = false;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  },

  memoize<T extends (...args: any[]) => any>(
    func: T,
    keyGenerator?: (...args: Parameters<T>) => string
  ): T {
    const cache = new Map<string, ReturnType<T>>();
    
    return ((...args: Parameters<T>): ReturnType<T> => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key)!;
      }
      
      const result = func(...args);
      cache.set(key, result);
      return result;
    }) as T;
  }
};

// Export singleton instance and initialization function
let systemInstance: OptimizedMemorySystem | null = null;

export async function initializeOptimizedMemorySystem(
  config?: Partial<OptimizationConfig>
): Promise<OptimizedMemorySystem> {
  if (!systemInstance) {
    systemInstance = OptimizedMemorySystem.getInstance(config);
    await systemInstance.initialize();
  }
  return systemInstance;
}

export function getSystemStatus(): SystemStatus {
  if (!systemInstance) {
    return {
      initialized: false,
      cacheEnabled: false,
      providersLoaded: 0,
      totalProviders: 0,
      memoryUsage: 0,
      uptime: 0,
      lastOptimization: null,
      errors: ['System not initialized']
    };
  }
  
  return systemInstance.getSystemStatus();
}

export async function shutdownOptimizedMemorySystem(): Promise<void> {
  if (systemInstance) {
    await systemInstance.shutdown();
    systemInstance = null;
  }
}