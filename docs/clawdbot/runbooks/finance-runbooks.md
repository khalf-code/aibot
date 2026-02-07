# Finance Runbooks — Business Skill Packs

Runbooks for all Finance workflows in the Clawdbot Business Skill Packs.

Covers:

- BIZ-045 (#135) Invoice processing docs + runbook
- BIZ-048 (#138) Expense report approval docs + runbook
- BIZ-051 (#141) Budget variance alert docs + runbook
- BIZ-054 (#144) Revenue reconciliation docs + runbook

---

## Invoice Processing

**Workflow ID:** `finance-invoice-processing`
**Trigger:** Event-driven (email received, file upload) or webhook
**Approval gate:** Finance reviewer or accounts payable lead

### Overview

Receives invoices from multiple sources (email, upload, API), extracts data using OCR/AI, matches against purchase orders, validates line items and GL coding, and schedules payment. Pauses for finance reviewer approval to verify extracted data accuracy before payment is scheduled.

### Prerequisites

- Invoice intake channels configured (email inbox, file upload endpoint, API webhook)
- OCR/AI extraction service integration
- Purchase order database or ERP access
- Chart of accounts / GL codes available
- Payment processing system integration
- Accounts payable notification channel configured

### Steps

1. **Receive invoice** -- Accept the invoice document from the configured source and store it for processing.
2. **Extract data** -- Run OCR/AI extraction to pull vendor name, invoice number, date, line items, and totals.
3. **Match purchase order** -- Search the PO database for a matching purchase order based on vendor, amount, and line items.
4. **Validate line items** -- Verify line item quantities, prices, and totals against the PO (if matched) and flag discrepancies.
5. **Apply GL codes** -- Assign general ledger account codes to each line item based on category and department rules.
6. **Approval gate** -- Pause for finance reviewer approval. The reviewer sees extracted data, PO match status, confidence score, and GL coding.
7. **Schedule payment** -- Queue the invoice for payment according to the detected payment terms.
8. **Update ledger** -- Record the invoice and scheduled payment in the accounting system.
9. **Notify accounts payable** -- Send a confirmation to the AP team with payment details and timeline.

### Failure handling

- OCR extraction failures fall back to manual data entry (the workflow creates a task for the AP team).
- PO matching failures do not block the workflow; the invoice proceeds without a PO match and is flagged for manual review.
- Payment scheduling failures are retried 3 times with exponential backoff.

### Rollback

- Scheduled payments can be cancelled before execution via the payment processing system. The workflow logs the payment reference for easy lookup.

---

## Expense Report Approval

**Workflow ID:** `finance-expense-report`
**Trigger:** Manual (employee submission) or webhook from expense tool
**Approval gate:** Reporting manager

### Overview

Receives expense report submissions, validates receipts, checks against company policy limits, categorises expenses, calculates totals, and routes to the appropriate manager for approval. Processes reimbursement after approval.

### Prerequisites

- Expense submission portal or integration configured
- Company expense policy documented (per-category limits, receipt requirements)
- Receipt storage system (for image/PDF uploads)
- Reimbursement processing system (payroll integration or direct deposit)
- Manager notification channel configured

### Steps

1. **Receive submission** -- Accept the expense report with line items and receipt attachments.
2. **Validate receipts** -- Verify that required receipts are attached for each expense line above the receipt threshold.
3. **Check policy limits** -- Compare each expense against category-specific and per-trip/per-day limits.
4. **Categorise expenses** -- Assign expense categories (travel, meals, lodging, software, etc.) based on descriptions and merchant data.
5. **Calculate totals** -- Compute the total reimbursement amount and flag any policy violations.
6. **Approval gate** -- Pause for manager approval. The reviewer sees all expense lines, receipts, policy compliance status, and total amount.
7. **Process reimbursement** -- Submit the approved amount for reimbursement through the payroll or payment system.
8. **Update ledger** -- Record the expense in the accounting system with proper categorisation.
9. **Notify submitter** -- Send the employee a confirmation with the approved amount and expected reimbursement timeline.

### Failure handling

- Missing receipts do not block submission but are flagged as policy violations for the manager to decide.
- Reimbursement processing failures are retried once; persistent failures create a manual task for the finance team.

### Rollback

- Approved but unprocessed reimbursements can be reversed by the finance team. Processed reimbursements require a clawback through the payroll system.

---

## Budget Variance Alert

**Workflow ID:** `finance-budget-variance`
**Trigger:** Scheduled (monthly or weekly, configurable) or manual
**Approval gate:** Finance controller

### Overview

Compares actual spend against the approved budget for a given reporting period, identifies categories with significant variance, and generates alerts. Pauses for finance controller approval before updating forecasts or escalating to leadership.

### Prerequisites

- Budget data source configured (ERP, spreadsheet, or planning tool)
- Actual spend data source (accounting system, bank feeds)
- Variance threshold configured (percentage trigger)
- Forecast update mechanism available
- Stakeholder notification channel configured

### Steps

1. **Fetch budget data** -- Pull the approved budget figures for the reporting period by category/cost centre.
2. **Fetch actual spend** -- Pull the actual spend figures from the accounting system for the same period.
3. **Calculate variances** -- Compute the difference (absolute and percentage) between budget and actual for each category.
4. **Apply thresholds** -- Filter to categories exceeding the configured variance threshold.
5. **Approval gate** -- Pause for finance controller review. The reviewer sees each variance line, direction (over/under), and totals.
6. **Update forecast** -- If approved, adjust the rolling forecast to reflect actual trends.
7. **Notify stakeholders** -- Send the variance report to department heads and leadership as configured.
8. **Generate report** -- Produce a downloadable variance report (PDF or spreadsheet) for records.

### Failure handling

- Data source fetch failures are retried 3 times. If budget data is unavailable, the workflow halts and notifies the finance team.
- Forecast update failures are logged; the variance report is still generated and distributed.

### Rollback

- Forecast updates can be reverted by re-running with the previous period's data. The workflow logs all forecast changes.

---

## Revenue Reconciliation

**Workflow ID:** `finance-revenue-reconciliation`
**Trigger:** Scheduled (daily, weekly, or monthly, configurable) or manual
**Approval gate:** Finance manager

### Overview

Pulls revenue data from multiple sources (payment processors, bank feeds, ERP), normalises transactions, matches them across systems, identifies discrepancies, and prepares adjustments. Pauses for finance manager approval before applying adjustments and closing the reconciliation period.

### Prerequisites

- Revenue source integrations configured (Stripe, PayPal, bank feed API, ERP)
- Transaction matching rules defined (amount tolerance, date range, reference ID matching)
- Adjustment journal entry mechanism available
- Period close process documented

### Steps

1. **Fetch revenue sources** -- Pull transaction data from all configured revenue sources for the reconciliation period.
2. **Normalise transactions** -- Convert all transactions to a common format (amount, date, reference, source).
3. **Match transactions** -- Apply matching rules to pair transactions across sources. Use configured tolerance for minor differences.
4. **Identify discrepancies** -- Flag unmatched transactions and transactions with differences outside tolerance.
5. **Approval gate** -- Pause for finance manager review. The reviewer sees matched totals, discrepancies, and proposed adjustments.
6. **Apply adjustments** -- Post adjustment journal entries for approved discrepancy resolutions.
7. **Close period** -- Mark the reconciliation period as closed in the accounting system.
8. **Notify finance team** -- Send a summary of the reconciliation results, adjustments applied, and any open items.

### Failure handling

- Revenue source API failures are retried 5 times with exponential backoff (data processing retry policy).
- Partial data (one source unavailable) does not block reconciliation; unmatched items from the available source are flagged.
- Journal entry posting failures halt the period close and alert the finance team.

### Rollback

- Period close can be reopened by the finance manager. Adjustment journal entries can be reversed with a correcting entry.
