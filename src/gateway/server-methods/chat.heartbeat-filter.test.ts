import { describe, expect, test } from "vitest";
import { isHeartbeatOnlyMessage, filterHeartbeatMessages } from "./chat.js";

describe("chat.history heartbeat filtering", () => {
  describe("isHeartbeatOnlyMessage", () => {
    test("returns true for assistant HEARTBEAT_OK string content", () => {
      const msg = { role: "assistant", content: "HEARTBEAT_OK" };
      expect(isHeartbeatOnlyMessage(msg)).toBe(true);
    });

    test("returns true for assistant HEARTBEAT_OK with whitespace", () => {
      const msg = { role: "assistant", content: "  HEARTBEAT_OK  " };
      expect(isHeartbeatOnlyMessage(msg)).toBe(true);
    });

    test("returns true for assistant HEARTBEAT_OK with trailing newline only", () => {
      const msg = { role: "assistant", content: "HEARTBEAT_OK\n" };
      expect(isHeartbeatOnlyMessage(msg)).toBe(true);
    });

    test("returns false for assistant with additional content after newline", () => {
      // This is the key fix: HEARTBEAT_OK followed by real content should NOT be filtered
      const msg = { role: "assistant", content: "HEARTBEAT_OK\nActual response here" };
      expect(isHeartbeatOnlyMessage(msg)).toBe(false);
    });

    test("returns false for assistant with additional content on same line", () => {
      const msg = { role: "assistant", content: "HEARTBEAT_OK but also this message" };
      expect(isHeartbeatOnlyMessage(msg)).toBe(false);
    });

    test("returns false for user messages", () => {
      const msg = { role: "user", content: "HEARTBEAT_OK" };
      expect(isHeartbeatOnlyMessage(msg)).toBe(false);
    });

    test("returns true for array content with single HEARTBEAT_OK text block", () => {
      const msg = {
        role: "assistant",
        content: [{ type: "text", text: "HEARTBEAT_OK" }],
      };
      expect(isHeartbeatOnlyMessage(msg)).toBe(true);
    });

    test("returns false for array content with HEARTBEAT_OK and additional text block", () => {
      // This is the key fix: multiple text blocks where one is HEARTBEAT_OK should NOT be filtered
      const msg = {
        role: "assistant",
        content: [
          { type: "text", text: "HEARTBEAT_OK" },
          { type: "text", text: "But here's some real content" },
        ],
      };
      expect(isHeartbeatOnlyMessage(msg)).toBe(false);
    });

    test("returns false for array content with real message", () => {
      const msg = {
        role: "assistant",
        content: [{ type: "text", text: "Here's a helpful response." }],
      };
      expect(isHeartbeatOnlyMessage(msg)).toBe(false);
    });

    test("returns false for empty array content", () => {
      const msg = { role: "assistant", content: [] };
      expect(isHeartbeatOnlyMessage(msg)).toBe(false);
    });

    test("returns false for null/undefined message", () => {
      expect(isHeartbeatOnlyMessage(null)).toBe(false);
      expect(isHeartbeatOnlyMessage(undefined)).toBe(false);
    });

    test("returns false for non-object message", () => {
      expect(isHeartbeatOnlyMessage("HEARTBEAT_OK")).toBe(false);
      expect(isHeartbeatOnlyMessage(123)).toBe(false);
    });
  });

  describe("filterHeartbeatMessages", () => {
    test("removes HEARTBEAT_OK when showOk is false", () => {
      const messages = [
        { role: "user", content: "ping" },
        { role: "assistant", content: "HEARTBEAT_OK" },
        { role: "user", content: "hello" },
        { role: "assistant", content: "Hello! How can I help?" },
      ];
      const filtered = filterHeartbeatMessages(messages, false);
      expect(filtered).toHaveLength(3);
      expect(filtered.map((m) => (m as { role: string }).role)).toEqual([
        "user",
        "user",
        "assistant",
      ]);
    });

    test("keeps all messages when showOk is true", () => {
      const messages = [
        { role: "user", content: "ping" },
        { role: "assistant", content: "HEARTBEAT_OK" },
        { role: "user", content: "hello" },
        { role: "assistant", content: "Hello! How can I help?" },
      ];
      const filtered = filterHeartbeatMessages(messages, true);
      expect(filtered).toHaveLength(4);
    });

    test("handles multiple HEARTBEAT_OK messages", () => {
      const messages = [
        { role: "assistant", content: "HEARTBEAT_OK" },
        { role: "assistant", content: "HEARTBEAT_OK" },
        { role: "assistant", content: "Actual content here" },
      ];
      const filtered = filterHeartbeatMessages(messages, false);
      expect(filtered).toHaveLength(1);
      expect((filtered[0] as { content: string }).content).toBe("Actual content here");
    });

    test("preserves messages with HEARTBEAT_OK prefix followed by real content", () => {
      // Critical: messages that START with HEARTBEAT_OK but have more content should be kept
      const messages = [
        { role: "assistant", content: "HEARTBEAT_OK\nBut I also wanted to mention something" },
        { role: "assistant", content: "HEARTBEAT_OK" },
      ];
      const filtered = filterHeartbeatMessages(messages, false);
      expect(filtered).toHaveLength(1);
      expect((filtered[0] as { content: string }).content).toBe(
        "HEARTBEAT_OK\nBut I also wanted to mention something",
      );
    });

    test("handles empty message array", () => {
      const filtered = filterHeartbeatMessages([], false);
      expect(filtered).toHaveLength(0);
    });
  });
});
