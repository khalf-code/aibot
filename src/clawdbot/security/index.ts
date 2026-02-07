/**
 * Clawdbot security framework — barrel export
 *
 * Re-exports every security module so consumers can import from a single path:
 *   import { PolicyEngine, AuditLogService, ... } from "../clawdbot/security/index.js";
 */

// SEC-001 (#75) Policy engine v1
export { PolicyEngine } from "./policy-engine.js";
export type {
  ActionContext,
  Policy,
  PolicyAction,
  PolicyCondition,
  PolicyEvaluation,
  PolicyRule,
} from "./policy-engine.js";

// SEC-002 (#76) Audit log service
export { InMemoryAuditLog } from "./audit-log.js";
export type {
  AuditCategory,
  AuditEvent,
  AuditLogService,
  AuditQuery,
  AuditSeverity,
} from "./audit-log.js";

// SEC-003 (#77) Data retention policies
export { applyRetention, DEFAULT_RETENTION_POLICIES } from "./data-retention.js";
export type {
  DataPurgeResult,
  PurgeStrategy,
  RetentionCategory,
  RetentionPolicy,
  RetentionRecord,
} from "./data-retention.js";

// SEC-004 (#78) PII tagging + masking
export { detectPii, maskPii } from "./pii.js";
export type {
  PiiDetection,
  PiiMaskConfig,
  PiiMaskResult,
  PiiMaskStrategy,
  PiiType,
} from "./pii.js";

// SEC-005 (#79) Secret rotation workflow
export { StubSecretRotator } from "./secret-rotation.js";
export type {
  RotationResult,
  RotationSchedule,
  RotationStatus,
  SecretRotator,
} from "./secret-rotation.js";

// SEC-006 (#80) Signed workflow definitions
export { signWorkflow, verifyWorkflow } from "./signed-workflows.js";
export type {
  SignedWorkflow,
  VerificationResult,
  WorkflowDefinition,
  WorkflowSignature,
} from "./signed-workflows.js";

// SEC-007 (#81) Approval risk scoring
export { calculateRiskScore } from "./risk-scoring.js";
export type { RiskContext, RiskFactor, RiskLevel, RiskScore } from "./risk-scoring.js";

// SEC-008 (#82) Outbound content policy filters
export { DEFAULT_FILTER_RULES, filterOutboundContent } from "./content-filter.js";
export type {
  ContentCategory,
  ContentFilterRule,
  FilterAction,
  FilterMatch,
  FilterResult,
} from "./content-filter.js";

// SEC-009 (#83) SSO integration stub
export type {
  SsoAuthResult,
  SsoConfig,
  SsoProvider,
  SsoProviderType,
  SsoService,
  SsoSession,
} from "./sso.js";

// SEC-010 (#84) Environment separation enforcement
export { DEFAULT_CROSS_ENV_POLICY, validateCrossEnvAccess } from "./env-separation.js";
export type {
  BoundaryCondition,
  CrossEnvAccessResult,
  CrossEnvPolicy,
  EnvironmentBoundary,
} from "./env-separation.js";
