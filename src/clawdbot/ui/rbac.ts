/**
 * UI-011 (#72) -- RBAC: roles + permissions UI
 *
 * Type definitions for the role-based access control management view.
 * Operators can define roles, assign granular permissions, and bind
 * roles to users from this interface.
 */

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

/** A resource category that permissions can target. */
export type PermissionResource =
  | "runs"
  | "approvals"
  | "workflows"
  | "skills"
  | "tools"
  | "secrets"
  | "rbac"
  | "settings"
  | "notifications";

/** An action that can be performed on a resource. */
export type PermissionAction = "read" | "write" | "delete" | "manage";

/** A single granular permission. */
export type Permission = {
  /** Unique identifier (e.g. `"runs:read"`, `"secrets:manage"`). */
  id: string;
  /** The resource this permission applies to. */
  resource: PermissionResource;
  /** The action this permission grants. */
  action: PermissionAction;
  /** Human-readable description. */
  description: string;
};

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------

/** A named role that bundles a set of permissions. */
export type Role = {
  /** Unique role identifier (e.g. `"admin"`, `"operator"`, `"viewer"`). */
  id: string;
  /** Display name. */
  name: string;
  /** Description of the role's purpose. */
  description: string;
  /** Permissions granted by this role. */
  permissions: Permission[];
  /** Whether this is a built-in role (cannot be deleted). */
  builtIn: boolean;
  /** ISO-8601 timestamp when the role was created. */
  createdAt: string;
  /** ISO-8601 timestamp when the role was last modified. */
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Role assignment
// ---------------------------------------------------------------------------

/** Binding of a role to a user. */
export type RoleAssignment = {
  /** Unique assignment identifier. */
  id: string;
  /** ID of the user this role is assigned to. */
  userId: string;
  /** Display name of the user (for UI rendering). */
  userName: string;
  /** ID of the assigned role. */
  roleId: string;
  /** Display name of the role (denormalized for display). */
  roleName: string;
  /** Who made this assignment. */
  assignedBy: string;
  /** ISO-8601 timestamp when the assignment was created. */
  assignedAt: string;
  /** Optional expiry (ISO-8601) after which the assignment is revoked. */
  expiresAt?: string;
};

// ---------------------------------------------------------------------------
// RBAC configuration
// ---------------------------------------------------------------------------

/** Active tab in the RBAC management view. */
export type RbacTab = "roles" | "assignments" | "permissions";

/** Filter criteria for the RBAC view. */
export type RbacFilter = {
  /** Free-text search (matched against role names, user names). */
  search?: string;
  /** Only show assignments for this role. */
  roleId?: string;
  /** Only show assignments for this user. */
  userId?: string;
};

/** Configuration state for the RBAC management view. */
export type RbacConfig = {
  /** Currently active tab. */
  activeTab: RbacTab;
  /** Active filter criteria. */
  filter: RbacFilter;
  /** Number of items per page. */
  pageSize: number;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Built-in roles provided out of the box. */
export const BUILT_IN_ROLES: Omit<Role, "createdAt" | "updatedAt">[] = [
  {
    id: "admin",
    name: "Admin",
    description: "Full access to all resources and settings.",
    permissions: [], // populated at runtime from all available permissions
    builtIn: true,
  },
  {
    id: "operator",
    name: "Operator",
    description: "Can manage runs, approvals, and workflows but not RBAC or secrets.",
    permissions: [], // populated at runtime
    builtIn: true,
  },
  {
    id: "viewer",
    name: "Viewer",
    description: "Read-only access to runs, workflows, and skills.",
    permissions: [], // populated at runtime
    builtIn: true,
  },
];

/** Default RBAC view configuration. */
export const DEFAULT_RBAC_CONFIG: RbacConfig = {
  activeTab: "roles",
  filter: {},
  pageSize: 25,
};
