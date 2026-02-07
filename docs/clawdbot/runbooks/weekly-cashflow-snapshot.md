# Runbook: Weekly Cashflow Snapshot

> BIZ-052 to BIZ-054 (#144-#146)

## Overview

This workflow generates a weekly cashflow report by aggregating transaction data from configured sources, comparing against the prior period, and distributing the snapshot to stakeholders after optional approval.

## Trigger

- **Scheduled:** Runs every Monday at 06:00 UTC via the workflow scheduler.
- **Manual:** Finance team can trigger an ad-hoc snapshot from the dashboard.

## Workflow steps

1. **Data collection** -- Pull transaction entries from configured sources (bank feeds, Stripe, payroll system, etc.) for the reporting period.
2. **Aggregation** -- Compute total inflows, outflows, net cashflow, and category breakdown.
3. **Period comparison** -- Compare current period metrics against the prior week.
4. **Alert evaluation** -- Check net cashflow threshold, outflow increase percentage, and closing balance.
5. **Gate decision** -- If alerts fire, pause for finance-lead approval. If clean, auto-distribute.
6. **Distribution** -- Send the approved snapshot via configured channels (email, Slack).

## Alert thresholds

| Alert                    | Default threshold | Description                                                 |
| ------------------------ | ----------------- | ----------------------------------------------------------- |
| Negative net cashflow    | -10,000           | Net cashflow below this triggers CFO escalation             |
| Outflow increase         | 20%               | Week-over-week outflow increase above this flags the report |
| Negative closing balance | < 0               | Any negative closing balance is always flagged              |

## Category breakdown

Entries are grouped by category for drill-down:

- `revenue` -- Client payments, subscription income
- `payroll` -- Salary, benefits, contractor payments
- `vendor` -- Supplier invoices, SaaS subscriptions
- `tax` -- Tax payments, withholdings
- `other` -- Uncategorized transactions

## Distribution channels

Approved snapshots are distributed to:

- **Email** -- PDF summary sent to the finance distribution list.
- **Slack** -- Summary posted to the `#finance-reports` channel.

## Troubleshooting

| Symptom                    | Likely cause               | Resolution                                                          |
| -------------------------- | -------------------------- | ------------------------------------------------------------------- |
| Missing transactions       | Bank feed sync delay       | Wait for feed refresh and re-trigger                                |
| Wrong opening balance      | Prior period not available | Manually provide `priorPeriod` in the workflow input                |
| Snapshot stuck in approval | Approver unavailable       | Check timeout setting; escalate to backup approver                  |
| Alert fires incorrectly    | Threshold too sensitive    | Adjust `netCashflowAlertThreshold` or `outflowIncreaseAlertPercent` |

## Related files

- Approval gate type: `src/clawdbot/workflows/gates/weekly-cashflow-snapshot.ts`
- Workflow wrapper: `src/clawdbot/workflows/wrappers/weekly-cashflow-snapshot.ts`

## Rollback

If an incorrect snapshot is distributed:

1. Post a correction notice to the same distribution channels.
2. Fix the source data or aggregation logic.
3. Re-trigger the workflow for the same period.
4. The new snapshot replaces the prior one in the report archive.
