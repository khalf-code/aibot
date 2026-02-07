import { describe, expect, it } from "vitest";
import { splitShellArgs } from "./shell-argv.js";

describe("splitShellArgs", () => {
  it("splits simple space-separated args", () => {
    expect(splitShellArgs("a b c")).toEqual(["a", "b", "c"]);
  });

  it("handles multiple spaces between args", () => {
    expect(splitShellArgs("a   b   c")).toEqual(["a", "b", "c"]);
  });

  it("handles tabs and mixed whitespace", () => {
    expect(splitShellArgs("a\tb\t c")).toEqual(["a", "b", "c"]);
  });

  it("returns empty array for empty string", () => {
    expect(splitShellArgs("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(splitShellArgs("   ")).toEqual([]);
  });

  // Double quotes
  it("handles double-quoted strings", () => {
    expect(splitShellArgs('a "hello world" b')).toEqual(["a", "hello world", "b"]);
  });

  it("handles double-quoted string with spaces", () => {
    expect(splitShellArgs('"foo bar"')).toEqual(["foo bar"]);
  });

  it("skips empty double-quoted string (no token produced)", () => {
    expect(splitShellArgs('a "" b')).toEqual(["a", "b"]);
  });

  // Single quotes
  it("handles single-quoted strings", () => {
    expect(splitShellArgs("a 'hello world' b")).toEqual(["a", "hello world", "b"]);
  });

  it("handles single-quoted string preserving double quotes inside", () => {
    expect(splitShellArgs(`'say "hi"'`)).toEqual(['say "hi"']);
  });

  // Backslash escaping
  it("handles backslash-escaped spaces", () => {
    expect(splitShellArgs("hello\\ world")).toEqual(["hello world"]);
  });

  it("handles backslash-escaped backslash", () => {
    expect(splitShellArgs("a\\\\b")).toEqual(["a\\b"]);
  });

  // Error cases (unclosed quotes / trailing backslash)
  it("returns null for unclosed double quote", () => {
    expect(splitShellArgs('"unclosed')).toBeNull();
  });

  it("returns null for unclosed single quote", () => {
    expect(splitShellArgs("'unclosed")).toBeNull();
  });

  it("returns null for trailing backslash", () => {
    expect(splitShellArgs("trailing\\")).toBeNull();
  });

  // Mixed quoting
  it("handles adjacent quoted and unquoted segments", () => {
    expect(splitShellArgs('pre"mid"post')).toEqual(["premidpost"]);
  });

  it("handles complex mixed quoting", () => {
    expect(splitShellArgs(`echo "hello" 'world' foo`)).toEqual(["echo", "hello", "world", "foo"]);
  });

  // Real-world patterns
  it("parses a typical command line", () => {
    expect(splitShellArgs("git commit -m 'initial commit'")).toEqual([
      "git",
      "commit",
      "-m",
      "initial commit",
    ]);
  });

  it("parses a command with key=value pairs", () => {
    expect(splitShellArgs('ENV_VAR="some value" ./run.sh')).toEqual([
      "ENV_VAR=some value",
      "./run.sh",
    ]);
  });
});
