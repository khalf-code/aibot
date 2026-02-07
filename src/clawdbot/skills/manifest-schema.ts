/**
 * SK-001 (#27) -- Manifest v1 schema validation
 *
 * TypeScript interface and validation function for the skill manifest
 * format declared in `skills/_template/manifest.yaml`. The runtime
 * validates every manifest before loading a skill.
 */

// ---------------------------------------------------------------------------
// Allowed tool types
// ---------------------------------------------------------------------------

/** Tool runners a skill may request in its manifest. */
export const ALLOWED_TOOL_TYPES = ["cli-runner", "browser-runner", "email-runner"] as const;

export type AllowedToolType = (typeof ALLOWED_TOOL_TYPES)[number];

// ---------------------------------------------------------------------------
// ManifestV1 interface
// ---------------------------------------------------------------------------

/** Permissions block inside a skill manifest. */
export type ManifestPermissions = {
  /** Tool runners the skill can use. */
  tools: string[];
  /** Secret names the skill reads from the vault at runtime. */
  secrets: string[];
  /** Internet domains the skill can access. Use `"*"` for unrestricted. */
  domains: string[];
};

/**
 * The canonical shape of a v1 skill manifest (`manifest.yaml`).
 *
 * Every field here maps 1:1 to the top-level keys in the YAML file.
 */
export interface ManifestV1 {
  /** Skill name -- must match the directory name. Lowercase, digits, hyphens only. */
  name: string;
  /** Semantic version string (e.g. `"1.0.0"`). */
  version: string;
  /** One-sentence description of what the skill does. */
  description: string;
  /** Permission declarations for tools, secrets, and network domains. */
  permissions: ManifestPermissions;
  /** Whether the runtime must pause for human approval before execution. */
  approval_required: boolean;
  /** Maximum execution time in milliseconds. */
  timeout_ms: number;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Semver-ish pattern: MAJOR.MINOR.PATCH with optional pre-release suffix. */
const SEMVER_RE = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;

/** Skill name pattern: lowercase letters, digits, and hyphens. */
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Validate a parsed manifest object against the v1 schema.
 *
 * Returns `{ valid: true, errors: [] }` when the manifest is well-formed,
 * or `{ valid: false, errors: [...] }` with human-readable error strings.
 */
export function validateManifest(manifest: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (manifest === null || manifest === undefined || typeof manifest !== "object") {
    return { valid: false, errors: ["Manifest must be a non-null object."] };
  }

  const m = manifest as Record<string, unknown>;

  // -- name (required, string, pattern) ------------------------------------
  if (typeof m.name !== "string" || m.name.length === 0) {
    errors.push("'name' is required and must be a non-empty string.");
  } else if (!NAME_RE.test(m.name)) {
    errors.push(
      `'name' must contain only lowercase letters, digits, and hyphens (got "${m.name}").`,
    );
  }

  // -- version (required, semver) ------------------------------------------
  if (typeof m.version !== "string" || m.version.length === 0) {
    errors.push("'version' is required and must be a non-empty string.");
  } else if (!SEMVER_RE.test(m.version)) {
    errors.push(`'version' must be a valid semver string like "1.0.0" (got "${m.version}").`);
  }

  // -- description (required, string) --------------------------------------
  if (typeof m.description !== "string" || m.description.length === 0) {
    errors.push("'description' is required and must be a non-empty string.");
  }

  // -- permissions (required, object) --------------------------------------
  if (m.permissions === null || m.permissions === undefined || typeof m.permissions !== "object") {
    errors.push("'permissions' is required and must be an object.");
  } else {
    const perms = m.permissions as Record<string, unknown>;

    // permissions.tools
    if (!Array.isArray(perms.tools)) {
      errors.push("'permissions.tools' must be an array.");
    } else {
      for (const tool of perms.tools) {
        if (typeof tool !== "string") {
          errors.push(`Each entry in 'permissions.tools' must be a string (got ${typeof tool}).`);
        } else if (!(ALLOWED_TOOL_TYPES as readonly string[]).includes(tool)) {
          errors.push(
            `Unknown tool type "${tool}". Allowed values: ${ALLOWED_TOOL_TYPES.join(", ")}.`,
          );
        }
      }
    }

    // permissions.secrets
    if (!Array.isArray(perms.secrets)) {
      errors.push("'permissions.secrets' must be an array.");
    } else {
      for (const secret of perms.secrets) {
        if (typeof secret !== "string") {
          errors.push(
            `Each entry in 'permissions.secrets' must be a string (got ${typeof secret}).`,
          );
        }
      }
    }

    // permissions.domains
    if (!Array.isArray(perms.domains)) {
      errors.push("'permissions.domains' must be an array.");
    } else {
      for (const domain of perms.domains) {
        if (typeof domain !== "string") {
          errors.push(
            `Each entry in 'permissions.domains' must be a string (got ${typeof domain}).`,
          );
        }
      }
    }
  }

  // -- approval_required (required, boolean) --------------------------------
  if (typeof m.approval_required !== "boolean") {
    errors.push("'approval_required' must be a boolean.");
  }

  // -- timeout_ms (required, positive number) ------------------------------
  if (typeof m.timeout_ms !== "number" || !Number.isFinite(m.timeout_ms)) {
    errors.push("'timeout_ms' must be a finite number.");
  } else if (m.timeout_ms <= 0) {
    errors.push("'timeout_ms' must be a positive number.");
  }

  return { valid: errors.length === 0, errors };
}
