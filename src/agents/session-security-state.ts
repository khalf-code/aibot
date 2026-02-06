/**
 * Session-scoped security state for sig verification.
 *
 * Tracks per-session, per-turn verification status so the hook gate
 * can enforce that the `verify` tool was called before sensitive tools.
 */

export type VerificationStatus = "unverified" | "verified" | "failed";

export interface VerificationState {
  status: VerificationStatus;
  verifiedAt?: string;
  turnId?: string;
}

export interface SessionSecurityState {
  sessionId: string;
  verificationState: VerificationState;
}

const sessions = new Map<string, SessionSecurityState>();

/**
 * Get or create session security state.
 */
export function getSessionSecurityState(sessionId: string): SessionSecurityState {
  let state = sessions.get(sessionId);
  if (!state) {
    state = {
      sessionId,
      verificationState: { status: "unverified" },
    };
    sessions.set(sessionId, state);
  }
  return state;
}

/**
 * Clear all security state for a session (e.g., on session end).
 */
export function clearSessionSecurityState(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Mark a session as verified for a specific turn.
 */
export function setVerified(sessionId: string, turnId: string): void {
  const state = getSessionSecurityState(sessionId);
  state.verificationState = {
    status: "verified",
    verifiedAt: new Date().toISOString(),
    turnId,
  };
}

/**
 * Reset verification for a new turn (each user message resets).
 */
export function resetVerification(sessionId: string, turnId: string): void {
  const state = getSessionSecurityState(sessionId);
  state.verificationState = {
    status: "unverified",
    turnId,
  };
}

/**
 * Check if a session is verified for the given turn.
 */
export function isVerified(sessionId: string, turnId: string): boolean {
  const state = sessions.get(sessionId);
  if (!state) {
    return false;
  }
  return state.verificationState.status === "verified" && state.verificationState.turnId === turnId;
}
