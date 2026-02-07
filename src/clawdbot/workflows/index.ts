/**
 * Clawdbot workflow orchestration — barrel export
 *
 * Re-exports every workflow module so consumers can import from a single path:
 *   import { WorkflowTrigger, RetryPolicy, ... } from "../clawdbot/workflows/index.js";
 */

// WF-002 (#53) Dashboard trigger controls
export type { TriggerType, TriggerConfig, WorkflowTrigger, TriggerManager } from "./trigger.js";
export { StubTriggerManager } from "./trigger.js";

// WF-003 (#54) Retry policies
export type { BackoffType, RetryPolicy, ErrorAction, ErrorHandler } from "./retry-policy.js";
export { DEFAULT_RETRY_POLICIES, computeDelay } from "./retry-policy.js";

// WF-004 (#55) Branching patterns
export type {
  ConditionOperator,
  BranchCondition,
  WorkflowBranch,
  IfNodeConfig,
  SwitchNodeConfig,
  MergeMode,
  MergeNodeConfig,
  BranchingNodeConfig,
} from "./branching.js";

// WF-005 (#56) Custom approval node
export type { ApprovalStatus, ApprovalRequest, ApprovalResponse } from "./approval-node.js";
export { n8nApprovalNodeSpec } from "./approval-node.js";

// WF-008 (#59) Data bridge
export type {
  BridgeMessageType,
  DataBridgeMessage,
  BridgeSubscriber,
  DataBridge,
} from "./data-bridge.js";
export { InMemoryDataBridge } from "./data-bridge.js";

// WF-009 (#60) Gap analysis
export type { Priority, EffortEstimate, WorkflowGap, WorkflowTemplate } from "./gap-analysis.js";
export { generateGapReport } from "./gap-analysis.js";

// WF-010 (#61) Dry-run mode
export type { DryRunConfig, DryRunStep, BlockedSideEffect, DryRunResult } from "./dry-run.js";
export { DEFAULT_DRY_RUN_CONFIG } from "./dry-run.js";

// ---------------------------------------------------------------------------
// Business Skill Packs — Approval Gates
// ---------------------------------------------------------------------------

// Ops gates (BIZ-065, BIZ-068, BIZ-071, BIZ-074)
export type {
  OpsUrgency,
  OpsGateBase,
  CredentialKind,
  CredentialRotationItem,
  RotateCredentialsGate,
  OnboardDepartment,
  OnboardTask,
  OnboardEmployeeGate,
  VendorContractStatus,
  VendorRenewalItem,
  VendorRenewalGate,
  IncidentSeverity,
  UptimeResponseAction,
  UptimeIncident,
  UptimeMonitorGate,
  OpsApprovalGate,
} from "./gates/ops-gates.js";

// Marketing gates (BIZ-077, BIZ-080, BIZ-083)
export type {
  ContentStatus,
  MarketingChannel,
  MarketingGateBase,
  ContentIdea,
  WeeklyContentIdeasGate,
  NewsletterSection,
  NewsletterDraftGate,
  SocialPost,
  SocialPostSchedulingGate,
  MarketingApprovalGate,
} from "./gates/marketing-gates.js";

// People gates (BIZ-086, BIZ-089)
export type {
  PeopleGateBase,
  InterviewFormat,
  InterviewSlot,
  InterviewCandidate,
  InterviewSchedulingGate,
  PaperworkCategory,
  PaperworkItem,
  NewHirePaperworkGate,
  PeopleApprovalGate,
} from "./gates/people-gates.js";

// Finance gates (BIZ-043, BIZ-046, BIZ-049, BIZ-052)
export type {
  FinanceGateBase,
  MoneyAmount,
  PaymentTerms,
  InvoiceLineItem,
  InvoiceProcessingGate,
  ExpenseCategory,
  ExpenseLine,
  ExpenseReportGate,
  VarianceDirection,
  BudgetVarianceLine,
  BudgetVarianceGate,
  RevenueSource,
  ReconciliationDiscrepancy,
  RevenueReconciliationGate,
  FinanceApprovalGate,
} from "./gates/finance-gates.js";

// Support gates (BIZ-055, BIZ-058, BIZ-061)
export type {
  TicketPriority,
  SupportChannel,
  SupportGateBase,
  TicketRouting,
  TriageTicket,
  TicketTriageGate,
  AutoResponseDraft,
  AutoResponseGate,
  SlaBreachStatus,
  SlaEscalationItem,
  SlaEscalationGate,
  SupportApprovalGate,
} from "./gates/support-gates.js";

// ---------------------------------------------------------------------------
// Business Skill Packs — Workflow Wrappers
// ---------------------------------------------------------------------------

// Ops wrappers (BIZ-066, BIZ-069, BIZ-072, BIZ-075)
export type {
  RotateCredentialsStep,
  RotateCredentialsInput,
  RotateCredentialsOutput,
  RotateCredentialsWrapper,
  OnboardEmployeeStep,
  OnboardEmployeeInput,
  OnboardEmployeeOutput,
  OnboardEmployeeWrapper,
  VendorRenewalStep,
  VendorRenewalInput,
  VendorRenewalOutput,
  VendorRenewalWrapper,
  UptimeMonitorStep,
  UptimeMonitorInput,
  UptimeMonitorOutput,
  UptimeMonitorWrapper,
  OpsWorkflowWrapper,
} from "./wrappers/ops-wrappers.js";

// Marketing wrappers (BIZ-078, BIZ-081, BIZ-084)
export type {
  WeeklyContentIdeasStep,
  WeeklyContentIdeasInput,
  WeeklyContentIdeasOutput,
  WeeklyContentIdeasWrapper,
  NewsletterDraftStep,
  NewsletterDraftInput,
  NewsletterDraftOutput,
  NewsletterDraftWrapper,
  SocialPostSchedulingStep,
  SocialPostSchedulingInput,
  SocialPostSchedulingOutput,
  SocialPostSchedulingWrapper,
  MarketingWorkflowWrapper,
} from "./wrappers/marketing-wrappers.js";

// People wrappers (BIZ-087, BIZ-090)
export type {
  InterviewSchedulingStep,
  InterviewSchedulingInput,
  InterviewSchedulingOutput,
  InterviewSchedulingWrapper,
  NewHirePaperworkStep,
  NewHirePaperworkInput,
  NewHirePaperworkOutput,
  NewHirePaperworkWrapper,
  PeopleWorkflowWrapper,
} from "./wrappers/people-wrappers.js";

// Finance wrappers (BIZ-044, BIZ-047, BIZ-050, BIZ-053)
export type {
  InvoiceProcessingStep,
  InvoiceProcessingInput,
  InvoiceProcessingOutput,
  InvoiceProcessingWrapper,
  ExpenseReportStep,
  ExpenseReportInput,
  ExpenseReportOutput,
  ExpenseReportWrapper,
  BudgetVarianceStep,
  BudgetVarianceInput,
  BudgetVarianceOutput,
  BudgetVarianceWrapper,
  RevenueReconciliationStep,
  RevenueReconciliationInput,
  RevenueReconciliationOutput,
  RevenueReconciliationWrapper,
  FinanceWorkflowWrapper,
} from "./wrappers/finance-wrappers.js";

// Support wrappers (BIZ-056, BIZ-059, BIZ-062)
export type {
  TicketTriageStep,
  TicketTriageInput,
  TicketTriageOutput,
  TicketTriageWrapper,
  AutoResponseStep,
  AutoResponseInput,
  AutoResponseOutput,
  AutoResponseWrapper,
  SlaEscalationStep,
  SlaEscalationInput,
  SlaEscalationOutput,
  SlaEscalationWrapper,
  SupportWorkflowWrapper,
} from "./wrappers/support-wrappers.js";

// ---------------------------------------------------------------------------
// Business Skill Packs — Finance & Ops Gates (BIZ-049 to BIZ-064)
// ---------------------------------------------------------------------------

// BIZ-049 (#141) Match invoice to PO — approval gate
export type {
  MatchStatus,
  InvoicePoLineMatch,
  InvoicePoGateConfig,
  InvoicePoGateSnapshot,
  InvoicePoGateResult,
} from "./gates/match-invoice-to-po.js";
export {
  DEFAULT_INVOICE_PO_GATE_CONFIG,
  classifyMatch,
  requiresApproval as requiresInvoicePoApproval,
} from "./gates/match-invoice-to-po.js";

// BIZ-052 (#144) Weekly cashflow snapshot — approval gate
export type {
  CashflowEntry,
  CashflowSummary,
  CashflowGateConfig,
  CashflowGateSnapshot,
  CashflowGateResult,
} from "./gates/weekly-cashflow-snapshot.js";
export {
  DEFAULT_CASHFLOW_GATE_CONFIG,
  evaluateAlerts as evaluateCashflowAlerts,
} from "./gates/weekly-cashflow-snapshot.js";

// BIZ-055 (#147) Expense receipt matcher — approval gate
export type {
  ReceiptData,
  ExpenseClaimData,
  ExpenseMatchStatus,
  ExpenseMatchResult,
  ExpenseReceiptGateConfig,
  ExpenseReceiptGateSnapshot,
} from "./gates/expense-receipt-matcher.js";
export {
  DEFAULT_EXPENSE_RECEIPT_GATE_CONFIG,
  vendorNamesMatch,
  matchExpenseToReceipt,
  requiresApproval as requiresExpenseApproval,
} from "./gates/expense-receipt-matcher.js";

// BIZ-058 (#150) Payment approval — approval gate
export type {
  PaymentMethod,
  PaymentUrgency,
  PaymentRequest,
  ApprovalTier,
  PaymentApprovalGateConfig,
  PaymentApprovalGateSnapshot,
  PaymentApprovalGateResult,
} from "./gates/payment-approval.js";
export {
  DEFAULT_PAYMENT_APPROVAL_GATE_CONFIG,
  determineApprovalTier,
  identifyRiskFlags,
  requiresApproval as requiresPaymentApproval,
} from "./gates/payment-approval.js";

// BIZ-061 (#153) Daily system health digest — approval gate
export type {
  ServiceStatus,
  IssueSeverity,
  HealthCheckResult,
  HealthIssue,
  HealthDigest,
  HealthDigestGateConfig,
  HealthDigestGateSnapshot,
  HealthDigestGateResult,
} from "./gates/daily-system-health-digest.js";
export {
  DEFAULT_HEALTH_DIGEST_GATE_CONFIG,
  computeOverallStatus,
  evaluateAlerts as evaluateHealthAlerts,
  requiresAcknowledgment,
} from "./gates/daily-system-health-digest.js";

// ---------------------------------------------------------------------------
// Business Skill Packs — Finance & Ops Workflow Wrappers (BIZ-050 to BIZ-062)
// ---------------------------------------------------------------------------

// BIZ-050 (#142) Match invoice to PO — workflow wrapper
export type {
  LineItem as InvoicePoLineItem,
  MatchInvoiceToPoInput,
  MatchInvoiceToPoOutput,
} from "./wrappers/match-invoice-to-po.js";
export { executeMatchInvoiceToPo } from "./wrappers/match-invoice-to-po.js";

// BIZ-053 (#145) Weekly cashflow snapshot — workflow wrapper
export type {
  WeeklyCashflowInput,
  WeeklyCashflowOutput,
} from "./wrappers/weekly-cashflow-snapshot.js";
export { executeWeeklyCashflow } from "./wrappers/weekly-cashflow-snapshot.js";

// BIZ-056 (#148) Expense receipt matcher — workflow wrapper
export type {
  ExpenseReceiptMatcherInput,
  ExpenseReceiptMatcherOutput,
} from "./wrappers/expense-receipt-matcher.js";
export { executeExpenseReceiptMatcher } from "./wrappers/expense-receipt-matcher.js";

// BIZ-059 (#151) Payment approval — workflow wrapper
export type { PaymentApprovalInput, PaymentApprovalOutput } from "./wrappers/payment-approval.js";
export { executePaymentApproval } from "./wrappers/payment-approval.js";

// BIZ-062 (#154) Daily system health digest — workflow wrapper
export type {
  DailyHealthDigestInput,
  DailyHealthDigestOutput,
} from "./wrappers/daily-system-health-digest.js";
export { executeDailyHealthDigest } from "./wrappers/daily-system-health-digest.js";
