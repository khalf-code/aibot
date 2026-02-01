import { abortEmbeddedPiRun } from "../../agents/pi-embedded.js";
import { resolveSessionAgentId } from "../../agents/agent-scope.js";
import type { SessionEntry } from "../../config/sessions.js";
import { updateSessionStore } from "../../config/sessions.js";
import { forgetSession } from "../../config/sessions/forget.js";
import { logVerbose } from "../../globals.js";
import { createInternalHookEvent, triggerInternalHook } from "../../hooks/internal-hooks.js";
import { scheduleGatewaySigusr1Restart, triggerMoltbotRestart } from "../../infra/restart.js";
import { parseActivationCommand } from "../group-activation.js";
import { parseSendPolicyCommand } from "../send-policy.js";
import { normalizeUsageDisplay, resolveResponseUsageMode } from "../thinking.js";
import { loadCostUsageSummary, loadSessionCostSummary } from "../../infra/session-cost-usage.js";
import { formatTokenCount, formatUsd } from "../../utils/usage-format.js";
import {
  formatAbortReplyText,
  isAbortTrigger,
  setAbortMemory,
  stopSubagentsForRequester,
} from "./abort.js";
import type { CommandHandler } from "./commands-types.js";
import { clearSessionQueues } from "./queue.js";

function resolveSessionEntryForKey(
  store: Record<string, SessionEntry> | undefined,
  sessionKey: string | undefined,
) {
  if (!store || !sessionKey) return {};
  const direct = store[sessionKey];
  if (direct) return { entry: direct, key: sessionKey };
  return {};
}

function resolveAbortTarget(params: {
  ctx: { CommandTargetSessionKey?: string | null };
  sessionKey?: string;
  sessionEntry?: SessionEntry;
  sessionStore?: Record<string, SessionEntry>;
}) {
  const targetSessionKey = params.ctx.CommandTargetSessionKey?.trim() || params.sessionKey;
  const { entry, key } = resolveSessionEntryForKey(params.sessionStore, targetSessionKey);
  if (entry && key) return { entry, key, sessionId: entry.sessionId };
  if (params.sessionEntry && params.sessionKey) {
    return {
      entry: params.sessionEntry,
      key: params.sessionKey,
      sessionId: params.sessionEntry.sessionId,
    };
  }
  return { entry: undefined, key: targetSessionKey, sessionId: undefined };
}

export const handleActivationCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) return null;
  const activationCommand = parseActivationCommand(params.command.commandBodyNormalized);
  if (!activationCommand.hasCommand) return null;
  if (!params.isGroup) {
    return {
      shouldContinue: false,
      reply: { text: "⚙️ Group activation only applies to group chats." },
    };
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /activation from unauthorized sender in group: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  if (!activationCommand.mode) {
    return {
      shouldContinue: false,
      reply: { text: "⚙️ Usage: /activation mention|always" },
    };
  }
  if (params.sessionEntry && params.sessionStore && params.sessionKey) {
    params.sessionEntry.groupActivation = activationCommand.mode;
    params.sessionEntry.groupActivationNeedsSystemIntro = true;
    params.sessionEntry.updatedAt = Date.now();
    params.sessionStore[params.sessionKey] = params.sessionEntry;
    if (params.storePath) {
      await updateSessionStore(params.storePath, (store) => {
        store[params.sessionKey] = params.sessionEntry as SessionEntry;
      });
    }
  }
  return {
    shouldContinue: false,
    reply: {
      text: `⚙️ Group activation set to ${activationCommand.mode}.`,
    },
  };
};

export const handleSendPolicyCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) return null;
  const sendPolicyCommand = parseSendPolicyCommand(params.command.commandBodyNormalized);
  if (!sendPolicyCommand.hasCommand) return null;
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /send from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  if (!sendPolicyCommand.mode) {
    return {
      shouldContinue: false,
      reply: { text: "⚙️ Usage: /send on|off|inherit" },
    };
  }
  if (params.sessionEntry && params.sessionStore && params.sessionKey) {
    if (sendPolicyCommand.mode === "inherit") {
      delete params.sessionEntry.sendPolicy;
    } else {
      params.sessionEntry.sendPolicy = sendPolicyCommand.mode;
    }
    params.sessionEntry.updatedAt = Date.now();
    params.sessionStore[params.sessionKey] = params.sessionEntry;
    if (params.storePath) {
      await updateSessionStore(params.storePath, (store) => {
        store[params.sessionKey] = params.sessionEntry as SessionEntry;
      });
    }
  }
  const label =
    sendPolicyCommand.mode === "inherit"
      ? "inherit"
      : sendPolicyCommand.mode === "allow"
        ? "on"
        : "off";
  return {
    shouldContinue: false,
    reply: { text: `⚙️ Send policy set to ${label}.` },
  };
};

export const handleUsageCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) return null;
  const normalized = params.command.commandBodyNormalized;
  if (normalized !== "/usage" && !normalized.startsWith("/usage ")) return null;
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /usage from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  const rawArgs = normalized === "/usage" ? "" : normalized.slice("/usage".length).trim();
  const requested = rawArgs ? normalizeUsageDisplay(rawArgs) : undefined;
  if (rawArgs.toLowerCase().startsWith("cost")) {
    const sessionSummary = await loadSessionCostSummary({
      sessionId: params.sessionEntry?.sessionId,
      sessionEntry: params.sessionEntry,
      sessionFile: params.sessionEntry?.sessionFile,
      config: params.cfg,
    });
    const summary = await loadCostUsageSummary({ days: 30, config: params.cfg });

    const sessionCost = formatUsd(sessionSummary?.totalCost);
    const sessionTokens = sessionSummary?.totalTokens
      ? formatTokenCount(sessionSummary.totalTokens)
      : undefined;
    const sessionMissing = sessionSummary?.missingCostEntries ?? 0;
    const sessionSuffix = sessionMissing > 0 ? " (partial)" : "";
    const sessionLine =
      sessionCost || sessionTokens
        ? `Session ${sessionCost ?? "n/a"}${sessionSuffix}${sessionTokens ? ` · ${sessionTokens} tokens` : ""}`
        : "Session n/a";

    const todayKey = new Date().toLocaleDateString("en-CA");
    const todayEntry = summary.daily.find((entry) => entry.date === todayKey);
    const todayCost = formatUsd(todayEntry?.totalCost);
    const todayMissing = todayEntry?.missingCostEntries ?? 0;
    const todaySuffix = todayMissing > 0 ? " (partial)" : "";
    const todayLine = `Today ${todayCost ?? "n/a"}${todaySuffix}`;

    const last30Cost = formatUsd(summary.totals.totalCost);
    const last30Missing = summary.totals.missingCostEntries;
    const last30Suffix = last30Missing > 0 ? " (partial)" : "";
    const last30Line = `Last 30d ${last30Cost ?? "n/a"}${last30Suffix}`;

    return {
      shouldContinue: false,
      reply: { text: `💸 Usage cost\n${sessionLine}\n${todayLine}\n${last30Line}` },
    };
  }

  if (rawArgs && !requested) {
    return {
      shouldContinue: false,
      reply: { text: "⚙️ Usage: /usage off|tokens|full|cost" },
    };
  }

  const currentRaw =
    params.sessionEntry?.responseUsage ??
    (params.sessionKey ? params.sessionStore?.[params.sessionKey]?.responseUsage : undefined);
  const current = resolveResponseUsageMode(currentRaw);
  const next = requested ?? (current === "off" ? "tokens" : current === "tokens" ? "full" : "off");

  if (params.sessionEntry && params.sessionStore && params.sessionKey) {
    if (next === "off") delete params.sessionEntry.responseUsage;
    else params.sessionEntry.responseUsage = next;
    params.sessionEntry.updatedAt = Date.now();
    params.sessionStore[params.sessionKey] = params.sessionEntry;
    if (params.storePath) {
      await updateSessionStore(params.storePath, (store) => {
        store[params.sessionKey] = params.sessionEntry as SessionEntry;
      });
    }
  }

  return {
    shouldContinue: false,
    reply: {
      text: `⚙️ Usage footer: ${next}.`,
    },
  };
};

export const handleRestartCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) return null;
  if (params.command.commandBodyNormalized !== "/restart") return null;
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /restart from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  if (params.cfg.commands?.restart !== true) {
    return {
      shouldContinue: false,
      reply: {
        text: "⚠️ /restart is disabled. Set commands.restart=true to enable.",
      },
    };
  }
  const hasSigusr1Listener = process.listenerCount("SIGUSR1") > 0;
  if (hasSigusr1Listener) {
    scheduleGatewaySigusr1Restart({ reason: "/restart" });
    return {
      shouldContinue: false,
      reply: {
        text: "⚙️ Restarting moltbot in-process (SIGUSR1); back in a few seconds.",
      },
    };
  }
  const restartMethod = triggerMoltbotRestart();
  if (!restartMethod.ok) {
    const detail = restartMethod.detail ? ` Details: ${restartMethod.detail}` : "";
    return {
      shouldContinue: false,
      reply: {
        text: `⚠️ Restart failed (${restartMethod.method}).${detail}`,
      },
    };
  }
  return {
    shouldContinue: false,
    reply: {
      text: `⚙️ Restarting moltbot via ${restartMethod.method}; give me a few seconds to come back online.`,
    },
  };
};

export const handleStopCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) return null;
  if (params.command.commandBodyNormalized !== "/stop") return null;
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /stop from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }
  const abortTarget = resolveAbortTarget({
    ctx: params.ctx,
    sessionKey: params.sessionKey,
    sessionEntry: params.sessionEntry,
    sessionStore: params.sessionStore,
  });
  if (abortTarget.sessionId) {
    abortEmbeddedPiRun(abortTarget.sessionId);
  }
  const cleared = clearSessionQueues([abortTarget.key, abortTarget.sessionId]);
  if (cleared.followupCleared > 0 || cleared.laneCleared > 0) {
    logVerbose(
      `stop: cleared followups=${cleared.followupCleared} lane=${cleared.laneCleared} keys=${cleared.keys.join(",")}`,
    );
  }
  if (abortTarget.entry && params.sessionStore && abortTarget.key) {
    abortTarget.entry.abortedLastRun = true;
    abortTarget.entry.updatedAt = Date.now();
    params.sessionStore[abortTarget.key] = abortTarget.entry;
    if (params.storePath) {
      await updateSessionStore(params.storePath, (store) => {
        store[abortTarget.key] = abortTarget.entry as SessionEntry;
      });
    }
  } else if (params.command.abortKey) {
    setAbortMemory(params.command.abortKey, true);
  }

  // Trigger internal hook for stop command
  const hookEvent = createInternalHookEvent(
    "command",
    "stop",
    abortTarget.key ?? params.sessionKey ?? "",
    {
      sessionEntry: abortTarget.entry ?? params.sessionEntry,
      sessionId: abortTarget.sessionId,
      commandSource: params.command.surface,
      senderId: params.command.senderId,
    },
  );
  await triggerInternalHook(hookEvent);

  const { stopped } = stopSubagentsForRequester({
    cfg: params.cfg,
    requesterSessionKey: abortTarget.key ?? params.sessionKey,
  });

  return { shouldContinue: false, reply: { text: formatAbortReplyText(stopped) } };
};

export const handleAbortTrigger: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) return null;
  if (!isAbortTrigger(params.command.rawBodyNormalized)) return null;
  const abortTarget = resolveAbortTarget({
    ctx: params.ctx,
    sessionKey: params.sessionKey,
    sessionEntry: params.sessionEntry,
    sessionStore: params.sessionStore,
  });
  if (abortTarget.sessionId) {
    abortEmbeddedPiRun(abortTarget.sessionId);
  }
  if (abortTarget.entry && params.sessionStore && abortTarget.key) {
    abortTarget.entry.abortedLastRun = true;
    abortTarget.entry.updatedAt = Date.now();
    params.sessionStore[abortTarget.key] = abortTarget.entry;
    if (params.storePath) {
      await updateSessionStore(params.storePath, (store) => {
        store[abortTarget.key] = abortTarget.entry as SessionEntry;
      });
    }
  } else if (params.command.abortKey) {
    setAbortMemory(params.command.abortKey, true);
  }
  return { shouldContinue: false, reply: { text: "⚙️ Agent was aborted." } };
};

/**
 * Handle /forget command - completely delete the current session from all storage.
 */
export const handleForgetCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) return null;
  if (params.command.commandBodyNormalized !== "/forget") return null;
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /forget from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  const { sessionKey, sessionEntry, sessionStore, storePath, cfg } = params;
  if (!sessionKey || !sessionEntry || !storePath) {
    return {
      shouldContinue: false,
      reply: { text: "⚠️ No active session to forget." },
    };
  }

  // 1. Abort any running agent
  if (sessionEntry.sessionId) {
    abortEmbeddedPiRun(sessionEntry.sessionId);
  }
  clearSessionQueues([sessionKey, sessionEntry.sessionId]);

  // 2. Resolve agent ID for memory deletion
  const agentId = resolveSessionAgentId({ sessionKey, config: cfg });

  // 3. Forget the session (delete from all storage)
  const result = await forgetSession({
    agentId,
    sessionKey,
    sessionEntry,
    storePath,
    createCheckpointBeforeDelete: true,
  });

  // 4. Clear from in-memory store
  if (sessionStore) {
    delete sessionStore[sessionKey];
  }

  // 5. Trigger internal hook
  const hookEvent = createInternalHookEvent("command", "forget", sessionKey, {
    sessionEntry,
    sessionId: sessionEntry.sessionId,
    commandSource: params.command.surface,
    senderId: params.command.senderId,
    forgetResult: result,
  });
  await triggerInternalHook(hookEvent);

  // 6. Build response
  if (result.success) {
    const checkpointNote = result.checkpointId
      ? `\nCheckpoint: ${result.checkpointId} (recoverable via CLI)`
      : "";
    return {
      shouldContinue: false,
      reply: {
        text: `🗑️ Session deleted from local storage.${checkpointNote}\n\nNote: Messages still exist in Telegram and may exist in LLM provider logs.`,
      },
    };
  } else {
    return {
      shouldContinue: false,
      reply: {
        text: `⚠️ Failed to completely delete session.\nErrors: ${result.errors.join(", ")}`,
      },
    };
  }
};

/**
 * Handle /private command - toggle ephemeral mode for the session.
 */
export const handlePrivateCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) return null;
  const normalized = params.command.commandBodyNormalized;
  if (normalized !== "/private" && !normalized.startsWith("/private ")) return null;
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /private from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  const { sessionEntry, sessionStore, sessionKey, storePath } = params;
  if (!sessionEntry || !sessionStore || !sessionKey) {
    return {
      shouldContinue: false,
      reply: { text: "⚠️ No active session." },
    };
  }

  // Parse argument: /private, /private on, /private off
  const arg =
    normalized === "/private" ? "" : normalized.slice("/private".length).trim().toLowerCase();

  let newState: boolean;
  if (arg === "on" || arg === "true" || arg === "1") {
    newState = true;
  } else if (arg === "off" || arg === "false" || arg === "0") {
    newState = false;
  } else if (arg === "") {
    // Toggle
    newState = !sessionEntry.ephemeral;
  } else {
    return {
      shouldContinue: false,
      reply: { text: "⚙️ Usage: /private [on|off]" },
    };
  }

  // Update session entry
  sessionEntry.ephemeral = newState;
  if (newState) {
    // Also exclude from memory when ephemeral
    sessionEntry.excludeFromMemory = true;
  }
  sessionEntry.updatedAt = Date.now();
  sessionStore[sessionKey] = sessionEntry;

  if (storePath) {
    await updateSessionStore(storePath, (store) => {
      store[sessionKey] = sessionEntry;
    });
  }

  if (newState) {
    return {
      shouldContinue: false,
      reply: {
        text: "🔒 Private mode ON. This conversation won't be saved locally.\n⚠️ If I restart, I'll lose all context from this session.",
      },
    };
  } else {
    return {
      shouldContinue: false,
      reply: { text: "🔓 Private mode OFF. Conversation will be saved normally." },
    };
  }
};

/**
 * Handle /dont-remember command - exclude session from memory indexing.
 */
export const handleDontRememberCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) return null;
  const normalized = params.command.commandBodyNormalized;
  if (normalized !== "/dont-remember" && normalized !== "/dontremember") return null;
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /dont-remember from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  const { sessionEntry, sessionStore, sessionKey, storePath } = params;
  if (!sessionEntry || !sessionStore || !sessionKey) {
    return {
      shouldContinue: false,
      reply: { text: "⚠️ No active session." },
    };
  }

  // Mark session as excluded from memory
  sessionEntry.excludeFromMemory = true;
  sessionEntry.updatedAt = Date.now();
  sessionStore[sessionKey] = sessionEntry;

  if (storePath) {
    await updateSessionStore(storePath, (store) => {
      store[sessionKey] = sessionEntry;
    });
  }

  // Note: Existing memory entries will be cleaned up on next memory sync
  // when the session file is no longer found or the excludeFromMemory flag is checked
  const memoryNote = "\nExisting memory entries will be cleaned up on next sync.";

  return {
    shouldContinue: false,
    reply: {
      text: `🧠 Memory exclusion enabled. This session won't appear in memory search.${memoryNote}`,
    },
  };
};
