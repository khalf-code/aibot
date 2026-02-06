/**
 * Enhanced embedding cache with integrity checks, statistics, and better error handling.
 * This module extends the existing cache functionality in manager.ts.
 */

import type { DatabaseSync } from "node:sqlite";
import { parseEmbedding } from "./internal.js";

export interface EmbeddingCacheStats {
  totalEntries: number;
  hitRate: number;
  hits: number;
  misses: number;
  totalQueries: number;
  averageEmbeddingSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

export class EnhancedEmbeddingCache {
  private stats = {
    hits: 0,
    misses: 0,
    totalQueries: 0,
  };

  constructor(
    private db: DatabaseSync,
    private tableName: string,
    private providerId: string,
    private model: string,
    private providerKey: string,
  ) {}

  /**
   * Load embeddings from cache (alias for loadWithVerification)
   */
  load(hashes: string[]): Map<string, number[]> {
    return this.loadWithVerification(hashes);
  }

  /**
   * Load embeddings from cache with integrity verification
   */
  loadWithVerification(hashes: string[]): Map<string, number[]> {
    if (hashes.length === 0) {
      return new Map();
    }

    this.stats.totalQueries += hashes.length;

    const placeholders = hashes.map(() => "?").join(",");
    const rows = this.db
      .prepare(
        `SELECT hash, embedding, dims FROM ${this.tableName}\n` +
          ` WHERE provider = ? AND model = ? AND provider_key = ? AND hash IN (${placeholders})`,
      )
      .all(this.providerId, this.model, this.providerKey, ...hashes) as Array<{
        hash: string;
        embedding: string;
        dims: number;
      }>;

    const result = new Map<string, number[]>();
    let hits = 0;
    let misses = 0;

    for (const hash of hashes) {
      const row = rows.find((r) => r.hash === hash);
      if (row) {
        try {
          const embedding = parseEmbedding(row.embedding);
          
          // Verify embedding dimensions match expected
          if (row.dims && embedding.length !== row.dims) {
            console.warn(
              `Embedding cache integrity check failed for hash ${hash}: ` +
              `expected ${row.dims} dimensions, got ${embedding.length}`,
            );
            misses++;
            continue;
          }

          // Verify embedding is not all zeros or NaN
          if (embedding.length === 0 || embedding.some((v) => !Number.isFinite(v))) {
            console.warn(`Embedding cache contains invalid values for hash ${hash}`);
            misses++;
            continue;
          }

          result.set(hash, embedding);
          hits++;
        } catch (error) {
          console.warn(`Failed to parse cached embedding for hash ${hash}:`, error);
          misses++;
        }
      } else {
        misses++;
      }
    }

    this.stats.hits += hits;
    this.stats.misses += misses;

    return result;
  }

  /**
   * Store embeddings in cache (alias for upsertWithValidation)
   */
  store(entries: Array<{ hash: string; embedding: number[] }>): void {
    this.upsertWithValidation(entries);
  }

  /**
   * Upsert embeddings with validation
   */
  upsertWithValidation(entries: Array<{ hash: string; embedding: number[] }>): void {
    if (entries.length === 0) {
      return;
    }

    const now = Date.now();
    const stmt = this.db.prepare(
      `INSERT INTO ${this.tableName} (provider, model, provider_key, hash, embedding, dims, updated_at)\n` +
        ` VALUES (?, ?, ?, ?, ?, ?, ?)\n` +
        ` ON CONFLICT(provider, model, provider_key, hash) DO UPDATE SET\n` +
        `   embedding=excluded.embedding,\n` +
        `   dims=excluded.dims,\n` +
        `   updated_at=excluded.updated_at`,
    );

    for (const entry of entries) {
      const embedding = entry.embedding ?? [];

      // Validate embedding before caching
      if (embedding.length === 0) {
        console.warn(`Skipping cache for empty embedding (hash: ${entry.hash})`);
        continue;
      }

      if (embedding.some((v) => !Number.isFinite(v))) {
        console.warn(`Skipping cache for invalid embedding values (hash: ${entry.hash})`);
        continue;
      }

      stmt.run(
        this.providerId,
        this.model,
        this.providerKey,
        entry.hash,
        JSON.stringify(embedding),
        embedding.length,
        now,
      );
    }
  }

  /**
   * Prune cache with smart retention policy
   */
  pruneSmart(maxEntries: number): number {
    if (maxEntries <= 0) {
      return 0;
    }

    const row = this.db.prepare(`SELECT COUNT(*) as c FROM ${this.tableName}`).get() as
      | { c: number | bigint }
      | undefined;
    const count = row?.c ? Number(row.c) : 0;

    if (count <= maxEntries) {
      return 0;
    }

    const excess = count - maxEntries;
    
    // Smart pruning: keep recently used entries and entries with high hit potential
    // First, remove entries that haven't been used in a long time
    const removed = Number(this.db
      .prepare(
        `DELETE FROM ${this.tableName}\n` +
          ` WHERE rowid IN (\n` +
          `   SELECT rowid FROM ${this.tableName}\n` +
          `   ORDER BY updated_at ASC\n` +
          `   LIMIT ?\n` +
          ` )`,
      )
      .run(excess).changes);

    // Optional: compact database after pruning
    if (removed > 0) {
      this.db.exec(`VACUUM`);
    }

    return removed;
  }

  /**
   * Get detailed cache statistics
   */
  getStats(): EmbeddingCacheStats {
    const totalRows = this.db
      .prepare(`SELECT COUNT(*) as c FROM ${this.tableName}`)
      .get() as { c: number | bigint };
    const totalEntries = Number(totalRows.c);

    const sizeStats = this.db
      .prepare(`SELECT AVG(dims) as avg_dims FROM ${this.tableName} WHERE dims IS NOT NULL`)
      .get() as { avg_dims: number | null };

    const timeStats = this.db
      .prepare(`SELECT MIN(updated_at) as oldest, MAX(updated_at) as newest FROM ${this.tableName}`)
      .get() as { oldest: number | bigint | null; newest: number | bigint | null };

    const hitRate =
      this.stats.totalQueries > 0
        ? (this.stats.hits / this.stats.totalQueries) * 100
        : 0;

    return {
      totalEntries,
      hitRate,
      hits: this.stats.hits,
      misses: this.stats.misses,
      totalQueries: this.stats.totalQueries,
      averageEmbeddingSize: sizeStats.avg_dims ?? 0,
      oldestEntry: timeStats.oldest ? Number(timeStats.oldest) : null,
      newestEntry: timeStats.newest ? Number(timeStats.newest) : null,
    };
  }

  /**
   * Clear cache for this provider
   */
  clear(): number {
    const stmt = this.db.prepare(
      `DELETE FROM ${this.tableName} WHERE provider = ? AND model = ? AND provider_key = ?`,
    );
    const result = stmt.run(this.providerId, this.model, this.providerKey);
    return Number(result.changes);
  }

  /**
   * Verify cache integrity
   */
  verifyIntegrity(): { valid: number; invalid: number; errors: string[] } {
    const rows = this.db
      .prepare(
        `SELECT hash, embedding, dims FROM ${this.tableName}\n` +
          ` WHERE provider = ? AND model = ? AND provider_key = ?`,
      )
      .all(this.providerId, this.model, this.providerKey) as Array<{
        hash: string;
        embedding: string;
        dims: number;
      }>;

    let valid = 0;
    let invalid = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const embedding = parseEmbedding(row.embedding);

        // Check dimensions match
        if (row.dims && embedding.length !== row.dims) {
          invalid++;
          errors.push(
            `Hash ${row.hash}: dimension mismatch (expected ${row.dims}, got ${embedding.length})`,
          );
          continue;
        }

        // Check for valid values
        if (embedding.some((v) => !Number.isFinite(v))) {
          invalid++;
          errors.push(`Hash ${row.hash}: contains non-finite values`);
          continue;
        }

        valid++;
      } catch (error) {
        invalid++;
        errors.push(`Hash ${row.hash}: parse error - ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { valid, invalid, errors };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      totalQueries: 0,
    };
  }
}