import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveGatewayStateDir } from "./paths.js";

describe("resolveGatewayStateDir", () => {
  it("uses the default state dir when no overrides are set", () => {
    const env = { HOME: "/Users/test" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".zoidbergbot"));
  });

  it("appends the profile suffix when set", () => {
    const env = { HOME: "/Users/test", ZOIDBERGBOT_PROFILE: "rescue" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".zoidbergbot-rescue"));
  });

  it("treats default profiles as the base state dir", () => {
    const env = { HOME: "/Users/test", ZOIDBERGBOT_PROFILE: "Default" };
    expect(resolveGatewayStateDir(env)).toBe(path.join("/Users/test", ".zoidbergbot"));
  });

  it("uses ZOIDBERGBOT_STATE_DIR when provided", () => {
    const env = { HOME: "/Users/test", ZOIDBERGBOT_STATE_DIR: "/var/lib/zoidbergbot" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/var/lib/zoidbergbot"));
  });

  it("expands ~ in ZOIDBERGBOT_STATE_DIR", () => {
    const env = { HOME: "/Users/test", ZOIDBERGBOT_STATE_DIR: "~/zoidbergbot-state" };
    expect(resolveGatewayStateDir(env)).toBe(path.resolve("/Users/test/zoidbergbot-state"));
  });

  it("preserves Windows absolute paths without HOME", () => {
    const env = { ZOIDBERGBOT_STATE_DIR: "C:\\State\\openclaw" };
    expect(resolveGatewayStateDir(env)).toBe("C:\\State\\openclaw");
  });
});
