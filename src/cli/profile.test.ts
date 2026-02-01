import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "zoidbergbot",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "zoidbergbot", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "zoidbergbot", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "zoidbergbot", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "zoidbergbot", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "zoidbergbot", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "zoidbergbot", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (dev first)", () => {
    const res = parseCliProfileArgs([
      "node",
      "zoidbergbot",
      "--dev",
      "--profile",
      "work",
      "status",
    ]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (profile first)", () => {
    const res = parseCliProfileArgs([
      "node",
      "zoidbergbot",
      "--profile",
      "work",
      "--dev",
      "status",
    ]);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join("/home/peter", ".zoidbergbot-dev");
    expect(env.ZOIDBERGBOT_PROFILE).toBe("dev");
    expect(env.ZOIDBERGBOT_STATE_DIR).toBe(expectedStateDir);
    expect(env.ZOIDBERGBOT_CONFIG_PATH).toBe(path.join(expectedStateDir, "zoidbergbot.json"));
    expect(env.ZOIDBERGBOT_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      ZOIDBERGBOT_STATE_DIR: "/custom",
      ZOIDBERGBOT_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.ZOIDBERGBOT_STATE_DIR).toBe("/custom");
    expect(env.ZOIDBERGBOT_GATEWAY_PORT).toBe("19099");
    expect(env.ZOIDBERGBOT_CONFIG_PATH).toBe(path.join("/custom", "zoidbergbot.json"));
  });
});

describe("formatCliCommand", () => {
  it("returns command unchanged when no profile is set", () => {
    expect(formatCliCommand("zoidbergbot doctor --fix", {})).toBe("zoidbergbot doctor --fix");
  });

  it("returns command unchanged when profile is default", () => {
    expect(formatCliCommand("zoidbergbot doctor --fix", { ZOIDBERGBOT_PROFILE: "default" })).toBe(
      "zoidbergbot doctor --fix",
    );
  });

  it("returns command unchanged when profile is Default (case-insensitive)", () => {
    expect(formatCliCommand("zoidbergbot doctor --fix", { ZOIDBERGBOT_PROFILE: "Default" })).toBe(
      "zoidbergbot doctor --fix",
    );
  });

  it("returns command unchanged when profile is invalid", () => {
    expect(
      formatCliCommand("zoidbergbot doctor --fix", { ZOIDBERGBOT_PROFILE: "bad profile" }),
    ).toBe("zoidbergbot doctor --fix");
  });

  it("returns command unchanged when --profile is already present", () => {
    expect(
      formatCliCommand("zoidbergbot --profile work doctor --fix", { ZOIDBERGBOT_PROFILE: "work" }),
    ).toBe("zoidbergbot --profile work doctor --fix");
  });

  it("returns command unchanged when --dev is already present", () => {
    expect(formatCliCommand("zoidbergbot --dev doctor", { ZOIDBERGBOT_PROFILE: "dev" })).toBe(
      "zoidbergbot --dev doctor",
    );
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("zoidbergbot doctor --fix", { ZOIDBERGBOT_PROFILE: "work" })).toBe(
      "zoidbergbot --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(
      formatCliCommand("zoidbergbot doctor --fix", { ZOIDBERGBOT_PROFILE: "  jbopenclaw  " }),
    ).toBe("zoidbergbot --profile jbzoidbergbot doctor --fix");
  });

  it("handles command with no args after openclaw", () => {
    expect(formatCliCommand("zoidbergbot", { ZOIDBERGBOT_PROFILE: "test" })).toBe(
      "zoidbergbot --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm zoidbergbot doctor", { ZOIDBERGBOT_PROFILE: "work" })).toBe(
      "pnpm zoidbergbot --profile work doctor",
    );
  });
});
