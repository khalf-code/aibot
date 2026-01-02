/**
 * Deep Research topic normalization helpers
 */

export const MAX_DEEP_RESEARCH_TOPIC_LENGTH = 240;

export function normalizeDeepResearchTopic(
  raw: string,
): { topic: string; truncated: boolean } | null {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  if (normalized.length > MAX_DEEP_RESEARCH_TOPIC_LENGTH) {
    return {
      topic: normalized.slice(0, MAX_DEEP_RESEARCH_TOPIC_LENGTH).trim(),
      truncated: true,
    };
  }

  return { topic: normalized, truncated: false };
}
