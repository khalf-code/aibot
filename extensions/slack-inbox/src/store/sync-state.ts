import fs from "node:fs";
import path from "node:path";
import { SyncStateSchema, type SyncState } from "../types.js";

const STATE_FILENAME = "sync-state.json";

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getSyncStatePath(storeDir: string): string {
  return path.join(storeDir, STATE_FILENAME);
}

export function loadSyncState(storeDir: string): SyncState {
  const filePath = getSyncStatePath(storeDir);
  if (!fs.existsSync(filePath)) {
    return { unreadCount: 0 };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    return SyncStateSchema.parse(data);
  } catch {
    return { unreadCount: 0 };
  }
}

export function saveSyncState(storeDir: string, state: SyncState): void {
  ensureDir(storeDir);
  const filePath = getSyncStatePath(storeDir);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
}

export function updateSyncState(storeDir: string, update: Partial<SyncState>): SyncState {
  const current = loadSyncState(storeDir);
  const updated = { ...current, ...update };
  saveSyncState(storeDir, updated);
  return updated;
}
