/**
 * extract-invoice-line-items — Parse invoices and extract line items.
 *
 * BIZ-045 (#137) Skeleton
 * BIZ-046 (#138) Implementation
 * BIZ-047 (#139) Sandbox fixture
 * BIZ-048 (#140) Observability
 *
 * This skill accepts invoice text (from OCR or plain text) and extracts
 * structured line items including descriptions, quantities, unit prices,
 * tax amounts, and line totals. It also extracts invoice-level metadata
 * such as vendor name, invoice number, date, and payment terms.
 */

// ── Types ────────────────────────────────────────────────────────

/** A single line item extracted from the invoice. */
export interface InvoiceLineItem {
  /** Line number on the invoice (1-based). */
  lineNumber: number;
  /** Item description or name. */
  description: string;
  /** Quantity of units. */
  quantity: number;
  /** Unit of measure (e.g. "each", "hours", "licenses"). */
  unitOfMeasure: string;
  /** Price per unit in the invoice currency. */
  unitPrice: number;
  /** Tax amount for this line item. */
  taxAmount: number;
  /** Total for this line (quantity * unitPrice + taxAmount). */
  lineTotal: number;
  /** Optional item/SKU code if present on the invoice. */
  itemCode?: string;
  /** Confidence score for this extraction (0.0 to 1.0). */
  confidence: number;
}

/** Invoice-level metadata extracted alongside line items. */
export interface InvoiceMetadata {
  /** Vendor or supplier name. */
  vendorName: string | null;
  /** Invoice number or reference. */
  invoiceNumber: string | null;
  /** Invoice date in ISO-8601 format. */
  invoiceDate: string | null;
  /** Due date in ISO-8601 format. */
  dueDate: string | null;
  /** Payment terms (e.g. "Net 30", "Due on receipt"). */
  paymentTerms: string | null;
  /** Currency code (e.g. "USD", "EUR", "GBP"). */
  currency: string;
  /** Purchase order number, if referenced. */
  poNumber: string | null;
}

/** Input payload for the extract-invoice-line-items skill. */
export interface ExtractInvoiceInput {
  /** Raw invoice text (from OCR output or plaintext invoice). */
  invoiceText: string;
  /** Optional hint for the expected currency. */
  currencyHint?: string;
  /** Whether to attempt to extract metadata alongside line items. */
  extractMetadata?: boolean;
}

/** Output payload returned by the skill. */
export interface ExtractInvoiceOutput {
  /** Whether the skill completed successfully. */
  success: boolean;
  /** Error message when success is false. */
  error?: string;
  /** Extracted line items, ordered by line number. */
  lineItems: InvoiceLineItem[];
  /** Invoice-level metadata (only populated when extractMetadata is true). */
  metadata: InvoiceMetadata | null;
  /** Subtotal of all line items before tax. */
  subtotal: number;
  /** Total tax amount across all line items. */
  totalTax: number;
  /** Grand total (subtotal + totalTax). */
  grandTotal: number;
  /** Number of line items extracted. */
  lineCount: number;
  /** Average extraction confidence across all line items. */
  averageConfidence: number;
  /** ISO-8601 timestamp of when the extraction ran. */
  extractedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Parse a currency amount string into a number.
 * Handles common formats: "$1,234.56", "1.234,56", "1234.56".
 */
function parseAmount(raw: string): number {
  // Remove currency symbols and whitespace
  const cleaned = raw.replace(/[^0-9.,\-]/g, "").trim();
  if (!cleaned) return 0;

  // Detect European format (1.234,56) vs US format (1,234.56)
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma > lastDot) {
    // European: comma is decimal separator
    return Number.parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }
  // US or no-separator format
  return Number.parseFloat(cleaned.replace(/,/g, ""));
}

/**
 * Attempt to extract line items from invoice text using regex patterns.
 *
 * This is a simplified extraction; production implementations should use
 * a trained ML model or specialized invoice OCR API.
 */
function extractLineItemsFromText(text: string): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];

  // Pattern: quantity, description, unit price, total
  // Matches lines like: "2  Widget Pro License  $499.00  $998.00"
  //                  or: "1  Consulting hours (8h)  $150.00  $150.00"
  const linePattern = /^\s*(\d+(?:\.\d+)?)\s+(.+?)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)\s*$/gm;

  let match: RegExpExecArray | null = linePattern.exec(text);
  let lineNumber = 1;

  while (match !== null) {
    const quantity = Number.parseFloat(match[1]);
    const description = match[2].trim();
    const unitPrice = parseAmount(match[3]);
    const lineTotal = parseAmount(match[4]);

    // Estimate tax as 0 (would need invoice-level tax info to distribute)
    items.push({
      lineNumber,
      description,
      quantity,
      unitOfMeasure: "each",
      unitPrice,
      taxAmount: 0,
      lineTotal,
      confidence: 0.75,
    });

    lineNumber++;
    match = linePattern.exec(text);
  }

  return items;
}

/**
 * Extract invoice metadata from the text header area.
 */
function extractMetadataFromText(text: string, currencyHint?: string): InvoiceMetadata {
  const invoiceNumberMatch = /invoice\s*#?\s*:?\s*([A-Z0-9\-]+)/i.exec(text);
  const dateMatch = /(?:invoice\s+)?date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i.exec(text);
  const dueDateMatch = /due\s*(?:date)?\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i.exec(text);
  const poMatch = /p\.?o\.?\s*#?\s*:?\s*([A-Z0-9\-]+)/i.exec(text);
  const termsMatch = /(?:payment\s+)?terms?\s*:?\s*(net\s*\d+|due\s+on\s+receipt|cod|cia)/i.exec(
    text,
  );
  // Vendor name: first non-empty line (heuristic)
  const firstLine =
    text
      .split("\n")
      .find((l) => l.trim().length > 0)
      ?.trim() ?? null;

  return {
    vendorName: firstLine,
    invoiceNumber: invoiceNumberMatch?.[1] ?? null,
    invoiceDate: dateMatch?.[1] ?? null,
    dueDate: dueDateMatch?.[1] ?? null,
    paymentTerms: termsMatch?.[1] ?? null,
    currency: currencyHint ?? "USD",
    poNumber: poMatch?.[1] ?? null,
  };
}

// ── Implementation ───────────────────────────────────────────────

/**
 * Extract line items and metadata from invoice text.
 *
 * @param input - Raw invoice text and extraction options.
 * @returns Structured line items, metadata, and totals.
 */
export async function execute(input: ExtractInvoiceInput): Promise<ExtractInvoiceOutput> {
  const now = new Date().toISOString();

  // Validate required fields
  if (!input.invoiceText || typeof input.invoiceText !== "string") {
    return {
      success: false,
      error: "Missing or invalid 'invoiceText' in input.",
      lineItems: [],
      metadata: null,
      subtotal: 0,
      totalTax: 0,
      grandTotal: 0,
      lineCount: 0,
      averageConfidence: 0,
      extractedAt: now,
    };
  }

  try {
    const lineItems = extractLineItemsFromText(input.invoiceText);

    // Compute totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const totalTax = lineItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const grandTotal = subtotal + totalTax;
    const averageConfidence =
      lineItems.length > 0
        ? lineItems.reduce((sum, item) => sum + item.confidence, 0) / lineItems.length
        : 0;

    // Extract metadata if requested
    const metadata =
      input.extractMetadata !== false
        ? extractMetadataFromText(input.invoiceText, input.currencyHint)
        : null;

    return {
      success: true,
      lineItems,
      metadata,
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
      lineCount: lineItems.length,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      extractedAt: now,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: message,
      lineItems: [],
      metadata: null,
      subtotal: 0,
      totalTax: 0,
      grandTotal: 0,
      lineCount: 0,
      averageConfidence: 0,
      extractedAt: now,
    };
  }
}
