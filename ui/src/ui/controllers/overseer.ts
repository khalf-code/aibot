import type { GatewayBrowserClient } from "../gateway";
import type {
  OverseerGoalStatusResult,
  OverseerStatusResult,
} from "../types/overseer";

export type OverseerState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  overseerLoading: boolean;
  overseerError: string | null;
  overseerStatus: OverseerStatusResult | null;
  overseerGoalLoading: boolean;
  overseerGoalError: string | null;
  overseerSelectedGoalId: string | null;
  overseerGoal: OverseerGoalStatusResult | null;
  // Goal action states
  overseerGoalActionPending: boolean;
  overseerGoalActionError: string | null;
  // Create goal modal state
  overseerCreateGoalOpen: boolean;
  overseerCreateGoalForm: {
    title: string;
    problemStatement: string;
    successCriteria: string[];
    constraints: string[];
    priority: "low" | "normal" | "high" | "urgent";
    generatePlan: boolean;
  };
};

export async function loadOverseerStatus(
  state: OverseerState,
  opts?: { quiet?: boolean },
) {
  if (!state.client || !state.connected) return;
  if (state.overseerLoading) return;
  state.overseerLoading = true;
  if (!opts?.quiet) state.overseerError = null;
  try {
    const res = (await state.client.request("overseer.status", {
      includeGoals: true,
      includeAssignments: true,
    })) as OverseerStatusResult | undefined;
    if (res) state.overseerStatus = res;
  } catch (err) {
    if (!opts?.quiet) state.overseerError = String(err);
  } finally {
    state.overseerLoading = false;
  }
}

export async function loadOverseerGoal(
  state: OverseerState,
  goalId: string,
  opts?: { quiet?: boolean },
) {
  if (!state.client || !state.connected) return;
  if (state.overseerGoalLoading) return;
  state.overseerGoalLoading = true;
  if (!opts?.quiet) state.overseerGoalError = null;
  try {
    const res = (await state.client.request("overseer.goal.status", { goalId })) as
      | OverseerGoalStatusResult
      | undefined;
    if (res) state.overseerGoal = res;
  } catch (err) {
    if (!opts?.quiet) state.overseerGoalError = String(err);
  } finally {
    state.overseerGoalLoading = false;
  }
}

export async function refreshOverseer(
  state: OverseerState,
  opts?: { quiet?: boolean },
) {
  await loadOverseerStatus(state, opts);
  const goals = state.overseerStatus?.goals ?? [];
  if (goals.length === 0) {
    state.overseerSelectedGoalId = null;
    state.overseerGoal = null;
    return;
  }
  const selected =
    state.overseerSelectedGoalId && goals.some((goal) => goal.goalId === state.overseerSelectedGoalId)
      ? state.overseerSelectedGoalId
      : goals[0]?.goalId ?? null;
  state.overseerSelectedGoalId = selected;
  if (selected) {
    await loadOverseerGoal(state, selected, { quiet: true });
  } else {
    state.overseerGoal = null;
  }
}

export async function tickOverseer(state: OverseerState, reason?: string) {
  if (!state.client || !state.connected) return;
  try {
    await state.client.request("overseer.tick", { reason });
  } catch (err) {
    state.overseerError = String(err);
  }
}

export async function pauseOverseerGoal(state: OverseerState, goalId: string) {
  if (!state.client || !state.connected) return;
  if (state.overseerGoalActionPending) return;
  state.overseerGoalActionPending = true;
  state.overseerGoalActionError = null;
  try {
    await state.client.request("overseer.goal.pause", { goalId });
    await refreshOverseer(state, { quiet: true });
  } catch (err) {
    state.overseerGoalActionError = String(err);
  } finally {
    state.overseerGoalActionPending = false;
  }
}

export async function resumeOverseerGoal(state: OverseerState, goalId: string) {
  if (!state.client || !state.connected) return;
  if (state.overseerGoalActionPending) return;
  state.overseerGoalActionPending = true;
  state.overseerGoalActionError = null;
  try {
    await state.client.request("overseer.goal.resume", { goalId });
    await refreshOverseer(state, { quiet: true });
  } catch (err) {
    state.overseerGoalActionError = String(err);
  } finally {
    state.overseerGoalActionPending = false;
  }
}

export async function createOverseerGoal(
  state: OverseerState,
  params: {
    title: string;
    problemStatement: string;
    successCriteria?: string[];
    constraints?: string[];
    priority?: "low" | "normal" | "high" | "urgent";
    generatePlan?: boolean;
  },
) {
  if (!state.client || !state.connected) return;
  if (state.overseerGoalActionPending) return;
  state.overseerGoalActionPending = true;
  state.overseerGoalActionError = null;
  try {
    const result = (await state.client.request("overseer.goal.create", {
      title: params.title,
      problemStatement: params.problemStatement,
      successCriteria: params.successCriteria ?? [],
      constraints: params.constraints ?? [],
      priority: params.priority ?? "normal",
      generatePlan: params.generatePlan ?? true,
    })) as { goalId: string; planGenerated: boolean } | undefined;
    if (result?.goalId) {
      state.overseerSelectedGoalId = result.goalId;
    }
    state.overseerCreateGoalOpen = false;
    await refreshOverseer(state, { quiet: true });
    return result;
  } catch (err) {
    state.overseerGoalActionError = String(err);
  } finally {
    state.overseerGoalActionPending = false;
  }
}

export async function updateOverseerWorkNode(
  state: OverseerState,
  params: {
    goalId: string;
    workNodeId: string;
    status?: "done" | "blocked";
    blockedReason?: string;
    summary?: string;
  },
) {
  if (!state.client || !state.connected) return;
  if (state.overseerGoalActionPending) return;
  state.overseerGoalActionPending = true;
  state.overseerGoalActionError = null;
  try {
    await state.client.request("overseer.work.update", params);
    await refreshOverseer(state, { quiet: true });
  } catch (err) {
    state.overseerGoalActionError = String(err);
  } finally {
    state.overseerGoalActionPending = false;
  }
}

export async function retryOverseerAssignment(
  state: OverseerState,
  params: { goalId: string; workNodeId: string },
) {
  if (!state.client || !state.connected) return;
  if (state.overseerGoalActionPending) return;
  state.overseerGoalActionPending = true;
  state.overseerGoalActionError = null;
  try {
    // Reset the work node to queued status to trigger retry
    await state.client.request("overseer.work.update", {
      goalId: params.goalId,
      workNodeId: params.workNodeId,
      status: "queued",
    });
    // Trigger a tick to dispatch the retry
    await state.client.request("overseer.tick", { reason: "manual retry" });
    await refreshOverseer(state, { quiet: true });
  } catch (err) {
    state.overseerGoalActionError = String(err);
  } finally {
    state.overseerGoalActionPending = false;
  }
}

export function initOverseerState(): Pick<
  OverseerState,
  | "overseerGoalActionPending"
  | "overseerGoalActionError"
  | "overseerCreateGoalOpen"
  | "overseerCreateGoalForm"
> {
  return {
    overseerGoalActionPending: false,
    overseerGoalActionError: null,
    overseerCreateGoalOpen: false,
    overseerCreateGoalForm: {
      title: "",
      problemStatement: "",
      successCriteria: [],
      constraints: [],
      priority: "normal",
      generatePlan: true,
    },
  };
}
