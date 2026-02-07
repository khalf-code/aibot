/**
 * SK-006 (#32) -- Permissions allowlist
 *
 * Runtime enforcement of the permissions declared in a skill's manifest.
 * Every tool call, secret access, and outbound network request is checked
 * against the manifest's `permissions` block before being allowed.
 */

import type { ManifestV1 } from "./manifest-schema.ts";
import { ALLOWED_TOOL_TYPES } from "./manifest-schema.ts";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/** Result of a permission check. */
export type PermissionCheckResult = {
  /** Whether the action is allowed. */
  allowed: boolean;
  /** Human-readable explanation when denied. */
  reason?: string;
};

// ---------------------------------------------------------------------------
// Tool permission
// ---------------------------------------------------------------------------

/**
 * Check whether a skill is allowed to use a specific tool runner.
 *
 * @param manifest - The validated skill manifest.
 * @param toolName - The tool runner being invoked (e.g. `"browser-runner"`).
 * @returns Whether the call is permitted and, if not, why.
 */
export function checkPermission(manifest: ManifestV1, toolName: string): PermissionCheckResult {
  // Reject unknown tool types at the gate -- they can never be allowed.
  if (!(ALLOWED_TOOL_TYPES as readonly string[]).includes(toolName)) {
    return {
      allowed: false,
      reason: `Unknown tool type "${toolName}". Allowed types: ${ALLOWED_TOOL_TYPES.join(", ")}.`,
    };
  }

  if (manifest.permissions.tools.includes(toolName)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Skill "${manifest.name}" does not declare "${toolName}" in permissions.tools.`,
  };
}

// ---------------------------------------------------------------------------
// Secret permission
// ---------------------------------------------------------------------------

/**
 * Check whether a skill is allowed to read a specific secret from the vault.
 *
 * @param manifest - The validated skill manifest.
 * @param secretName - The secret being accessed (e.g. `"OPENAI_API_KEY"`).
 * @returns Whether the access is permitted and, if not, why.
 */
export function checkSecretAccess(manifest: ManifestV1, secretName: string): PermissionCheckResult {
  if (manifest.permissions.secrets.includes(secretName)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Skill "${manifest.name}" does not declare "${secretName}" in permissions.secrets.`,
  };
}

// ---------------------------------------------------------------------------
// Domain permission
// ---------------------------------------------------------------------------

/**
 * Check whether a skill is allowed to make network requests to a domain.
 *
 * Supports exact matches and wildcard entries:
 *   - `"*"` allows all domains.
 *   - `"*.example.com"` allows any subdomain of example.com.
 *   - `"api.example.com"` allows only that exact domain.
 *
 * @param manifest - The validated skill manifest.
 * @param domain - The target domain (e.g. `"api.github.com"`).
 * @returns Whether the request is permitted and, if not, why.
 */
export function checkDomainAccess(manifest: ManifestV1, domain: string): PermissionCheckResult {
  const normalizedDomain = domain.toLowerCase();

  for (const allowed of manifest.permissions.domains) {
    // Universal wildcard -- allows everything.
    if (allowed === "*") {
      return { allowed: true };
    }

    const normalizedAllowed = allowed.toLowerCase();

    // Exact match.
    if (normalizedAllowed === normalizedDomain) {
      return { allowed: true };
    }

    // Wildcard subdomain match: "*.example.com" matches "api.example.com"
    // but not "example.com" itself.
    if (normalizedAllowed.startsWith("*.")) {
      const suffix = normalizedAllowed.slice(1); // ".example.com"
      if (normalizedDomain.endsWith(suffix) && normalizedDomain !== suffix.slice(1)) {
        return { allowed: true };
      }
    }
  }

  return {
    allowed: false,
    reason: `Skill "${manifest.name}" is not allowed to access domain "${domain}". Declared domains: ${manifest.permissions.domains.join(", ") || "(none)"}.`,
  };
}
