/**
 * SK-008 (#34) -- Changelog and manifest diff
 *
 * Types for tracking skill version history and a function for diffing
 * two manifest versions to detect what changed between releases.
 */

import type { ManifestV1, ManifestPermissions } from "./manifest-schema.ts";

// ---------------------------------------------------------------------------
// Changelog types
// ---------------------------------------------------------------------------

/** A single entry describing one change within a version. */
export type ChangeEntry = {
  /** What changed (e.g. "Added browser-runner tool permission"). */
  description: string;
  /** Category of change. */
  kind: "added" | "changed" | "removed" | "fixed";
};

/** Changelog record for a single version of a skill. */
export type SkillChangelog = {
  /** The version this changelog entry describes. */
  version: string;
  /** ISO-8601 date string for the release. */
  date: string;
  /** Non-breaking changes. */
  changes: ChangeEntry[];
  /** Breaking changes that may require operator action. */
  breaking_changes: ChangeEntry[];
};

// ---------------------------------------------------------------------------
// Manifest diff
// ---------------------------------------------------------------------------

/** The result of comparing two manifest versions. */
export type ManifestDiff = {
  /** Fields that were added, removed, or had their value changed. */
  fieldChanges: FieldChange[];
  /** Whether any change is considered breaking (permissions removed, etc.). */
  hasBreakingChanges: boolean;
};

/** A single field-level change between two manifests. */
export type FieldChange = {
  /** Dot-separated path to the changed field (e.g. `"permissions.tools"`). */
  field: string;
  /** The value in the old manifest. */
  oldValue: unknown;
  /** The value in the new manifest. */
  newValue: unknown;
  /** Whether this specific change is breaking. */
  breaking: boolean;
};

// ---------------------------------------------------------------------------
// Diff implementation
// ---------------------------------------------------------------------------

/**
 * Compare two ManifestV1 objects and return the differences.
 *
 * A change is considered "breaking" when:
 *   - A required tool, secret, or domain permission is removed.
 *   - `approval_required` changes from `false` to `true`.
 *   - `timeout_ms` is decreased.
 *
 * @param oldManifest - The previous version of the manifest.
 * @param newManifest - The updated version of the manifest.
 * @returns A `ManifestDiff` describing all changes and whether any are breaking.
 */
export function diffManifests(oldManifest: ManifestV1, newManifest: ManifestV1): ManifestDiff {
  const fieldChanges: FieldChange[] = [];

  // -- Scalar fields -------------------------------------------------------

  if (oldManifest.name !== newManifest.name) {
    fieldChanges.push({
      field: "name",
      oldValue: oldManifest.name,
      newValue: newManifest.name,
      breaking: true,
    });
  }

  if (oldManifest.version !== newManifest.version) {
    fieldChanges.push({
      field: "version",
      oldValue: oldManifest.version,
      newValue: newManifest.version,
      breaking: false,
    });
  }

  if (oldManifest.description !== newManifest.description) {
    fieldChanges.push({
      field: "description",
      oldValue: oldManifest.description,
      newValue: newManifest.description,
      breaking: false,
    });
  }

  if (oldManifest.approval_required !== newManifest.approval_required) {
    fieldChanges.push({
      field: "approval_required",
      oldValue: oldManifest.approval_required,
      newValue: newManifest.approval_required,
      // Breaking if approval was not required before but now is.
      breaking: !oldManifest.approval_required && newManifest.approval_required,
    });
  }

  if (oldManifest.timeout_ms !== newManifest.timeout_ms) {
    fieldChanges.push({
      field: "timeout_ms",
      oldValue: oldManifest.timeout_ms,
      newValue: newManifest.timeout_ms,
      // Breaking if the timeout was decreased (skill may start timing out).
      breaking: newManifest.timeout_ms < oldManifest.timeout_ms,
    });
  }

  // -- Permissions arrays --------------------------------------------------

  diffArrayField(
    "permissions.tools",
    oldManifest.permissions.tools,
    newManifest.permissions.tools,
    fieldChanges,
  );

  diffArrayField(
    "permissions.secrets",
    oldManifest.permissions.secrets,
    newManifest.permissions.secrets,
    fieldChanges,
  );

  diffArrayField(
    "permissions.domains",
    oldManifest.permissions.domains,
    newManifest.permissions.domains,
    fieldChanges,
  );

  const hasBreakingChanges = fieldChanges.some((c) => c.breaking);
  return { fieldChanges, hasBreakingChanges };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compare two string arrays and record additions/removals as field changes.
 * Removals are always considered breaking (permission/capability lost).
 */
function diffArrayField(
  field: string,
  oldArr: string[],
  newArr: string[],
  out: FieldChange[],
): void {
  const oldSet = new Set(oldArr);
  const newSet = new Set(newArr);

  const added = newArr.filter((v) => !oldSet.has(v));
  const removed = oldArr.filter((v) => !newSet.has(v));

  if (added.length > 0 || removed.length > 0) {
    out.push({
      field,
      oldValue: oldArr,
      newValue: newArr,
      // Removals are breaking -- a previously available permission is gone.
      breaking: removed.length > 0,
    });
  }
}
