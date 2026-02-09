import type { PluginHookMessageSentEvent, PluginHookMessageContext } from "../plugins/types.js";
import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";

export type { PluginHookMessageSentEvent, PluginHookMessageContext };

export function emitMessageSent(
  event: PluginHookMessageSentEvent,
  ctx: PluginHookMessageContext,
): void {
  const runner = getGlobalHookRunner();
  if (!runner?.hasHooks("message_sent")) {
    return;
  }
  void runner.runMessageSent(event, ctx);
}
