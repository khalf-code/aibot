import { createHash } from "node:crypto";
import type { OpenClawConfig } from "../config/config.js";
import type { EmbeddedContextFile } from "./pi-embedded-helpers.js";
import { applyBootstrapHookOverrides } from "./bootstrap-hooks.js";
import { buildBootstrapContextFiles, resolveBootstrapMaxChars } from "./pi-embedded-helpers.js";
import {
  filterBootstrapFilesForSession,
  loadWorkspaceBootstrapFiles,
  type WorkspaceBootstrapFile,
} from "./workspace.js";

/**
 * Compute SHA256 checksum for file content
 */
export function computeFileChecksum(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

/**
 * Cache entry for a context file
 */
type ContextFileCacheEntry = {
  checksum: string;
  content: string;
};

/**
 * Per-session cache for context files
 * Maps sessionKey -> fileName -> cache entry
 */
const CONTEXT_FILE_CACHE = new Map<string, Map<string, ContextFileCacheEntry>>();

/**
 * Get cache for a specific session
 */
function getSessionCache(sessionKey: string): Map<string, ContextFileCacheEntry> {
  if (!CONTEXT_FILE_CACHE.has(sessionKey)) {
    CONTEXT_FILE_CACHE.set(sessionKey, new Map());
  }
  return CONTEXT_FILE_CACHE.get(sessionKey)!;
}

/**
 * Get cached context file entry
 */
export function getContextFileCache(
  sessionKey: string,
  fileName: string,
): ContextFileCacheEntry | null {
  const sessionCache = getSessionCache(sessionKey);
  const entry = sessionCache.get(fileName);
  return entry ?? null;
}

/**
 * Set cached context file entry
 */
export function setContextFileCache(
  sessionKey: string,
  fileName: string,
  checksum: string,
  content: string,
): void {
  const sessionCache = getSessionCache(sessionKey);
  sessionCache.set(fileName, { checksum, content });
}

/**
 * Clear context file cache for a session
 */
export function clearContextFileCache(sessionKey: string): void {
  CONTEXT_FILE_CACHE.delete(sessionKey);
}

/**
 * Clear all context file caches (useful for testing)
 */
export function clearAllContextFileCaches(): void {
  CONTEXT_FILE_CACHE.clear();
}

export function makeBootstrapWarn(params: {
  sessionLabel: string;
  warn?: (message: string) => void;
}): ((message: string) => void) | undefined {
  if (!params.warn) {
    return undefined;
  }
  return (message: string) => params.warn?.(`${message} (sessionKey=${params.sessionLabel})`);
}

export async function resolveBootstrapFilesForRun(params: {
  workspaceDir: string;
  config?: OpenClawConfig;
  sessionKey?: string;
  sessionId?: string;
  agentId?: string;
}): Promise<WorkspaceBootstrapFile[]> {
  const sessionKey = params.sessionKey ?? params.sessionId;
  const bootstrapFiles = filterBootstrapFilesForSession(
    await loadWorkspaceBootstrapFiles(params.workspaceDir),
    sessionKey,
  );
  return applyBootstrapHookOverrides({
    files: bootstrapFiles,
    workspaceDir: params.workspaceDir,
    config: params.config,
    sessionKey: params.sessionKey,
    sessionId: params.sessionId,
    agentId: params.agentId,
  });
}

/**
 * Build context files with caching support.
 * Uses checksums to avoid re-sending unchanged files.
 */
function buildBootstrapContextFilesWithCache(
  files: WorkspaceBootstrapFile[],
  opts?: {
    warn?: (message: string) => void;
    maxChars?: number;
    sessionKey?: string;
  },
): EmbeddedContextFile[] {
  const maxChars = opts?.maxChars ?? 20_000;
  const sessionKey = opts?.sessionKey;
  const result: EmbeddedContextFile[] = [];

  for (const file of files) {
    // Handle missing files - always include marker
    if (file.missing) {
      result.push({
        path: file.name,
        content: `[MISSING] Expected at: ${file.path}`,
      });
      continue;
    }

    const content = file.content ?? "";

    // If we have a session key, use caching
    if (sessionKey) {
      const currentChecksum = computeFileChecksum(content);
      const cached = getContextFileCache(sessionKey, file.name);

      if (cached && cached.checksum === currentChecksum) {
        // File unchanged - use cached content (already trimmed)
        // Note: cached.content may be empty string for empty/whitespace files
        // We still skip reprocessing by continuing, just don't add to result
        if (cached.content) {
          result.push({
            path: file.name,
            content: cached.content,
          });
        }
        // Continue to skip reprocessing, even for empty content
        continue;
      }

      // File changed or not cached - process and cache
      const processed = processBootstrapFile(file, maxChars, opts?.warn);
      // Always cache the result, even if empty (to avoid reprocessing)
      setContextFileCache(sessionKey, file.name, currentChecksum, processed?.content ?? "");
      if (processed) {
        result.push(processed);
      }
    } else {
      // No session key - process without caching
      const processed = processBootstrapFile(file, maxChars, opts?.warn);
      if (processed) {
        result.push(processed);
      }
    }
  }

  return result;
}

/**
 * Process a single bootstrap file (trim content, apply warnings)
 */
function processBootstrapFile(
  file: WorkspaceBootstrapFile,
  maxChars: number,
  warn?: (message: string) => void,
): EmbeddedContextFile | null {
  const content = file.content ?? "";
  const trimmed = trimBootstrapContent(content, file.name, maxChars);

  if (!trimmed.content) {
    return null;
  }

  if (trimmed.truncated && warn) {
    warn(
      `workspace bootstrap file ${file.name} is ${trimmed.originalLength} chars (limit ${trimmed.maxChars}); truncating in injected context`,
    );
  }

  return {
    path: file.name,
    content: trimmed.content,
  };
}

/**
 * Trim bootstrap content to max chars with head/tail ratio
 */
type TrimBootstrapResult = {
  content: string;
  truncated: boolean;
  maxChars: number;
  originalLength: number;
};

const BOOTSTRAP_HEAD_RATIO = 0.7;
const BOOTSTRAP_TAIL_RATIO = 0.2;

function trimBootstrapContent(
  content: string,
  fileName: string,
  maxChars: number,
): TrimBootstrapResult {
  const trimmed = content.trimEnd();
  if (trimmed.length <= maxChars) {
    return {
      content: trimmed,
      truncated: false,
      maxChars,
      originalLength: trimmed.length,
    };
  }

  const headChars = Math.floor(maxChars * BOOTSTRAP_HEAD_RATIO);
  const tailChars = Math.floor(maxChars * BOOTSTRAP_TAIL_RATIO);
  const head = trimmed.slice(0, headChars);
  const tail = trimmed.slice(-tailChars);

  const marker = [
    "",
    `[...truncated, read ${fileName} for full content...]`,
    `…(truncated ${fileName}: kept ${headChars}+${tailChars} chars of ${trimmed.length})…`,
    "",
  ].join("\n");
  const contentWithMarker = [head, marker, tail].join("\n");
  return {
    content: contentWithMarker,
    truncated: true,
    maxChars,
    originalLength: trimmed.length,
  };
}

export async function resolveBootstrapContextForRun(params: {
  workspaceDir: string;
  config?: OpenClawConfig;
  sessionKey?: string;
  sessionId?: string;
  agentId?: string;
  warn?: (message: string) => void;
}): Promise<{
  bootstrapFiles: WorkspaceBootstrapFile[];
  contextFiles: EmbeddedContextFile[];
}> {
  const bootstrapFiles = await resolveBootstrapFilesForRun(params);

  // Use cached version if we have a session key
  const effectiveSessionKey = params.sessionKey ?? params.sessionId;

  if (effectiveSessionKey) {
    // Use caching version
    const contextFiles = buildBootstrapContextFilesWithCache(bootstrapFiles, {
      maxChars: resolveBootstrapMaxChars(params.config),
      warn: params.warn,
      sessionKey: effectiveSessionKey,
    });
    return { bootstrapFiles, contextFiles };
  }

  // Fallback to non-cached version for backward compatibility
  const contextFiles = buildBootstrapContextFiles(bootstrapFiles, {
    maxChars: resolveBootstrapMaxChars(params.config),
    warn: params.warn,
  });
  return { bootstrapFiles, contextFiles };
}
