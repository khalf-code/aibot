/**
 * UI-006 (#67) -- Workflow catalog UI
 *
 * Type definitions for the browseable workflow catalog. Operators can
 * search, filter, and deploy workflow templates from this view.
 */

// ---------------------------------------------------------------------------
// Catalog entry
// ---------------------------------------------------------------------------

/** Publication status of a catalog workflow. */
export type CatalogEntryStatus = "published" | "draft" | "archived";

/** Category tag for organizing catalog entries. */
export type WorkflowCategory =
  | "automation"
  | "data-pipeline"
  | "notification"
  | "integration"
  | "monitoring"
  | "custom";

/** A single workflow entry in the catalog. */
export type CatalogEntry = {
  /** Unique identifier for this catalog entry. */
  id: string;
  /** Human-readable workflow name. */
  name: string;
  /** One-sentence description of what the workflow does. */
  description: string;
  /** Longer markdown-formatted documentation (optional). */
  longDescription?: string;
  /** Semantic version string. */
  version: string;
  /** Who authored this workflow. */
  author: string;
  /** Category tag for filtering. */
  category: WorkflowCategory;
  /** Publication status. */
  status: CatalogEntryStatus;
  /** Skills referenced by this workflow. */
  requiredSkills: string[];
  /** Estimated run duration in seconds (for informational display). */
  estimatedDurationSec?: number;
  /** ISO-8601 timestamp when this version was published. */
  publishedAt: string;
  /** ISO-8601 timestamp of the last update. */
  updatedAt: string;
  /** Number of times this workflow has been deployed. */
  deployCount: number;
  /** Tags for free-form filtering and search. */
  tags: string[];
};

// ---------------------------------------------------------------------------
// Deploy action
// ---------------------------------------------------------------------------

/** Input for deploying a catalog workflow. */
export type DeployAction = {
  /** ID of the catalog entry to deploy. */
  catalogEntryId: string;
  /** Target environment for the deployment. */
  targetEnvironment: string;
  /** Parameter overrides for the deployment. */
  parameterOverrides?: Record<string, unknown>;
  /** ID of the user initiating the deployment. */
  deployedBy: string;
};

/** Result of a deploy action. */
export type DeployResult = {
  /** Whether the deployment succeeded. */
  success: boolean;
  /** ID of the deployed workflow instance (undefined on failure). */
  workflowInstanceId?: string;
  /** Error message on failure. */
  error?: string;
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** Sort fields for the catalog. */
export type CatalogSortField = "name" | "publishedAt" | "updatedAt" | "deployCount";

/** Filter criteria for narrowing the catalog. */
export type CatalogFilter = {
  /** Only show entries with these statuses. Empty = all. */
  statuses: CatalogEntryStatus[];
  /** Only show entries in these categories. Empty = all. */
  categories: WorkflowCategory[];
  /** Free-text search (matched against name, description, tags). */
  search?: string;
  /** Only show entries by this author. */
  author?: string;
  /** Only show entries that use these skills. */
  requiredSkills?: string[];
};

// ---------------------------------------------------------------------------
// Catalog configuration
// ---------------------------------------------------------------------------

/** Configuration state for the workflow catalog view. */
export type CatalogConfig = {
  /** Active filter criteria. */
  filter: CatalogFilter;
  /** Sort field. */
  sortField: CatalogSortField;
  /** Sort direction. */
  sortDirection: "asc" | "desc";
  /** Number of items per page. */
  pageSize: number;
  /** View layout preference. */
  viewMode: "grid" | "list";
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default catalog filter (published entries only). */
export const DEFAULT_CATALOG_FILTER: CatalogFilter = {
  statuses: ["published"],
  categories: [],
};

/** Default catalog view configuration. */
export const DEFAULT_CATALOG_CONFIG: CatalogConfig = {
  filter: DEFAULT_CATALOG_FILTER,
  sortField: "publishedAt",
  sortDirection: "desc",
  pageSize: 12,
  viewMode: "grid",
};
