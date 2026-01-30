import { describe, expect, it, vi, beforeEach } from "vitest";
import { preserveRecentTurns } from "./compact.js";
import { estimateTokens } from "@mariozechner/pi-coding-agent";

// Mock estimateTokens before import if possible, or just mock return value
vi.mock("@mariozechner/pi-coding-agent", () => ({
  estimateTokens: vi.fn(),
}));

const mockedEstimateTokens = vi.mocked(estimateTokens);

describe("preserveRecentTurns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMsg = (role: string, content: string): any => ({ role, content });

  it("preserves last 5 turns (10 messages) when they fit in context", () => {
    mockedEstimateTokens.mockReturnValue(100);

    const oldMessages = [createMsg("user", "old1"), createMsg("assistant", "old2")];
    const recentMessages = [];
    for (let i = 0; i < 10; i++) {
      recentMessages.push(createMsg(i % 2 === 0 ? "user" : "assistant", `recent${i}`));
    }
    const allMessages = [...oldMessages, ...recentMessages];

    // Context window large enough: 25% of 10000 = 2500. 10 * 100 = 1000.
    const result = preserveRecentTurns({
      messages: allMessages,
      contextWindow: 10000,
    });

    expect(result.recentMessages).toHaveLength(10);
    expect(result.recentMessages[0].content).toBe("recent0");
    expect(result.preservedTokens).toBe(1000);
  });

  it("stops preserving if token limit (25% context) is reached", () => {
    // Context 1000. 25% = 250.
    // Each message 100.
    // Can preserve 2 messages max.
    mockedEstimateTokens.mockReturnValue(100);

    const messages = [
      createMsg("user", "1"),
      createMsg("assistant", "2"),
      createMsg("user", "3"), // Preserved
      createMsg("assistant", "4"), // Preserved
    ];

    const result = preserveRecentTurns({
      messages,
      contextWindow: 1000,
    });

    expect(result.recentMessages).toHaveLength(2);
    expect(result.recentMessages[0].content).toBe("3");
    expect(result.preservedTokens).toBe(200);
  });

  it("stops preserving if a single recent message is too huge", () => {
    // Context 4000. 25% = 1000.
    // Last message 1500.
    mockedEstimateTokens.mockImplementation((msg: any) => {
      return msg.content === "huge" ? 1500 : 100;
    });

    const messages = [createMsg("user", "normal"), createMsg("assistant", "huge")];

    // Assuming we walk backwards:
    // 1. "huge" (1500). 1500 > 1000.
    // If recentMessages is empty, we check `recentMessages.length > 0`.
    // Wait, the logic is: `if (preservedTokens + tokens > maxPreserved && recentMessages.length > 0) break;`
    // If recentMessages is empty, it does NOT break. It adds it!
    // This implies we preserve AT LEAST ONE message even if oversized?
    // Let's verify assumption.

    // Code:
    // if (preservedTokens + tokens > maxPreservedTokens && recentMessages.length > 0) break;
    // recentMessages.unshift(msg);

    // So yes, it allows the *first* (most recent) message to exceed limits if it's the only one.
    // This is arguably good (prefer keeping 1 message over 0).

    const result = preserveRecentTurns({
      messages,
      contextWindow: 4000,
    });

    expect(result.recentMessages).toHaveLength(1);
    expect(result.recentMessages[0].content).toBe("huge");
  });

  it("stops preserving if accumulated tokens exceed limit", () => {
    // Context 4000. Max 1000.
    mockedEstimateTokens.mockReturnValue(400);

    const messages = [createMsg("u", "1"), createMsg("a", "2"), createMsg("u", "3")];
    // 3. 400. Total 400. OK.
    // 2. 400. Total 800. OK.
    // 1. 400. Total 1200. > 1000. Break.

    const result = preserveRecentTurns({ messages, contextWindow: 4000 });
    expect(result.recentMessages).toHaveLength(2); // 3 and 2
    expect(result.preservedTokens).toBe(800);
  });
});
