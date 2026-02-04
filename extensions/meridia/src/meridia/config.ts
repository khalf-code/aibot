import type { OpenClawConfig } from "openclaw/plugin-sdk";
import path from "node:path";
import { resolveUserPath } from "./paths.js";

type RawMeridiaPluginConfig = {
  db?: {
    type?: string;
    sqlite?: {
      dbPath?: string;
    };
  };
  debug?: {
    writeTraceJsonl?: boolean;
  };
};

export type ResolvedMeridiaPluginConfig = {
  db: {
    type: "sqlite";
    sqlite: {
      dbPath?: string;
    };
  };
  debug: {
    writeTraceJsonl: boolean;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readMeridiaPluginConfig(cfg?: OpenClawConfig): RawMeridiaPluginConfig {
  const plugins = asRecord(cfg?.plugins);
  const entries = asRecord(plugins?.entries);
  const meridiaEntry = asRecord(entries?.meridia);
  const config = meridiaEntry ? meridiaEntry.config : undefined;
  return (asRecord(config) ?? {}) as RawMeridiaPluginConfig;
}

export function resolveMeridiaPluginConfig(cfg?: OpenClawConfig): ResolvedMeridiaPluginConfig {
  const raw = readMeridiaPluginConfig(cfg);
  const dbTypeRaw = raw.db?.type?.trim();
  const dbType = dbTypeRaw === "sqlite" || !dbTypeRaw ? "sqlite" : "sqlite";

  const dbPathRaw = raw.db?.sqlite?.dbPath;
  const dbPathValue = typeof dbPathRaw === "string" ? dbPathRaw.trim() : "";
  const dbPath = dbPathValue ? path.resolve(resolveUserPath(dbPathValue)) : undefined;

  const writeTraceJsonl =
    raw.debug?.writeTraceJsonl === undefined ? true : raw.debug.writeTraceJsonl === true;

  return {
    db: {
      type: dbType,
      sqlite: {
        ...(dbPath ? { dbPath } : {}),
      },
    },
    debug: {
      writeTraceJsonl,
    },
  };
}

