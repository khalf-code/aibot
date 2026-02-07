# Dashboard UI Guide

The Clawdbot Dashboard is the primary web interface for operating and monitoring the Clawdbot agent runtime. It provides real-time visibility into runs, approvals, workflows, skills, and system configuration.

## Architecture

All UI type definitions live in `src/clawdbot/ui/` and can be imported from the barrel export:

```ts
import { DashboardShell, Widget, RunListConfig } from "../clawdbot/ui/index.ts";
```

Each module corresponds to a dashboard view or feature area, referenced by its issue number.

## Views

### Command Center (UI-001, UI-002)

The landing page of the dashboard. The **shell** (`shell.ts`) provides the sidebar navigation, breadcrumb trail, and top bar. The **widgets** (`widgets.ts`) render summary metrics:

- **Runs Summary** -- aggregate counts of running, completed, failed, and pending runs.
- **Approvals Pending** -- count and age of items waiting in the approval queue.
- **System Health** -- rollup status of all runtime components (n8n, artifact store, queue).
- **Cost Overview** -- estimated spend for the current billing period.
- **Recent Activity** -- live feed of notable events.

### Runs List (UI-003)

A paginated, sortable, filterable table of all skill executions. Supports cursor-based pagination, column visibility toggles, and auto-refresh.

Key types: `RunListItem`, `RunFilter`, `RunSort`, `PaginatedRunList`.

### Run Detail (UI-004)

Drill-down view for a single run. Includes:

- **Timeline** -- chronological list of state changes, step events, and artifacts.
- **Inspector Drawer** -- side panel that shows formatted input/output, duration, and redacted fields for a selected step.
- **Live Updates** -- WebSocket-driven real-time updates while a run is in progress.

### Approval Queue (UI-005)

Human-in-the-loop gate for high-risk steps. Operators review pending requests with context (skill name, step summary, urgency) and approve or reject them. Supports urgency-based sorting, filtering, and optional notification sounds.

### Workflow Catalog (UI-006)

Browseable catalog of published workflow templates. Supports grid and list layouts, category filters, and one-click deploy to a target environment.

### Workflow Editor (UI-007)

In-browser YAML editor for authoring and editing workflows. MVP features:

- Syntax highlighting
- Real-time validation with inline diagnostics
- Undo/redo history
- Format-on-save
- Deploy and revert actions

### Skill Registry (UI-008)

Visual browser for published skills. Shows cards with status badges, usage statistics, and manifest details. Supports filtering by status, tools, and author.

### Tools Configuration (UI-009)

Management view for tool runner settings. Grouped into sections (Automation, Communication, Integration), each tool entry exposes:

- Enable/disable toggle
- Timeout, concurrency, and rate limit settings
- Health check status
- Runner-specific configuration form

### Secrets Management (UI-010)

Scoped secrets vault UI. Secrets can be scoped to global, environment, or skill level. The UI shows metadata only (name, scopes, rotation status) -- values are write-only and never displayed after creation.

### RBAC (UI-011)

Role-based access control management. Three built-in roles (Admin, Operator, Viewer) plus custom role creation. Permissions are granular: `{resource}:{action}` (e.g., `secrets:manage`, `runs:read`).

### Notification Settings (UI-012)

Per-user notification preferences. Users map events (run failed, approval requested, health degraded) to delivery channels (email, Slack, Discord, Telegram, webhook, in-app). Quiet hours suppress non-critical notifications during off hours.

### Theme / Dark Mode (UI-013)

Theming system with light, dark, and system-preference modes. Color tokens cover backgrounds, text, accent, status colors, and sidebar chrome. Supports user overrides, border radius customization, and reduced motion / high contrast accessibility toggles.

## Module Index

| Issue        | File                                   | Description                         |
| ------------ | -------------------------------------- | ----------------------------------- |
| UI-001 (#62) | `src/clawdbot/ui/shell.ts`             | Dashboard shell + navigation        |
| UI-002 (#63) | `src/clawdbot/ui/widgets.ts`           | Command Center summary widgets      |
| UI-003 (#64) | `src/clawdbot/ui/runs-list.ts`         | Runs list table + filters           |
| UI-004 (#65) | `src/clawdbot/ui/run-detail.ts`        | Run detail view + inspector drawer  |
| UI-005 (#66) | `src/clawdbot/ui/approval-queue.ts`    | Approval queue UI                   |
| UI-006 (#67) | `src/clawdbot/ui/workflow-catalog.ts`  | Workflow catalog UI                 |
| UI-007 (#68) | `src/clawdbot/ui/workflow-editor.ts`   | Workflow editor (YAML + validation) |
| UI-008 (#69) | `src/clawdbot/ui/skill-registry-ui.ts` | Skill registry UI                   |
| UI-009 (#70) | `src/clawdbot/ui/tools-config.ts`      | Tools configuration UI              |
| UI-010 (#71) | `src/clawdbot/ui/secrets-ui.ts`        | Secrets UI (scoped)                 |
| UI-011 (#72) | `src/clawdbot/ui/rbac.ts`              | RBAC: roles + permissions           |
| UI-012 (#73) | `src/clawdbot/ui/notifications.ts`     | Notification settings               |
| UI-013 (#74) | `src/clawdbot/ui/theme.ts`             | Dark mode + theming                 |

## Conventions

- **Types over classes**: all data shapes use `export type` for serialization compatibility.
- **Defaults**: each module exports `DEFAULT_*` constants for initial view state.
- **Strict typing**: no `any`; union types for enumerations; optional fields marked with `?`.
- **JSDoc**: all exported types and fields have documentation comments.
- **Issue references**: each file header cites its tracking issue (e.g., `UI-001 (#62)`).
- **Barrel export**: `src/clawdbot/ui/index.ts` re-exports everything for single-path imports.
