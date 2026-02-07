/**
 * Skill framework barrel export.
 *
 * Re-exports every public type and function from the skill framework
 * modules so consumers can import from a single entry point:
 *
 *   import { validateManifest, SkillLoader, ... } from "../clawdbot/skills/index.ts";
 */

// SK-001 -- Manifest schema validation
export { ALLOWED_TOOL_TYPES, validateManifest } from "./manifest-schema.ts";
export type { AllowedToolType, ManifestPermissions, ManifestV1 } from "./manifest-schema.ts";

// SK-002 -- Skill loader and sandbox runner
export { SkillLoader, SandboxRunner } from "./loader.ts";
export type { LoadedSkill, SandboxResult } from "./loader.ts";

// SK-003 -- Signed bundle format
export { signBundle, verifyBundleSignature } from "./signing.ts";
export type { BundleSignature } from "./signing.ts";

// SK-004 -- Internal registry API
export { InMemorySkillRegistry } from "./registry.ts";
export type { SkillRegistry, SkillRegistryEntry, SkillStatus } from "./registry.ts";

// SK-005 -- Approval policy hooks
export { checkApprovalRequired } from "./approval.ts";
export type { ApprovalDecision, ApprovalGate } from "./approval.ts";

// SK-006 -- Permissions allowlist
export { checkDomainAccess, checkPermission, checkSecretAccess } from "./permissions.ts";
export type { PermissionCheckResult } from "./permissions.ts";

// SK-007 -- Deprecation notices
export { checkDeprecation } from "./deprecation.ts";
export type { DeprecationNotice } from "./deprecation.ts";

// SK-008 -- Changelog and manifest diff
export { diffManifests } from "./changelog.ts";
export type { ChangeEntry, FieldChange, ManifestDiff, SkillChangelog } from "./changelog.ts";
