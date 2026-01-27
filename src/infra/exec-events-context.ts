import { AsyncLocalStorage } from "node:async_hooks";
import type { ExecEventContext } from "./exec-events.js";

const execEventContextStorage = new AsyncLocalStorage<ExecEventContext>();

function hasContextValues(context: ExecEventContext | undefined): boolean {
  if (!context) return false;
  return Boolean(context.runId || context.toolCallId || context.sessionKey);
}

export function runWithExecEventContext<T>(context: ExecEventContext, fn: () => T): T {
  const existing = execEventContextStorage.getStore();
  const shouldBypass = !hasContextValues(context) && !hasContextValues(existing);
  if (shouldBypass) return fn();

  const merged = existing ? { ...existing, ...context } : { ...context };
  return execEventContextStorage.run(merged, fn);
}

export function getExecEventContext(): ExecEventContext | undefined {
  const store = execEventContextStorage.getStore();
  return store ? { ...store } : undefined;
}
