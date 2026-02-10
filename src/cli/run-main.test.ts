import { describe, expect, it } from "vitest";
import { commandRegistry } from "./program/command-registry.js";
import { getSubCliEntries } from "./program/register.subclis.js";
import { BUILTIN_COMMANDS, rewriteUpdateFlagArgv } from "./run-main.js";

// Commands intentionally excluded from BUILTIN_COMMANDS because they need plugin
// CLI registration (e.g. completion needs plugin commands for shell scripts).
const INTENTIONAL_EXCLUSIONS = new Set(["completion"]);

describe("BUILTIN_COMMANDS covers all registered commands", () => {
  it("includes every subcli entry (except intentional exclusions)", () => {
    const missing: string[] = [];
    for (const entry of getSubCliEntries()) {
      if (!BUILTIN_COMMANDS.has(entry.name) && !INTENTIONAL_EXCLUSIONS.has(entry.name)) {
        missing.push(entry.name);
      }
    }
    expect(missing, `Subcli commands missing from BUILTIN_COMMANDS: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("includes every core command registry entry that is a direct command name", () => {
    // Registry entries whose id matches an actual CLI command name
    const coreCommandIds = commandRegistry
      .map((entry) => entry.id)
      .filter((id) => !["subclis", "status-health-sessions"].includes(id));
    const missing = coreCommandIds.filter((id) => !BUILTIN_COMMANDS.has(id));
    expect(missing, `Core commands missing from BUILTIN_COMMANDS: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("does not contain unknown command names", () => {
    const knownSubclis = new Set(getSubCliEntries().map((e) => e.name));
    const knownCore = new Set(commandRegistry.map((e) => e.id));
    // Route-registered top-level names (health, status, sessions) are registered
    // by the status-health-sessions entry, not as individual registry IDs.
    const knownRouted = new Set(["health", "status", "sessions"]);
    const unknown: string[] = [];
    for (const cmd of BUILTIN_COMMANDS) {
      if (!knownSubclis.has(cmd) && !knownCore.has(cmd) && !knownRouted.has(cmd)) {
        unknown.push(cmd);
      }
    }
    expect(unknown, `BUILTIN_COMMANDS contains unknown entries: ${unknown.join(", ")}`).toEqual([]);
  });
});

describe("rewriteUpdateFlagArgv", () => {
  it("leaves argv unchanged when --update is absent", () => {
    const argv = ["node", "entry.js", "status"];
    expect(rewriteUpdateFlagArgv(argv)).toBe(argv);
  });

  it("rewrites --update into the update command", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--update"])).toEqual([
      "node",
      "entry.js",
      "update",
    ]);
  });

  it("preserves global flags that appear before --update", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--profile", "p", "--update"])).toEqual([
      "node",
      "entry.js",
      "--profile",
      "p",
      "update",
    ]);
  });

  it("keeps update options after the rewritten command", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--update", "--json"])).toEqual([
      "node",
      "entry.js",
      "update",
      "--json",
    ]);
  });
});
