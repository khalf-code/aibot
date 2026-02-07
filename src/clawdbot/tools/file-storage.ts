/**
 * TOOLS-014 (#50) -- File storage
 *
 * Provider interface and types for uploading, downloading, listing,
 * and deleting files in a storage backend. Implementations may wrap
 * local disk, S3, GCS, Azure Blob Storage, or other object stores.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// StoredFile
// ---------------------------------------------------------------------------

/** Metadata for a file stored in the backend. */
export type StoredFile = {
  /** Object key / path within the bucket (e.g. `"runs/abc123/output.pdf"`). */
  key: string;

  /** Bucket or container name. */
  bucket: string;

  /** File size in bytes. */
  size_bytes: number;

  /** MIME content type (e.g. `"application/pdf"`, `"image/png"`). */
  content_type: string;

  /** ISO-8601 timestamp of when the file was uploaded. */
  uploaded_at: string;

  /** ISO-8601 timestamp of the last modification (may equal `uploaded_at`). */
  updated_at?: string;

  /** SHA-256 hex digest for integrity verification. */
  sha256?: string;

  /** Optional user-defined metadata tags. */
  metadata?: Record<string, string>;

  /** Pre-signed URL for direct download (time-limited, provider-specific). */
  download_url?: string;
};

// ---------------------------------------------------------------------------
// Upload options
// ---------------------------------------------------------------------------

/** Options for uploading a file. */
export type FileUploadOptions = {
  /** Object key / path within the bucket. */
  key: string;

  /** Bucket or container name. */
  bucket: string;

  /** MIME content type. */
  content_type: string;

  /** The file data to upload. */
  data: Uint8Array;

  /** Optional user-defined metadata tags. */
  metadata?: Record<string, string>;

  /**
   * If `true`, overwrite an existing file at the same key.
   * When `false` (default), the upload fails if the key already exists.
   */
  overwrite?: boolean;
};

// ---------------------------------------------------------------------------
// List options
// ---------------------------------------------------------------------------

/** Options for listing files in a bucket. */
export type FileListOptions = {
  /** Bucket or container name. */
  bucket: string;

  /** Key prefix to filter by (e.g. `"runs/abc123/"`). */
  prefix?: string;

  /** Maximum number of results. */
  limit?: number;

  /** Continuation token for paginated results. */
  cursor?: string;
};

/** Result of a file listing operation (supports pagination). */
export type FileListResult = {
  /** Files matching the query. */
  files: StoredFile[];

  /**
   * Continuation token for the next page.
   * `undefined` when there are no more results.
   */
  next_cursor?: string;
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * File storage provider interface.
 *
 * Implementations wrap a specific storage backend and expose a uniform
 * API for the Clawdbot tool runner.
 */
export type FileStorageProvider = {
  /** Human-readable name (e.g. `"Local Disk"`, `"AWS S3"`). */
  readonly name: string;

  /**
   * Upload a file to the storage backend.
   *
   * @returns Metadata of the stored file.
   * @throws {Error} If the key already exists and `overwrite` is `false`.
   */
  upload(options: FileUploadOptions): Promise<StoredFile>;

  /**
   * Download a file from the storage backend.
   *
   * @param bucket Bucket or container name.
   * @param key Object key / path.
   * @returns The file data and metadata, or `null` if the file does not exist.
   */
  download(bucket: string, key: string): Promise<{ file: StoredFile; data: Uint8Array } | null>;

  /**
   * Delete a file from the storage backend.
   *
   * @param bucket Bucket or container name.
   * @param key Object key / path.
   * @throws {Error} If the file does not exist.
   */
  delete(bucket: string, key: string): Promise<void>;

  /**
   * List files in a bucket, optionally filtered by prefix.
   *
   * @returns A paginated list of stored files.
   */
  list(options: FileListOptions): Promise<FileListResult>;
};
