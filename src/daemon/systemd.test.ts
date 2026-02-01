import { describe, expect, it } from "vitest";
import { parseSystemdShow, resolveSystemdUserUnitPath } from "./systemd.js";

describe("systemd runtime parsing", () => {
  it("parses active state details", () => {
    const output = [
      "ActiveState=inactive",
      "SubState=dead",
      "MainPID=0",
      "ExecMainStatus=2",
      "ExecMainCode=exited",
    ].join("\n");
    expect(parseSystemdShow(output)).toEqual({
      activeState: "inactive",
      subState: "dead",
      execMainStatus: 2,
      execMainCode: "exited",
    });
  });
});

describe("resolveSystemdUserUnitPath", () => {
  it("uses default service name when ZOIDBERGBOT_PROFILE is default", () => {
    const env = { HOME: "/home/test", ZOIDBERGBOT_PROFILE: "default" };
    expect(resolveSystemdUserUnitPath(env)).toBe(
      "/home/test/.config/systemd/user/zoidbergbot-gateway.service",
    );
  });

  it("uses default service name when ZOIDBERGBOT_PROFILE is unset", () => {
    const env = { HOME: "/home/test" };
    expect(resolveSystemdUserUnitPath(env)).toBe(
      "/home/test/.config/systemd/user/zoidbergbot-gateway.service",
    );
  });

  it("uses profile-specific service name when ZOIDBERGBOT_PROFILE is set to a custom value", () => {
    const env = { HOME: "/home/test", ZOIDBERGBOT_PROFILE: "jbphoenix" };
    expect(resolveSystemdUserUnitPath(env)).toBe(
      "/home/test/.config/systemd/user/zoidbergbot-gateway-jbphoenix.service",
    );
  });

  it("prefers ZOIDBERGBOT_SYSTEMD_UNIT over ZOIDBERGBOT_PROFILE", () => {
    const env = {
      HOME: "/home/test",
      ZOIDBERGBOT_PROFILE: "jbphoenix",
      ZOIDBERGBOT_SYSTEMD_UNIT: "custom-unit",
    };
    expect(resolveSystemdUserUnitPath(env)).toBe(
      "/home/test/.config/systemd/user/custom-unit.service",
    );
  });

  it("handles ZOIDBERGBOT_SYSTEMD_UNIT with .service suffix", () => {
    const env = {
      HOME: "/home/test",
      ZOIDBERGBOT_SYSTEMD_UNIT: "custom-unit.service",
    };
    expect(resolveSystemdUserUnitPath(env)).toBe(
      "/home/test/.config/systemd/user/custom-unit.service",
    );
  });

  it("trims whitespace from ZOIDBERGBOT_SYSTEMD_UNIT", () => {
    const env = {
      HOME: "/home/test",
      ZOIDBERGBOT_SYSTEMD_UNIT: "  custom-unit  ",
    };
    expect(resolveSystemdUserUnitPath(env)).toBe(
      "/home/test/.config/systemd/user/custom-unit.service",
    );
  });

  it("handles case-insensitive 'Default' profile", () => {
    const env = { HOME: "/home/test", ZOIDBERGBOT_PROFILE: "Default" };
    expect(resolveSystemdUserUnitPath(env)).toBe(
      "/home/test/.config/systemd/user/zoidbergbot-gateway.service",
    );
  });

  it("handles case-insensitive 'DEFAULT' profile", () => {
    const env = { HOME: "/home/test", ZOIDBERGBOT_PROFILE: "DEFAULT" };
    expect(resolveSystemdUserUnitPath(env)).toBe(
      "/home/test/.config/systemd/user/zoidbergbot-gateway.service",
    );
  });

  it("trims whitespace from ZOIDBERGBOT_PROFILE", () => {
    const env = { HOME: "/home/test", ZOIDBERGBOT_PROFILE: "  myprofile  " };
    expect(resolveSystemdUserUnitPath(env)).toBe(
      "/home/test/.config/systemd/user/zoidbergbot-gateway-myprofile.service",
    );
  });
});
