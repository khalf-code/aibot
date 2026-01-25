import type { SessionManager } from "@mariozechner/pi-coding-agent";

import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import {
  installSessionToolResultGuard,
  type OverflowContext,
  type OverflowHandlerResult,
} from "./session-tool-result-guard.js";

export type GuardedSessionManager = SessionManager & {
  /** Flush any synthetic tool results for pending tool calls. Idempotent. */
  flushPendingToolResults?: () => void;
  /** Update overflow detection settings at runtime. */
  setOverflowSettings?: (settings: {
    contextWindowTokens?: number;
    reserveTokens?: number;
  }) => void;
};

export type GuardSessionManagerOptions = {
  agentId?: string;
  sessionKey?: string;
  allowSyntheticToolResults?: boolean;
  /**
   * Context window size in tokens for overflow detection.
   * If not provided, overflow detection is disabled.
   */
  contextWindowTokens?: number;
  /**
   * Reserve tokens to keep below the context window limit.
   * Defaults to 0.
   */
  reserveTokens?: number;
  /**
   * Callback invoked when appending a message would cause context overflow.
   * This is called BEFORE the message is appended.
   */
  onOverflowDetected?: (context: OverflowContext) => OverflowHandlerResult | void;
  /**
   * Async version of onOverflowDetected. Takes precedence over the sync version.
   */
  onOverflowDetectedAsync?: (context: OverflowContext) => Promise<OverflowHandlerResult | void>;
};

/**
 * Apply the tool-result guard to a SessionManager exactly once and expose
 * a flush method on the instance for easy teardown handling.
 */
export function guardSessionManager(
  sessionManager: SessionManager,
  opts?: GuardSessionManagerOptions,
): GuardedSessionManager {
  if (typeof (sessionManager as GuardedSessionManager).flushPendingToolResults === "function") {
    return sessionManager as GuardedSessionManager;
  }

  const hookRunner = getGlobalHookRunner();
  const transform = hookRunner?.hasHooks("tool_result_persist")
    ? (message: any, meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean }) => {
        const out = hookRunner.runToolResultPersist(
          {
            toolName: meta.toolName,
            toolCallId: meta.toolCallId,
            message,
            isSynthetic: meta.isSynthetic,
          },
          {
            agentId: opts?.agentId,
            sessionKey: opts?.sessionKey,
            toolName: meta.toolName,
            toolCallId: meta.toolCallId,
          },
        );
        return out?.message ?? message;
      }
    : undefined;

  const guard = installSessionToolResultGuard(sessionManager, {
    transformToolResultForPersistence: transform,
    allowSyntheticToolResults: opts?.allowSyntheticToolResults,
    contextWindowTokens: opts?.contextWindowTokens,
    reserveTokens: opts?.reserveTokens,
    onOverflowDetected: opts?.onOverflowDetected,
    onOverflowDetectedAsync: opts?.onOverflowDetectedAsync,
  });
  (sessionManager as GuardedSessionManager).flushPendingToolResults = guard.flushPendingToolResults;
  (sessionManager as GuardedSessionManager).setOverflowSettings = guard.setOverflowSettings;
  return sessionManager as GuardedSessionManager;
}
