import type { GatewayBrowserClient } from "../gateway.ts";
import type { SessionsListResult } from "../types.ts";
import { toNumber } from "../format.ts";

export type SessionsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  sessionsLoading: boolean;
  sessionsResult: SessionsListResult | null;
  sessionsError: string | null;
  sessionsFilterActive: string;
  sessionsFilterLimit: string;
  sessionsIncludeGlobal: boolean;
  sessionsIncludeUnknown: boolean;
  sessionsShowDeleted: boolean;
  sessionsDeletedList: Array<{
    sessionId: string;
    file: string;
    size: number;
    deletedAt: string | null;
    mtime: number;
    label?: string;
    description?: string;
    persistent?: boolean;
  }> | null;
  sessionKey: string;
};

export async function loadSessions(
  state: SessionsState & { requestUpdate?: () => void },
  overrides?: {
    activeMinutes?: number;
    limit?: number;
    includeGlobal?: boolean;
    includeUnknown?: boolean;
  },
) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.sessionsLoading) {
    return;
  }
  state.sessionsLoading = true;
  state.sessionsError = null;
  try {
    const includeGlobal = overrides?.includeGlobal ?? state.sessionsIncludeGlobal;
    const includeUnknown = overrides?.includeUnknown ?? state.sessionsIncludeUnknown;
    const activeMinutes = overrides?.activeMinutes ?? toNumber(state.sessionsFilterActive, 0);
    const limit = overrides?.limit ?? toNumber(state.sessionsFilterLimit, 0);
    const params: Record<string, unknown> = {
      includeGlobal,
      includeUnknown,
    };
    if (activeMinutes > 0) {
      params.activeMinutes = activeMinutes;
    }
    if (limit > 0) {
      params.limit = limit;
    }
    const res = await state.client.request<SessionsListResult | undefined>("sessions.list", params);
    if (res) {
      state.sessionsResult = res;
    }
  } catch (err) {
    state.sessionsError = String(err);
  } finally {
    state.sessionsLoading = false;
    state.requestUpdate?.();
  }
}

export async function patchSession(
  state: SessionsState & { requestUpdate?: () => void },
  key: string,
  patch: {
    label?: string | null;
    thinkingLevel?: string | null;
    verboseLevel?: string | null;
    reasoningLevel?: string | null;
  },
) {
  if (!state.client || !state.connected) {
    return;
  }
  const params: Record<string, unknown> = { key };
  if ("label" in patch) {
    params.label = patch.label;
  }
  if ("thinkingLevel" in patch) {
    params.thinkingLevel = patch.thinkingLevel;
  }
  if ("verboseLevel" in patch) {
    params.verboseLevel = patch.verboseLevel;
  }
  if ("reasoningLevel" in patch) {
    params.reasoningLevel = patch.reasoningLevel;
  }
  try {
    await state.client.request("sessions.patch", params);
    await loadSessions(state);
    state.requestUpdate?.();
  } catch (err) {
    state.sessionsError = String(err);
    state.requestUpdate?.();
  }
}

export async function loadDeletedSessions(state: SessionsState & { requestUpdate?: () => void }) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.sessionsLoading) {
    return;
  }
  state.sessionsLoading = true;
  state.sessionsError = null;
  try {
    const res = await state.client.request<{
      ok: boolean;
      deleted: Array<{
        sessionId: string;
        file: string;
        size: number;
        deletedAt: string | null;
        mtime: number;
        label?: string;
        description?: string;
        persistent?: boolean;
      }>;
    }>("sessions.list.deleted", { limit: 100 });
    if (res && res.ok) {
      state.sessionsDeletedList = res.deleted;
    }
  } catch (err) {
    state.sessionsError = String(err);
  } finally {
    state.sessionsLoading = false;
    state.requestUpdate?.();
  }
}

export async function restoreSession(
  state: SessionsState & { requestUpdate?: () => void },
  sessionId: string,
) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.sessionsLoading) {
    return;
  }

  const confirmed = window.confirm(
    `Restore session "${sessionId}"?\n\nThis will recreate the session entry and restore its transcript.`,
  );
  if (!confirmed) {
    return;
  }

  state.sessionsLoading = true;
  state.sessionsError = null;
  try {
    await state.client.request("sessions.restore", { sessionId });

    // Refresh both lists after restore
    await Promise.all([
      loadSessions(state),
      state.sessionsShowDeleted ? loadDeletedSessions(state) : Promise.resolve(),
    ]);

    // Force UI update
    state.requestUpdate?.();
  } catch (err) {
    state.sessionsError = String(err);
  } finally {
    state.sessionsLoading = false;
    // Force UI update on error too
    state.requestUpdate?.();
  }
}

export async function deleteSession(
  state: SessionsState & { requestUpdate?: () => void },
  key: string,
) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.sessionsLoading) {
    return;
  }

  // Prevent deleting main session
  if (key === "agent:main:main") {
    state.sessionsError = "Cannot delete the main session.";
    return;
  }

  // Check if deleting the currently active session
  const isActiveSession = key === state.sessionKey;
  const confirmMessage = isActiveSession
    ? `⚠️ You are currently using this session.\n\nDeleting it will return you to the main session.\n\nDelete session "${key}"?`
    : `Delete session "${key}"?\n\nDeletes the session entry and archives its transcript.`;

  const confirmed = window.confirm(confirmMessage);
  if (!confirmed) {
    return;
  }

  state.sessionsLoading = true;
  state.sessionsError = null;
  try {
    await state.client.request("sessions.delete", { key, deleteTranscript: true });

    // Redirect to main session if we deleted the active one
    if (isActiveSession) {
      const url = new URL(window.location.href);
      url.searchParams.delete("session");
      url.pathname = "/";
      window.location.href = url.toString();
      return;
    }

    // Refresh both lists after deletion
    await Promise.all([
      loadSessions(state),
      state.sessionsShowDeleted ? loadDeletedSessions(state) : Promise.resolve(),
    ]);

    // Force UI update
    state.requestUpdate?.();
  } catch (err) {
    state.sessionsError = String(err);
  } finally {
    state.sessionsLoading = false;
    // Force UI update on error too
    state.requestUpdate?.();
  }
}
