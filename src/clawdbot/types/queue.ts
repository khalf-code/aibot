/**
 * CORE-007 (#23) — Queue-based execution
 *
 * Job queue abstraction for ordering, retrying, and prioritising
 * run steps.
 */

export type JobStatus = "pending" | "active" | "completed" | "failed" | "dead";

export type QueueJob = {
  id: string;
  runId: string;
  /** Lower number = higher priority. */
  priority: number;
  attempts: number;
  maxAttempts: number;
  status: JobStatus;
  createdAt: number;
};

/** Generic async job queue contract. */
export type JobQueue = {
  /** Add a job to the queue. Returns the job with a generated `id`. */
  enqueue(job: Omit<QueueJob, "id" | "status" | "attempts" | "createdAt">): Promise<QueueJob>;
  /** Pull the next highest-priority pending job (or null if empty). */
  dequeue(): Promise<QueueJob | null>;
  /** Mark a job as successfully completed. */
  ack(jobId: string): Promise<void>;
  /** Mark a job as failed; it may be retried if attempts < maxAttempts. */
  nack(jobId: string, reason?: string): Promise<void>;
  /** Explicitly re-enqueue a failed job for another attempt. */
  retry(jobId: string): Promise<QueueJob>;
};
