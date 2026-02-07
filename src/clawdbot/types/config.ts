/**
 * CORE-006 (#22) — Config layering
 *
 * Environment-aware configuration with layered overrides
 * (defaults -> env-specific -> user overrides).
 */

export enum Environment {
  Dev = "dev",
  Staging = "staging",
  Prod = "prod",
}

export type ClawdbotConfig = {
  environment: Environment;
  /** When true, destructive actions require explicit confirmation. */
  safeMode: boolean;
  /** Allow the bot to send messages to external channels. */
  allowExternalSend: boolean;
  /** Maximum concurrent runs. */
  maxConcurrentRuns: number;
  /** Default timeout per step in milliseconds. */
  defaultStepTimeoutMs: number;
  /** Whether to persist artifacts to disk. */
  persistArtifacts: boolean;
  /** Optional overrides from user / env layers. */
  overrides?: Record<string, unknown>;
};

/** Sensible defaults per environment. */
const ENV_DEFAULTS: Record<Environment, ClawdbotConfig> = {
  [Environment.Dev]: {
    environment: Environment.Dev,
    safeMode: false,
    allowExternalSend: false,
    maxConcurrentRuns: 2,
    defaultStepTimeoutMs: 120_000,
    persistArtifacts: true,
  },
  [Environment.Staging]: {
    environment: Environment.Staging,
    safeMode: true,
    allowExternalSend: false,
    maxConcurrentRuns: 4,
    defaultStepTimeoutMs: 60_000,
    persistArtifacts: true,
  },
  [Environment.Prod]: {
    environment: Environment.Prod,
    safeMode: true,
    allowExternalSend: true,
    maxConcurrentRuns: 8,
    defaultStepTimeoutMs: 30_000,
    persistArtifacts: true,
  },
};

/**
 * Load the configuration for the given environment.
 * In a real implementation this would merge file / env-var / CLI layers.
 */
export function loadConfig(env: Environment): ClawdbotConfig {
  // TODO: layer file-based and env-var overrides on top of defaults
  return { ...ENV_DEFAULTS[env] };
}
