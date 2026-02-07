/**
 * TOOLS-006 (#42) -- Browser commit gating
 *
 * Detects destructive or irreversible actions on a web page (submit forms,
 * payment buttons, delete confirmations) and flags them for human approval
 * before the browser runner proceeds.
 *
 * @see ./browser-runner.ts
 * @module
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The category of potentially destructive action detected on a page.
 *
 * - `submit`  -- form submission or data-sending button
 * - `payment` -- purchase / checkout / payment button
 * - `delete`  -- deletion or permanent-removal action
 * - `confirm` -- generic confirmation dialog (e.g. "Are you sure?")
 * - `unknown` -- detected as potentially destructive but uncategorized
 */
export type CommitActionType = "submit" | "payment" | "delete" | "confirm" | "unknown";

/**
 * Describes a detected commit-worthy element on the page.
 */
export type CommitGateResult = {
  /** The category of the detected action. */
  action_type: CommitActionType;

  /** CSS selector uniquely identifying the element on the page. */
  element_selector: string;

  /**
   * Whether the action requires explicit human approval before the
   * browser runner interacts with it.
   *
   * When `true`, the runner must pause and request approval through the
   * run's approval queue.
   */
  requires_approval: boolean;

  /**
   * Human-readable description of what the element does.
   * Used in the approval prompt shown to the operator.
   *
   * Example: `"Submit payment of $49.99 to Acme Corp"`
   */
  description: string;

  /** The visible text content of the element (e.g. button label). */
  element_text?: string;

  /** Confidence score (0-1) of the detection heuristic. */
  confidence?: number;
};

// ---------------------------------------------------------------------------
// Heuristic patterns
// ---------------------------------------------------------------------------

/**
 * Text patterns (case-insensitive) that indicate a destructive or
 * commit-worthy action. Grouped by action type.
 */
const HEURISTIC_PATTERNS: Record<CommitActionType, RegExp[]> = {
  submit: [/submit/i, /send/i, /confirm\s+order/i, /place\s+order/i, /apply/i],
  payment: [
    /pay\s+(now|\$)/i,
    /checkout/i,
    /purchase/i,
    /buy\s+now/i,
    /complete\s+payment/i,
    /add\s+to\s+cart/i,
  ],
  delete: [/delete/i, /remove/i, /destroy/i, /permanently/i, /erase/i],
  confirm: [/are\s+you\s+sure/i, /confirm/i, /irreversible/i, /cannot\s+be\s+undone/i],
  unknown: [],
};

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

/**
 * Scans page content for elements that represent destructive or
 * irreversible actions.
 *
 * Usage:
 * ```ts
 * const detector = new CommitStepDetector();
 * const results = detector.detect(pageElementDescriptions);
 * for (const gate of results) {
 *   if (gate.requires_approval) {
 *     // pause and request human approval
 *   }
 * }
 * ```
 */
export class CommitStepDetector {
  /**
   * Analyze a set of interactive elements from the current page and
   * return any that appear to be commit-worthy actions.
   *
   * @param elements An array of `{ selector, text }` pairs describing
   *   clickable/submittable elements on the page (buttons, links,
   *   input[type=submit], etc.).
   *
   * @returns An array of `CommitGateResult` entries, one for each
   *   element that matches a heuristic pattern. Empty array when no
   *   commit-worthy elements are found.
   */
  detect(elements: ReadonlyArray<{ selector: string; text: string }>): CommitGateResult[] {
    const results: CommitGateResult[] = [];

    for (const el of elements) {
      const matched = this.classifyElement(el.text);
      if (matched) {
        results.push({
          action_type: matched.type,
          element_selector: el.selector,
          requires_approval: matched.type !== "unknown",
          description: `Detected "${el.text.trim()}" as a potential ${matched.type} action`,
          element_text: el.text.trim(),
          confidence: matched.confidence,
        });
      }
    }

    return results;
  }

  /**
   * Classify a single element's visible text against heuristic patterns.
   *
   * @returns The matched action type and confidence, or `null` if no
   *   pattern matches.
   */
  private classifyElement(text: string): { type: CommitActionType; confidence: number } | null {
    for (const [type, patterns] of Object.entries(HEURISTIC_PATTERNS) as Array<
      [CommitActionType, RegExp[]]
    >) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          // Confidence is higher for more-specific patterns (payment, delete)
          // and lower for generic ones (submit, confirm).
          const confidence =
            type === "payment" || type === "delete" ? 0.9 : type === "submit" ? 0.7 : 0.6;
          return { type, confidence };
        }
      }
    }
    return null;
  }
}
