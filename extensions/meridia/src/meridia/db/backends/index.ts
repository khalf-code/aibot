import type { OpenClawConfig } from "openclaw/plugin-sdk";
import path from "node:path";
import type { MeridiaDbBackend } from "../backend.js";
import { resolveMeridiaPluginConfig } from "../../config.js";
import { createSqliteBackend, resolveMeridiaDbPath } from "./sqlite.js";

export type MeridiaBackendType = "sqlite";

let cachedBackend: MeridiaDbBackend | undefined;
let cachedPath: string | undefined;

export function createBackend(params?: { cfg?: OpenClawConfig; hookKey?: string }): MeridiaDbBackend {
  const cfg = params?.cfg;
  const pluginCfg = resolveMeridiaPluginConfig(cfg);

  const backendType: MeridiaBackendType = pluginCfg.db.type;
  if (backendType !== "sqlite") {
    throw new Error(`Unsupported Meridia backend type: ${backendType}`);
  }

  const dbPath = resolveMeridiaDbPath({
    cfg,
    hookKey: params?.hookKey,
    dbPathOverride: pluginCfg.db.sqlite.dbPath,
  });

  const resolvedPath = path.resolve(dbPath);
  if (cachedBackend && cachedPath === resolvedPath) {
    return cachedBackend;
  }

  if (cachedBackend) {
    try {
      cachedBackend.close();
    } catch {
      // ignore
    }
  }

  const backend = createSqliteBackend({ cfg, hookKey: params?.hookKey, dbPath: resolvedPath });
  cachedBackend = backend;
  cachedPath = resolvedPath;
  return backend;
}

export function closeBackend(): void {
  if (cachedBackend) {
    try {
      cachedBackend.close();
    } catch {
      // ignore
    }
  }
  cachedBackend = undefined;
  cachedPath = undefined;
}

