import { afterEach, describe, expect, it, vi } from "vitest";
import { rewriteUpdateFlagArgv } from "./run-main.js";

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

describe("runCli process.exit on success", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls process.exit(0) after routed command completes", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("EXIT_0");
    });

    vi.mock("./route.js", () => ({
      tryRouteCli: vi.fn().mockResolvedValue(true),
    }));
    vi.mock("../infra/dotenv.js", () => ({ loadDotEnv: vi.fn() }));
    vi.mock("../infra/env.js", () => ({ normalizeEnv: vi.fn() }));
    vi.mock("../infra/path-env.js", () => ({ ensureOpenClawCliOnPath: vi.fn() }));
    vi.mock("../infra/runtime-guard.js", () => ({ assertSupportedRuntime: vi.fn() }));

    const { runCli } = await import("./run-main.js");

    await expect(runCli(["node", "entry.js", "gateway", "restart"])).rejects.toThrow("EXIT_0");
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
