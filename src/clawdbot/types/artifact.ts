/**
 * CORE-004 (#20) — Artifact store
 *
 * Types and interface for persisting run artifacts (screenshots,
 * transcripts, exported files, etc.) with metadata.
 */

export type ArtifactType = "screenshot" | "transcript" | "export" | "file";

export type Artifact = {
  id: string;
  runId: string;
  type: ArtifactType;
  mimeType: string;
  path: string;
  sizeBytes: number;
  metadata: Record<string, unknown>;
  createdAt: number;
};

/** Async storage backend for run artifacts. */
export type ArtifactStore = {
  save(artifact: Artifact, data: Uint8Array): Promise<void>;
  get(id: string): Promise<{ artifact: Artifact; data: Uint8Array } | null>;
  list(runId: string): Promise<Artifact[]>;
  delete(id: string): Promise<void>;
};

/**
 * Filesystem-backed artifact store.
 * Stores artifacts under a configurable base directory.
 */
export class LocalArtifactStore implements ArtifactStore {
  constructor(private readonly baseDir: string) {}

  async save(_artifact: Artifact, _data: Uint8Array): Promise<void> {
    // TODO: write data to baseDir/{artifact.runId}/{artifact.id}
    throw new Error("LocalArtifactStore.save not implemented");
  }

  async get(_id: string): Promise<{ artifact: Artifact; data: Uint8Array } | null> {
    // TODO: read artifact metadata + data from disk
    throw new Error("LocalArtifactStore.get not implemented");
  }

  async list(_runId: string): Promise<Artifact[]> {
    // TODO: enumerate artifacts for the given run
    throw new Error("LocalArtifactStore.list not implemented");
  }

  async delete(_id: string): Promise<void> {
    // TODO: remove artifact file and metadata
    throw new Error("LocalArtifactStore.delete not implemented");
  }
}
