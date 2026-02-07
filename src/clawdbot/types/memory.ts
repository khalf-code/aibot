/**
 * CORE-010 (#26) — Memory policy
 *
 * Types governing how the bot stores, retains, and deletes
 * conversational / project memory, with consent tracking.
 */

export enum MemoryType {
  /** Cleared at the end of each run. */
  Ephemeral = "ephemeral",
  /** Scoped to a project; persists across runs. */
  Project = "project",
  /** Scoped to a user; persists across projects. */
  User = "user",
}

export type MemoryEntry = {
  id: string;
  type: MemoryType;
  key: string;
  value: unknown;
  /** Number of days to retain before automatic deletion (0 = indefinite). */
  retentionDays: number;
  createdAt: number;
  /** Whether the user gave explicit consent for this data to be stored. */
  consentGiven: boolean;
};

export type MemoryPolicy = {
  type: MemoryType;
  /** Default retention period in days for entries of this type. */
  retentionDays: number;
  /** If true, storage requires explicit user consent. */
  requiresConsent: boolean;
  /** If true, entries are deleted immediately when the user requests deletion. */
  autoDeleteOnRequest: boolean;
};
