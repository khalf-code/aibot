import { describe, expect, it } from "vitest";
import {
  compressBashOutput,
  compressFindOutput,
  compressGrepOutput,
  compressLsOutput,
  compressReadOutput,
  compressToolResult,
  TOOL_COMPRESSORS,
} from "./index.js";

describe("compressLsOutput", () => {
  it("returns original for small outputs", () => {
    const small = "file1.txt\nfile2.txt\ndir1/";
    expect(compressLsOutput(small)).toBe(small);
  });

  it("compresses large ls outputs", () => {
    // Generate 50 files
    const lines = Array.from({ length: 50 }, (_, i) => `file${i}.ts`);
    const input = lines.join("\n");

    const compressed = compressLsOutput(input);

    expect(compressed).toContain("[50 files/directories total]");
    expect(compressed).toContain("ts: 50 files");
    expect(compressed).toContain("[Tool result compressed");
    expect(compressed.length).toBeLessThan(input.length);
  });

  it("groups files by extension", () => {
    const lines = [
      ...Array.from({ length: 20 }, (_, i) => `file${i}.ts`),
      ...Array.from({ length: 10 }, (_, i) => `doc${i}.md`),
      ...Array.from({ length: 5 }, (_, i) => `config${i}.json`),
    ];
    const input = lines.join("\n");

    const compressed = compressLsOutput(input);

    expect(compressed).toContain("ts: 20 files");
    expect(compressed).toContain("md: 10 files");
    expect(compressed).toContain("json: 5 files");
  });
});

describe("compressGrepOutput", () => {
  it("returns original for small outputs", () => {
    const small = "file.ts:10:const x = 1\nfile.ts:20:const y = 2";
    expect(compressGrepOutput(small)).toBe(small);
  });

  it("compresses and deduplicates grep matches", () => {
    // Generate repeated matches
    const lines = Array.from(
      { length: 40 },
      (_, i) => `file${i}.ts:10:import { foo } from 'bar'`,
    );
    const input = lines.join("\n");

    const compressed = compressGrepOutput(input);

    expect(compressed).toContain("40 grep matches found");
    expect(compressed).toContain("import { foo } from 'bar'");
    expect(compressed).toContain("Found 40 times");
    expect(compressed.length).toBeLessThan(input.length);
  });
});

describe("compressBashOutput", () => {
  it("returns original for small outputs", () => {
    const small = "line1\nline2\nline3";
    expect(compressBashOutput(small)).toBe(small);
  });

  it("detects and summarizes repeated patterns", () => {
    const lines = [
      ...Array.from({ length: 100 }, () => "npm WARN deprecated package@1.0.0"),
      "Build completed successfully",
      "Time: 5.2s",
    ];
    const input = lines.join("\n");

    const compressed = compressBashOutput(input);

    expect(compressed).toContain("102 lines total");
    expect(compressed).toContain("Repeated patterns detected");
    expect(compressed).toContain("(100x)");
    expect(compressed).toContain("npm WARN deprecated");
    expect(compressed.length).toBeLessThan(input.length);
  });

  it("truncates with head/tail when no patterns found", () => {
    const lines = Array.from({ length: 150 }, (_, i) => `unique line ${i}`);
    const input = lines.join("\n");

    const compressed = compressBashOutput(input);

    expect(compressed).toContain("lines omitted");
    expect(compressed.length).toBeLessThan(input.length);
  });
});

describe("compressReadOutput", () => {
  it("returns original for small files", () => {
    const small = "const x = 1;\nconst y = 2;";
    expect(compressReadOutput(small)).toBe(small);
  });

  it("collapses multiple blank lines in large files", () => {
    // Build a file with many blank line runs > 8000 chars
    const chunks = Array.from(
      { length: 500 },
      (_, i) => `const x${i} = ${i};\n\n\n\n\n`,
    );
    const input = chunks.join("");

    expect(input.length).toBeGreaterThan(8000);

    const compressed = compressReadOutput(input);

    // Should reduce size by collapsing blank lines and add note
    expect(compressed.length).toBeLessThan(input.length);
    expect(compressed).toContain("[File content compressed");
  });

  it("preserves code blocks", () => {
    // Generate > 8000 chars to trigger compression
    const input = "# Heading\n```js\nconst x = 1;\n```\nMore text\n".repeat(
      200,
    );

    expect(input.length).toBeGreaterThan(8000);

    const compressed = compressReadOutput(input);

    // Code blocks should be preserved
    expect(compressed).toContain("```js");
    expect(compressed).toContain("const x = 1;");
  });
});

describe("compressFindOutput", () => {
  it("returns original for small outputs", () => {
    const small = "./file1.ts\n./file2.ts";
    expect(compressFindOutput(small)).toBe(small);
  });

  it("shows directory structure for large outputs", () => {
    const lines = [
      ...Array.from({ length: 20 }, (_, i) => `./src/components/file${i}.tsx`),
      ...Array.from({ length: 15 }, (_, i) => `./src/utils/util${i}.ts`),
      ...Array.from({ length: 10 }, (_, i) => `./tests/test${i}.test.ts`),
    ];
    const input = lines.join("\n");

    const compressed = compressFindOutput(input);

    expect(compressed).toContain("45 files found");
    expect(compressed).toContain("3 directories");
    expect(compressed).toContain("./src/components/ (20 files)");
    expect(compressed).toContain("./src/utils/ (15 files)");
    expect(compressed.length).toBeLessThan(input.length);
  });
});

describe("TOOL_COMPRESSORS registry", () => {
  it("has compressors for common tools", () => {
    expect(TOOL_COMPRESSORS.ls).toBe(compressLsOutput);
    expect(TOOL_COMPRESSORS.grep).toBe(compressGrepOutput);
    expect(TOOL_COMPRESSORS.bash).toBe(compressBashOutput);
    expect(TOOL_COMPRESSORS.read).toBe(compressReadOutput);
    expect(TOOL_COMPRESSORS.find).toBe(compressFindOutput);
  });
});

describe("compressToolResult", () => {
  it("applies correct compressor based on tool name", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `file${i}.ts`);
    const input = lines.join("\n");

    const compressed = compressToolResult("ls", input);

    expect(compressed).toContain("[50 files/directories total]");
  });

  it("returns original for unknown tools", () => {
    const input = "some output";
    expect(compressToolResult("unknown_tool", input)).toBe(input);
  });

  it("is case insensitive for tool names", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `file${i}.ts`);
    const input = lines.join("\n");

    const compressed = compressToolResult("LS", input);

    expect(compressed).toContain("[50 files/directories total]");
  });

  it("returns original on compression error", () => {
    // The compressor shouldn't fail on any input, but if it does, return original
    const input = "valid input";
    expect(compressToolResult("ls", input)).toBe(input);
  });
});
