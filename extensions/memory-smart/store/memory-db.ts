/**
 * LanceDB facts/memories store — CRUD + vector search.
 *
 * Table schema:
 *   id, text, vector, importance (0-1), category, entities (string[]),
 *   source, createdAt, updatedAt, accessCount
 */

import * as lancedb from "@lancedb/lancedb";
import { randomUUID } from "node:crypto";
import type { MemoryCategory } from "../config.js";

// ============================================================================
// Types
// ============================================================================

export type MemoryEntry = {
  id: string;
  text: string;
  vector: number[];
  importance: number;
  category: MemoryCategory;
  entities: string;       // JSON-encoded string[] (LanceDB doesn't support nested arrays well)
  source: string;         // file path or session id
  createdAt: number;
  updatedAt: number;
  accessCount: number;
};

export type MemorySearchResult = {
  entry: MemoryEntry;
  score: number;
};

export type StoreMemoryInput = {
  text: string;
  vector: number[];
  importance: number;
  category: MemoryCategory;
  entities?: string[];
  source?: string;
};

// ============================================================================
// Memory DB
// ============================================================================

const TABLE_NAME = "memories";

export class MemoryDB {
  private db: lancedb.Connection | null = null;
  private table: lancedb.Table | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly dbPath: string,
    private readonly vectorDim: number,
  ) {}

  private async ensureInitialized(): Promise<void> {
    if (this.table) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    this.db = await lancedb.connect(this.dbPath);
    const tables = await this.db.tableNames();

    if (tables.includes(TABLE_NAME)) {
      this.table = await this.db.openTable(TABLE_NAME);
    } else {
      // Create table with schema row, then delete it
      this.table = await this.db.createTable(TABLE_NAME, [
        {
          id: "__schema__",
          text: "",
          vector: new Array(this.vectorDim).fill(0),
          importance: 0,
          category: "other",
          entities: "[]",
          source: "",
          createdAt: 0,
          updatedAt: 0,
          accessCount: 0,
        },
      ]);
      await this.table.delete('id = "__schema__"');
    }
  }

  async store(input: StoreMemoryInput): Promise<MemoryEntry> {
    await this.ensureInitialized();

    const now = Date.now();
    const entry: MemoryEntry = {
      id: randomUUID(),
      text: input.text,
      vector: input.vector,
      importance: input.importance,
      category: input.category,
      entities: JSON.stringify(input.entities ?? []),
      source: input.source ?? "",
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
    };

    await this.table!.add([entry]);
    return entry;
  }

  async search(
    vector: number[],
    limit = 5,
    minScore = 0.3,
  ): Promise<MemorySearchResult[]> {
    await this.ensureInitialized();

    const results = await this.table!.vectorSearch(vector).limit(limit).toArray();

    const mapped = results.map((row) => {
      const distance = (row._distance as number) ?? 0;
      // Convert L2 distance to similarity score: sim = 1 / (1 + d)
      const score = 1 / (1 + distance);
      return {
        entry: {
          id: row.id as string,
          text: row.text as string,
          vector: row.vector as number[],
          importance: row.importance as number,
          category: row.category as MemoryCategory,
          entities: row.entities as string,
          source: row.source as string,
          createdAt: row.createdAt as number,
          updatedAt: row.updatedAt as number,
          accessCount: row.accessCount as number,
        },
        score,
      };
    });

    return mapped.filter((r) => r.score >= minScore);
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized();
    // Validate UUID format to prevent injection
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new Error(`Invalid memory ID format: ${id}`);
    }
    await this.table!.delete(`id = '${id}'`);
    return true;
  }

  async count(): Promise<number> {
    await this.ensureInitialized();
    return this.table!.countRows();
  }

  /**
   * Get all entity names from the store (for entity matching in auto-recall).
   * Returns a deduplicated list of all entity strings.
   */
  async getAllEntityNames(): Promise<string[]> {
    await this.ensureInitialized();
    // We can't easily query distinct JSON array values in LanceDB,
    // so we'll collect from recent entries
    const results = await this.table!.query().limit(500).toArray();
    const names = new Set<string>();
    for (const row of results) {
      try {
        const entities = JSON.parse(row.entities as string) as string[];
        for (const e of entities) {
          if (e) names.add(e.toLowerCase());
        }
      } catch {
        // skip malformed
      }
    }
    return [...names];
  }

  /**
   * Get all memories (for reflection pipeline).
   * Returns up to `limit` entries.
   */
  async getAll(limit = 500): Promise<MemoryEntry[]> {
    await this.ensureInitialized();
    const results = await this.table!.query().limit(limit).toArray();
    return results.map((row) => ({
      id: row.id as string,
      text: row.text as string,
      vector: row.vector as number[],
      importance: row.importance as number,
      category: row.category as MemoryCategory,
      entities: row.entities as string,
      source: row.source as string,
      createdAt: row.createdAt as number,
      updatedAt: row.updatedAt as number,
      accessCount: row.accessCount as number,
    }));
  }

  /**
   * Drop and recreate the memories table (for reset).
   */
  async reset(): Promise<void> {
    await this.ensureInitialized();
    try {
      await this.db!.dropTable(TABLE_NAME);
    } catch {
      // Table might not exist
    }
    this.table = null;
    this.initPromise = null;
    await this.ensureInitialized();
  }

  /**
   * Update fields on an existing memory entry.
   * Deletes old row and inserts updated one (LanceDB doesn't support in-place update).
   */
  async update(id: string, fields: Partial<Pick<MemoryEntry, "text" | "importance" | "category" | "entities" | "accessCount" | "vector">>): Promise<void> {
    await this.ensureInitialized();

    // Validate UUID format to prevent injection
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new Error(`Invalid memory ID format: ${id}`);
    }

    // Fetch existing
    const all = await this.table!.query().limit(1000).toArray();
    const existing = all.find((r) => r.id === id);
    if (!existing) return;

    // Build updated entry
    const updated: MemoryEntry = {
      id: existing.id as string,
      text: fields.text ?? existing.text as string,
      vector: fields.vector ?? existing.vector as number[],
      importance: fields.importance ?? existing.importance as number,
      category: fields.category ?? existing.category as MemoryCategory,
      entities: fields.entities ?? existing.entities as string,
      source: existing.source as string,
      createdAt: existing.createdAt as number,
      updatedAt: Date.now(),
      accessCount: fields.accessCount ?? existing.accessCount as number,
    };

    // Delete + re-add
    await this.table!.delete(`id = '${id}'`);
    await this.table!.add([updated]);
  }
}
