# Runbook: Expense Receipt Matcher

> BIZ-055 to BIZ-057 (#147-#149)

## Overview

This workflow matches employee expense claims against uploaded receipt images/documents. It auto-approves small, fully-matched claims and flags discrepancies for manager review.

## Trigger

- **Automatic:** Employee submits an expense claim with an attached receipt.
- **Batch:** Finance runs end-of-week batch matching for all pending claims.

## Workflow steps

1. **Claim intake** -- Employee submits an expense claim with vendor, amount, date, category, and description.
2. **Receipt extraction** -- The uploaded receipt image is processed via OCR to extract vendor name, amount, date, and payment method.
3. **Matching** -- The claim data is compared against the receipt data:
   - Amount (within configured tolerance)
   - Vendor name (fuzzy match)
   - Date (within configured day window)
4. **Gate evaluation** -- Based on match status and claim amount:
   - **Full match + below auto-approve threshold** = auto-approved
   - **Any mismatch or above threshold** = paused for manager approval
5. **Approval** -- Manager reviews the claim, receipt, and match details in the dashboard.
6. **Recording** -- Outcome is logged for the audit trail.

## Match statuses

| Status            | Description                                  |
| ----------------- | -------------------------------------------- |
| `full_match`      | All fields match within tolerance            |
| `partial_match`   | Some fields match, some differ               |
| `amount_mismatch` | Amount differs beyond tolerance              |
| `vendor_mismatch` | Vendor names do not match                    |
| `date_mismatch`   | Dates differ by more than allowed            |
| `no_receipt`      | No receipt was provided                      |
| `low_confidence`  | OCR confidence too low for reliable matching |

## Gate configuration

| Parameter                 | Default            | Description                                |
| ------------------------- | ------------------ | ------------------------------------------ |
| `amountToleranceAbsolute` | 5.00               | Max absolute amount variance               |
| `amountTolerancePercent`  | 2%                 | Max percentage amount variance             |
| `dateDifferenceMaxDays`   | 3                  | Max days between claim and receipt dates   |
| `minOcrConfidence`        | 0.70               | Minimum OCR confidence to trust extraction |
| `autoApproveMaxAmount`    | 250                | Max amount for auto-approval               |
| `approverRole`            | `expense-approver` | Role required to approve                   |
| `timeoutMinutes`          | 4320               | 72-hour expiry                             |

## Troubleshooting

| Symptom                            | Likely cause                 | Resolution                                           |
| ---------------------------------- | ---------------------------- | ---------------------------------------------------- |
| All claims flagged as "no_receipt" | Receipt upload failed        | Check file upload pipeline; verify supported formats |
| Low OCR confidence                 | Poor image quality           | Ask employee to re-upload a clearer photo            |
| Vendor names never match           | Different naming conventions | Improve fuzzy matching or add vendor aliases         |
| Claims stuck in approval           | Approver unavailable         | Assign backup approver; check timeout setting        |

## Related files

- Approval gate type: `src/clawdbot/workflows/gates/expense-receipt-matcher.ts`
- Workflow wrapper: `src/clawdbot/workflows/wrappers/expense-receipt-matcher.ts`

## Rollback

If claims are incorrectly auto-approved:

1. Pause the auto-approval workflow.
2. Lower the `autoApproveMaxAmount` threshold.
3. Identify affected claims from the audit log.
4. Mark affected claims as "pending review" and reassign to approvers.
