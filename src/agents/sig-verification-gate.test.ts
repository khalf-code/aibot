import { describe, it, expect, beforeEach } from "vitest";
import {
  setVerified,
  resetVerification,
  clearSessionSecurityState,
} from "./session-security-state.js";
import { checkVerificationGate, SIG_GATED_TOOLS } from "./sig-verification-gate.js";

const SESSION = "test-session";
const TURN = "turn-1";

function makeConfig(enforceVerification: boolean, gatedTools?: string[]) {
  return {
    agents: {
      defaults: {
        sig: { enforceVerification, gatedTools },
      },
    },
  } as never;
}

describe("sig-verification-gate", () => {
  beforeEach(() => {
    clearSessionSecurityState(SESSION);
  });

  it("passes all tools when enforcement is disabled", () => {
    const config = makeConfig(false);
    for (const tool of SIG_GATED_TOOLS) {
      const result = checkVerificationGate(tool, SESSION, TURN, config);
      expect(result.blocked).toBe(false);
    }
  });

  it("blocks gated tools when unverified and enforcement enabled", () => {
    const config = makeConfig(true);
    resetVerification(SESSION, TURN);
    for (const tool of SIG_GATED_TOOLS) {
      const result = checkVerificationGate(tool, SESSION, TURN, config);
      expect(result.blocked).toBe(true);
      if (result.blocked) {
        expect(result.reason).toContain("verify");
      }
    }
  });

  it("passes gated tools when verified", () => {
    const config = makeConfig(true);
    resetVerification(SESSION, TURN);
    setVerified(SESSION, TURN);
    for (const tool of SIG_GATED_TOOLS) {
      const result = checkVerificationGate(tool, SESSION, TURN, config);
      expect(result.blocked).toBe(false);
    }
  });

  it("always passes non-gated tools", () => {
    const config = makeConfig(true);
    resetVerification(SESSION, TURN);
    const nonGated = ["read", "grep", "find", "ls", "web_search", "web_fetch", "verify"];
    for (const tool of nonGated) {
      const result = checkVerificationGate(tool, SESSION, TURN, config);
      expect(result.blocked).toBe(false);
    }
  });

  it("resets verification on new turn", () => {
    const config = makeConfig(true);
    resetVerification(SESSION, TURN);
    setVerified(SESSION, TURN);

    const newTurn = "turn-2";
    resetVerification(SESSION, newTurn);

    const result = checkVerificationGate("exec", SESSION, newTurn, config);
    expect(result.blocked).toBe(true);
  });

  it("verification from old turn does not carry to new turn", () => {
    const config = makeConfig(true);
    resetVerification(SESSION, TURN);
    setVerified(SESSION, TURN);

    const newTurn = "turn-2";
    // Don't reset — just check with new turnId
    const result = checkVerificationGate("exec", SESSION, newTurn, config);
    expect(result.blocked).toBe(true);
  });

  it("respects custom gatedTools from config", () => {
    const config = makeConfig(true, ["read", "grep"]);
    resetVerification(SESSION, TURN);

    // Custom gated tools should be blocked
    expect(checkVerificationGate("read", SESSION, TURN, config).blocked).toBe(true);
    expect(checkVerificationGate("grep", SESSION, TURN, config).blocked).toBe(true);

    // Default gated tools should pass (not in custom list)
    expect(checkVerificationGate("exec", SESSION, TURN, config).blocked).toBe(false);
  });

  it("passes when config is undefined", () => {
    const result = checkVerificationGate("exec", SESSION, TURN, undefined);
    expect(result.blocked).toBe(false);
  });

  it("blocks when sessionKey is missing", () => {
    const config = makeConfig(true);
    const result = checkVerificationGate("exec", undefined, TURN, config);
    expect(result.blocked).toBe(true);
  });
});
