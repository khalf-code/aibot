/**
 * UI-003 (#64) -- Runs list table + filters
 *
 * Type definitions for the paginated, filterable runs list view.
 * This view is the primary way operators inspect past and in-progress
 * skill executions.
 */

import type { RunState } from "../types/run.ts";

// ---------------------------------------------------------------------------
// Run list item
// ---------------------------------------------------------------------------

/**
 * A single row in the runs list table.
 *
 * This is a denormalized projection of the full `Run` record, containing
 * only the fields needed for table rendering and inline actions.
 */
export type RunListItem = {
  /** Run identifier. */
  id: string;
  /** Skill that was executed. */
  skillName: string;
  /** Current lifecycle state. */
  state: RunState;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp of the most recent state change. */
  updatedAt: string;
  /** Wall-clock duration in milliseconds (undefined if still running). */
  durationMs?: number;
  /** Number of steps completed so far. */
  stepsCompleted: number;
  /** Total number of steps in the execution plan. */
  stepsTotal: number;
  /** Who or what triggered the run (user id, schedule, webhook, etc.). */
  triggeredBy: string;
  /** Estimated cost in USD (undefined if not yet computed). */
  estimatedCostUsd?: number;
};

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/** Fields the runs list can be sorted by. */
export type RunSortField =
  | "createdAt"
  | "updatedAt"
  | "skillName"
  | "state"
  | "durationMs"
  | "estimatedCostUsd";

/** Sort direction. */
export type SortDirection = "asc" | "desc";

/** A sort specification for the runs list. */
export type RunSort = {
  field: RunSortField;
  direction: SortDirection;
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** Filter criteria for narrowing the runs list. */
export type RunFilter = {
  /** Only show runs in these states. Empty array = no state filter. */
  states: RunState[];
  /** Only show runs for these skill names. Empty array = all skills. */
  skillNames: string[];
  /** Only show runs created at or after this ISO-8601 timestamp. */
  createdAfter?: string;
  /** Only show runs created at or before this ISO-8601 timestamp. */
  createdBefore?: string;
  /** Free-text search (matched against skill name, run ID, trigger). */
  search?: string;
  /** Only show runs triggered by this actor. */
  triggeredBy?: string;
};

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Cursor-based pagination metadata. */
export type PaginationMeta = {
  /** Opaque cursor pointing to the next page (undefined on last page). */
  nextCursor?: string;
  /** Opaque cursor pointing to the previous page (undefined on first page). */
  prevCursor?: string;
  /** Total number of runs matching the current filter (if known). */
  totalCount?: number;
  /** Number of items per page. */
  pageSize: number;
};

/** A page of run list items with pagination metadata. */
export type PaginatedRunList = {
  /** The items in the current page. */
  items: RunListItem[];
  /** Pagination cursors and counts. */
  pagination: PaginationMeta;
};

// ---------------------------------------------------------------------------
// List configuration
// ---------------------------------------------------------------------------

/** Complete configuration state for the runs list view. */
export type RunListConfig = {
  /** Active filter criteria. */
  filter: RunFilter;
  /** Active sort specification. */
  sort: RunSort;
  /** Number of items to display per page. */
  pageSize: number;
  /** Whether the list is auto-refreshing. */
  autoRefresh: boolean;
  /** Auto-refresh interval in seconds (ignored when `autoRefresh` is false). */
  refreshIntervalSec: number;
  /** Columns visible in the table (ordered). */
  visibleColumns: RunSortField[];
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default filter (no restrictions). */
export const DEFAULT_RUN_FILTER: RunFilter = {
  states: [],
  skillNames: [],
};

/** Default sort (newest first). */
export const DEFAULT_RUN_SORT: RunSort = {
  field: "createdAt",
  direction: "desc",
};

/** Default list configuration. */
export const DEFAULT_RUN_LIST_CONFIG: RunListConfig = {
  filter: DEFAULT_RUN_FILTER,
  sort: DEFAULT_RUN_SORT,
  pageSize: 25,
  autoRefresh: true,
  refreshIntervalSec: 10,
  visibleColumns: ["createdAt", "skillName", "state", "durationMs", "estimatedCostUsd"],
};
