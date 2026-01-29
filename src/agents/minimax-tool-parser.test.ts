import { describe, expect, it } from "vitest";

import {
  extractAllMinimaxToolCallBlocks,
  extractMinimaxToolCallBlock,
  generateMinimaxToolCallId,
  hasCompleteMinimaxToolCall,
  hasMinimaxToolCallEnd,
  hasMinimaxToolCallStart,
  isPartialMinimaxToolCall,
  parseMinimaxToolCalls,
  stripMinimaxToolCallBlocks,
} from "./minimax-tool-parser.js";

describe("minimax-tool-parser", () => {
  describe("hasMinimaxToolCallStart", () => {
    it("detects tool call start tag", () => {
      expect(hasMinimaxToolCallStart("<<minimax:tool_call>>")).toBe(true);
      expect(hasMinimaxToolCallStart("Some text <<minimax:tool_call>>")).toBe(true);
      expect(hasMinimaxToolCallStart("<<MINIMAX:TOOL_CALL>>")).toBe(true); // case insensitive
    });

    it("returns false when no start tag", () => {
      expect(hasMinimaxToolCallStart("regular text")).toBe(false);
      expect(hasMinimaxToolCallStart("<minimax:tool_call>")).toBe(false); // wrong format
    });
  });

  describe("hasMinimaxToolCallEnd", () => {
    it("detects tool call end tag", () => {
      expect(hasMinimaxToolCallEnd("<</minimax:tool_call>>")).toBe(true);
      expect(hasMinimaxToolCallEnd("content<</minimax:tool_call>>")).toBe(true);
      expect(hasMinimaxToolCallEnd("<</MINIMAX:TOOL_CALL>>")).toBe(true); // case insensitive
    });

    it("returns false when no end tag", () => {
      expect(hasMinimaxToolCallEnd("regular text")).toBe(false);
      expect(hasMinimaxToolCallEnd("</minimax:tool_call>")).toBe(false); // wrong format
    });
  });

  describe("hasCompleteMinimaxToolCall", () => {
    it("detects complete tool call block", () => {
      const complete = `<<minimax:tool_call>>
        <<invoke name="read">>
          <<parameter name="path">>/home/test.txt<</parameter>>
        <</invoke>>
      <</minimax:tool_call>>`;
      expect(hasCompleteMinimaxToolCall(complete)).toBe(true);
    });

    it("returns false for partial blocks", () => {
      expect(hasCompleteMinimaxToolCall("<<minimax:tool_call>>content")).toBe(false);
      expect(hasCompleteMinimaxToolCall("content<</minimax:tool_call>>")).toBe(false);
    });
  });

  describe("isPartialMinimaxToolCall", () => {
    it("detects partial tool calls (has start but no end)", () => {
      expect(isPartialMinimaxToolCall("<<minimax:tool_call>>content")).toBe(true);
      expect(isPartialMinimaxToolCall("text<<minimax:tool_call>>more")).toBe(true);
    });

    it("returns false for complete or no tool calls", () => {
      expect(isPartialMinimaxToolCall("regular text")).toBe(false);
      expect(isPartialMinimaxToolCall("<<minimax:tool_call>>content<</minimax:tool_call>>")).toBe(
        false,
      );
    });
  });

  describe("parseMinimaxToolCalls", () => {
    it("parses single tool call with string parameter", () => {
      const text = `<<minimax:tool_call>>
        <<invoke name="read">>
          <<parameter name="path">>/home/liam/test.txt<</parameter>>
        <</invoke>>
      <</minimax:tool_call>>`;

      const calls = parseMinimaxToolCalls(text);
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe("read");
      expect(calls[0].arguments).toEqual({ path: "/home/liam/test.txt" });
    });

    it("parses tool call with multiple parameters", () => {
      const text = `<<minimax:tool_call>>
        <<invoke name="exec">>
          <<parameter name="command">>ls -la<</parameter>>
          <<parameter name="cwd">>/home/liam<</parameter>>
          <<parameter name="timeout">>30<</parameter>>
        <</invoke>>
      <</minimax:tool_call>>`;

      const calls = parseMinimaxToolCalls(text);
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe("exec");
      expect(calls[0].arguments).toEqual({
        command: "ls -la",
        cwd: "/home/liam",
        timeout: 30, // Should parse as number
      });
    });

    it("parses JSON array parameter", () => {
      const text = `<<minimax:tool_call>>
        <<invoke name="search">>
          <<parameter name="patterns">>["*.ts", "*.js"]<</parameter>>
        <</invoke>>
      <</minimax:tool_call>>`;

      const calls = parseMinimaxToolCalls(text);
      expect(calls).toHaveLength(1);
      expect(calls[0].arguments.patterns).toEqual(["*.ts", "*.js"]);
    });

    it("parses JSON object parameter", () => {
      const text = `<<minimax:tool_call>>
        <<invoke name="config">>
          <<parameter name="settings">>{"enabled": true, "count": 5}<</parameter>>
        <</invoke>>
      <</minimax:tool_call>>`;

      const calls = parseMinimaxToolCalls(text);
      expect(calls).toHaveLength(1);
      expect(calls[0].arguments.settings).toEqual({ enabled: true, count: 5 });
    });

    it("parses multiple tool calls in one block", () => {
      const text = `<<minimax:tool_call>>
        <<invoke name="read">>
          <<parameter name="path">>file1.txt<</parameter>>
        <</invoke>>
        <<invoke name="read">>
          <<parameter name="path">>file2.txt<</parameter>>
        <</invoke>>
      <</minimax:tool_call>>`;

      const calls = parseMinimaxToolCalls(text);
      expect(calls).toHaveLength(2);
      expect(calls[0].arguments.path).toBe("file1.txt");
      expect(calls[1].arguments.path).toBe("file2.txt");
    });

    it("parses multiple tool call blocks", () => {
      const text = `Some text<<minimax:tool_call>>
        <<invoke name="read">>
          <<parameter name="path">>file1.txt<</parameter>>
        <</invoke>>
      <</minimax:tool_call>>More text<<minimax:tool_call>>
        <<invoke name="write">>
          <<parameter name="path">>file2.txt<</parameter>>
          <<parameter name="content">>hello<</parameter>>
        <</invoke>>
      <</minimax:tool_call>>`;

      const calls = parseMinimaxToolCalls(text);
      expect(calls).toHaveLength(2);
      expect(calls[0].name).toBe("read");
      expect(calls[1].name).toBe("write");
    });

    it("handles boolean parameters", () => {
      const text = `<<minimax:tool_call>>
        <<invoke name="exec">>
          <<parameter name="command">>npm test<</parameter>>
          <<parameter name="elevated">>true<</parameter>>
          <<parameter name="silent">>false<</parameter>>
        <</invoke>>
      <</minimax:tool_call>>`;

      const calls = parseMinimaxToolCalls(text);
      expect(calls[0].arguments.elevated).toBe(true);
      expect(calls[0].arguments.silent).toBe(false);
    });

    it("handles parameters with newline-prefixed values", () => {
      const text = `<<minimax:tool_call>>
        <<invoke name="write">>
          <<parameter name="content">>
line 1
line 2
line 3<</parameter>>
        <</invoke>>
      <</minimax:tool_call>>`;

      const calls = parseMinimaxToolCalls(text);
      expect(calls[0].arguments.content).toBe("line 1\nline 2\nline 3");
    });

    it("handles tool names with quotes", () => {
      const text = `<<minimax:tool_call>>
        <<invoke name="read">>
          <<parameter name="path">>test.txt<</parameter>>
        <</invoke>>
      <</minimax:tool_call>>`;

      const calls = parseMinimaxToolCalls(text);
      expect(calls[0].name).toBe("read");

      const textWithDoubleQuotes = `<<minimax:tool_call>>
        <<invoke name="read">>
          <<parameter name="path">>test.txt<</parameter>>
        <</invoke>>
      <</minimax:tool_call>>`;

      const calls2 = parseMinimaxToolCalls(textWithDoubleQuotes);
      expect(calls2[0].name).toBe("read");
    });

    it("returns empty array when no tool calls", () => {
      expect(parseMinimaxToolCalls("regular text")).toEqual([]);
      expect(parseMinimaxToolCalls("")).toEqual([]);
    });
  });

  describe("extractMinimaxToolCallBlock", () => {
    it("extracts first tool call block with surrounding text", () => {
      const text = `Before<<minimax:tool_call>>
        <<invoke name="test">><</invoke>>
      <</minimax:tool_call>>After`;

      const result = extractMinimaxToolCallBlock(text);
      expect(result).not.toBeNull();
      expect(result!.before).toBe("Before");
      expect(result!.after).toBe("After");
      expect(result!.block).toContain("<<minimax:tool_call>>");
      expect(result!.block).toContain("<</minimax:tool_call>>");
    });

    it("returns null when no complete block", () => {
      expect(extractMinimaxToolCallBlock("no tool calls")).toBeNull();
      expect(extractMinimaxToolCallBlock("<<minimax:tool_call>>partial")).toBeNull();
    });
  });

  describe("extractAllMinimaxToolCallBlocks", () => {
    it("extracts multiple blocks", () => {
      const text = `A<<minimax:tool_call>>B<</minimax:tool_call>>C<<minimax:tool_call>>D<</minimax:tool_call>>E`;

      const blocks = extractAllMinimaxToolCallBlocks(text);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].before).toBe("A");
      expect(blocks[1].before).toBe("C");
      expect(blocks[1].after).toBe("E");
    });
  });

  describe("stripMinimaxToolCallBlocks", () => {
    it("removes all tool call blocks from text", () => {
      const text = `Before<<minimax:tool_call>>content<</minimax:tool_call>>After`;
      expect(stripMinimaxToolCallBlocks(text)).toBe("BeforeAfter");
    });

    it("handles multiple blocks", () => {
      const text = `A<<minimax:tool_call>>1<</minimax:tool_call>>B<<minimax:tool_call>>2<</minimax:tool_call>>C`;
      expect(stripMinimaxToolCallBlocks(text)).toBe("ABC");
    });

    it("returns unchanged text when no blocks", () => {
      expect(stripMinimaxToolCallBlocks("no changes")).toBe("no changes");
    });
  });

  describe("generateMinimaxToolCallId", () => {
    it("generates unique IDs", () => {
      const id1 = generateMinimaxToolCallId();
      const id2 = generateMinimaxToolCallId();

      expect(id1).toMatch(/^minimax_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^minimax_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });
});
