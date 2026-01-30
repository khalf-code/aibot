/**
 * Track compaction cooldowns per session and checkpoint to prevent rapid-fire compaction attempts.
 * Prevents double-compaction (proactive + reactive fighting) while allowing different checkpoints
 * to compact the same session independently.
 */

// Track per-checkpoint cooldowns to allow different checkpoints to compact independently
const compactionTimestamps = new Map<string, { [checkpoint: string]: number }>();
const MIN_TIME_BETWEEN_COMPACTIONS_MS = 30000; // 30 seconds
const COOLDOWN_CLEANUP_INTERVAL_MS = 600000; // 10 minutes
const COOLDOWN_HISTORY_TTL_MS = 300000; // 5 minutes

// Periodic cleanup to prevent memory leak in long-running gateways
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [sessionId, checkpoints] of compactionTimestamps.entries()) {
    // Remove expired checkpoint timestamps
    const validCheckpoints = Object.entries(checkpoints).filter(
      ([_, timestamp]) => now - timestamp <= COOLDOWN_HISTORY_TTL_MS,
    );

    if (validCheckpoints.length === 0) {
      // All checkpoints expired, remove session entry
      compactionTimestamps.delete(sessionId);
    } else {
      // Update with only valid checkpoints
      compactionTimestamps.set(sessionId, Object.fromEntries(validCheckpoints));
    }
  }
}, COOLDOWN_CLEANUP_INTERVAL_MS);

// Prevent cleanup timer from keeping process alive during shutdown
cleanupInterval.unref();

export function canCompactNow(
  sessionId: string,
  checkpoint: string,
): { allowed: boolean; reason?: string } {
  const checkpointTimestamps = compactionTimestamps.get(sessionId);
  if (!checkpointTimestamps) {
    return { allowed: true };
  }

  const lastCompaction = checkpointTimestamps[checkpoint];
  if (!lastCompaction) {
    // This checkpoint hasn't compacted recently, even if others have
    return { allowed: true };
  }

  const elapsed = Date.now() - lastCompaction;
  if (elapsed < MIN_TIME_BETWEEN_COMPACTIONS_MS) {
    return {
      allowed: false,
      reason: `${checkpoint} compacted ${Math.round(elapsed / 1000)}s ago (cooldown: 30s)`,
    };
  }

  return { allowed: true };
}

export function recordCompaction(sessionId: string, checkpoint: string): void {
  const existing = compactionTimestamps.get(sessionId) ?? {};
  existing[checkpoint] = Date.now();
  compactionTimestamps.set(sessionId, existing);
}

export function clearCompactionHistory(sessionId: string): void {
  compactionTimestamps.delete(sessionId);
}
