import { Injectable, Logger } from "@nestjs/common";
import { getEnv } from "../config/env";
import type { EnqueueOptions, IQueue, JobHandler } from "./queue.types";

type MinimalWorker = { close: () => Promise<void> };

/**
 * BullMQ-backed queue driver (production). Selected by QueueModule when
 * REDIS_URL is configured. Handlers are idempotent by contract.
 */
@Injectable()
export class BullMqQueueDriver implements IQueue {
  private readonly logger = new Logger(BullMqQueueDriver.name);
  private readonly handlers = new Map<string, JobHandler>();
  private queues = new Map<string, { add: (name: string, data: unknown, opts?: object) => Promise<{ id?: string }> }>();
  private workers: MinimalWorker[] = [];

  async enqueue(queue: string, payload: Record<string, unknown>, opts?: EnqueueOptions): Promise<string> {
    const q = this.queues.get(queue);
    if (!q) throw new Error(`Queue ${queue} not initialized`);
    const job = await q.add("job", payload, {
      delay: opts?.runAt ? Math.max(0, opts.runAt.getTime() - Date.now()) : undefined,
      jobId: opts?.dedupeKey,
      removeOnComplete: 500,
      removeOnFail: 1000,
    });
    return job.id ?? crypto.randomUUID();
  }

  register(queue: string, handler: JobHandler): void {
    if (this.handlers.has(queue)) throw new Error(`Handler already registered for queue ${queue}`);
    this.handlers.set(queue, handler);
  }

  async start(): Promise<void> {
    const env = getEnv();
    if (!env.REDIS_URL) throw new Error("BullMqQueueDriver requires REDIS_URL");
    const [{ Queue, Worker }, IORedis] = await Promise.all([
      import("bullmq"),
      (async () => (await import("ioredis")).default)(),
    ]);
    const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    for (const [queue, handler] of this.handlers) {
      const q = new Queue(queue, { connection });
      this.queues.set(queue, q as unknown as { add: (n: string, d: unknown, o?: object) => Promise<{ id?: string }> });
      const worker = new Worker(
        queue,
        async (job) =>
          handler(job.data as Record<string, unknown>, { id: String(job.id), attempt: job.attemptsMade + 1 }),
        { connection },
      );
      worker.on("failed", (job, err) => this.logger.error(`job ${job?.id} on ${queue} failed: ${err.message}`));
      this.workers.push(worker);
    }
    this.logger.log(`BullMQ workers started for ${this.handlers.size} queues`);
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close().catch(() => undefined)));
  }
}
