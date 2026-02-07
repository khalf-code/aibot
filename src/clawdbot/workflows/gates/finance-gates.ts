/**
 * Finance approval gate types — Business Skill Packs
 *
 * Covers:
 *   - BIZ-043 (#133) Invoice processing approval gate
 *   - BIZ-046 (#136) Expense report approval gate
 *   - BIZ-049 (#139) Budget variance alert approval gate
 *   - BIZ-052 (#142) Revenue reconciliation approval gate
 *
 * Each gate configuration defines the approval parameters for its
 * corresponding Finance workflow. Gates are evaluated by the Clawdbot
 * Approval Gate node (WF-005) at runtime.
 */

import type { ApprovalStatus } from "../approval-node.js";

// ---------------------------------------------------------------------------
// Shared Finance gate types
// ---------------------------------------------------------------------------

/** Common fields shared by all Finance approval gate configurations. */
export type FinanceGateBase = {
  /** Unique gate identifier (scoped to the workflow instance). */
  gateId: string;
  /** The workflow run ID this gate belongs to. */
  workflowRunId: string;
  /** Role or user required to approve (empty = any authorised Finance user). */
  approverRole: string;
  /** Minutes before the gate auto-expires if no decision is made. */
  timeoutMinutes: number;
  /** Current status of the gate. */
  status: ApprovalStatus;
  /** ISO-8601 timestamp when the gate was created. */
  createdAt: string;
};

/** Monetary amount with currency. */
export type MoneyAmount = {
  /** Amount in the currency's smallest unit (e.g. cents for USD). */
  amountMinor: number;
  /** ISO-4217 currency code (e.g. "USD", "EUR"). */
  currency: string;
};

// ---------------------------------------------------------------------------
// BIZ-043 (#133) — Invoice processing approval gate
// ---------------------------------------------------------------------------

/** Invoice payment terms. */
export type PaymentTerms = "net_15" | "net_30" | "net_45" | "net_60" | "due_on_receipt" | "custom";

/** Line item on an invoice. */
export type InvoiceLineItem = {
  /** Description of the goods or service. */
  description: string;
  /** Quantity. */
  quantity: number;
  /** Unit price in minor currency units. */
  unitPriceMinor: number;
  /** Line total in minor currency units. */
  totalMinor: number;
  /** General ledger account code. */
  glAccountCode: string;
};

/**
 * Gate configuration for the invoice processing workflow.
 * The workflow extracts data from incoming invoices (email, upload,
 * or API), matches them against purchase orders, and queues for
 * payment. The gate pauses so a finance reviewer can verify the
 * extracted data and GL coding before the payment is scheduled.
 */
export type InvoiceProcessingGate = FinanceGateBase & {
  kind: "invoice_processing";
  /** Vendor / supplier name on the invoice. */
  vendorName: string;
  /** Invoice number. */
  invoiceNumber: string;
  /** Invoice date (ISO-8601). */
  invoiceDate: string;
  /** Due date (ISO-8601). */
  dueDate: string;
  /** Payment terms. */
  paymentTerms: PaymentTerms;
  /** Line items extracted from the invoice. */
  lineItems: InvoiceLineItem[];
  /** Total invoice amount. */
  totalAmount: MoneyAmount;
  /** Whether a matching purchase order was found. */
  poMatched: boolean;
  /** Purchase order number (if matched). */
  poNumber?: string;
  /** Confidence score of the data extraction (0-1). */
  extractionConfidence: number;
};

// ---------------------------------------------------------------------------
// BIZ-046 (#136) — Expense report approval gate
// ---------------------------------------------------------------------------

/** Expense category. */
export type ExpenseCategory =
  | "travel"
  | "meals"
  | "lodging"
  | "office_supplies"
  | "software"
  | "hardware"
  | "professional_services"
  | "marketing"
  | "other";

/** A single expense line within a report. */
export type ExpenseLine = {
  /** Date the expense was incurred (ISO-8601). */
  date: string;
  /** Expense description. */
  description: string;
  /** Category. */
  category: ExpenseCategory;
  /** Amount. */
  amount: MoneyAmount;
  /** Whether a receipt is attached. */
  receiptAttached: boolean;
  /** URL to the receipt image (if attached). */
  receiptUrl?: string;
};

/**
 * Gate configuration for the expense report approval workflow.
 * The workflow collects expense submissions, validates receipt
 * requirements and policy limits, and routes to the appropriate
 * manager for approval before reimbursement is triggered.
 */
export type ExpenseReportGate = FinanceGateBase & {
  kind: "expense_report";
  /** Employee who submitted the report. */
  submitterName: string;
  /** Report title or description. */
  reportTitle: string;
  /** Expense lines. */
  expenses: ExpenseLine[];
  /** Total report amount. */
  totalAmount: MoneyAmount;
  /** Whether the report exceeds any policy limit. */
  exceedsPolicy: boolean;
  /** Policy violations detected (empty if compliant). */
  policyViolations: string[];
  /** Submission date (ISO-8601). */
  submittedAt: string;
};

// ---------------------------------------------------------------------------
// BIZ-049 (#139) — Budget variance alert approval gate
// ---------------------------------------------------------------------------

/** Variance direction. */
export type VarianceDirection = "over_budget" | "under_budget";

/** A single budget line item with variance. */
export type BudgetVarianceLine = {
  /** Budget category or cost centre. */
  category: string;
  /** Budgeted amount for the period. */
  budgetedAmount: MoneyAmount;
  /** Actual spend for the period. */
  actualAmount: MoneyAmount;
  /** Variance amount (actual - budgeted). */
  varianceAmount: MoneyAmount;
  /** Variance as a percentage of budgeted (e.g. 12.5 = 12.5%). */
  variancePercent: number;
  /** Direction of variance. */
  direction: VarianceDirection;
};

/**
 * Gate configuration for the budget variance alert workflow.
 * The workflow compares actual spend against the budget and flags
 * significant variances. The gate pauses so a finance controller
 * can review the variances and decide whether to acknowledge,
 * adjust the forecast, or escalate.
 */
export type BudgetVarianceGate = FinanceGateBase & {
  kind: "budget_variance";
  /** Reporting period (e.g. "2026-Q1", "2026-01"). */
  reportingPeriod: string;
  /** Lines with notable variance. */
  variances: BudgetVarianceLine[];
  /** Threshold percentage that triggered the alert. */
  thresholdPercent: number;
  /** Total budget for the period. */
  totalBudget: MoneyAmount;
  /** Total actual spend for the period. */
  totalActual: MoneyAmount;
};

// ---------------------------------------------------------------------------
// BIZ-052 (#142) — Revenue reconciliation approval gate
// ---------------------------------------------------------------------------

/** Source of revenue data being reconciled. */
export type RevenueSource = "stripe" | "paypal" | "bank_feed" | "manual_entry" | "erp" | "other";

/** A reconciliation discrepancy. */
export type ReconciliationDiscrepancy = {
  /** Description of the discrepancy. */
  description: string;
  /** Expected amount. */
  expectedAmount: MoneyAmount;
  /** Actual amount found. */
  actualAmount: MoneyAmount;
  /** Difference. */
  differenceAmount: MoneyAmount;
  /** Source where the discrepancy was found. */
  source: RevenueSource;
  /** Transaction or reference ID (if applicable). */
  referenceId?: string;
};

/**
 * Gate configuration for the revenue reconciliation workflow.
 * The workflow pulls revenue data from multiple sources, matches
 * transactions, and identifies discrepancies. The gate pauses so
 * a finance manager can review unmatched transactions and approve
 * adjustments before the books are closed.
 */
export type RevenueReconciliationGate = FinanceGateBase & {
  kind: "revenue_reconciliation";
  /** Reconciliation period (ISO-8601 date range or month). */
  reconciliationPeriod: string;
  /** Revenue sources included in this reconciliation. */
  sources: RevenueSource[];
  /** Total expected revenue. */
  expectedRevenue: MoneyAmount;
  /** Total actual revenue found. */
  actualRevenue: MoneyAmount;
  /** Discrepancies requiring review. */
  discrepancies: ReconciliationDiscrepancy[];
  /** Whether all transactions were successfully matched. */
  fullyReconciled: boolean;
};

// ---------------------------------------------------------------------------
// Discriminated union of all Finance gates
// ---------------------------------------------------------------------------

/** Union of all Finance approval gate configurations. */
export type FinanceApprovalGate =
  | InvoiceProcessingGate
  | ExpenseReportGate
  | BudgetVarianceGate
  | RevenueReconciliationGate;
