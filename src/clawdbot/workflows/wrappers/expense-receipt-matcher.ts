/**
 * BIZ-056 (#148) — Workflow wrapper: Expense receipt matcher
 *
 * Orchestrates the expense receipt matching workflow:
 *   1. Accept an expense claim and optional receipt data.
 *   2. Match the claim against the receipt (amount, vendor, date).
 *   3. Auto-approve small claims with full matches.
 *   4. Flag mismatches or large claims for manager approval.
 *   5. Record the outcome for audit trail.
 */

import type {
  ExpenseClaimData,
  ExpenseMatchResult,
  ExpenseReceiptGateConfig,
  ExpenseReceiptGateSnapshot,
  ReceiptData,
} from "../gates/expense-receipt-matcher.js";
import {
  DEFAULT_EXPENSE_RECEIPT_GATE_CONFIG,
  matchExpenseToReceipt,
  requiresApproval,
} from "../gates/expense-receipt-matcher.js";

// ---------------------------------------------------------------------------
// Workflow input / output types
// ---------------------------------------------------------------------------

/** Input for the expense receipt matcher workflow. */
export type ExpenseReceiptMatcherInput = {
  /** The expense claim submitted by the employee. */
  claim: ExpenseClaimData;
  /** Receipt data extracted via OCR (null if no receipt uploaded). */
  receipt: ReceiptData | null;
  /** Optional gate configuration overrides. */
  gateConfig?: Partial<ExpenseReceiptGateConfig>;
};

/** Output from the expense receipt matcher workflow. */
export type ExpenseReceiptMatcherOutput = {
  /** Whether the workflow completed successfully. */
  success: boolean;
  /** Error message if the workflow failed. */
  error?: string;
  /** The detailed match result. */
  matchResult: ExpenseMatchResult;
  /** Whether the claim was approved (auto or pending manual). */
  approved: boolean;
  /** Whether the approval was automatic. */
  autoApproved: boolean;
  /** Whether the claim is pending manual approval. */
  pendingApproval: boolean;
  /** The full gate snapshot for audit/review. */
  snapshot: ExpenseReceiptGateSnapshot;
};

// ---------------------------------------------------------------------------
// Workflow execution
// ---------------------------------------------------------------------------

/**
 * Execute the expense receipt matcher workflow.
 *
 * @param input - Expense claim, receipt data, and optional config.
 * @returns Match result, approval status, and gate snapshot.
 */
export async function executeExpenseReceiptMatcher(
  input: ExpenseReceiptMatcherInput,
): Promise<ExpenseReceiptMatcherOutput> {
  const config: ExpenseReceiptGateConfig = {
    ...DEFAULT_EXPENSE_RECEIPT_GATE_CONFIG,
    ...input.gateConfig,
  };

  try {
    // Perform the match
    const matchResult = matchExpenseToReceipt(input.claim, input.receipt, config);

    // Determine approval requirement
    const needsApproval = requiresApproval(input.claim, matchResult, config);

    const snapshot: ExpenseReceiptGateSnapshot = {
      claim: input.claim,
      receipt: input.receipt,
      matchResult,
      matchedAt: new Date().toISOString(),
    };

    return {
      success: true,
      matchResult,
      approved: !needsApproval,
      autoApproved: !needsApproval,
      pendingApproval: needsApproval,
      snapshot,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      matchResult: {
        status: "no_receipt",
        amountMatch: false,
        amountVariance: 0,
        vendorMatch: false,
        dateMatch: false,
        dateDifferenceD: 0,
        matchConfidence: 0,
        issues: [message],
      },
      approved: false,
      autoApproved: false,
      pendingApproval: false,
      snapshot: {
        claim: input.claim,
        receipt: input.receipt,
        matchResult: {
          status: "no_receipt",
          amountMatch: false,
          amountVariance: 0,
          vendorMatch: false,
          dateMatch: false,
          dateDifferenceD: 0,
          matchConfidence: 0,
          issues: [message],
        },
        matchedAt: new Date().toISOString(),
      },
    };
  }
}
