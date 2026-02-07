/**
 * UI-001 (#62) -- Dashboard shell + navigation
 *
 * Type definitions for the top-level dashboard layout, including the sidebar
 * navigation tree, breadcrumb trail, and overall shell configuration.
 *
 * The shell is the outermost frame of the Clawdbot dashboard UI. It owns the
 * sidebar, top bar, breadcrumbs, and the content viewport where child views
 * render.
 */

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/** A single item in the sidebar navigation tree. */
export type NavigationItem = {
  /** Unique identifier for the nav item (used as a route key). */
  id: string;
  /** Display label shown in the sidebar. */
  label: string;
  /** Icon identifier (e.g. `"play"`, `"shield"`, `"settings"`). */
  icon?: string;
  /** Route path this item navigates to (e.g. `"/runs"`). */
  href: string;
  /** Optional badge count (e.g. pending approvals). */
  badge?: number;
  /** Nested child items for collapsible sub-menus. */
  children?: NavigationItem[];
  /**
   * Minimum permission required to see this item.
   * When omitted the item is visible to all authenticated users.
   */
  requiredPermission?: string;
  /** Whether this item is currently disabled (greyed out). */
  disabled?: boolean;
};

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------

/** A single segment in the breadcrumb trail. */
export type BreadcrumbItem = {
  /** Display label for this breadcrumb segment. */
  label: string;
  /** Route path for this segment (`undefined` for the current/active segment). */
  href?: string;
};

// ---------------------------------------------------------------------------
// Sidebar configuration
// ---------------------------------------------------------------------------

/** Configuration for the sidebar panel. */
export type SidebarConfig = {
  /** Ordered list of top-level navigation items. */
  items: NavigationItem[];
  /** Whether the sidebar starts in a collapsed (icon-only) state. */
  collapsed: boolean;
  /** Width of the sidebar in pixels when expanded. */
  expandedWidthPx: number;
  /** Width of the sidebar in pixels when collapsed. */
  collapsedWidthPx: number;
  /** The `id` of the currently active navigation item. */
  activeItemId?: string;
};

// ---------------------------------------------------------------------------
// Dashboard shell
// ---------------------------------------------------------------------------

/** Top-level dashboard shell state. */
export type DashboardShell = {
  /** Sidebar navigation configuration. */
  sidebar: SidebarConfig;
  /** Current breadcrumb trail (ordered root-to-leaf). */
  breadcrumbs: BreadcrumbItem[];
  /** Title displayed in the top bar. */
  pageTitle: string;
  /** Optional subtitle / description below the page title. */
  pageSubtitle?: string;
  /**
   * Whether the shell chrome (sidebar + top bar) should be hidden,
   * e.g. for full-screen editor views.
   */
  chromeHidden: boolean;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default sidebar configuration with standard navigation items. */
export const DEFAULT_SIDEBAR_CONFIG: SidebarConfig = {
  items: [
    { id: "dashboard", label: "Dashboard", icon: "home", href: "/" },
    { id: "runs", label: "Runs", icon: "play", href: "/runs" },
    { id: "approvals", label: "Approvals", icon: "check-circle", href: "/approvals" },
    {
      id: "workflows",
      label: "Workflows",
      icon: "git-branch",
      href: "/workflows",
      children: [
        { id: "workflow-catalog", label: "Catalog", href: "/workflows/catalog" },
        { id: "workflow-editor", label: "Editor", href: "/workflows/editor" },
      ],
    },
    { id: "skills", label: "Skills", icon: "puzzle", href: "/skills" },
    { id: "tools", label: "Tools", icon: "wrench", href: "/tools" },
    {
      id: "secrets",
      label: "Secrets",
      icon: "lock",
      href: "/secrets",
      requiredPermission: "secrets:read",
    },
    {
      id: "settings",
      label: "Settings",
      icon: "settings",
      href: "/settings",
      children: [
        {
          id: "rbac",
          label: "Roles & Permissions",
          href: "/settings/rbac",
          requiredPermission: "rbac:manage",
        },
        { id: "notifications", label: "Notifications", href: "/settings/notifications" },
        { id: "theme", label: "Theme", href: "/settings/theme" },
      ],
    },
  ],
  collapsed: false,
  expandedWidthPx: 260,
  collapsedWidthPx: 64,
};

/** Create a fresh dashboard shell with default configuration. */
export function createDefaultShell(): DashboardShell {
  return {
    sidebar: { ...DEFAULT_SIDEBAR_CONFIG },
    breadcrumbs: [{ label: "Dashboard", href: "/" }],
    pageTitle: "Dashboard",
    chromeHidden: false,
  };
}
