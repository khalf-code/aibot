import type { OpenClawConfig } from "../config/config.js";

const DEFAULT_AGENT_TIMEOUT_SECONDS = 600;
export const MAX_SET_TIMEOUT_MS = 2_147_483_647;
const NO_TIMEOUT_BUFFER_MS = 10_000;

const normalizeNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : undefined;

export function resolveAgentTimeoutSeconds(cfg?: OpenClawConfig): number {
  const raw = normalizeNumber(cfg?.agents?.defaults?.timeoutSeconds);
  const seconds = raw ?? DEFAULT_AGENT_TIMEOUT_SECONDS;
  return Math.max(seconds, 1);
}

export function resolveAgentTimeoutMs(opts: {
  cfg?: OpenClawConfig;
  overrideMs?: number | null;
  overrideSeconds?: number | null;
  minMs?: number;
}): number {
  const minMs = Math.max(normalizeNumber(opts.minMs) ?? 1, 1);
  const defaultMs = resolveAgentTimeoutSeconds(opts.cfg) * 1000;
  // Use a very large timeout value to represent "no timeout" when explicitly set to 0.
  // Leave room for the gateway wait buffer so we never exceed Node's setTimeout limit.
  const NO_TIMEOUT_MS = MAX_SET_TIMEOUT_MS - NO_TIMEOUT_BUFFER_MS;
  const overrideMs = normalizeNumber(opts.overrideMs);
  if (overrideMs !== undefined) {
    if (overrideMs === 0) {
      return NO_TIMEOUT_MS;
    }
    if (overrideMs < 0) {
      return defaultMs;
    }
    return Math.max(overrideMs, minMs);
  }
  const overrideSeconds = normalizeNumber(opts.overrideSeconds);
  if (overrideSeconds !== undefined) {
    if (overrideSeconds === 0) {
      return NO_TIMEOUT_MS;
    }
    if (overrideSeconds < 0) {
      return defaultMs;
    }
    return Math.max(overrideSeconds * 1000, minMs);
  }
  return Math.max(defaultMs, minMs);
}
