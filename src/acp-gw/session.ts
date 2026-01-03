/**
 * ACP-GW Session Manager
 *
 * Manages local session metadata. Actual conversation state lives in Gateway.
 */

import type { AcpGwSession } from "./types.js";

/**
 * In-memory session store.
 */
const sessions = new Map<string, AcpGwSession>();

/**
 * Reverse lookup: runId -> sessionId
 */
const runIdToSessionId = new Map<string, string>();

/**
 * Create a new session with a unique ID.
 */
export function createSession(cwd: string): AcpGwSession {
  const sessionId = crypto.randomUUID();
  const session: AcpGwSession = {
    sessionId,
    sessionKey: `acp:${sessionId}`,  // Use acp: prefix for session isolation
    cwd,
    createdAt: Date.now(),
    abortController: null,
    activeRunId: null,
  };
  sessions.set(sessionId, session);
  return session;
}

/**
 * Get a session by ID.
 */
export function getSession(sessionId: string): AcpGwSession | undefined {
  return sessions.get(sessionId);
}

/**
 * Delete a session.
 */
export function deleteSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (session) {
    session.abortController?.abort();
    sessions.delete(sessionId);
    return true;
  }
  return false;
}

/**
 * Set the active run for a session.
 */
export function setActiveRun(
  sessionId: string,
  runId: string,
  abortController: AbortController,
): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.activeRunId = runId;
    session.abortController = abortController;
    runIdToSessionId.set(runId, sessionId);
  }
}

/**
 * Find session by runId.
 */
export function getSessionByRunId(runId: string): AcpGwSession | undefined {
  const sessionId = runIdToSessionId.get(runId);
  return sessionId ? sessions.get(sessionId) : undefined;
}

/**
 * Clear the active run for a session.
 */
export function clearActiveRun(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    if (session.activeRunId) {
      runIdToSessionId.delete(session.activeRunId);
    }
    session.activeRunId = null;
    session.abortController = null;
  }
}

/**
 * Cancel the active run for a session.
 */
export function cancelActiveRun(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (session?.abortController) {
    session.abortController.abort();
    session.abortController = null;
    session.activeRunId = null;
    return true;
  }
  return false;
}
