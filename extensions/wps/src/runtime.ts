import type { PluginRuntime } from "clawdbot/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setWpsRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getWpsRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Wps runtime not initialized");
  }
  return runtime;
}