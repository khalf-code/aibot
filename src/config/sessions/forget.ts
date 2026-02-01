/**
 * Session forget/delete functionality.
 *
 * Provides complete session deletion across all storage locations:
 * - Session JSONL transcript
 * - sessions.json metadata
 * - Memory SQLite index
 * - In-memory state
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { resolveStateDir } from "../paths.js";
import { updateSessionStore } from "./store.js";
import { createSessionCheckpoint } from "./checkpoint.js";
import type { SessionEntry } from "./types.js";
import { requireNodeSqlite } from "../../memory/sqlite.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("session-forget");

export type ForgetSessionResult = {
  success: boolean;
  checkpointId?: string;
  deletedJsonl: boolean;
  deletedFromStore: boolean;
  deletedFromMemory: boolean;
  memoryChunksDeleted: number;
  errors: string[];
};

/**
 * Completely forget/delete a session from all storage locations.
 *
 * @param agentId - The agent ID (e.g., "liam-telegram")
 * @param sessionKey - The session key
 * @param sessionEntry - The session entry metadata
 * @param storePath - Path to sessions.json
 * @param createCheckpointBeforeDelete - Whether to create a checkpoint for recovery (default: true)
 */
export async function forgetSession(params: {
  agentId: string;
  sessionKey: string;
  sessionEntry: SessionEntry;
  storePath: string;
  createCheckpointBeforeDelete?: boolean;
}): Promise<ForgetSessionResult> {
  const { agentId, sessionKey, sessionEntry, storePath } = params;
  const createCheckpoint = params.createCheckpointBeforeDelete ?? true;

  const result: ForgetSessionResult = {
    success: false,
    deletedJsonl: false,
    deletedFromStore: false,
    deletedFromMemory: false,
    memoryChunksDeleted: 0,
    errors: [],
  };

  log.info(
    `forgetting session: agentId=${agentId} sessionKey=${sessionKey} sessionId=${sessionEntry.sessionId}`,
  );

  // 1. Create checkpoint before deletion (for recovery)
  if (createCheckpoint) {
    try {
      const checkpoint = await createSessionCheckpoint(agentId, sessionKey, sessionEntry, "manual");
      result.checkpointId = checkpoint.id;
      log.info(`created checkpoint ${checkpoint.id} before deletion`);
    } catch (err) {
      const msg = `failed to create checkpoint: ${String(err)}`;
      log.warn(msg);
      result.errors.push(msg);
      // Continue with deletion even if checkpoint fails
    }
  }

  // 2. Delete JSONL transcript file
  const sessionFile = sessionEntry.sessionFile;
  if (sessionFile) {
    try {
      await fs.unlink(sessionFile);
      result.deletedJsonl = true;
      log.info(`deleted JSONL: ${sessionFile}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        // File doesn't exist - that's fine
        result.deletedJsonl = true;
        log.info(`JSONL already deleted or never existed: ${sessionFile}`);
      } else {
        const msg = `failed to delete JSONL: ${String(err)}`;
        log.warn(msg);
        result.errors.push(msg);
      }
    }
  } else {
    result.deletedJsonl = true; // No file to delete
    log.info("no JSONL file to delete (session was memory-only)");
  }

  // 3. Remove from sessions.json
  try {
    await updateSessionStore(storePath, (store) => {
      delete store[sessionKey];
    });
    result.deletedFromStore = true;
    log.info(`removed from sessions.json: ${sessionKey}`);
  } catch (err) {
    const msg = `failed to remove from sessions.json: ${String(err)}`;
    log.warn(msg);
    result.errors.push(msg);
  }

  // 4. Delete from memory SQLite
  if (sessionFile) {
    try {
      const memoryResult = await deleteFromMemorySqlite({ agentId, sessionFile });
      result.deletedFromMemory = memoryResult.deleted;
      result.memoryChunksDeleted = memoryResult.chunksDeleted;
    } catch (err) {
      const msg = `failed to delete from memory: ${String(err)}`;
      log.warn(msg);
      result.errors.push(msg);
    }
  } else {
    result.deletedFromMemory = true; // Nothing to delete
  }

  // Success if we managed to delete from store (the critical one)
  result.success = result.deletedFromStore;

  log.info(
    `forget complete: success=${result.success} jsonl=${result.deletedJsonl} store=${result.deletedFromStore} memory=${result.deletedFromMemory} chunks=${result.memoryChunksDeleted}`,
  );

  return result;
}

/**
 * Delete session data from memory SQLite database.
 */
async function deleteFromMemorySqlite(params: {
  agentId: string;
  sessionFile: string;
}): Promise<{ deleted: boolean; chunksDeleted: number }> {
  const { agentId, sessionFile } = params;

  // Resolve memory database path
  const stateDir = resolveStateDir(process.env, os.homedir);
  const dbPath = path.join(stateDir, "memory", `${agentId}.sqlite`);

  // Check if database exists
  try {
    await fs.access(dbPath);
  } catch {
    log.info(`memory database not found: ${dbPath}`);
    return { deleted: true, chunksDeleted: 0 };
  }

  // Open database and delete entries
  try {
    const { DatabaseSync } = requireNodeSqlite();
    const db = new DatabaseSync(dbPath);

    // Count chunks before deletion
    let chunksDeleted = 0;
    try {
      const countResult = db
        .prepare("SELECT COUNT(*) as count FROM chunks WHERE path = ?")
        .get(sessionFile) as { count: number } | undefined;
      chunksDeleted = countResult?.count ?? 0;
    } catch {
      // chunks table may not exist
    }

    // Delete from vector table (if exists)
    try {
      db.prepare("DELETE FROM chunks_vec WHERE id IN (SELECT id FROM chunks WHERE path = ?)").run(
        sessionFile,
      );
    } catch {
      // Vector table may not exist
    }

    // Delete from FTS table (if exists)
    try {
      db.prepare("DELETE FROM chunks_fts WHERE path = ?").run(sessionFile);
    } catch {
      // FTS table may not exist
    }

    // Delete from chunks table
    try {
      db.prepare("DELETE FROM chunks WHERE path = ?").run(sessionFile);
    } catch {
      // chunks table may not exist
    }

    // Delete from files table
    try {
      db.prepare("DELETE FROM files WHERE path = ?").run(sessionFile);
    } catch {
      // files table may not exist
    }

    db.close();

    log.info(`deleted ${chunksDeleted} chunks from memory: ${dbPath}`);
    return { deleted: true, chunksDeleted };
  } catch (err) {
    log.warn(`failed to delete from memory database: ${String(err)}`);
    return { deleted: false, chunksDeleted: 0 };
  }
}
