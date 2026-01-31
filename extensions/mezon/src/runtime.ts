/**
 * Mezon runtime reference.
 */
import type { MezonClient } from "mezon-sdk";

import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

// Active client per account
const clients = new Map<string, MezonClient>();

export function setMezonRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getMezonRuntime(): PluginRuntime {
  if (!runtime) throw new Error("Mezon runtime not initialized");
  return runtime;
}

export function setMezonClient(accountId: string, client: MezonClient): void {
  const existing = clients.get(accountId);
  if (existing) existing.closeSocket();
  clients.set(accountId, client);
}

export function getMezonClient(accountId: string): MezonClient | undefined {
  return clients.get(accountId);
}

export function removeMezonClient(accountId: string): void {
  const client = clients.get(accountId);
  if (client) {
    client.closeSocket();
    clients.delete(accountId);
  }
}
