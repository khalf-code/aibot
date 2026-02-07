/**
 * SK-004 (#30) -- Internal skill registry API
 *
 * Defines the CRUD interface for managing published skills and provides
 * an in-memory stub implementation for development and testing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Publication status of a skill in the registry. */
export type SkillStatus = "active" | "deprecated" | "yanked";

/** A single versioned entry in the skill registry. */
export type SkillRegistryEntry = {
  /** Skill name (matches the directory / manifest name). */
  name: string;
  /** Semantic version string. */
  version: string;
  /** One-sentence description from the manifest. */
  description: string;
  /** Current publication status. */
  status: SkillStatus;
  /** ISO-8601 timestamp of when this version was published. */
  published_at: string;
  /** User or system that published this version. */
  published_by: string;
};

// ---------------------------------------------------------------------------
// Registry interface
// ---------------------------------------------------------------------------

/** CRUD contract for an internal skill registry. */
export interface SkillRegistry {
  /**
   * Publish a new skill version to the registry.
   *
   * @param entry - The registry entry to publish.
   * @throws If the name+version pair already exists.
   */
  publish(entry: SkillRegistryEntry): Promise<void>;

  /**
   * List all registered skills, optionally filtered by status.
   *
   * @param status - If provided, only return entries with this status.
   */
  list(status?: SkillStatus): Promise<SkillRegistryEntry[]>;

  /**
   * Get a specific skill entry by name and version.
   *
   * @param name - Skill name.
   * @param version - Exact version string. If omitted, returns the latest active version.
   * @returns The matching entry, or `null` if not found.
   */
  get(name: string, version?: string): Promise<SkillRegistryEntry | null>;

  /**
   * Mark a skill version as deprecated.
   *
   * @param name - Skill name.
   * @param version - Version to deprecate.
   * @param message - Human-readable deprecation reason.
   */
  deprecate(name: string, version: string, message: string): Promise<void>;

  /**
   * Roll back to a previous version by marking the current version as yanked
   * and the target version as active.
   *
   * @param name - Skill name.
   * @param targetVersion - The version to restore as active.
   */
  rollback(name: string, targetVersion: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory stub
// ---------------------------------------------------------------------------

/**
 * In-memory implementation of `SkillRegistry` for development and tests.
 *
 * Data is lost when the process exits. Replace with a persistent backend
 * (SQLite, Postgres, S3 manifest index, etc.) for production use.
 */
export class InMemorySkillRegistry implements SkillRegistry {
  private entries: SkillRegistryEntry[] = [];

  async publish(entry: SkillRegistryEntry): Promise<void> {
    const existing = this.entries.find((e) => e.name === entry.name && e.version === entry.version);
    if (existing) {
      throw new Error(`Skill "${entry.name}@${entry.version}" is already published.`);
    }
    this.entries.push({ ...entry });
  }

  async list(status?: SkillStatus): Promise<SkillRegistryEntry[]> {
    if (status) {
      return this.entries.filter((e) => e.status === status);
    }
    return [...this.entries];
  }

  async get(name: string, version?: string): Promise<SkillRegistryEntry | null> {
    if (version) {
      return this.entries.find((e) => e.name === name && e.version === version) ?? null;
    }
    // Return the latest active entry (last published with status "active").
    const active = this.entries.filter((e) => e.name === name && e.status === "active").reverse();
    return active[0] ?? null;
  }

  async deprecate(name: string, version: string, _message: string): Promise<void> {
    const entry = this.entries.find((e) => e.name === name && e.version === version);
    if (!entry) {
      throw new Error(`Skill "${name}@${version}" not found in registry.`);
    }
    entry.status = "deprecated";
  }

  async rollback(name: string, targetVersion: string): Promise<void> {
    const target = this.entries.find((e) => e.name === name && e.version === targetVersion);
    if (!target) {
      throw new Error(`Target version "${name}@${targetVersion}" not found in registry.`);
    }

    // Yank all newer active versions of this skill.
    for (const entry of this.entries) {
      if (entry.name === name && entry.status === "active") {
        entry.status = "yanked";
      }
    }

    target.status = "active";
  }
}
