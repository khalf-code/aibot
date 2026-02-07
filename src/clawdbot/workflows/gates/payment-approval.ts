/**
 * BIZ-058 (#150) — Approval gate: Payment approval workflow
 *
 * Defines the approval gate type for outbound payment authorization.
 * When a payment is scheduled (vendor invoice, refund, wire transfer),
 * this gate enforces approval policies based on amount thresholds,
 * payment type, and dual-authorization requirements.
 */

// ---------------------------------------------------------------------------
// Payment data types
// ---------------------------------------------------------------------------

/** Supported payment methods. */
export type PaymentMethod = "ach" | "wire" | "check" | "credit_card" | "debit" | "virtual_card";

/** Payment urgency level. */
export type PaymentUrgency = "standard" | "expedited" | "same_day";

/** A payment request pending authorization. */
export type PaymentRequest = {
  /** Unique payment request ID. */
  paymentId: string;
  /** Payee / vendor name. */
  payeeName: string;
  /** Payee account or identifier. */
  payeeAccount: string;
  /** Payment amount. */
  amount: number;
  /** Currency code. */
  currency: string;
  /** Payment method. */
  method: PaymentMethod;
  /** Urgency level. */
  urgency: PaymentUrgency;
  /** Reason or description for the payment. */
  description: string;
  /** Reference document (e.g. invoice number, PO number). */
  reference: string;
  /** Department or cost center. */
  department: string;
  /** Who initiated the payment request. */
  requestedBy: string;
  /** ISO-8601 timestamp of when the request was created. */
  requestedAt: string;
};

// ---------------------------------------------------------------------------
// Approval tier types
// ---------------------------------------------------------------------------

/** An approval tier defining who can approve and up to what amount. */
export type ApprovalTier = {
  /** Tier name (e.g. "manager", "director", "cfo"). */
  name: string;
  /** Maximum amount this tier can approve (inclusive). */
  maxAmount: number;
  /** Roles that can approve at this tier. */
  roles: string[];
  /** Whether this tier requires dual authorization (two approvers). */
  dualAuth: boolean;
};

// ---------------------------------------------------------------------------
// Gate configuration
// ---------------------------------------------------------------------------

/** Configuration for the payment approval gate. */
export type PaymentApprovalGateConfig = {
  /**
   * Ordered list of approval tiers. The gate selects the first tier
   * whose maxAmount >= the payment amount.
   */
  tiers: ApprovalTier[];
  /**
   * Maximum payment amount allowed via auto-approval (no human review).
   * Default: 0 (all payments require approval).
   */
  autoApproveMaxAmount: number;
  /**
   * Payment methods that always require manual approval regardless
   * of amount (e.g. wire transfers).
   * Default: ["wire"].
   */
  alwaysRequireApprovalMethods: PaymentMethod[];
  /**
   * Timeout in minutes before the request expires.
   * Default: 1440 (24 hours).
   */
  timeoutMinutes: number;
  /**
   * Whether same-day payments bypass normal timeout and escalate
   * immediately if not approved within 2 hours.
   * Default: true.
   */
  escalateSameDayPayments: boolean;
};

/** Sensible defaults for the payment approval gate. */
export const DEFAULT_PAYMENT_APPROVAL_GATE_CONFIG: PaymentApprovalGateConfig = {
  tiers: [
    { name: "manager", maxAmount: 5_000, roles: ["finance-manager"], dualAuth: false },
    { name: "director", maxAmount: 50_000, roles: ["finance-director"], dualAuth: false },
    { name: "cfo", maxAmount: 500_000, roles: ["cfo"], dualAuth: true },
    {
      name: "board",
      maxAmount: Number.POSITIVE_INFINITY,
      roles: ["board-member", "cfo"],
      dualAuth: true,
    },
  ],
  autoApproveMaxAmount: 0,
  alwaysRequireApprovalMethods: ["wire"],
  timeoutMinutes: 1440,
  escalateSameDayPayments: true,
};

// ---------------------------------------------------------------------------
// Gate snapshot
// ---------------------------------------------------------------------------

/** Data attached to the approval request for reviewer context. */
export type PaymentApprovalGateSnapshot = {
  /** The payment request details. */
  payment: PaymentRequest;
  /** Which approval tier applies. */
  requiredTier: ApprovalTier;
  /** Whether dual authorization is required. */
  dualAuthRequired: boolean;
  /** Risk flags identified for this payment. */
  riskFlags: string[];
  /** ISO-8601 timestamp of when the gate was reached. */
  evaluatedAt: string;
};

/** Result after the approval decision is made. */
export type PaymentApprovalGateResult = {
  /** Whether the payment was approved. */
  approved: boolean;
  /** The primary approver. */
  primaryApprover: string;
  /** The secondary approver (for dual-auth; null if not required). */
  secondaryApprover: string | null;
  /** ISO-8601 timestamp of the final decision. */
  decidedAt: string;
  /** Optional comment from the approver. */
  comment?: string;
};

// ---------------------------------------------------------------------------
// Gate logic (pure functions)
// ---------------------------------------------------------------------------

/**
 * Determine the required approval tier for a payment.
 *
 * @param amount - Payment amount.
 * @param config - Gate configuration.
 * @returns The applicable approval tier.
 */
export function determineApprovalTier(
  amount: number,
  config: PaymentApprovalGateConfig = DEFAULT_PAYMENT_APPROVAL_GATE_CONFIG,
): ApprovalTier {
  for (const tier of config.tiers) {
    if (amount <= tier.maxAmount) {
      return tier;
    }
  }
  // Fallback to the highest tier
  return config.tiers[config.tiers.length - 1];
}

/**
 * Identify risk flags for a payment request.
 *
 * @param payment - The payment request.
 * @returns List of risk flag descriptions.
 */
export function identifyRiskFlags(payment: PaymentRequest): string[] {
  const flags: string[] = [];

  // Large payment flag
  if (payment.amount > 100_000) {
    flags.push(`Large payment: ${payment.currency} ${payment.amount.toLocaleString()}.`);
  }

  // Same-day wire transfer
  if (payment.method === "wire" && payment.urgency === "same_day") {
    flags.push("Same-day wire transfer — high urgency, verify payee details.");
  }

  // New payee detection (would check against known payees in production)
  // Stub: flag if payee account is very short (likely incomplete)
  if (payment.payeeAccount.length < 6) {
    flags.push("Payee account appears incomplete — verify before approving.");
  }

  // Weekend or holiday payment
  const requestDay = new Date(payment.requestedAt).getDay();
  if (requestDay === 0 || requestDay === 6) {
    flags.push("Payment requested on a weekend — review timing.");
  }

  return flags;
}

/**
 * Determine whether manual approval is required for a payment.
 *
 * @param payment - The payment request.
 * @param config - Gate configuration.
 * @returns True if manual approval is required.
 */
export function requiresApproval(
  payment: PaymentRequest,
  config: PaymentApprovalGateConfig = DEFAULT_PAYMENT_APPROVAL_GATE_CONFIG,
): boolean {
  // Always require approval for certain methods
  if (config.alwaysRequireApprovalMethods.includes(payment.method)) {
    return true;
  }
  // Auto-approve below threshold
  if (payment.amount <= config.autoApproveMaxAmount) {
    return false;
  }
  return true;
}
