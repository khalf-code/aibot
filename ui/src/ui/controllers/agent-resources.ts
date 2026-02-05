import type { GatewayBrowserClient } from "../gateway.ts";

export type AgentResourceEntry = {
  agentId: string;
  isDefault: boolean;
  sessions: { total: number; active: number };
  tokens: { input: number; output: number; total: number };
  cost: { total: number; days: number };
  heartbeat: { enabled: boolean; everyMs: number | null; every: string };
  workspace: { files: number; totalBytes: number };
};

export type AgentResourcesResult = {
  agents: AgentResourceEntry[];
};

export type AgentResourcesState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  agentResourcesLoading: boolean;
  agentResourcesError: string | null;
  agentResourcesData: AgentResourcesResult | null;
};

export async function loadAgentResources(state: AgentResourcesState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.agentResourcesLoading) {
    return;
  }
  state.agentResourcesLoading = true;
  state.agentResourcesError = null;
  try {
    const res = await state.client.request<AgentResourcesResult>("agents.resources", {});
    if (res) {
      state.agentResourcesData = res;
    }
  } catch (err) {
    state.agentResourcesError = String(err);
  } finally {
    state.agentResourcesLoading = false;
  }
}
