/**
 * Queue abstraction (ADR-007): BullMQ when REDIS_URL is configured,
 * Postgres-backed DbQueueDriver otherwise. Handlers are registered per queue;
 * processing must be idempotent.
 */
export type JobHandler = (payload: Record<string, unknown>, jobMeta: { id: string; attempt: number }) => Promise<void>;

export interface EnqueueOptions {
  runAt?: Date;
  /** Unique per queue — repeated enqueues with the same key collapse into one job. */
  dedupeKey?: string;
}

export interface IQueue {
  enqueue(queue: string, payload: Record<string, unknown>, opts?: EnqueueOptions): Promise<string>;
  register(queue: string, handler: JobHandler): void;
  /** Starts consumption; safe to call once at boot. */
  start(): Promise<void>;
}
