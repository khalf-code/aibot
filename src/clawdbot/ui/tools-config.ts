/**
 * UI-009 (#70) -- Tools configuration UI
 *
 * Type definitions for the tool configuration management view. Operators
 * use this to enable/disable tool runners, adjust per-tool settings
 * (timeouts, rate limits, allowlists), and view tool health.
 */

// ---------------------------------------------------------------------------
// Tool types
// ---------------------------------------------------------------------------

/** Operational status of a tool runner. */
export type ToolRunnerStatus = "enabled" | "disabled" | "error";

/** Health check result for a tool runner. */
export type ToolHealthCheck = {
  /** Whether the last health check succeeded. */
  healthy: boolean;
  /** Human-readable status message. */
  message: string;
  /** ISO-8601 timestamp of the last health check. */
  checkedAt: string;
  /** Response time in milliseconds (undefined if the check failed). */
  responseMs?: number;
};

// ---------------------------------------------------------------------------
// Tool config entry
// ---------------------------------------------------------------------------

/** Configuration for a single tool runner. */
export type ToolConfigEntry = {
  /** Tool runner identifier (e.g. `"cli-runner"`, `"browser-runner"`). */
  id: string;
  /** Human-readable display name. */
  displayName: string;
  /** Short description of what this tool does. */
  description: string;
  /** Whether this tool runner is currently enabled. */
  status: ToolRunnerStatus;
  /** Default timeout in milliseconds for calls to this tool. */
  defaultTimeoutMs: number;
  /** Maximum concurrent invocations of this tool (0 = unlimited). */
  maxConcurrency: number;
  /** Rate limit: maximum calls per minute (0 = unlimited). */
  rateLimitPerMinute: number;
  /** Most recent health check result. */
  healthCheck?: ToolHealthCheck;
  /** Tool-specific settings (varies by runner type). */
  settings: Record<string, unknown>;
  /** ISO-8601 timestamp when this config was last modified. */
  updatedAt: string;
  /** User who last modified this config. */
  updatedBy: string;
};

// ---------------------------------------------------------------------------
// Config form
// ---------------------------------------------------------------------------

/** Metadata for a single form field in the tool configuration UI. */
export type ToolConfigField = {
  /** Field key (matches a key in `ToolConfigEntry.settings`). */
  key: string;
  /** Display label. */
  label: string;
  /** Field type for rendering the appropriate input control. */
  type: "text" | "number" | "boolean" | "select" | "textarea";
  /** Brief help text shown below the field. */
  helpText?: string;
  /** Whether this field is required. */
  required: boolean;
  /** Default value for the field. */
  defaultValue?: unknown;
  /** Allowed options (for `select` type fields). */
  options?: { label: string; value: string }[];
  /** Validation pattern (regex string, for `text` fields). */
  validationPattern?: string;
};

/** Form definition for editing a tool's configuration. */
export type ToolConfigForm = {
  /** ID of the tool this form configures. */
  toolId: string;
  /** Ordered list of form fields. */
  fields: ToolConfigField[];
  /** Whether the form has unsaved changes. */
  dirty: boolean;
  /** Whether a save operation is in progress. */
  saving: boolean;
  /** Validation errors keyed by field key. */
  errors: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Config section
// ---------------------------------------------------------------------------

/** A logical grouping of tool configurations (e.g. "Communication", "Automation"). */
export type ToolConfigSection = {
  /** Section identifier. */
  id: string;
  /** Display title. */
  title: string;
  /** Optional description for the section header. */
  description?: string;
  /** Tool config entries in this section (ordered). */
  entries: ToolConfigEntry[];
  /** Whether this section is expanded in the UI. */
  expanded: boolean;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default tool configuration sections. */
export const DEFAULT_TOOL_SECTIONS: ToolConfigSection[] = [
  {
    id: "automation",
    title: "Automation",
    description: "CLI and browser automation runners.",
    entries: [],
    expanded: true,
  },
  {
    id: "communication",
    title: "Communication",
    description: "Email, voice, and messaging runners.",
    entries: [],
    expanded: true,
  },
  {
    id: "integration",
    title: "Integration",
    description: "Webhook and external service runners.",
    entries: [],
    expanded: false,
  },
];
