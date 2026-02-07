/**
 * UI-010 (#71) -- Secrets UI (scoped)
 *
 * Type definitions for the secrets management view. Operators can
 * create, rotate, and scope secrets to specific skills or environments.
 * Secret values are never exposed in the UI after creation -- only
 * metadata is displayed.
 */

// ---------------------------------------------------------------------------
// Secret scope
// ---------------------------------------------------------------------------

/** The scope at which a secret is available. */
export type SecretScopeLevel = "global" | "environment" | "skill";

/** Defines where a secret is accessible. */
export type SecretScope = {
  /** Scope level. */
  level: SecretScopeLevel;
  /**
   * Scope target identifier.
   *
   * - For `global`: unused (empty string).
   * - For `environment`: the environment name (e.g. `"prod"`, `"staging"`).
   * - For `skill`: the skill name.
   */
  target: string;
};

// ---------------------------------------------------------------------------
// Secret entry
// ---------------------------------------------------------------------------

/** Metadata for a stored secret (value is never exposed). */
export type SecretEntry = {
  /** Unique identifier for this secret. */
  id: string;
  /** Secret name / key (e.g. `"OPENAI_API_KEY"`). */
  name: string;
  /** Brief description of what this secret is for. */
  description?: string;
  /** Scopes where this secret is available. */
  scopes: SecretScope[];
  /** ISO-8601 timestamp when the secret was created. */
  createdAt: string;
  /** ISO-8601 timestamp when the secret value was last rotated. */
  rotatedAt: string;
  /** User who created the secret. */
  createdBy: string;
  /** User who last rotated the secret value. */
  rotatedBy: string;
  /** Whether the secret value has been set (it may exist as a placeholder). */
  hasValue: boolean;
  /** Number of days until the secret should be rotated (0 = no policy). */
  rotationPolicyDays: number;
  /** Whether the secret is past its rotation deadline. */
  rotationOverdue: boolean;
  /** Number of skills currently referencing this secret. */
  usageCount: number;
};

// ---------------------------------------------------------------------------
// Secret form
// ---------------------------------------------------------------------------

/** Input for creating or updating a secret. */
export type SecretForm = {
  /** Secret name (required, uppercase convention). */
  name: string;
  /** Secret value (only provided on create or rotate; never read back). */
  value?: string;
  /** Description of the secret. */
  description?: string;
  /** Scopes to assign. */
  scopes: SecretScope[];
  /** Rotation policy in days (0 = no automatic rotation reminders). */
  rotationPolicyDays: number;
};

/** Validation state for the secret form. */
export type SecretFormValidation = {
  /** Whether the form is valid. */
  valid: boolean;
  /** Per-field error messages. */
  errors: {
    name?: string;
    value?: string;
    scopes?: string;
  };
};

// ---------------------------------------------------------------------------
// Secrets list configuration
// ---------------------------------------------------------------------------

/** Sort fields for the secrets list. */
export type SecretSortField = "name" | "createdAt" | "rotatedAt" | "usageCount";

/** Filter criteria for the secrets list. */
export type SecretFilter = {
  /** Only show secrets at these scope levels. Empty = all. */
  scopeLevels: SecretScopeLevel[];
  /** Free-text search (matched against name, description). */
  search?: string;
  /** Only show secrets that are overdue for rotation. */
  rotationOverdueOnly: boolean;
};

/** Configuration state for the secrets list view. */
export type SecretsListConfig = {
  /** Active filter criteria. */
  filter: SecretFilter;
  /** Sort field. */
  sortField: SecretSortField;
  /** Sort direction. */
  sortDirection: "asc" | "desc";
  /** Number of items per page. */
  pageSize: number;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default secrets filter (all secrets). */
export const DEFAULT_SECRET_FILTER: SecretFilter = {
  scopeLevels: [],
  rotationOverdueOnly: false,
};

/** Default secrets list configuration. */
export const DEFAULT_SECRETS_LIST_CONFIG: SecretsListConfig = {
  filter: DEFAULT_SECRET_FILTER,
  sortField: "name",
  sortDirection: "asc",
  pageSize: 25,
};
