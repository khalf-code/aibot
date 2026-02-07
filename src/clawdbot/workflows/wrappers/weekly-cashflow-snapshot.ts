/**
 * BIZ-053 (#145) — Workflow wrapper: Weekly cashflow snapshot
 *
 * Orchestrates the weekly cashflow snapshot workflow:
 *   1. Collect transaction data from configured sources.
 *   2. Aggregate into a cashflow summary with category breakdown.
 *   3. Compare against prior period and evaluate alert thresholds.
 *   4. If alerts fire, pause for finance-lead approval.
 *   5. Distribute the approved snapshot to stakeholders.
 */

import type {
  CashflowEntry,
  CashflowGateConfig,
  CashflowGateSnapshot,
  CashflowSummary,
} from "../gates/weekly-cashflow-snapshot.js";
import { DEFAULT_CASHFLOW_GATE_CONFIG, evaluateAlerts } from "../gates/weekly-cashflow-snapshot.js";

// ---------------------------------------------------------------------------
// Workflow input / output types
// ---------------------------------------------------------------------------

/** Input for the weekly cashflow snapshot workflow. */
export type WeeklyCashflowInput = {
  /** Start of the reporting period (ISO-8601). */
  periodStart: string;
  /** End of the reporting period (ISO-8601). */
  periodEnd: string;
  /** Opening balance at the start of the period. */
  openingBalance: number;
  /** Currency code for all amounts. */
  currency: string;
  /** List of cashflow entries for the period. */
  entries: CashflowEntry[];
  /** Optional: prior period summary for comparison. */
  priorPeriod?: CashflowSummary;
  /** Optional gate configuration overrides. */
  gateConfig?: Partial<CashflowGateConfig>;
};

/** Output from the weekly cashflow snapshot workflow. */
export type WeeklyCashflowOutput = {
  /** Whether the workflow completed successfully. */
  success: boolean;
  /** Error message if the workflow failed. */
  error?: string;
  /** The generated cashflow summary. */
  summary: CashflowSummary;
  /** The full gate snapshot (for review/distribution). */
  snapshot: CashflowGateSnapshot;
  /** Whether the snapshot requires approval before distribution. */
  pendingApproval: boolean;
  /** Whether the snapshot was auto-distributed (no alerts). */
  autoDistributed: boolean;
};

// ---------------------------------------------------------------------------
// Aggregation logic
// ---------------------------------------------------------------------------

/**
 * Aggregate a list of cashflow entries into a summary with category breakdown.
 *
 * @param entries - Individual cashflow entries.
 * @param periodStart - Start of the period.
 * @param periodEnd - End of the period.
 * @param openingBalance - Balance at the start of the period.
 * @param currency - Currency code.
 * @returns Aggregated cashflow summary.
 */
function aggregateEntries(
  entries: CashflowEntry[],
  periodStart: string,
  periodEnd: string,
  openingBalance: number,
  currency: string,
): CashflowSummary {
  const categoryBreakdown: Record<string, { inflows: number; outflows: number; net: number }> = {};

  let totalInflows = 0;
  let totalOutflows = 0;

  for (const entry of entries) {
    // Initialize category if not seen
    if (!categoryBreakdown[entry.category]) {
      categoryBreakdown[entry.category] = { inflows: 0, outflows: 0, net: 0 };
    }

    if (entry.amount >= 0) {
      totalInflows += entry.amount;
      categoryBreakdown[entry.category].inflows += entry.amount;
    } else {
      totalOutflows += Math.abs(entry.amount);
      categoryBreakdown[entry.category].outflows += Math.abs(entry.amount);
    }
    categoryBreakdown[entry.category].net += entry.amount;
  }

  // Round all values to 2 decimal places
  const round = (n: number) => Math.round(n * 100) / 100;

  for (const cat of Object.keys(categoryBreakdown)) {
    categoryBreakdown[cat].inflows = round(categoryBreakdown[cat].inflows);
    categoryBreakdown[cat].outflows = round(categoryBreakdown[cat].outflows);
    categoryBreakdown[cat].net = round(categoryBreakdown[cat].net);
  }

  const netCashflow = round(totalInflows - totalOutflows);

  return {
    periodStart,
    periodEnd,
    totalInflows: round(totalInflows),
    totalOutflows: round(totalOutflows),
    netCashflow,
    openingBalance: round(openingBalance),
    closingBalance: round(openingBalance + netCashflow),
    currency,
    categoryBreakdown,
  };
}

// ---------------------------------------------------------------------------
// Workflow execution
// ---------------------------------------------------------------------------

/**
 * Execute the weekly cashflow snapshot workflow.
 *
 * @param input - Transaction entries, period info, and optional config.
 * @returns Cashflow summary, alerts, and approval status.
 */
export async function executeWeeklyCashflow(
  input: WeeklyCashflowInput,
): Promise<WeeklyCashflowOutput> {
  const config: CashflowGateConfig = {
    ...DEFAULT_CASHFLOW_GATE_CONFIG,
    ...input.gateConfig,
  };

  try {
    // Aggregate entries into summary
    const summary = aggregateEntries(
      input.entries,
      input.periodStart,
      input.periodEnd,
      input.openingBalance,
      input.currency,
    );

    // Evaluate alert thresholds
    const alertsTriggered = evaluateAlerts(summary, input.priorPeriod ?? null, config);

    const snapshot: CashflowGateSnapshot = {
      currentPeriod: summary,
      priorPeriod: input.priorPeriod ?? null,
      alertsTriggered,
      entryCount: input.entries.length,
      generatedAt: new Date().toISOString(),
    };

    // If no alerts, auto-distribute without approval
    const needsApproval = alertsTriggered.length > 0;

    return {
      success: true,
      summary,
      snapshot,
      pendingApproval: needsApproval,
      autoDistributed: !needsApproval,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      summary: {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalInflows: 0,
        totalOutflows: 0,
        netCashflow: 0,
        openingBalance: input.openingBalance,
        closingBalance: input.openingBalance,
        currency: input.currency,
        categoryBreakdown: {},
      },
      snapshot: {
        currentPeriod: {
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          totalInflows: 0,
          totalOutflows: 0,
          netCashflow: 0,
          openingBalance: input.openingBalance,
          closingBalance: input.openingBalance,
          currency: input.currency,
          categoryBreakdown: {},
        },
        priorPeriod: null,
        alertsTriggered: [],
        entryCount: 0,
        generatedAt: new Date().toISOString(),
      },
      pendingApproval: false,
      autoDistributed: false,
    };
  }
}
