/**
 * BIZ-050 (#142) — Workflow wrapper: Match invoice to purchase order
 *
 * Orchestrates the full invoice-to-PO matching workflow:
 *   1. Accept an invoice and PO as input.
 *   2. Perform line-by-line matching with variance calculation.
 *   3. If all lines pass the tolerance gate, auto-approve.
 *   4. If any lines exceed tolerance, pause for human approval.
 *   5. Record the outcome and return the match report.
 *
 * This wrapper is consumed by the n8n workflow engine as a
 * Clawdbot Skill node that internally manages the approval gate.
 */

import type {
  InvoicePoGateConfig,
  InvoicePoGateSnapshot,
  InvoicePoLineMatch,
  MatchStatus,
} from "../gates/match-invoice-to-po.js";
import {
  DEFAULT_INVOICE_PO_GATE_CONFIG,
  classifyMatch,
  requiresApproval,
} from "../gates/match-invoice-to-po.js";

// ---------------------------------------------------------------------------
// Workflow input / output types
// ---------------------------------------------------------------------------

/** A single line item from an invoice or PO. */
export type LineItem = {
  /** Item description. */
  description: string;
  /** Quantity. */
  quantity: number;
  /** Unit price. */
  unitPrice: number;
  /** Line total (quantity * unitPrice). */
  total: number;
  /** Optional item/SKU code. */
  itemCode?: string;
};

/** Input for the match-invoice-to-PO workflow. */
export type MatchInvoiceToPoInput = {
  /** Invoice number. */
  invoiceNumber: string;
  /** Purchase order number to match against. */
  poNumber: string;
  /** Vendor name. */
  vendorName: string;
  /** Currency code. */
  currency: string;
  /** Line items from the invoice. */
  invoiceLines: LineItem[];
  /** Line items from the purchase order. */
  poLines: LineItem[];
  /** Optional gate configuration overrides. */
  gateConfig?: Partial<InvoicePoGateConfig>;
};

/** Outcome of the workflow run. */
export type MatchInvoiceToPoOutput = {
  /** Whether the workflow completed successfully. */
  success: boolean;
  /** Error message if the workflow failed. */
  error?: string;
  /** Whether the match was approved (auto or manual). */
  approved: boolean;
  /** Whether the approval was automatic (within tolerance). */
  autoApproved: boolean;
  /** The match snapshot with all line-by-line details. */
  snapshot: InvoicePoGateSnapshot;
  /** Whether manual approval is required (gate is paused). */
  pendingApproval: boolean;
};

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

/**
 * Find the best matching PO line for a given invoice line.
 * Uses item code first, then falls back to description similarity.
 *
 * @param invoiceLine - The invoice line to match.
 * @param poLines - Available PO lines to match against.
 * @param usedIndices - Set of PO line indices already matched.
 * @returns The index of the best PO match, or -1 if no match.
 */
function findBestPoMatch(
  invoiceLine: LineItem,
  poLines: LineItem[],
  usedIndices: Set<number>,
): number {
  // First pass: exact item code match
  if (invoiceLine.itemCode) {
    for (let i = 0; i < poLines.length; i++) {
      if (!usedIndices.has(i) && poLines[i].itemCode === invoiceLine.itemCode) {
        return i;
      }
    }
  }

  // Second pass: description contains match (case-insensitive)
  const invDesc = invoiceLine.description.toLowerCase();
  for (let i = 0; i < poLines.length; i++) {
    if (!usedIndices.has(i)) {
      const poDesc = poLines[i].description.toLowerCase();
      if (invDesc.includes(poDesc) || poDesc.includes(invDesc)) {
        return i;
      }
    }
  }

  return -1;
}

// ---------------------------------------------------------------------------
// Workflow execution
// ---------------------------------------------------------------------------

/**
 * Execute the match-invoice-to-PO workflow.
 *
 * @param input - Invoice and PO data with optional gate config.
 * @returns Match results, approval status, and the full snapshot.
 */
export async function executeMatchInvoiceToPo(
  input: MatchInvoiceToPoInput,
): Promise<MatchInvoiceToPoOutput> {
  const config: InvoicePoGateConfig = {
    ...DEFAULT_INVOICE_PO_GATE_CONFIG,
    ...input.gateConfig,
  };

  try {
    const usedPoIndices = new Set<number>();
    const lineMatches: InvoicePoLineMatch[] = [];

    // Match each invoice line to a PO line
    for (const invLine of input.invoiceLines) {
      const poIdx = findBestPoMatch(invLine, input.poLines, usedPoIndices);

      if (poIdx >= 0) {
        usedPoIndices.add(poIdx);
        const poLine = input.poLines[poIdx];
        const variance = Math.abs(invLine.total - poLine.total);
        const variancePercent =
          poLine.total === 0 ? (variance > 0 ? 100 : 0) : (variance / poLine.total) * 100;
        const status: MatchStatus = classifyMatch(invLine.total, poLine.total, config);

        lineMatches.push({
          invoiceDescription: invLine.description,
          invoiceAmount: invLine.total,
          poDescription: poLine.description,
          poAmount: poLine.total,
          variance: Math.round(variance * 100) / 100,
          variancePercent: Math.round(variancePercent * 100) / 100,
          status,
        });
      } else {
        lineMatches.push({
          invoiceDescription: invLine.description,
          invoiceAmount: invLine.total,
          poDescription: null,
          poAmount: null,
          variance: invLine.total,
          variancePercent: 100,
          status: "unmatched",
        });
      }
    }

    // Compute overall match score
    const matchedCount = lineMatches.filter(
      (m) => m.status === "exact" || m.status === "within_tolerance",
    ).length;
    const overallMatchScore = lineMatches.length > 0 ? matchedCount / lineMatches.length : 0;

    const linesRequiringReview = lineMatches.filter(
      (m) => m.status === "over_threshold" || m.status === "unmatched",
    ).length;

    const invoiceTotal = input.invoiceLines.reduce((s, l) => s + l.total, 0);
    const poTotal = input.poLines.reduce((s, l) => s + l.total, 0);

    const snapshot: InvoicePoGateSnapshot = {
      invoiceNumber: input.invoiceNumber,
      poNumber: input.poNumber,
      vendorName: input.vendorName,
      currency: input.currency,
      invoiceTotal: Math.round(invoiceTotal * 100) / 100,
      poTotal: Math.round(poTotal * 100) / 100,
      lineMatches,
      linesRequiringReview,
      overallMatchScore: Math.round(overallMatchScore * 100) / 100,
      matchedAt: new Date().toISOString(),
    };

    const needsApproval = requiresApproval(lineMatches, config);

    return {
      success: true,
      approved: !needsApproval,
      autoApproved: !needsApproval,
      snapshot,
      pendingApproval: needsApproval,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      approved: false,
      autoApproved: false,
      snapshot: {
        invoiceNumber: input.invoiceNumber,
        poNumber: input.poNumber,
        vendorName: input.vendorName,
        currency: input.currency,
        invoiceTotal: 0,
        poTotal: 0,
        lineMatches: [],
        linesRequiringReview: 0,
        overallMatchScore: 0,
        matchedAt: new Date().toISOString(),
      },
      pendingApproval: false,
    };
  }
}
