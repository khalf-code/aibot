import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import { __testing } from "./pi-tools.before-tool-call.js";
import {
  clearSessionSecurityState,
  resetVerification,
  setVerified,
} from "./session-security-state.js";

vi.mock("../plugins/hook-runner-global.js");

const mockGetGlobalHookRunner = vi.mocked(getGlobalHookRunner);
const SESSION = "sig-gate-session";
const TURN = "sig-gate-turn";

function makeConfig(enforceVerification: boolean, gatedTools?: string[]) {
  return {
    agents: {
      defaults: {
        sig: { enforceVerification, gatedTools },
      },
    },
  } as never;
}

describe("runBeforeToolCallHook sig ownership enforcement", () => {
  beforeEach(() => {
    clearSessionSecurityState(SESSION);
    mockGetGlobalHookRunner.mockReturnValue({
      hasHooks: vi.fn().mockReturnValue(false),
      runBeforeToolCall: vi.fn(),
    } as never);
  });

  it("blocks gated tools for non-owners when enforcement is enabled", async () => {
    const outcome = await __testing.runBeforeToolCallHook({
      toolName: "exec",
      params: { command: "ls" },
      ctx: {
        sessionKey: SESSION,
        turnId: TURN,
        senderIsOwner: false,
        config: makeConfig(true),
      },
    });
    expect(outcome).toEqual({
      blocked: true,
      reason: "Sensitive tools require an owner-authenticated session.",
    });
  });

  it("respects gatedTools override for non-owner blocking", async () => {
    const outcome = await __testing.runBeforeToolCallHook({
      toolName: "exec",
      params: { command: "ls" },
      ctx: {
        sessionKey: SESSION,
        turnId: TURN,
        senderIsOwner: false,
        config: makeConfig(true, ["read"]),
      },
    });
    expect(outcome).toEqual({
      blocked: false,
      params: { command: "ls" },
    });
  });

  it("passes non-owner calls when enforcement is disabled", async () => {
    const outcome = await __testing.runBeforeToolCallHook({
      toolName: "exec",
      params: { command: "ls" },
      ctx: {
        sessionKey: SESSION,
        turnId: TURN,
        senderIsOwner: false,
        config: makeConfig(false),
      },
    });
    expect(outcome).toEqual({
      blocked: false,
      params: { command: "ls" },
    });
  });

  it("blocks owner calls until verify has run in the current turn", async () => {
    resetVerification(SESSION, TURN);
    const outcome = await __testing.runBeforeToolCallHook({
      toolName: "exec",
      params: { command: "ls" },
      ctx: {
        sessionKey: SESSION,
        turnId: TURN,
        senderIsOwner: true,
        config: makeConfig(true),
      },
    });
    expect(outcome.blocked).toBe(true);
    if (outcome.blocked) {
      expect(outcome.reason).toContain("verify");
    }
  });

  it("passes owner calls after verify has run in the current turn", async () => {
    resetVerification(SESSION, TURN);
    setVerified(SESSION, TURN);
    const outcome = await __testing.runBeforeToolCallHook({
      toolName: "exec",
      params: { command: "ls" },
      ctx: {
        sessionKey: SESSION,
        turnId: TURN,
        senderIsOwner: true,
        config: makeConfig(true),
      },
    });
    expect(outcome).toEqual({
      blocked: false,
      params: { command: "ls" },
    });
  });
});
