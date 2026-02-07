/**
 * BIZ-059 (#151) — Workflow wrapper: Payment approval
 *
 * Orchestrates the payment approval workflow:
 *   1. Accept a payment request.
 *   2. Determine the required approval tier based on amount.
 *   3. Identify risk flags.
 *   4. Route to the appropriate approver(s).
 *   5. Enforce dual authorization for high-value payments.
 *   6. Record the outcome for audit trail and compliance.
 */

import type {
  PaymentApprovalGateConfig,
  PaymentApprovalGateSnapshot,
  PaymentRequest,
} from "../gates/payment-approval.js";
import {
  DEFAULT_PAYMENT_APPROVAL_GATE_CONFIG,
  determineApprovalTier,
  identifyRiskFlags,
  requiresApproval,
} from "../gates/payment-approval.js";

// ---------------------------------------------------------------------------
// Workflow input / output types
// ---------------------------------------------------------------------------

/** Input for the payment approval workflow. */
export type PaymentApprovalInput = {
  /** The payment request to process. */
  payment: PaymentRequest;
  /** Optional gate configuration overrides. */
  gateConfig?: Partial<PaymentApprovalGateConfig>;
};

/** Output from the payment approval workflow. */
export type PaymentApprovalOutput = {
  /** Whether the workflow completed successfully. */
  success: boolean;
  /** Error message if the workflow failed. */
  error?: string;
  /** Whether the payment was approved (auto or manual). */
  approved: boolean;
  /** Whether the approval was automatic (below threshold). */
  autoApproved: boolean;
  /** Whether the payment is pending manual approval. */
  pendingApproval: boolean;
  /** The gate snapshot with tier, risk flags, and context. */
  snapshot: PaymentApprovalGateSnapshot;
  /** Human-readable summary of the decision/status. */
  summary: string;
};

// ---------------------------------------------------------------------------
// Workflow execution
// ---------------------------------------------------------------------------

/**
 * Execute the payment approval workflow.
 *
 * @param input - Payment request and optional configuration.
 * @returns Approval status, risk flags, and the full snapshot.
 */
export async function executePaymentApproval(
  input: PaymentApprovalInput,
): Promise<PaymentApprovalOutput> {
  const config: PaymentApprovalGateConfig = {
    ...DEFAULT_PAYMENT_APPROVAL_GATE_CONFIG,
    ...input.gateConfig,
  };

  try {
    const payment = input.payment;

    // Determine approval tier
    const requiredTier = determineApprovalTier(payment.amount, config);

    // Identify risk flags
    const riskFlags = identifyRiskFlags(payment);

    // Check if approval is required
    const needsApproval = requiresApproval(payment, config);

    const snapshot: PaymentApprovalGateSnapshot = {
      payment,
      requiredTier,
      dualAuthRequired: requiredTier.dualAuth,
      riskFlags,
      evaluatedAt: new Date().toISOString(),
    };

    // Build summary
    let summary: string;
    if (!needsApproval) {
      summary = `Payment ${payment.paymentId} auto-approved: ${payment.currency} ${payment.amount} to ${payment.payeeName} via ${payment.method}.`;
    } else {
      const dualNote = requiredTier.dualAuth ? " (dual authorization required)" : "";
      const riskNote = riskFlags.length > 0 ? ` ${riskFlags.length} risk flag(s) identified.` : "";
      summary = `Payment ${payment.paymentId} requires ${requiredTier.name}-level approval${dualNote}: ${payment.currency} ${payment.amount} to ${payment.payeeName} via ${payment.method}.${riskNote}`;
    }

    return {
      success: true,
      approved: !needsApproval,
      autoApproved: !needsApproval,
      pendingApproval: needsApproval,
      snapshot,
      summary,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      approved: false,
      autoApproved: false,
      pendingApproval: false,
      snapshot: {
        payment: input.payment,
        requiredTier: { name: "unknown", maxAmount: 0, roles: [], dualAuth: false },
        dualAuthRequired: false,
        riskFlags: [],
        evaluatedAt: new Date().toISOString(),
      },
      summary: `Payment workflow failed: ${message}`,
    };
  }
}
