/**
 * Ops approval gate types — Business Skill Packs
 *
 * Covers:
 *   - BIZ-065 (#157) Rotate credentials reminder approval gate
 *   - BIZ-068 (#160) Onboard new employee checklist approval gate
 *   - BIZ-071 (#163) Vendor renewal tracker update approval gate
 *   - BIZ-074 (#166) Website uptime monitor response approval gate
 *
 * Each gate configuration defines the approval parameters for its
 * corresponding Ops workflow. Gates are evaluated by the Clawdbot
 * Approval Gate node (WF-005) at runtime.
 */

import type { ApprovalStatus } from "../approval-node.js";

// ---------------------------------------------------------------------------
// Shared Ops gate types
// ---------------------------------------------------------------------------

/** Urgency levels used across Ops gates to drive escalation timing. */
export type OpsUrgency = "low" | "medium" | "high" | "critical";

/** Common fields shared by all Ops approval gate configurations. */
export type OpsGateBase = {
  /** Unique gate identifier (scoped to the workflow instance). */
  gateId: string;
  /** The workflow run ID this gate belongs to. */
  workflowRunId: string;
  /** Role or user required to approve (empty = any authorised Ops user). */
  approverRole: string;
  /** Minutes before the gate auto-expires if no decision is made. */
  timeoutMinutes: number;
  /** Current status of the gate. */
  status: ApprovalStatus;
  /** ISO-8601 timestamp when the gate was created. */
  createdAt: string;
};

// ---------------------------------------------------------------------------
// BIZ-065 (#157) — Rotate credentials reminder approval gate
// ---------------------------------------------------------------------------

/** Credential types that can be flagged for rotation. */
export type CredentialKind =
  | "api_key"
  | "oauth_token"
  | "database_password"
  | "ssh_key"
  | "tls_certificate"
  | "signing_secret";

/** A single credential pending rotation. */
export type CredentialRotationItem = {
  /** Human-readable name of the credential (e.g. "Stripe API key - production"). */
  credentialName: string;
  /** Category of credential. */
  kind: CredentialKind;
  /** Service or system the credential belongs to. */
  service: string;
  /** ISO-8601 date when the credential was last rotated. */
  lastRotatedAt: string;
  /** Maximum age in days before the credential must be rotated. */
  maxAgeDays: number;
  /** Days overdue (0 if not yet due). */
  daysOverdue: number;
};

/**
 * Gate configuration for the credential rotation reminder workflow.
 * The gate fires when one or more credentials exceed their maximum age
 * and an Ops engineer must approve the rotation plan before execution.
 */
export type RotateCredentialsGate = OpsGateBase & {
  kind: "rotate_credentials";
  /** Credentials flagged for rotation in this batch. */
  credentials: CredentialRotationItem[];
  /** Overall urgency derived from the most overdue credential. */
  urgency: OpsUrgency;
  /** Whether to auto-approve if all credentials are non-production. */
  autoApproveNonProd: boolean;
};

// ---------------------------------------------------------------------------
// BIZ-068 (#160) — Onboard new employee checklist approval gate
// ---------------------------------------------------------------------------

/** Departments an employee can be onboarded into. */
export type OnboardDepartment =
  | "engineering"
  | "design"
  | "product"
  | "marketing"
  | "sales"
  | "finance"
  | "ops"
  | "people"
  | "support"
  | "legal";

/** A single onboarding checklist task. */
export type OnboardTask = {
  /** Task identifier. */
  taskId: string;
  /** Human-readable task description. */
  description: string;
  /** Whether the task is complete. */
  completed: boolean;
  /** Who is responsible for this task (role or user). */
  assignee: string;
};

/**
 * Gate configuration for the new employee onboarding checklist workflow.
 * The gate pauses execution so a hiring manager can review and approve
 * the generated checklist before provisioning accounts and hardware.
 */
export type OnboardEmployeeGate = OpsGateBase & {
  kind: "onboard_employee";
  /** Full name of the new hire. */
  employeeName: string;
  /** Email address (may be a placeholder until account creation). */
  email: string;
  /** Target department. */
  department: OnboardDepartment;
  /** Start date (ISO-8601). */
  startDate: string;
  /** Generated checklist tasks for review. */
  tasks: OnboardTask[];
  /** Whether hardware has already been ordered. */
  hardwareOrdered: boolean;
};

// ---------------------------------------------------------------------------
// BIZ-071 (#163) — Vendor renewal tracker update approval gate
// ---------------------------------------------------------------------------

/** Vendor contract status. */
export type VendorContractStatus = "active" | "expiring_soon" | "expired" | "renewed" | "cancelled";

/** A vendor contract up for renewal review. */
export type VendorRenewalItem = {
  /** Vendor or supplier name. */
  vendorName: string;
  /** Internal contract identifier. */
  contractId: string;
  /** Current contract status. */
  status: VendorContractStatus;
  /** ISO-8601 expiry date of the current term. */
  expiryDate: string;
  /** Annual contract value in USD cents. */
  annualValueCents: number;
  /** Whether auto-renewal is enabled on the vendor side. */
  autoRenewal: boolean;
  /** Days until expiry (negative = already expired). */
  daysUntilExpiry: number;
};

/**
 * Gate configuration for the vendor renewal tracker workflow.
 * The gate fires before the tracker spreadsheet/system is updated so
 * a finance or procurement lead can verify the renewal data.
 */
export type VendorRenewalGate = OpsGateBase & {
  kind: "vendor_renewal";
  /** Vendor contracts included in this update batch. */
  renewals: VendorRenewalItem[];
  /** Total annual value of expiring contracts (USD cents). */
  totalExpiringValueCents: number;
  /** Urgency based on nearest expiry date. */
  urgency: OpsUrgency;
};

// ---------------------------------------------------------------------------
// BIZ-074 (#166) — Website uptime monitor response approval gate
// ---------------------------------------------------------------------------

/** Severity of a detected uptime incident. */
export type IncidentSeverity = "info" | "warning" | "error" | "critical";

/** Proposed automated response action. */
export type UptimeResponseAction =
  | "restart_service"
  | "scale_up"
  | "failover"
  | "rollback_deploy"
  | "page_oncall"
  | "disable_feature_flag"
  | "custom";

/** Details of the uptime incident that triggered the gate. */
export type UptimeIncident = {
  /** Monitor or check name (e.g. "api.example.com /healthz"). */
  monitorName: string;
  /** URL or endpoint being monitored. */
  endpoint: string;
  /** HTTP status code returned (0 if unreachable). */
  httpStatus: number;
  /** Response time in milliseconds (0 if timeout). */
  responseTimeMs: number;
  /** Incident severity. */
  severity: IncidentSeverity;
  /** ISO-8601 timestamp when the incident was first detected. */
  detectedAt: string;
  /** Number of consecutive failures. */
  consecutiveFailures: number;
};

/**
 * Gate configuration for the website uptime monitor response workflow.
 * When an outage or degradation is detected the workflow proposes a
 * remediation action; this gate requires Ops approval before executing
 * potentially destructive actions like rollbacks or failovers.
 */
export type UptimeMonitorGate = OpsGateBase & {
  kind: "uptime_monitor";
  /** The incident that triggered this response. */
  incident: UptimeIncident;
  /** Proposed automated response action. */
  proposedAction: UptimeResponseAction;
  /** Human-readable description of what the action will do. */
  actionDescription: string;
  /** Whether the action can be auto-approved for low-severity incidents. */
  autoApproveInfoLevel: boolean;
};

// ---------------------------------------------------------------------------
// Discriminated union of all Ops gates
// ---------------------------------------------------------------------------

/** Union of all Ops approval gate configurations. */
export type OpsApprovalGate =
  | RotateCredentialsGate
  | OnboardEmployeeGate
  | VendorRenewalGate
  | UptimeMonitorGate;
