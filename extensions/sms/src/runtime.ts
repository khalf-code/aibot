/**
 * SMS Runtime State Management
 */

import type { SMSRuntimeState } from "./types.js";

// Runtime reference from Clawdbot plugin API
let smsRuntime: unknown = null;

// Per-account runtime state
const accountStates = new Map<string, SMSRuntimeState>();

export function setSMSRuntime(runtime: unknown): void {
  smsRuntime = runtime;
}

export function getSMSRuntime(): unknown {
  return smsRuntime;
}

export function setAccountState(accountId: string, state: SMSRuntimeState): void {
  accountStates.set(accountId, state);
}

export function getAccountState(accountId: string): SMSRuntimeState | undefined {
  return accountStates.get(accountId);
}

export function removeAccountState(accountId: string): void {
  accountStates.delete(accountId);
}

export function getAllAccountStates(): Map<string, SMSRuntimeState> {
  return accountStates;
}
