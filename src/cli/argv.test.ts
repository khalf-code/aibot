import { describe, expect, it } from "vitest";
import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it("detects help/version flags", () => {
    expect(hasHelpOrVersion(["node", "zoidbergbot", "--help"])).toBe(true);
    expect(hasHelpOrVersion(["node", "zoidbergbot", "-V"])).toBe(true);
    expect(hasHelpOrVersion(["node", "zoidbergbot", "status"])).toBe(false);
  });

  it("extracts command path ignoring flags and terminator", () => {
    expect(getCommandPath(["node", "zoidbergbot", "status", "--json"], 2)).toEqual(["status"]);
    expect(getCommandPath(["node", "zoidbergbot", "agents", "list"], 2)).toEqual([
      "agents",
      "list",
    ]);
    expect(getCommandPath(["node", "zoidbergbot", "status", "--", "ignored"], 2)).toEqual([
      "status",
    ]);
  });

  it("returns primary command", () => {
    expect(getPrimaryCommand(["node", "zoidbergbot", "agents", "list"])).toBe("agents");
    expect(getPrimaryCommand(["node", "zoidbergbot"])).toBeNull();
  });

  it("parses boolean flags and ignores terminator", () => {
    expect(hasFlag(["node", "zoidbergbot", "status", "--json"], "--json")).toBe(true);
    expect(hasFlag(["node", "zoidbergbot", "--", "--json"], "--json")).toBe(false);
  });

  it("extracts flag values with equals and missing values", () => {
    expect(getFlagValue(["node", "zoidbergbot", "status", "--timeout", "5000"], "--timeout")).toBe(
      "5000",
    );
    expect(getFlagValue(["node", "zoidbergbot", "status", "--timeout=2500"], "--timeout")).toBe(
      "2500",
    );
    expect(getFlagValue(["node", "zoidbergbot", "status", "--timeout"], "--timeout")).toBeNull();
    expect(
      getFlagValue(["node", "zoidbergbot", "status", "--timeout", "--json"], "--timeout"),
    ).toBe(null);
    expect(
      getFlagValue(["node", "zoidbergbot", "--", "--timeout=99"], "--timeout"),
    ).toBeUndefined();
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "zoidbergbot", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "zoidbergbot", "status", "--debug"])).toBe(false);
    expect(
      getVerboseFlag(["node", "zoidbergbot", "status", "--debug"], { includeDebug: true }),
    ).toBe(true);
  });

  it("parses positive integer flag values", () => {
    expect(getPositiveIntFlagValue(["node", "zoidbergbot", "status"], "--timeout")).toBeUndefined();
    expect(
      getPositiveIntFlagValue(["node", "zoidbergbot", "status", "--timeout"], "--timeout"),
    ).toBeNull();
    expect(
      getPositiveIntFlagValue(["node", "zoidbergbot", "status", "--timeout", "5000"], "--timeout"),
    ).toBe(5000);
    expect(
      getPositiveIntFlagValue(["node", "zoidbergbot", "status", "--timeout", "nope"], "--timeout"),
    ).toBeUndefined();
  });

  it("builds parse argv from raw args", () => {
    const nodeArgv = buildParseArgv({
      programName: "zoidbergbot",
      rawArgs: ["node", "zoidbergbot", "status"],
    });
    expect(nodeArgv).toEqual(["node", "zoidbergbot", "status"]);

    const versionedNodeArgv = buildParseArgv({
      programName: "zoidbergbot",
      rawArgs: ["node-22", "zoidbergbot", "status"],
    });
    expect(versionedNodeArgv).toEqual(["node-22", "zoidbergbot", "status"]);

    const versionedNodeWindowsArgv = buildParseArgv({
      programName: "zoidbergbot",
      rawArgs: ["node-22.2.0.exe", "zoidbergbot", "status"],
    });
    expect(versionedNodeWindowsArgv).toEqual(["node-22.2.0.exe", "zoidbergbot", "status"]);

    const versionedNodePatchlessArgv = buildParseArgv({
      programName: "zoidbergbot",
      rawArgs: ["node-22.2", "zoidbergbot", "status"],
    });
    expect(versionedNodePatchlessArgv).toEqual(["node-22.2", "zoidbergbot", "status"]);

    const versionedNodeWindowsPatchlessArgv = buildParseArgv({
      programName: "zoidbergbot",
      rawArgs: ["node-22.2.exe", "zoidbergbot", "status"],
    });
    expect(versionedNodeWindowsPatchlessArgv).toEqual(["node-22.2.exe", "zoidbergbot", "status"]);

    const versionedNodeWithPathArgv = buildParseArgv({
      programName: "zoidbergbot",
      rawArgs: ["/usr/bin/node-22.2.0", "zoidbergbot", "status"],
    });
    expect(versionedNodeWithPathArgv).toEqual(["/usr/bin/node-22.2.0", "zoidbergbot", "status"]);

    const nodejsArgv = buildParseArgv({
      programName: "zoidbergbot",
      rawArgs: ["nodejs", "zoidbergbot", "status"],
    });
    expect(nodejsArgv).toEqual(["nodejs", "zoidbergbot", "status"]);

    const nonVersionedNodeArgv = buildParseArgv({
      programName: "zoidbergbot",
      rawArgs: ["node-dev", "zoidbergbot", "status"],
    });
    expect(nonVersionedNodeArgv).toEqual([
      "node",
      "zoidbergbot",
      "node-dev",
      "zoidbergbot",
      "status",
    ]);

    const directArgv = buildParseArgv({
      programName: "zoidbergbot",
      rawArgs: ["zoidbergbot", "status"],
    });
    expect(directArgv).toEqual(["node", "zoidbergbot", "status"]);

    const bunArgv = buildParseArgv({
      programName: "zoidbergbot",
      rawArgs: ["bun", "src/entry.ts", "status"],
    });
    expect(bunArgv).toEqual(["bun", "src/entry.ts", "status"]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "zoidbergbot",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "zoidbergbot", "status"]);
  });

  it("decides when to migrate state", () => {
    expect(shouldMigrateState(["node", "zoidbergbot", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "zoidbergbot", "health"])).toBe(false);
    expect(shouldMigrateState(["node", "zoidbergbot", "sessions"])).toBe(false);
    expect(shouldMigrateState(["node", "zoidbergbot", "memory", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "zoidbergbot", "agent", "--message", "hi"])).toBe(false);
    expect(shouldMigrateState(["node", "zoidbergbot", "agents", "list"])).toBe(true);
    expect(shouldMigrateState(["node", "zoidbergbot", "message", "send"])).toBe(true);
  });

  it("reuses command path for migrate state decisions", () => {
    expect(shouldMigrateStateFromPath(["status"])).toBe(false);
    expect(shouldMigrateStateFromPath(["agents", "list"])).toBe(true);
  });
});
