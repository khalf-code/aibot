/**
 * UI-008 (#69) -- Skill registry UI
 *
 * Type definitions for the visual skill registry browser. Operators can
 * search, filter, and inspect published skills, view their manifests,
 * and check deprecation status.
 */

import type { SkillStatus } from "../skills/registry.ts";

// ---------------------------------------------------------------------------
// Skill card
// ---------------------------------------------------------------------------

/** A card-level summary of a skill for the registry grid/list view. */
export type SkillCard = {
  /** Skill name (unique identifier). */
  name: string;
  /** Latest published version string. */
  version: string;
  /** One-sentence description from the manifest. */
  description: string;
  /** Publication status. */
  status: SkillStatus;
  /** Who published the latest version. */
  author: string;
  /** ISO-8601 timestamp of the latest publication. */
  publishedAt: string;
  /** Tools declared in the manifest's permissions block. */
  declaredTools: string[];
  /** Whether the skill requires human approval. */
  approvalRequired: boolean;
  /** Number of times this skill has been used in runs. */
  usageCount: number;
  /** Average run duration in milliseconds (undefined if no runs). */
  avgDurationMs?: number;
  /** Tags for search and categorization. */
  tags: string[];
};

// ---------------------------------------------------------------------------
// Skill detail
// ---------------------------------------------------------------------------

/** Full detail view data for a single skill (shown when a card is expanded). */
export type SkillDetail = {
  /** Card-level summary data. */
  card: SkillCard;
  /** Raw manifest YAML content for display in a code viewer. */
  manifestYaml: string;
  /** All published versions (newest first). */
  versions: { version: string; publishedAt: string; status: SkillStatus }[];
  /** Deprecation notice (if the skill is deprecated). */
  deprecationMessage?: string;
  /** Domains the skill is allowed to access. */
  allowedDomains: string[];
  /** Secrets the skill declares access to. */
  declaredSecrets: string[];
  /** Changelog entries for this skill (newest first). */
  changelog: { version: string; summary: string; date: string }[];
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** Sort fields for the skill registry. */
export type SkillSortField = "name" | "publishedAt" | "usageCount" | "version";

/** Filter criteria for the skill registry view. */
export type SkillFilter = {
  /** Only show skills with these statuses. Empty = all. */
  statuses: SkillStatus[];
  /** Only show skills that declare these tools. Empty = all. */
  tools: string[];
  /** Only show skills by this author. */
  author?: string;
  /** Free-text search (matched against name, description, tags). */
  search?: string;
  /** Whether to include deprecated skills. */
  includeDeprecated: boolean;
};

// ---------------------------------------------------------------------------
// Registry view configuration
// ---------------------------------------------------------------------------

/** Configuration state for the skill registry view. */
export type RegistryViewConfig = {
  /** Active filter criteria. */
  filter: SkillFilter;
  /** Sort field. */
  sortField: SkillSortField;
  /** Sort direction. */
  sortDirection: "asc" | "desc";
  /** Number of items per page. */
  pageSize: number;
  /** Layout preference. */
  viewMode: "grid" | "list";
  /** Whether to show usage statistics on cards. */
  showUsageStats: boolean;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default skill filter (active skills only). */
export const DEFAULT_SKILL_FILTER: SkillFilter = {
  statuses: ["active"],
  tools: [],
  includeDeprecated: false,
};

/** Default registry view configuration. */
export const DEFAULT_REGISTRY_VIEW_CONFIG: RegistryViewConfig = {
  filter: DEFAULT_SKILL_FILTER,
  sortField: "name",
  sortDirection: "asc",
  pageSize: 12,
  viewMode: "grid",
  showUsageStats: true,
};
