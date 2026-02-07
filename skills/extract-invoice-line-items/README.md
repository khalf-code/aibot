# extract-invoice-line-items

> BIZ-045 to BIZ-048 (#137-#140)

Parse invoice documents and extract structured line items with amounts and tax details.

## What it does

Given raw invoice text (from OCR or plaintext), this skill:

1. Extracts individual line items with descriptions, quantities, unit prices, and totals.
2. Optionally extracts invoice-level metadata (vendor, invoice number, dates, PO number, payment terms).
3. Computes subtotals, tax totals, and grand total.
4. Reports extraction confidence per line item.

## Directory layout

```
manifest.yaml          Permissions, metadata, and runtime configuration.
src/index.ts           Skill implementation. Exports an execute() function.
tests/index.test.ts    Vitest tests using fixture-based assertions.
fixtures/input.json    Sample input: multi-line invoice from Acme Corp.
fixtures/output.json   Expected output for the sample input.
README.md              This file.
```

## Supported formats

The current regex-based extraction handles common US invoice formats. For production use:

- Integrate with an OCR API (e.g. AWS Textract, Google Document AI) for scanned invoices.
- Use an ML-based extraction model for higher accuracy and format coverage.
- Support European number formats (comma as decimal separator).

## Testing

```bash
pnpm vitest run skills/extract-invoice-line-items/tests/index.test.ts
```

## Failure modes

- **Missing invoiceText** -- Returns `{ success: false }` with a validation error.
- **Unparseable format** -- Returns `{ success: true, lineItems: [] }` with zero line count (not an error).
- **OCR artifacts** -- Low-quality OCR text may produce incorrect amounts; check `confidence` scores.
- **Mixed currencies** -- The skill assumes a single currency per invoice; pass `currencyHint` to override.

## Observability

BIZ-048 (#140) adds the following metrics:

- `extract_invoice.extraction_total` -- Counter of extraction runs.
- `extract_invoice.line_items_extracted` -- Histogram of line items per invoice.
- `extract_invoice.avg_confidence` -- Gauge of rolling average confidence score.
- `extract_invoice.extraction_latency_ms` -- Histogram of skill execution latency.
