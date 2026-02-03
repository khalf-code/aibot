/**
 * Model tier constants for UI color coding.
 * Models are categorized by cost tier: high (red), medium (yellow), low (green).
 */

/**
 * Model name patterns that indicate high-cost models (red tier).
 * These models typically have the highest API costs.
 */
export const HIGH_TIER_MODEL_PATTERNS = [
  // OpenAI
  "gpt-5",
  "gpt-4.1",
  "gpt-4",
  "o1",
  "o3",

  // Anthropic
  "opus",

  // Google
  "gemini-2-pro",
  "gemini-1.5-pro",

  // Meta
  "llama-3.1-405b",

  // Mistral
  "mistral-large",
] as const;

/**
 * Model name patterns that indicate medium-cost models (yellow tier).
 * These models have moderate API costs.
 */
export const MEDIUM_TIER_MODEL_PATTERNS = ["sonnet", "gpt-4o", "gemini-3-flash"] as const;

/**
 * Model name patterns that indicate low-cost models (green tier).
 * These models have the lowest API costs.
 */

export const LOW_TIER_MODEL_PATTERNS = [
  // OpenAI
  "gpt-3.5",
  "gpt-4o-mini",

  // Anthropic
  "haiku",

  // Meta
  "llama",
  "llama-3.1-8b",
  "llama-3-8b",

  // Google
  "gemini-1.0",
  "gemini-nano",
] as const;
