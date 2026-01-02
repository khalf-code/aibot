import { describe, expect, it } from "vitest";

import {
  MAX_DEEP_RESEARCH_TOPIC_LENGTH,
  normalizeDeepResearchTopic,
} from "./topic.js";

describe("normalizeDeepResearchTopic", () => {
  it("normalizes whitespace and trims", () => {
    const result = normalizeDeepResearchTopic("  AI \n safety  ");

    expect(result).toEqual({ topic: "AI safety", truncated: false });
  });

  it("returns null for empty topics", () => {
    expect(normalizeDeepResearchTopic("   ")).toBeNull();
  });

  it("truncates overly long topics", () => {
    const longTopic = "a".repeat(MAX_DEEP_RESEARCH_TOPIC_LENGTH + 20);
    const result = normalizeDeepResearchTopic(longTopic);

    expect(result?.topic).toHaveLength(MAX_DEEP_RESEARCH_TOPIC_LENGTH);
    expect(result?.truncated).toBe(true);
  });
});
