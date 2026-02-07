/**
 * BIZ-052 (#144) — Approval gate: Weekly cashflow snapshot
 *
 * Defines the approval gate type for the weekly cashflow snapshot workflow.
 * The gate pauses after the snapshot is generated so a finance lead can
 * review the numbers before the report is distributed to stakeholders.
 */

// ---------------------------------------------------------------------------
// Cashflow data types
// ---------------------------------------------------------------------------

/** A single cashflow entry (inflow or outflow). */
export type CashflowEntry = {
  /** Entry description (e.g. "Client invoice payment", "Payroll"). */
  description: string;
  /** Amount in the reporting currency. Positive = inflow, negative = outflow. */
  amount: number;
  /** Category for grouping (e.g. "revenue", "payroll", "vendor", "tax"). */
  category: string;
  /** ISO-8601 date of the transaction. */
  date: string;
  /** Source system or account (e.g. "Stripe", "Checking-4521"). */
  source: string;
};

/** Aggregated cashflow summary for the reporting period. */
export type CashflowSummary = {
  /** Start of the reporting period (ISO-8601). */
  periodStart: string;
  /** End of the reporting period (ISO-8601). */
  periodEnd: string;
  /** Total inflows (positive amounts). */
  totalInflows: number;
  /** Total outflows (absolute value of negative amounts). */
  totalOutflows: number;
  /** Net cashflow (inflows - outflows). */
  netCashflow: number;
  /** Opening balance at the start of the period. */
  openingBalance: number;
  /** Closing balance at the end of the period. */
  closingBalance: number;
  /** Currency code for all amounts. */
  currency: string;
  /** Breakdown by category. */
  categoryBreakdown: Record<string, { inflows: number; outflows: number; net: number }>;
};

// ---------------------------------------------------------------------------
// Gate configuration
// ---------------------------------------------------------------------------

/** Configuration for the weekly cashflow snapshot approval gate. */
export type CashflowGateConfig = {
  /**
   * Minimum net cashflow threshold. If net cashflow drops below this,
   * the gate escalates to CFO in addition to the standard approver.
   * Default: -10000.
   */
  netCashflowAlertThreshold: number;
  /**
   * Percentage change in outflows vs. prior week that triggers a flag.
   * Default: 20 (20% increase).
   */
  outflowIncreaseAlertPercent: number;
  /**
   * Role required to approve the snapshot before distribution.
   * Default: "finance-lead".
   */
  approverRole: string;
  /**
   * Timeout in minutes before auto-distributing without approval.
   * Default: 1440 (24 hours). Set to 0 to require approval always.
   */
  timeoutMinutes: number;
  /**
   * Distribution channels for the approved snapshot.
   * Default: ["email", "slack"].
   */
  distributionChannels: string[];
};

/** Sensible defaults for the cashflow snapshot gate. */
export const DEFAULT_CASHFLOW_GATE_CONFIG: CashflowGateConfig = {
  netCashflowAlertThreshold: -10_000,
  outflowIncreaseAlertPercent: 20,
  approverRole: "finance-lead",
  timeoutMinutes: 1440,
  distributionChannels: ["email", "slack"],
};

// ---------------------------------------------------------------------------
// Gate snapshot (reviewer context)
// ---------------------------------------------------------------------------

/** Data attached to the approval request for the reviewer. */
export type CashflowGateSnapshot = {
  /** The cashflow summary for the current period. */
  currentPeriod: CashflowSummary;
  /** The cashflow summary for the prior period (for comparison). */
  priorPeriod: CashflowSummary | null;
  /** Whether any alert thresholds were triggered. */
  alertsTriggered: string[];
  /** Number of individual entries in the snapshot. */
  entryCount: number;
  /** ISO-8601 timestamp of when the snapshot was generated. */
  generatedAt: string;
};

// ---------------------------------------------------------------------------
// Gate decision
// ---------------------------------------------------------------------------

/** Result after the reviewer acts on the snapshot. */
export type CashflowGateResult = {
  /** Whether the snapshot was approved for distribution. */
  approved: boolean;
  /** The user who made the decision. */
  approver: string;
  /** ISO-8601 timestamp of the decision. */
  decidedAt: string;
  /** Optional comment (e.g. "Approved with note: payroll timing offset"). */
  comment?: string;
  /** Whether the reviewer requested corrections before redistribution. */
  correctionsRequested: boolean;
};

// ---------------------------------------------------------------------------
// Alert evaluation (pure function)
// ---------------------------------------------------------------------------

/**
 * Evaluate whether alert thresholds are triggered for the snapshot.
 *
 * @param current - Current period summary.
 * @param prior - Prior period summary (null if first snapshot).
 * @param config - Gate configuration.
 * @returns List of alert descriptions that were triggered.
 */
export function evaluateAlerts(
  current: CashflowSummary,
  prior: CashflowSummary | null,
  config: CashflowGateConfig = DEFAULT_CASHFLOW_GATE_CONFIG,
): string[] {
  const alerts: string[] = [];

  // Net cashflow below threshold
  if (current.netCashflow < config.netCashflowAlertThreshold) {
    alerts.push(
      `Net cashflow (${current.currency} ${current.netCashflow.toLocaleString()}) is below threshold (${current.currency} ${config.netCashflowAlertThreshold.toLocaleString()}).`,
    );
  }

  // Outflow increase vs prior period
  if (prior && prior.totalOutflows > 0) {
    const increasePercent =
      ((current.totalOutflows - prior.totalOutflows) / prior.totalOutflows) * 100;
    if (increasePercent > config.outflowIncreaseAlertPercent) {
      alerts.push(
        `Outflows increased ${increasePercent.toFixed(1)}% vs. prior week (threshold: ${config.outflowIncreaseAlertPercent}%).`,
      );
    }
  }

  // Negative closing balance
  if (current.closingBalance < 0) {
    alerts.push(
      `Closing balance is negative: ${current.currency} ${current.closingBalance.toLocaleString()}.`,
    );
  }

  return alerts;
}
