/**
 * UI-002 (#63) -- Command Center summary widgets
 *
 * Type definitions for the dashboard summary widgets that appear on the
 * Command Center home page. Each widget surfaces a high-level metric or
 * action list (runs summary, pending approvals, system health, etc.).
 */

// ---------------------------------------------------------------------------
// Widget types
// ---------------------------------------------------------------------------

/** The category of a dashboard widget. */
export type WidgetType =
  | "runs_summary"
  | "approvals_pending"
  | "system_health"
  | "cost_overview"
  | "recent_activity";

/** Possible sizes for widget grid placement. */
export type WidgetSize = "small" | "medium" | "large";

// ---------------------------------------------------------------------------
// Widget data payloads
// ---------------------------------------------------------------------------

/** Aggregate run counts by state, displayed in the Runs Summary widget. */
export type RunsSummaryData = {
  /** Total runs in the current time window. */
  total: number;
  /** Runs currently executing. */
  running: number;
  /** Runs completed successfully. */
  completed: number;
  /** Runs that ended in failure. */
  failed: number;
  /** Runs waiting on approval before proceeding. */
  awaitingApproval: number;
  /** Runs canceled by a user or policy. */
  canceled: number;
  /** ISO-8601 start of the reporting window. */
  windowStart: string;
  /** ISO-8601 end of the reporting window. */
  windowEnd: string;
};

/** Summary of items in the approval queue, for the Approvals Pending widget. */
export type ApprovalsPendingData = {
  /** Number of approval requests currently waiting. */
  pendingCount: number;
  /** ISO-8601 timestamp of the oldest pending request (undefined if none). */
  oldestPendingAt?: string;
  /** IDs of the most urgent pending items (sorted by age, newest first). */
  urgentItemIds: string[];
};

/** Component-level health indicator. */
export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

/** Per-component health entry for the System Health widget. */
export type ComponentHealth = {
  /** Component name (e.g. `"n8n"`, `"artifact-store"`, `"queue"`). */
  name: string;
  /** Current health status. */
  status: HealthStatus;
  /** Human-readable detail message. */
  message?: string;
  /** ISO-8601 timestamp of the last successful health check. */
  lastCheckedAt: string;
};

/** System health summary for the System Health widget. */
export type SystemHealthData = {
  /** Overall rollup status. */
  overall: HealthStatus;
  /** Per-component breakdown. */
  components: ComponentHealth[];
};

/** Cost overview for the Cost Overview widget. */
export type CostOverviewData = {
  /** Total estimated cost in USD for the current billing period. */
  totalCostUsd: number;
  /** Daily cost trend (ordered chronologically). */
  dailyCosts: { date: string; costUsd: number }[];
  /** Billing period start (ISO-8601). */
  periodStart: string;
  /** Billing period end (ISO-8601). */
  periodEnd: string;
};

/** A single entry in the Recent Activity feed. */
export type ActivityEntry = {
  /** Unique entry identifier. */
  id: string;
  /** Short description of the activity. */
  message: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Optional link to the related resource. */
  href?: string;
};

/** Recent activity feed data. */
export type RecentActivityData = {
  entries: ActivityEntry[];
};

/** Union of all possible widget data payloads. */
export type WidgetData =
  | RunsSummaryData
  | ApprovalsPendingData
  | SystemHealthData
  | CostOverviewData
  | RecentActivityData;

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

/** A dashboard widget instance. */
export type Widget<T extends WidgetData = WidgetData> = {
  /** Unique widget identifier. */
  id: string;
  /** Display title shown in the widget header. */
  title: string;
  /** Widget category (determines data shape and renderer). */
  type: WidgetType;
  /** Grid size hint for layout placement. */
  size: WidgetSize;
  /** Current data payload (undefined while loading). */
  data?: T;
  /** Whether the widget is currently fetching fresh data. */
  loading: boolean;
  /** Error message if the last data fetch failed. */
  error?: string;
  /** Auto-refresh interval in seconds (0 = manual refresh only). */
  refreshIntervalSec: number;
};

// ---------------------------------------------------------------------------
// Convenience typed widgets
// ---------------------------------------------------------------------------

/** Runs Summary widget with strongly-typed data. */
export type RunsSummaryWidget = Widget<RunsSummaryData>;

/** Approvals Pending widget with strongly-typed data. */
export type ApprovalsPendingWidget = Widget<ApprovalsPendingData>;

/** System Health widget with strongly-typed data. */
export type SystemHealthWidget = Widget<SystemHealthData>;

/** Cost Overview widget with strongly-typed data. */
export type CostOverviewWidget = Widget<CostOverviewData>;

/** Recent Activity widget with strongly-typed data. */
export type RecentActivityWidget = Widget<RecentActivityData>;
