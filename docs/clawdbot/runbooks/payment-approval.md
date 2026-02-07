# Runbook: Payment Approval Workflow

> BIZ-058 to BIZ-060 (#150-#152)

## Overview

This workflow enforces approval policies for outbound payments (vendor invoices, refunds, wire transfers). Payments are routed to the appropriate approval tier based on amount, method, and risk flags.

## Trigger

- **Automatic:** Payment request created in the ERP or finance system.
- **Manual:** Finance team submits a payment request via the dashboard.
- **Batch:** End-of-day payment run queues all pending payments for approval.

## Workflow steps

1. **Request intake** -- Payment details (amount, payee, method, urgency) are submitted.
2. **Tier determination** -- The workflow selects the approval tier based on the payment amount.
3. **Risk assessment** -- Automated checks flag potential issues (large amounts, new payees, weekend requests, same-day wires).
4. **Routing** -- The request is routed to approvers in the determined tier.
5. **Authorization** -- Approver(s) review the request in the dashboard. Dual-auth tiers require two independent approvals.
6. **Execution** -- Approved payments proceed to the payment processor. Rejected payments are returned to the requester.
7. **Recording** -- All decisions are logged with approver identity, timestamp, and comments.

## Approval tiers

| Tier     | Max amount | Roles                 | Dual auth |
| -------- | ---------- | --------------------- | --------- |
| Manager  | 5,000      | `finance-manager`     | No        |
| Director | 50,000     | `finance-director`    | No        |
| CFO      | 500,000    | `cfo`                 | Yes       |
| Board    | Unlimited  | `board-member`, `cfo` | Yes       |

## Risk flags

The workflow automatically identifies and flags:

- **Large payments** -- Above 100,000 in any currency
- **Same-day wire transfers** -- High urgency, requires payee verification
- **Incomplete payee data** -- Account information appears truncated
- **Weekend requests** -- Payments requested outside business hours

## Gate configuration

| Parameter                      | Default    | Description                                             |
| ------------------------------ | ---------- | ------------------------------------------------------- |
| `autoApproveMaxAmount`         | 0          | Max amount for auto-approval (0 = all require approval) |
| `alwaysRequireApprovalMethods` | `["wire"]` | Methods that always need approval                       |
| `timeoutMinutes`               | 1440       | 24-hour expiry                                          |
| `escalateSameDayPayments`      | true       | Same-day payments escalate after 2 hours                |

## Dual authorization flow

For CFO and Board tiers:

1. First approver reviews and approves.
2. System routes to a second approver (cannot be the same person).
3. Second approver reviews and approves.
4. Only after both approvals does the payment proceed.

If either approver rejects, the payment is returned to the requester with the rejection reason.

## Troubleshooting

| Symptom                        | Likely cause                       | Resolution                            |
| ------------------------------ | ---------------------------------- | ------------------------------------- |
| Payment stuck in approval      | Approver unavailable               | Check timeout; assign backup approver |
| Wrong tier selected            | Amount thresholds misconfigured    | Review tier configuration             |
| Dual auth not enforced         | Tier `dualAuth` set to false       | Update the tier configuration         |
| Same-day payment not escalated | `escalateSameDayPayments` is false | Enable in gate config                 |

## Related files

- Approval gate type: `src/clawdbot/workflows/gates/payment-approval.ts`
- Workflow wrapper: `src/clawdbot/workflows/wrappers/payment-approval.ts`

## Compliance notes

- All payment approvals are logged with full audit trail.
- Dual authorization is mandatory for payments above the CFO tier threshold.
- Wire transfers always require human approval regardless of amount.
- Payment records are retained per the organization's data retention policy.

## Rollback

If a payment is approved in error:

1. Contact the payment processor to reverse or hold the transaction.
2. Document the reversal in the audit log.
3. Review the approval chain to identify the process gap.
4. Adjust tier thresholds or risk flags as needed.
