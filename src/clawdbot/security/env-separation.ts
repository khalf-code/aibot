/**
 * SEC-010 (#84) — Environment separation enforcement
 *
 * Runtime enforcement of environment boundaries. Prevents accidental
 * cross-environment data access, credential leakage, and configuration
 * drift. Each environment (dev, staging, prod) has strict isolation
 * rules that are validated before any cross-boundary operation.
 */

import { Environment } from "../types/config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A boundary definition between two environments. */
export type EnvironmentBoundary = {
  /** Source environment (where the request originates). */
  source: Environment;
  /** Target environment (where the resource lives). */
  target: Environment;
  /** Whether cross-boundary access is allowed at all. */
  allowed: boolean;
  /** Conditions under which the access may be permitted. */
  conditions: BoundaryCondition[];
};

/** A condition that must be satisfied for cross-env access to be allowed. */
export type BoundaryCondition = {
  /** Human-readable identifier. */
  id: string;
  /** Description of the condition. */
  description: string;
  /** The type of check to perform. */
  check: "requires_approval" | "read_only" | "audit_logged" | "time_limited" | "never";
  /** Optional parameters for the check (e.g. TTL for time_limited). */
  params?: Record<string, unknown>;
};

/** Policy governing all cross-environment interactions. */
export type CrossEnvPolicy = {
  /** Set of boundary definitions. */
  boundaries: EnvironmentBoundary[];
  /** If true, any unspecified boundary pair is denied by default. */
  denyByDefault: boolean;
};

/** The result of a cross-environment access validation. */
export type CrossEnvAccessResult = {
  /** Whether the access is permitted. */
  allowed: boolean;
  /** Human-readable explanation. */
  reason: string;
  /** Conditions that must be satisfied (even if access is allowed). */
  requiredConditions: BoundaryCondition[];
  /** Source environment of the request. */
  source: Environment;
  /** Target environment of the request. */
  target: Environment;
};

// ---------------------------------------------------------------------------
// Default policy
// ---------------------------------------------------------------------------

/**
 * Default cross-environment policy. Production access from non-prod
 * environments is forbidden. Staging-to-dev is allowed read-only.
 */
export const DEFAULT_CROSS_ENV_POLICY: CrossEnvPolicy = {
  denyByDefault: true,
  boundaries: [
    // Same-environment access is always allowed.
    {
      source: Environment.Dev,
      target: Environment.Dev,
      allowed: true,
      conditions: [],
    },
    {
      source: Environment.Staging,
      target: Environment.Staging,
      allowed: true,
      conditions: [],
    },
    {
      source: Environment.Prod,
      target: Environment.Prod,
      allowed: true,
      conditions: [],
    },

    // Dev -> Staging: allowed with audit logging.
    {
      source: Environment.Dev,
      target: Environment.Staging,
      allowed: true,
      conditions: [
        {
          id: "dev-to-staging-audit",
          description: "Dev-to-staging access must be audit logged.",
          check: "audit_logged",
        },
        {
          id: "dev-to-staging-readonly",
          description: "Dev-to-staging access is read-only.",
          check: "read_only",
        },
      ],
    },

    // Staging -> Dev: allowed read-only.
    {
      source: Environment.Staging,
      target: Environment.Dev,
      allowed: true,
      conditions: [
        {
          id: "staging-to-dev-readonly",
          description: "Staging-to-dev access is read-only.",
          check: "read_only",
        },
      ],
    },

    // Dev -> Prod: never allowed.
    {
      source: Environment.Dev,
      target: Environment.Prod,
      allowed: false,
      conditions: [
        {
          id: "dev-to-prod-never",
          description: "Direct dev-to-prod access is forbidden.",
          check: "never",
        },
      ],
    },

    // Staging -> Prod: allowed with approval and time limit.
    {
      source: Environment.Staging,
      target: Environment.Prod,
      allowed: true,
      conditions: [
        {
          id: "staging-to-prod-approval",
          description: "Staging-to-prod access requires explicit approval.",
          check: "requires_approval",
        },
        {
          id: "staging-to-prod-time-limited",
          description: "Staging-to-prod access is time-limited to 1 hour.",
          check: "time_limited",
          params: { ttlMinutes: 60 },
        },
        {
          id: "staging-to-prod-audit",
          description: "Staging-to-prod access must be audit logged.",
          check: "audit_logged",
        },
      ],
    },

    // Prod -> Dev / Staging: allowed read-only with audit.
    {
      source: Environment.Prod,
      target: Environment.Dev,
      allowed: true,
      conditions: [
        {
          id: "prod-to-dev-readonly",
          description: "Prod-to-dev access is read-only.",
          check: "read_only",
        },
        {
          id: "prod-to-dev-audit",
          description: "Prod-to-dev access must be audit logged.",
          check: "audit_logged",
        },
      ],
    },
    {
      source: Environment.Prod,
      target: Environment.Staging,
      allowed: true,
      conditions: [
        {
          id: "prod-to-staging-readonly",
          description: "Prod-to-staging access is read-only.",
          check: "read_only",
        },
        {
          id: "prod-to-staging-audit",
          description: "Prod-to-staging access must be audit logged.",
          check: "audit_logged",
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate whether a cross-environment access is allowed by the given policy.
 *
 * @param source - The environment originating the request.
 * @param target - The environment being accessed.
 * @param policy - The cross-environment policy to enforce (defaults to
 *                 `DEFAULT_CROSS_ENV_POLICY`).
 * @returns Validation result including required conditions.
 */
export function validateCrossEnvAccess(
  source: Environment,
  target: Environment,
  policy: CrossEnvPolicy = DEFAULT_CROSS_ENV_POLICY,
): CrossEnvAccessResult {
  // Same environment is always allowed.
  if (source === target) {
    return {
      allowed: true,
      reason: "Same-environment access is always permitted.",
      requiredConditions: [],
      source,
      target,
    };
  }

  // Look up the boundary definition for this pair.
  const boundary = policy.boundaries.find((b) => b.source === source && b.target === target);

  if (!boundary) {
    // No explicit boundary defined — fall back to the policy default.
    const allowed = !policy.denyByDefault;
    return {
      allowed,
      reason: allowed
        ? "No explicit boundary defined; policy allows by default."
        : `No boundary defined for ${source} -> ${target}; denied by default policy.`,
      requiredConditions: [],
      source,
      target,
    };
  }

  if (!boundary.allowed) {
    return {
      allowed: false,
      reason:
        boundary.conditions.find((c) => c.check === "never")?.description ??
        `Cross-environment access from ${source} to ${target} is not allowed.`,
      requiredConditions: boundary.conditions,
      source,
      target,
    };
  }

  return {
    allowed: true,
    reason: `Access from ${source} to ${target} is permitted subject to conditions.`,
    requiredConditions: boundary.conditions,
    source,
    target,
  };
}
