import type { PluginRuntime } from "clawdbot/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setAgentMailRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getAgentMailRuntime(): PluginRuntime {
  if (!runtime) throw new Error("AgentMail runtime not initialized");
  return runtime;
}
