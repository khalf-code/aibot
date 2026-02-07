/**
 * SK-007 (#33) -- Deprecation notices
 *
 * Types and lookup function for skill deprecation. When a skill (or a
 * specific version) is deprecated, the runtime surfaces a notice to
 * operators and can suggest a replacement skill.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A deprecation notice attached to a skill version. */
export type DeprecationNotice = {
  /** Name of the deprecated skill. */
  skill_name: string;
  /** Version that is deprecated (or `"*"` if all versions are deprecated). */
  version: string;
  /** ISO-8601 timestamp of when the deprecation was announced. */
  deprecated_at: string;
  /** Name of the recommended replacement skill, if any. */
  replacement_skill: string | null;
  /** Human-readable deprecation message shown to operators. */
  message: string;
};

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/**
 * Check whether a skill version has been deprecated.
 *
 * Stub -- returns `null` (no deprecation). Replace with a lookup against
 * the registry or a local deprecation index once the registry is wired up.
 *
 * @param skillName - The skill to check.
 * @param version - The specific version to check.
 * @returns The deprecation notice, or `null` if the skill is not deprecated.
 */
export function checkDeprecation(skillName: string, version: string): DeprecationNotice | null {
  // TODO: look up deprecation status from the skill registry or a
  //       local JSON/YAML index of deprecation notices.
  void skillName;
  void version;
  return null;
}
