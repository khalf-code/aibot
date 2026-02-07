# Runbook: Match Invoice to Purchase Order

> BIZ-049 to BIZ-051 (#141-#143)

## Overview

This workflow automatically matches incoming invoice line items against the corresponding purchase order (PO) and flags discrepancies for human review.

## Trigger

- **Automatic:** New invoice uploaded to the finance inbox or received via API webhook.
- **Manual:** Finance team initiates matching from the dashboard by entering invoice and PO numbers.

## Workflow steps

1. **Invoice ingestion** -- The `extract-invoice-line-items` skill parses the invoice document into structured line items.
2. **PO retrieval** -- The workflow fetches the referenced PO from the ERP system using the PO number.
3. **Line matching** -- Each invoice line is matched to a PO line by item code (preferred) or description similarity.
4. **Variance calculation** -- For each matched pair, the absolute and percentage variance is computed.
5. **Gate evaluation** -- Lines within the configured tolerance auto-approve. Lines exceeding tolerance pause at the approval gate.
6. **Approval or rejection** -- A finance approver reviews flagged lines in the dashboard and approves, rejects, or adjusts amounts.
7. **Outcome recording** -- The decision is logged with the approver identity, timestamp, and any comments.

## Approval gate configuration

| Parameter                     | Default            | Description                                           |
| ----------------------------- | ------------------ | ----------------------------------------------------- |
| `tolerancePercent`            | 5                  | Maximum variance percentage before requiring approval |
| `toleranceAbsolute`           | 500                | Maximum absolute variance (in invoice currency)       |
| `requireApprovalForUnmatched` | true               | Whether unmatched lines require approval              |
| `approverRole`                | `finance-approver` | Role required to approve                              |
| `timeoutMinutes`              | 2880               | Auto-expiry after 48 hours                            |

## Match status definitions

| Status             | Meaning                                           |
| ------------------ | ------------------------------------------------- |
| `exact`            | Invoice and PO amounts match perfectly            |
| `within_tolerance` | Variance is within the configured threshold       |
| `over_threshold`   | Variance exceeds the threshold; requires approval |
| `unmatched`        | No corresponding PO line item found               |

## Alerts and escalation

- **Pending approval > 24h:** Dashboard shows a warning badge; email reminder sent to the approver role.
- **Expired approval (> 48h):** Workflow stops; the invoice is flagged as "review expired" for manual handling.
- **High variance (> 20%):** Tagged as `high-variance` for CFO visibility.

## Troubleshooting

| Symptom                    | Likely cause                            | Resolution                                               |
| -------------------------- | --------------------------------------- | -------------------------------------------------------- |
| All lines show "unmatched" | PO number mismatch or PO not in ERP     | Verify the PO number and re-trigger                      |
| Approval gate never fires  | All lines are within tolerance          | Expected behavior; check the match report                |
| Workflow times out         | Large invoice with many lines           | Increase `timeout_ms` in the workflow node configuration |
| Wrong currency comparison  | Invoice and PO use different currencies | Ensure currency conversion is applied before matching    |

## Related files

- Approval gate type: `src/clawdbot/workflows/gates/match-invoice-to-po.ts`
- Workflow wrapper: `src/clawdbot/workflows/wrappers/match-invoice-to-po.ts`
- Invoice extraction skill: `skills/extract-invoice-line-items/`

## Rollback

If the workflow produces incorrect matches at scale:

1. Pause the workflow trigger in the dashboard.
2. Identify affected invoices using the `match_invoice_po.error_total` metric.
3. Reset affected invoices to "pending" status in the ERP.
4. Fix the matching logic or tolerance configuration.
5. Re-run the workflow on affected invoices.
