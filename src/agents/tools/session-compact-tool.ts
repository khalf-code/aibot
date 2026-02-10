import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import type { AnyAgentTool } from "./common.js";
import { loadConfig } from "../../config/config.js";
import {
  loadSessionStore,
  resolveStorePath,
  updateSessionStore,
  type SessionEntry,
} from "../../config/sessions.js";
import { resolveSessionFilePath } from "../../config/sessions.js";
import { enqueueSystemEvent } from "../../infra/system-events.js";
import { resolveAgentWorkspaceDir, resolveSessionAgentId } from "../agent-scope.js";
import { compactEmbeddedPiSession } from "../pi-embedded.js";
import { readStringParam } from "./common.js";

const SessionCompactToolSchema = Type.Object({
  instructions: Type.Optional(Type.String({ minLength: 1 })),
});

// Prevent duplicate compaction scheduling for the same session.
const SCHEDULED_COMPACTIONS = new Set<string>();
const RETRY_DELAYS_MS = [0, 60_000, 180_000];

type ScheduledCompactionTask = {
  sessionId: string;
  sessionKey: string;
  agentId: string;
  cfg: OpenClawConfig;
  entry: SessionEntry;
  storePath: string;
  instructions?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientCompactionReason(reason: string): boolean {
  const normalized = reason.toLowerCase();
  return (
    // Common transient transport/provider failures.
    normalized.includes("503") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("fetch failed") ||
    normalized.includes("econnreset") ||
    normalized.includes("etimedout") ||
    // CN provider/router message seen in the wild.
    reason.includes("所有供应商暂时不可用")
  );
}

function formatErrorReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function runScheduledCompaction(task: ScheduledCompactionTask): Promise<void> {
  const { agentId, cfg, entry, instructions, sessionId, sessionKey, storePath } = task;

  // Queue compaction behind the current session lane; do not run inside the active attempt.
  const sessionFile = resolveSessionFilePath(sessionId, entry, { agentId });
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    const delayMs = RETRY_DELAYS_MS[attempt];
    if (delayMs > 0) {
      enqueueSystemEvent(`Session compaction retry scheduled in ${Math.round(delayMs / 1000)}s.`, {
        sessionKey,
      });
      await sleep(delayMs);
    }

    const result = await compactEmbeddedPiSession({
      sessionId,
      sessionKey,
      messageChannel: entry.lastChannel ?? entry.channel,
      groupId: entry.groupId,
      groupChannel: entry.groupChannel,
      groupSpace: entry.space,
      spawnedBy: entry.spawnedBy,
      sessionFile,
      workspaceDir,
      config: cfg,
      skillsSnapshot: entry.skillsSnapshot,
      provider: entry.providerOverride ?? entry.modelProvider,
      model: entry.modelOverride ?? entry.model,
      bashElevated: {
        enabled: false,
        allowed: false,
        defaultLevel: "off",
      },
      customInstructions: instructions,
    });

    if (result.ok && result.compacted) {
      // Best-effort: bump compactionCount for UI/status; ignore failures.
      try {
        await updateSessionStore(storePath, (next) => {
          const currentEntry = next[sessionKey];
          const nextCount = (currentEntry?.compactionCount ?? 0) + 1;
          const updates: Partial<SessionEntry> = {
            compactionCount: nextCount,
            updatedAt: Date.now(),
          };
          if (result.result?.tokensAfter && result.result.tokensAfter > 0) {
            updates.totalTokens = result.result.tokensAfter;
            updates.inputTokens = undefined;
            updates.outputTokens = undefined;
          }
          next[sessionKey] = { ...currentEntry, ...updates };
        });
      } catch {
        // Ignore store update failures.
      }

      enqueueSystemEvent("Session compacted.", { sessionKey });
      return;
    }

    const reason = result.reason?.trim() || (result.ok ? "not compacted" : "error");
    if (!result.ok && isTransientCompactionReason(reason) && attempt < RETRY_DELAYS_MS.length - 1) {
      continue;
    }

    enqueueSystemEvent(`Session compaction did not run: ${reason}.`, { sessionKey });
    return;
  }
}

export function createSessionCompactTool(opts?: {
  agentSessionKey?: string;
  agentSessionId?: string;
  agentId?: string;
  config?: OpenClawConfig;
}): AnyAgentTool {
  return {
    label: "Session Compact",
    name: "session_compact",
    description:
      "Trigger semantic session compaction (equivalent to /compact). Use when conversation history is getting large or before topic switches.",
    parameters: SessionCompactToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const instructions = readStringParam(params, "instructions")?.trim() || undefined;

      const sessionKey = opts?.agentSessionKey?.trim();
      if (!sessionKey) {
        throw new Error("session_compact requires agentSessionKey");
      }
      const sessionId = opts?.agentSessionId?.trim();
      if (!sessionId) {
        return {
          content: [
            {
              type: "text",
              text: "session_compact is unavailable (missing sessionId). Use /compact instead.",
            },
          ],
          details: { ok: false, compacted: false, reason: "missing sessionId" },
        };
      }

      const cfg = opts?.config ?? loadConfig();
      const agentId = opts?.agentId?.trim() || resolveSessionAgentId({ sessionKey, config: cfg });
      const storePath = resolveStorePath(cfg.session?.store, { agentId });
      const store = loadSessionStore(storePath);
      const entry = store[sessionKey];
      if (!entry?.sessionId) {
        return {
          content: [
            {
              type: "text",
              text: "session_compact is unavailable (missing session entry). Use /compact instead.",
            },
          ],
          details: { ok: false, compacted: false, reason: "missing session entry" },
        };
      }

      if (!SCHEDULED_COMPACTIONS.has(sessionId)) {
        SCHEDULED_COMPACTIONS.add(sessionId);
        const task: ScheduledCompactionTask = {
          sessionId,
          sessionKey,
          agentId,
          cfg,
          entry,
          storePath,
          instructions,
        };

        void runScheduledCompaction(task)
          .catch((error) => {
            enqueueSystemEvent(`Session compaction failed: ${formatErrorReason(error)}`, {
              sessionKey,
            });
          })
          .finally(() => {
            SCHEDULED_COMPACTIONS.delete(sessionId);
          });
      }

      return {
        content: [
          {
            type: "text",
            text: "Session compaction scheduled. It will run after the current turn finishes (equivalent to /compact).",
          },
        ],
        details: { ok: true, compacted: false, reason: "scheduled" },
      };
    },
  };
}
