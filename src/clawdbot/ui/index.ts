/**
 * Clawdbot Dashboard UI — barrel export
 *
 * Re-exports every UI module so consumers can import from a single path:
 *   import { DashboardShell, Widget, RunListConfig, ... } from "../clawdbot/ui/index.ts";
 */

// UI-001 (#62) Dashboard shell + navigation
export type { NavigationItem, BreadcrumbItem, SidebarConfig, DashboardShell } from "./shell.ts";
export { DEFAULT_SIDEBAR_CONFIG, createDefaultShell } from "./shell.ts";

// UI-002 (#63) Command Center summary widgets
export type {
  WidgetType,
  WidgetSize,
  WidgetData,
  RunsSummaryData,
  ApprovalsPendingData,
  SystemHealthData,
  CostOverviewData,
  RecentActivityData,
  ActivityEntry,
  HealthStatus,
  ComponentHealth,
  Widget,
  RunsSummaryWidget,
  ApprovalsPendingWidget,
  SystemHealthWidget,
  CostOverviewWidget,
  RecentActivityWidget,
} from "./widgets.ts";

// UI-003 (#64) Runs list table + filters
export type {
  RunListItem,
  RunSortField,
  SortDirection,
  RunSort,
  RunFilter,
  PaginationMeta,
  PaginatedRunList,
  RunListConfig,
} from "./runs-list.ts";
export { DEFAULT_RUN_FILTER, DEFAULT_RUN_SORT, DEFAULT_RUN_LIST_CONFIG } from "./runs-list.ts";

// UI-004 (#65) Run detail view with inspector drawer
export type {
  TimelineEntryType,
  TimelineEntry,
  StepInspection,
  InspectorDrawer,
  RunDetailView,
  RunDetailTab,
} from "./run-detail.ts";
export { DEFAULT_INSPECTOR_DRAWER } from "./run-detail.ts";

// UI-005 (#66) Approval queue UI
export type {
  ApprovalItemStatus,
  ApprovalUrgency,
  ApprovalQueueItem,
  ApprovalAction,
  ApprovalActionResult,
  ApprovalQueueFilter,
  ApprovalQueueConfig,
} from "./approval-queue.ts";
export { DEFAULT_APPROVAL_FILTER, DEFAULT_APPROVAL_QUEUE_CONFIG } from "./approval-queue.ts";

// UI-006 (#67) Workflow catalog UI
export type {
  CatalogEntryStatus,
  WorkflowCategory,
  CatalogEntry,
  DeployAction,
  DeployResult,
  CatalogSortField,
  CatalogFilter,
  CatalogConfig,
} from "./workflow-catalog.ts";
export { DEFAULT_CATALOG_FILTER, DEFAULT_CATALOG_CONFIG } from "./workflow-catalog.ts";

// UI-007 (#68) Workflow editor (YAML with validation)
export type {
  ValidationSeverity,
  ValidationDiagnostic,
  ValidationResult,
  EditorActionType,
  EditorAction,
  EditorHistoryEntry,
  EditorState,
  WorkflowEditorConfig,
} from "./workflow-editor.ts";
export { DEFAULT_EDITOR_CONFIG, createEmptyEditorState } from "./workflow-editor.ts";

// UI-008 (#69) Skill registry UI
export type {
  SkillCard,
  SkillDetail,
  SkillSortField,
  SkillFilter,
  RegistryViewConfig,
} from "./skill-registry-ui.ts";
export { DEFAULT_SKILL_FILTER, DEFAULT_REGISTRY_VIEW_CONFIG } from "./skill-registry-ui.ts";

// UI-009 (#70) Tools configuration UI
export type {
  ToolRunnerStatus,
  ToolHealthCheck,
  ToolConfigEntry,
  ToolConfigField,
  ToolConfigForm,
  ToolConfigSection,
} from "./tools-config.ts";
export { DEFAULT_TOOL_SECTIONS } from "./tools-config.ts";

// UI-010 (#71) Secrets UI (scoped)
export type {
  SecretScopeLevel,
  SecretScope,
  SecretEntry,
  SecretForm,
  SecretFormValidation,
  SecretSortField,
  SecretFilter,
  SecretsListConfig,
} from "./secrets-ui.ts";
export { DEFAULT_SECRET_FILTER, DEFAULT_SECRETS_LIST_CONFIG } from "./secrets-ui.ts";

// UI-011 (#72) RBAC: roles + permissions UI
export type {
  PermissionResource,
  PermissionAction,
  Permission,
  Role,
  RoleAssignment,
  RbacTab,
  RbacFilter,
  RbacConfig,
} from "./rbac.ts";
export { BUILT_IN_ROLES, DEFAULT_RBAC_CONFIG } from "./rbac.ts";

// UI-012 (#73) Notification settings UI
export type {
  NotificationChannelType,
  NotificationChannel,
  NotificationEventType,
  NotificationSeverity,
  NotificationRule,
  QuietHours,
  NotificationPreferences,
} from "./notifications.ts";
export { DEFAULT_QUIET_HOURS, DEFAULT_NOTIFICATION_PREFERENCES } from "./notifications.ts";

// UI-013 (#74) Dark mode polish
export type { ThemeMode, ThemeColors, ThemeConfig } from "./theme.ts";
export { LIGHT_COLORS, DARK_COLORS, DEFAULT_THEME_CONFIG, resolveColors } from "./theme.ts";
