export interface ProviderConfig {
  id: string;
  name: string;
  type: 'embedding' | 'search' | 'cache' | 'index';
  enabled: boolean;
  priority: number;
  config: Record<string, any>;
}

export interface LazyProvider<T = any> {
  id: string;
  name: string;
  type: string;
  isLoaded: boolean;
  instance: T | null;
  load: () => Promise<T>;
  unload: () => Promise<void>;
  config: ProviderConfig;
}

export class LazyProviderLoader {
  private providers: Map<string, LazyProvider> = new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();

  constructor(initialProviders: ProviderConfig[] = []) {
    initialProviders.forEach(config => {
      this.registerProvider(config);
    });
  }

  registerProvider(config: ProviderConfig): string {
    const provider: LazyProvider = {
      id: config.id,
      name: config.name,
      type: config.type,
      isLoaded: false,
      instance: null,
      config,
      load: async () => {
        throw new Error(`Provider ${config.id} load method not implemented`);
      },
      unload: async () => {
        throw new Error(`Provider ${config.id} unload method not implemented`);
      }
    };

    this.providers.set(config.id, provider);
    return config.id;
  }

  async getProvider<T>(id: string): Promise<T> {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider ${id} not found`);
    }

    // If already loading, return the existing promise
    if (this.loadingPromises.has(id)) {
      return this.loadingPromises.get(id) as Promise<T>;
    }

    // If already loaded, return the instance
    if (provider.isLoaded && provider.instance) {
      return provider.instance as T;
    }

    // Load the provider
    const loadPromise = (async () => {
      try {
        const instance = await provider.load();
        provider.instance = instance;
        provider.isLoaded = true;
        return instance;
      } finally {
        this.loadingPromises.delete(id);
      }
    })();

    this.loadingPromises.set(id, loadPromise);
    return loadPromise as Promise<T>;
  }

  async loadProvider(id: string): Promise<void> {
    await this.getProvider(id);
  }

  async unloadProvider(id: string): Promise<void> {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider ${id} not found`);
    }

    if (provider.isLoaded) {
      await provider.unload();
      provider.instance = null;
      provider.isLoaded = false;
    }

    // Cancel any pending load
    this.loadingPromises.delete(id);
  }

  async unloadAll(): Promise<void> {
    const unloadPromises = Array.from(this.providers.values())
      .filter(p => p.isLoaded)
      .map(p => this.unloadProvider(p.id));
    
    await Promise.allSettled(unloadPromises);
  }

  isProviderLoaded(id: string): boolean {
    const provider = this.providers.get(id);
    return provider?.isLoaded ?? false;
  }

  getProviderConfig(id: string): ProviderConfig | undefined {
    const provider = this.providers.get(id);
    return provider?.config;
  }

  updateProviderConfig(id: string, updates: Partial<ProviderConfig>): boolean {
    const provider = this.providers.get(id);
    if (!provider) return false;

    provider.config = { ...provider.config, ...updates };
    return true;
  }

  listProviders(): LazyProvider[] {
    return Array.from(this.providers.values());
  }

  listLoadedProviders(): LazyProvider[] {
    return Array.from(this.providers.values())
      .filter(p => p.isLoaded);
  }

  async reloadProvider(id: string): Promise<void> {
    await this.unloadProvider(id);
    await this.loadProvider(id);
  }

  setProviderLoader(
    id: string,
    loader: () => Promise<any>,
    unloader?: () => Promise<void>
  ): boolean {
    const provider = this.providers.get(id);
    if (!provider) return false;

    provider.load = loader;
    if (unloader) {
      provider.unload = unloader;
    }

    return true;
  }
}

// Default provider implementations

export async function createDefaultEmbeddingProvider(config: ProviderConfig): Promise<any> {
  // This would create an actual embedding provider
  // For now, return a mock
  return {
    embed: async (text: string) => {
      console.log(`Embedding text: ${text.substring(0, 50)}...`);
      return new Array(1536).fill(0).map(() => Math.random());
    },
    batchEmbed: async (texts: string[]) => {
      return texts.map(text => new Array(1536).fill(0).map(() => Math.random()));
    }
  };
}

export async function createDefaultSearchProvider(config: ProviderConfig): Promise<any> {
  return {
    search: async (query: string, options: any = {}) => {
      console.log(`Searching for: ${query}`);
      return {
        results: [],
        total: 0,
        queryTime: 0
      };
    },
    index: async (documents: any[]) => {
      console.log(`Indexing ${documents.length} documents`);
      return { success: true, count: documents.length };
    }
  };
}

export function createDefaultLazyLoader(): LazyProviderLoader {
  const loader = new LazyProviderLoader([
    {
      id: 'default-embedding',
      name: 'Default Embedding Provider',
      type: 'embedding',
      enabled: true,
      priority: 1,
      config: { model: 'text-embedding-ada-002', dimensions: 1536 }
    },
    {
      id: 'default-search',
      name: 'Default Search Provider',
      type: 'search',
      enabled: true,
      priority: 2,
      config: { engine: 'vector', similarityThreshold: 0.7 }
    },
    {
      id: 'default-cache',
      name: 'Default Cache Provider',
      type: 'cache',
      enabled: true,
      priority: 3,
      config: { maxSize: 1000, ttl: 3600000 }
    }
  ]);

  // Set up loaders for default providers
  loader.setProviderLoader(
    'default-embedding',
    () => createDefaultEmbeddingProvider(loader.getProviderConfig('default-embedding')!)
  );

  loader.setProviderLoader(
    'default-search',
    () => createDefaultSearchProvider(loader.getProviderConfig('default-search')!)
  );

  loader.setProviderLoader(
    'default-cache',
    async () => {
      const { CacheManager } = await import('./optimized-manager.js');
      const config = loader.getProviderConfig('default-cache')!;
      return new CacheManager(config.config.maxSize, config.config.ttl);
    }
  );

  return loader;
}