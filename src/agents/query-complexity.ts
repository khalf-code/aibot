/**
 * Query Complexity Estimation
 *
 * Estimates the complexity of user queries to inform adaptive behaviors:
 * - Output token budgeting (when supported by model API)
 * - Model selection for cost optimization
 * - Metrics and logging
 */

export type QueryComplexity = "simple" | "medium" | "complex";

/**
 * Recommended max_tokens based on complexity.
 * Simple queries don't need verbose responses.
 */
export const COMPLEXITY_TOKEN_LIMITS: Record<QueryComplexity, number> = {
  simple: 512,
  medium: 2048,
  complex: 8192,
};

/**
 * Keywords indicating code/implementation work (complex queries).
 */
const COMPLEX_KEYWORDS =
  /\b(implement|create|build|fix|debug|refactor|write|add|update|modify|change|delete|remove|deploy|configure|setup|install|migrate|convert|optimize|analyze)\b/i;

/**
 * Keywords indicating explanation/research work (medium queries).
 */
const MEDIUM_KEYWORDS =
  /\b(explain|describe|summarize|find|search|show|list|what|how|why|where|when|which|compare|difference|example)\b/i;

/**
 * Code-related entity patterns (files, functions, variables).
 */
const CODE_ENTITIES =
  /\b(file|function|class|method|variable|const|let|var|import|export|module|package|dependency|api|endpoint|route|component|hook|type|interface)\b/i;

/**
 * File path patterns.
 */
const FILE_PATTERNS =
  /\.(ts|js|tsx|jsx|py|go|rs|java|c|cpp|h|json|yaml|yml|md|txt|html|css|scss|sql)\b|\/[\w\-.]+\//i;

/**
 * Estimate query complexity based on content analysis.
 *
 * @param prompt - The user's query/message
 * @returns Estimated complexity level
 *
 * @example
 * estimateQueryComplexity("Hello") // "simple"
 * estimateQueryComplexity("What does this function do?") // "medium"
 * estimateQueryComplexity("Implement user authentication") // "complex"
 */
export function estimateQueryComplexity(prompt: string): QueryComplexity {
  const trimmed = prompt.trim();

  // Check for complex keywords first (implementation tasks)
  // These take priority regardless of message length
  if (COMPLEX_KEYWORDS.test(trimmed)) {
    return "complex";
  }

  // Check for medium-complexity keywords (questions, explanations)
  if (MEDIUM_KEYWORDS.test(trimmed)) {
    return "medium";
  }

  // Check for code entities or file references
  if (CODE_ENTITIES.test(trimmed) || FILE_PATTERNS.test(trimmed)) {
    // Code references without action keywords are likely medium
    return trimmed.length > 80 ? "complex" : "medium";
  }

  // Long messages are usually complex even without keywords
  if (trimmed.length > 200) {
    return "complex";
  }

  // Medium length messages default to medium
  if (trimmed.length > 80) {
    return "medium";
  }

  return "simple";
}

/**
 * Get recommended max_tokens for a query.
 *
 * @param prompt - The user's query/message
 * @returns Recommended max_tokens value
 */
export function getRecommendedMaxTokens(prompt: string): number {
  const complexity = estimateQueryComplexity(prompt);
  return COMPLEXITY_TOKEN_LIMITS[complexity];
}

/**
 * Estimate whether a query would benefit from a more powerful model.
 * Useful for cost optimization when choosing between model tiers.
 *
 * @param prompt - The user's query/message
 * @returns Whether a powerful model is recommended
 */
export function shouldUsePowerfulModel(prompt: string): boolean {
  return estimateQueryComplexity(prompt) === "complex";
}
