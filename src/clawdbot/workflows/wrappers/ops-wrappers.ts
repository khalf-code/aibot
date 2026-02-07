/**
 * Ops workflow wrapper types — Business Skill Packs
 *
 * Covers:
 *   - BIZ-066 (#158) Rotate credentials reminder workflow wrapper
 *   - BIZ-069 (#161) Onboard new employee checklist workflow wrapper
 *   - BIZ-072 (#164) Vendor renewal tracker update workflow wrapper
 *   - BIZ-075 (#167) Website uptime monitor response workflow wrapper
 *
 * Each wrapper type defines the orchestration shape for its Ops workflow,
 * including inputs, outputs, step definitions, and execution state.
 */

import type {
  OpsUrgency,
  CredentialRotationItem,
  OnboardDepartment,
  OnboardTask,
  VendorRenewalItem,
  UptimeIncident,
  UptimeResponseAction,
} from "../gates/ops-gates.js";
import type { RetryPolicy, ErrorHandler } from "../retry-policy.js";
import type { WorkflowTrigger } from "../trigger.js";

// ---------------------------------------------------------------------------
// Shared wrapper types
// ---------------------------------------------------------------------------

/** Execution status for a workflow run. */
export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

/** Common fields shared by all Ops workflow wrappers. */
export type OpsWrapperBase = {
  /** Workflow definition ID (template). */
  workflowId: string;
  /** Unique execution / run ID. */
  runId: string;
  /** Current execution status. */
  status: WorkflowRunStatus;
  /** Trigger that initiated this run. */
  trigger: WorkflowTrigger;
  /** Retry policy applied to recoverable steps. */
  retryPolicy: RetryPolicy;
  /** Error handler for unrecoverable failures. */
  errorHandler: ErrorHandler;
  /** ISO-8601 timestamp when the run started. */
  startedAt: string;
  /** ISO-8601 timestamp when the run completed (if finished). */
  completedAt?: string;
  /** Wall-clock duration in milliseconds (set on completion). */
  durationMs?: number;
};

// ---------------------------------------------------------------------------
// BIZ-066 (#158) — Rotate credentials reminder workflow wrapper
// ---------------------------------------------------------------------------

/** Step identifiers for the credential rotation workflow. */
export type RotateCredentialsStep =
  | "scan_credentials"
  | "evaluate_age"
  | "generate_rotation_plan"
  | "approval_gate"
  | "execute_rotation"
  | "verify_rotation"
  | "notify_owners"
  | "update_audit_log";

/** Input parameters for the credential rotation workflow. */
export type RotateCredentialsInput = {
  /** Services to scan (empty = all configured services). */
  services: string[];
  /** Maximum credential age in days before flagging. */
  maxAgeDays: number;
  /** Whether to include non-production environments. */
  includeNonProd: boolean;
  /** Notification channel for rotation results. */
  notificationChannel: string;
};

/** Output produced by the credential rotation workflow. */
export type RotateCredentialsOutput = {
  /** Credentials that were scanned. */
  scannedCredentials: CredentialRotationItem[];
  /** Credentials that were successfully rotated. */
  rotatedCredentials: CredentialRotationItem[];
  /** Credentials that failed to rotate. */
  failedCredentials: Array<CredentialRotationItem & { errorMessage: string }>;
  /** Summary message for notification. */
  summaryMessage: string;
};

/**
 * Workflow wrapper for the credential rotation reminder.
 * Orchestrates scanning for stale credentials, generating a rotation
 * plan, gating on Ops approval, executing rotations, and notifying
 * credential owners.
 */
export type RotateCredentialsWrapper = OpsWrapperBase & {
  kind: "rotate_credentials";
  input: RotateCredentialsInput;
  output?: RotateCredentialsOutput;
  currentStep: RotateCredentialsStep;
  urgency: OpsUrgency;
};

// ---------------------------------------------------------------------------
// BIZ-069 (#161) — Onboard new employee checklist workflow wrapper
// ---------------------------------------------------------------------------

/** Step identifiers for the employee onboarding workflow. */
export type OnboardEmployeeStep =
  | "gather_employee_info"
  | "generate_checklist"
  | "approval_gate"
  | "provision_accounts"
  | "order_hardware"
  | "schedule_orientation"
  | "assign_buddy"
  | "send_welcome_email"
  | "notify_team";

/** Input parameters for the employee onboarding workflow. */
export type OnboardEmployeeInput = {
  /** New hire full name. */
  employeeName: string;
  /** New hire email address. */
  email: string;
  /** Target department. */
  department: OnboardDepartment;
  /** Start date (ISO-8601). */
  startDate: string;
  /** Hiring manager name or ID. */
  hiringManager: string;
  /** Job title. */
  jobTitle: string;
  /** Whether to order standard hardware kit. */
  orderHardware: boolean;
};

/** Output produced by the employee onboarding workflow. */
export type OnboardEmployeeOutput = {
  /** Generated checklist tasks. */
  tasks: OnboardTask[];
  /** Accounts provisioned (service names). */
  accountsProvisioned: string[];
  /** Hardware order reference (if applicable). */
  hardwareOrderRef?: string;
  /** Assigned buddy name. */
  assignedBuddy: string;
  /** Welcome email sent (true/false). */
  welcomeEmailSent: boolean;
  /** Summary message. */
  summaryMessage: string;
};

/**
 * Workflow wrapper for new employee onboarding.
 * Orchestrates gathering employee details, generating a department-
 * specific checklist, gating on hiring manager approval, then
 * provisioning accounts, ordering hardware, and sending notifications.
 */
export type OnboardEmployeeWrapper = OpsWrapperBase & {
  kind: "onboard_employee";
  input: OnboardEmployeeInput;
  output?: OnboardEmployeeOutput;
  currentStep: OnboardEmployeeStep;
};

// ---------------------------------------------------------------------------
// BIZ-072 (#164) — Vendor renewal tracker update workflow wrapper
// ---------------------------------------------------------------------------

/** Step identifiers for the vendor renewal tracker workflow. */
export type VendorRenewalStep =
  | "fetch_contracts"
  | "check_expiry_dates"
  | "calculate_spend"
  | "approval_gate"
  | "update_tracker"
  | "notify_procurement"
  | "generate_report";

/** Input parameters for the vendor renewal tracker workflow. */
export type VendorRenewalInput = {
  /** Look-ahead window in days for upcoming renewals. */
  lookAheadDays: number;
  /** Minimum annual contract value (USD cents) to include. */
  minAnnualValueCents: number;
  /** Whether to include auto-renewing contracts. */
  includeAutoRenewal: boolean;
  /** Notification channel for renewal alerts. */
  notificationChannel: string;
};

/** Output produced by the vendor renewal tracker workflow. */
export type VendorRenewalOutput = {
  /** Vendor renewals found in the look-ahead window. */
  renewals: VendorRenewalItem[];
  /** Total annual value of expiring contracts (USD cents). */
  totalExpiringValueCents: number;
  /** Number of contracts requiring action. */
  actionRequiredCount: number;
  /** URL to the updated tracker (spreadsheet, dashboard, etc.). */
  trackerUrl: string;
  /** Summary message for notification. */
  summaryMessage: string;
};

/**
 * Workflow wrapper for the vendor renewal tracker.
 * Orchestrates fetching contract data, checking expiry dates,
 * calculating spend impact, gating on finance/procurement approval,
 * updating the tracker system, and notifying stakeholders.
 */
export type VendorRenewalWrapper = OpsWrapperBase & {
  kind: "vendor_renewal";
  input: VendorRenewalInput;
  output?: VendorRenewalOutput;
  currentStep: VendorRenewalStep;
  urgency: OpsUrgency;
};

// ---------------------------------------------------------------------------
// BIZ-075 (#167) — Website uptime monitor response workflow wrapper
// ---------------------------------------------------------------------------

/** Step identifiers for the uptime monitor response workflow. */
export type UptimeMonitorStep =
  | "detect_incident"
  | "assess_severity"
  | "propose_action"
  | "approval_gate"
  | "execute_remediation"
  | "verify_recovery"
  | "update_status_page"
  | "notify_stakeholders"
  | "create_postmortem";

/** Input parameters for the uptime monitor response workflow. */
export type UptimeMonitorInput = {
  /** Uptime incident details. */
  incident: UptimeIncident;
  /** Whether to auto-approve info-level incidents. */
  autoApproveInfoLevel: boolean;
  /** Status page URL to update. */
  statusPageUrl: string;
  /** On-call notification channel. */
  oncallChannel: string;
};

/** Output produced by the uptime monitor response workflow. */
export type UptimeMonitorOutput = {
  /** Action that was taken. */
  actionTaken: UptimeResponseAction;
  /** Whether the service recovered after remediation. */
  serviceRecovered: boolean;
  /** Recovery time in milliseconds (from detection to recovery). */
  recoveryTimeMs: number;
  /** Status page updated (true/false). */
  statusPageUpdated: boolean;
  /** Postmortem document URL (if created). */
  postmortemUrl?: string;
  /** Summary message for stakeholder notification. */
  summaryMessage: string;
};

/**
 * Workflow wrapper for website uptime monitor response.
 * Orchestrates incident detection, severity assessment, proposing
 * a remediation action, gating on Ops approval (for destructive
 * actions), executing remediation, verifying recovery, and updating
 * the status page and stakeholders.
 */
export type UptimeMonitorWrapper = OpsWrapperBase & {
  kind: "uptime_monitor";
  input: UptimeMonitorInput;
  output?: UptimeMonitorOutput;
  currentStep: UptimeMonitorStep;
};

// ---------------------------------------------------------------------------
// Discriminated union of all Ops wrappers
// ---------------------------------------------------------------------------

/** Union of all Ops workflow wrapper configurations. */
export type OpsWorkflowWrapper =
  | RotateCredentialsWrapper
  | OnboardEmployeeWrapper
  | VendorRenewalWrapper
  | UptimeMonitorWrapper;
