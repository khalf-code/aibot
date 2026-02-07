/**
 * CORE-005 (#21) — Redaction pipeline
 *
 * Pattern-based redaction for PII and sensitive data in logs,
 * artifacts, and UI output.
 */

export type RedactionPattern = {
  /** Human-readable name for the pattern (e.g. "credit-card", "email"). */
  name: string;
  /** Regex source string — compiled at runtime via `new RegExp(...)`. */
  pattern: string;
  /** Replacement template, e.g. "[REDACTED:email]". */
  replacement: string;
};

export type RedactionTarget = "logs" | "artifacts" | "ui";

export type RedactionPolicy = {
  patterns: RedactionPattern[];
  /** Built-in PII rules to enable (e.g. "ssn", "phone", "email"). */
  piiRules: string[];
  /** Which output surfaces this policy applies to. */
  appliesTo: RedactionTarget[];
};

/**
 * Apply a redaction policy to an input string, replacing all matches
 * from every pattern in the policy.
 */
export function redact(input: string, policy: RedactionPolicy): string {
  let result = input;
  for (const { pattern, replacement } of policy.patterns) {
    // TODO: pre-compile and cache RegExp instances for performance
    const re = new RegExp(pattern, "g");
    result = result.replace(re, replacement);
  }
  // TODO: apply built-in piiRules
  return result;
}
