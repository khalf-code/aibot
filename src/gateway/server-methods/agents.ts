import fs from "node:fs/promises";
import path from "node:path";
import type { GatewayRequestHandlers } from "./types.js";
import { listAgentIds, resolveAgentWorkspaceDir } from "../../agents/agent-scope.js";
import { resolveDefaultAgentId } from "../../agents/agent-scope.js";
import {
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_MEMORY_ALT_FILENAME,
  DEFAULT_MEMORY_FILENAME,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_USER_FILENAME,
} from "../../agents/workspace.js";
import { loadConfig } from "../../config/config.js";
import { loadSessionStore, resolveStorePath } from "../../config/sessions.js";
import { resolveHeartbeatSummaryForAgent } from "../../infra/heartbeat-runner.js";
import { loadCostUsageSummary } from "../../infra/session-cost-usage.js";
import { normalizeAgentId, parseAgentSessionKey } from "../../routing/session-key.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateAgentsFilesGetParams,
  validateAgentsFilesListParams,
  validateAgentsFilesSetParams,
  validateAgentsListParams,
} from "../protocol/index.js";
import { listAgentsForGateway } from "../session-utils.js";

const BOOTSTRAP_FILE_NAMES = [
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_USER_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
] as const;

const MEMORY_FILE_NAMES = [DEFAULT_MEMORY_FILENAME, DEFAULT_MEMORY_ALT_FILENAME] as const;

const ALLOWED_FILE_NAMES = new Set<string>([...BOOTSTRAP_FILE_NAMES, ...MEMORY_FILE_NAMES]);

type FileMeta = {
  size: number;
  updatedAtMs: number;
};

async function statFile(filePath: string): Promise<FileMeta | null> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return null;
    }
    return {
      size: stat.size,
      updatedAtMs: Math.floor(stat.mtimeMs),
    };
  } catch {
    return null;
  }
}

async function listAgentFiles(workspaceDir: string) {
  const files: Array<{
    name: string;
    path: string;
    missing: boolean;
    size?: number;
    updatedAtMs?: number;
  }> = [];

  for (const name of BOOTSTRAP_FILE_NAMES) {
    const filePath = path.join(workspaceDir, name);
    const meta = await statFile(filePath);
    if (meta) {
      files.push({
        name,
        path: filePath,
        missing: false,
        size: meta.size,
        updatedAtMs: meta.updatedAtMs,
      });
    } else {
      files.push({ name, path: filePath, missing: true });
    }
  }

  const primaryMemoryPath = path.join(workspaceDir, DEFAULT_MEMORY_FILENAME);
  const primaryMeta = await statFile(primaryMemoryPath);
  if (primaryMeta) {
    files.push({
      name: DEFAULT_MEMORY_FILENAME,
      path: primaryMemoryPath,
      missing: false,
      size: primaryMeta.size,
      updatedAtMs: primaryMeta.updatedAtMs,
    });
  } else {
    const altMemoryPath = path.join(workspaceDir, DEFAULT_MEMORY_ALT_FILENAME);
    const altMeta = await statFile(altMemoryPath);
    if (altMeta) {
      files.push({
        name: DEFAULT_MEMORY_ALT_FILENAME,
        path: altMemoryPath,
        missing: false,
        size: altMeta.size,
        updatedAtMs: altMeta.updatedAtMs,
      });
    } else {
      files.push({ name: DEFAULT_MEMORY_FILENAME, path: primaryMemoryPath, missing: true });
    }
  }

  return files;
}

function resolveAgentIdOrError(agentIdRaw: string, cfg: ReturnType<typeof loadConfig>) {
  const agentId = normalizeAgentId(agentIdRaw);
  const allowed = new Set(listAgentIds(cfg));
  if (!allowed.has(agentId)) {
    return null;
  }
  return agentId;
}

export const agentsHandlers: GatewayRequestHandlers = {
  "agents.list": ({ params, respond }) => {
    if (!validateAgentsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.list params: ${formatValidationErrors(validateAgentsListParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const result = listAgentsForGateway(cfg);
    respond(true, result, undefined);
  },
  "agents.files.list": async ({ params, respond }) => {
    if (!validateAgentsFilesListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.files.list params: ${formatValidationErrors(
            validateAgentsFilesListParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(String(params.agentId ?? ""), cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const files = await listAgentFiles(workspaceDir);
    respond(true, { agentId, workspace: workspaceDir, files }, undefined);
  },
  "agents.files.get": async ({ params, respond }) => {
    if (!validateAgentsFilesGetParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.files.get params: ${formatValidationErrors(
            validateAgentsFilesGetParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(String(params.agentId ?? ""), cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }
    const name = String(params.name ?? "").trim();
    if (!ALLOWED_FILE_NAMES.has(name)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `unsupported file "${name}"`),
      );
      return;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const filePath = path.join(workspaceDir, name);
    const meta = await statFile(filePath);
    if (!meta) {
      respond(
        true,
        {
          agentId,
          workspace: workspaceDir,
          file: { name, path: filePath, missing: true },
        },
        undefined,
      );
      return;
    }
    const content = await fs.readFile(filePath, "utf-8");
    respond(
      true,
      {
        agentId,
        workspace: workspaceDir,
        file: {
          name,
          path: filePath,
          missing: false,
          size: meta.size,
          updatedAtMs: meta.updatedAtMs,
          content,
        },
      },
      undefined,
    );
  },
  "agents.files.set": async ({ params, respond }) => {
    if (!validateAgentsFilesSetParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.files.set params: ${formatValidationErrors(
            validateAgentsFilesSetParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(String(params.agentId ?? ""), cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }
    const name = String(params.name ?? "").trim();
    if (!ALLOWED_FILE_NAMES.has(name)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `unsupported file "${name}"`),
      );
      return;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    await fs.mkdir(workspaceDir, { recursive: true });
    const filePath = path.join(workspaceDir, name);
    const content = String(params.content ?? "");
    await fs.writeFile(filePath, content, "utf-8");
    const meta = await statFile(filePath);
    respond(
      true,
      {
        ok: true,
        agentId,
        workspace: workspaceDir,
        file: {
          name,
          path: filePath,
          missing: false,
          size: meta?.size,
          updatedAtMs: meta?.updatedAtMs,
          content,
        },
      },
      undefined,
    );
  },
  "agents.resources": async ({ respond }) => {
    const cfg = loadConfig();
    const defaultAgentId = resolveDefaultAgentId(cfg);
    const agentList = listAgentsForGateway(cfg);
    const results = await Promise.all(
      agentList.agents.map(async (agent) => {
        const agentId = normalizeAgentId(agent.id);

        // Session count + token totals from session store
        const storePath = resolveStorePath(cfg.session?.store, { agentId });
        const store = loadSessionStore(storePath);
        let sessionCount = 0;
        let activeSessions = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalTokens = 0;
        const now = Date.now();
        const activeThreshold = 60 * 60 * 1000; // 1 hour
        for (const [key, entry] of Object.entries(store)) {
          if (key === "global" || key === "unknown") {
            continue;
          }
          const parsed = parseAgentSessionKey(key);
          if (parsed && normalizeAgentId(parsed.agentId) !== agentId) {
            continue;
          }
          sessionCount++;
          totalInputTokens += entry?.inputTokens ?? 0;
          totalOutputTokens += entry?.outputTokens ?? 0;
          totalTokens +=
            entry?.totalTokens ?? (entry?.inputTokens ?? 0) + (entry?.outputTokens ?? 0);
          if (entry?.updatedAt && now - entry.updatedAt < activeThreshold) {
            activeSessions++;
          }
        }

        // Cost from transcript scanning (7 days for speed)
        let totalCost = 0;
        try {
          const costSummary = await loadCostUsageSummary({ days: 7, config: cfg, agentId });
          totalCost = costSummary.totals.totalCost;
        } catch {
          // cost unavailable
        }

        // Heartbeat config (runtime alive/ageMs requires active agent loop)
        const heartbeat = resolveHeartbeatSummaryForAgent(cfg, agentId);

        // Workspace size
        const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
        let workspaceFiles = 0;
        let workspaceTotalBytes = 0;
        try {
          const entries = await fs.readdir(workspaceDir);
          for (const name of entries) {
            try {
              const stat = await fs.stat(path.join(workspaceDir, name));
              if (stat.isFile()) {
                workspaceFiles++;
                workspaceTotalBytes += stat.size;
              }
            } catch {
              // skip inaccessible files
            }
          }
        } catch {
          // workspace dir may not exist
        }

        return {
          agentId,
          isDefault: agentId === defaultAgentId,
          sessions: {
            total: sessionCount,
            active: activeSessions,
          },
          tokens: {
            input: totalInputTokens,
            output: totalOutputTokens,
            total: totalTokens,
          },
          cost: {
            total: totalCost,
            days: 7,
          },
          heartbeat: {
            enabled: heartbeat.enabled,
            everyMs: heartbeat.everyMs ?? null,
            every: heartbeat.every,
          },
          workspace: {
            files: workspaceFiles,
            totalBytes: workspaceTotalBytes,
          },
        };
      }),
    );
    respond(true, { agents: results }, undefined);
  },
};
