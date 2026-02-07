/**
 * Tests for extract-invoice-line-items skill.
 *
 * BIZ-047 (#139) — Sandbox fixture and test coverage.
 *
 * To run:
 *   pnpm vitest run skills/extract-invoice-line-items/tests/index.test.ts
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ExtractInvoiceInput } from "../src/index.js";
import { execute } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load a JSON fixture file from the fixtures/ directory. */
function loadFixture<T = unknown>(name: string): T {
  const filePath = resolve(__dirname, "..", "fixtures", name);
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

describe("extract-invoice-line-items", () => {
  it("extracts line items from a sample invoice", async () => {
    const input = loadFixture<ExtractInvoiceInput>("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.lineCount).toBeGreaterThanOrEqual(1);
    expect(output.lineItems.length).toBe(output.lineCount);
    // Each line item should have required fields
    for (const item of output.lineItems) {
      expect(item.lineNumber).toBeGreaterThan(0);
      expect(item.description).toBeTruthy();
      expect(item.quantity).toBeGreaterThan(0);
      expect(item.unitPrice).toBeGreaterThanOrEqual(0);
      expect(item.confidence).toBeGreaterThan(0);
    }
  });

  it("extracts invoice metadata when requested", async () => {
    const input = loadFixture<ExtractInvoiceInput>("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.metadata).not.toBeNull();
    expect(output.metadata?.invoiceNumber).toBe("INV-2026-0847");
    expect(output.metadata?.currency).toBe("USD");
    expect(output.metadata?.poNumber).toBe("PO-5521");
  });

  it("computes correct subtotal from line items", async () => {
    const input = loadFixture<ExtractInvoiceInput>("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    // Verify subtotal matches sum of (quantity * unitPrice) across items
    const computedSubtotal = output.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    expect(output.subtotal).toBe(Math.round(computedSubtotal * 100) / 100);
  });

  it("returns empty result for unparseable text", async () => {
    const input: ExtractInvoiceInput = {
      invoiceText: "This is just a random paragraph with no invoice data.",
    };

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.lineCount).toBe(0);
    expect(output.lineItems).toHaveLength(0);
    expect(output.subtotal).toBe(0);
    expect(output.grandTotal).toBe(0);
  });

  it("returns an error when invoiceText is missing", async () => {
    const output = await execute({} as ExtractInvoiceInput);

    expect(output.success).toBe(false);
    expect(output.error).toBeDefined();
    expect(output.error).toContain("invoiceText");
  });

  it("uses the currency hint in metadata", async () => {
    const input: ExtractInvoiceInput = {
      invoiceText: "Invoice #: EUR-001\nDate: 01/15/2026\n\n1  Consulting  $500.00  $500.00",
      currencyHint: "EUR",
      extractMetadata: true,
    };

    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.metadata?.currency).toBe("EUR");
  });

  it("reports average confidence across line items", async () => {
    const input = loadFixture<ExtractInvoiceInput>("input.json");
    const output = await execute(input);

    expect(output.success).toBe(true);
    expect(output.averageConfidence).toBeGreaterThan(0);
    expect(output.averageConfidence).toBeLessThanOrEqual(1);
  });
});
