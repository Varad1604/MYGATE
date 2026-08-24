import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";import type { EnqueueOptions, IQueue, JobHandler } from "./queue.types";

const POLL_INTERVAL_MS = 1500;

/**
 * Durable queue on PostgreSQL (SELECT … FOR UPDATE SKIP LOCKED).
 * Used when Redis is unavailable (default dev mode) — same interface as the
 * BullMQ driver, so business code never changes.
 */
@Injectable()
export class DbQueueDriver implements IQueue, OnModuleDestroy {
  private readonly logger = new Logger(DbQueueDriver.name);
  private readonly handlers = new Map<string, JobHandler>();
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(queue: string, payload: Record<string, unknown>, opts?: EnqueueOptions): Promise<string> {
    const runAt = opts?.runAt ?? new Date();
    const dedupeKey = opts?.dedupeKey ? `${queue}:${opts.dedupeKey}` : null;
    // Dedupe collapses only against ACTIVE jobs; a DONE/FAILED row with the
    // same key is recycled. Avoids unique-violation pile-ups for recurring jobs.
    const id = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "QueueJob" (id, queue, payload, status, "runAt", "updatedAt", "dedupeKey")
      VALUES (${crypto.randomUUID()}::uuid, ${queue}, ${JSON.stringify(payload)}::jsonb, 'PENDING', ${runAt}, now(), ${dedupeKey}::text)
      ON CONFLICT ("dedupeKey") DO UPDATE SET
        status = 'PENDING',
        payload = ${JSON.stringify(payload)}::jsonb,
        "runAt" = ${runAt},
        attempts = 0,
        "lastError" = NULL,
        "updatedAt" = now()
      WHERE "QueueJob"."status" IN ('DONE', 'FAILED')
      RETURNING id`;
    if (id[0]) return id[0].id;
    // Conflict with an ACTIVE job — dedupe hit, nothing to do.
    const existing = await this.prisma.queueJob.findUnique({ where: { dedupeKey: dedupeKey! }, select: { id: true } });
    return existing?.id ?? "";
  }

  register(queue: string, handler: JobHandler): void {
    if (this.handlers.has(queue)) throw new Error(`Handler already registered for queue ${queue}`);
    this.handlers.set(queue, handler);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.logger.log(`DbQueueDriver started (${this.handlers.size} queues)`);
    const tick = async () => {
      try {
        await this.drainOnce();
      } catch (err) {
        this.logger.error("drain error", err as Error);
      }
    };
    this.timer = setInterval(tick, POLL_INTERVAL_MS);
    void tick();
  }

  private async drainOnce(): Promise<void> {
    // Reap stale claims: rows left PROCESSING by a crashed/killed worker
    // would otherwise block their dedupeKey forever.
    try {
      await this.prisma.$queryRaw`
        UPDATE "QueueJob"
        SET status = 'PENDING', "updatedAt" = now()
        WHERE status = 'PROCESSING' AND "updatedAt" < now() - interval '120 seconds'`;
    } catch {
      // reap failure is non-fatal; next tick retries
    }
    for (const [queue, handler] of this.handlers) {
      // Claim one due job atomically.
      const claimed = await this.prisma.$queryRaw<{ id: string; payload: unknown; attempts: number }[]>`
        UPDATE "QueueJob"
        SET status = 'PROCESSING', "updatedAt" = now(), "attempts" = "attempts" + 1
        WHERE id = (
          SELECT id FROM "QueueJob"
          WHERE queue = ${queue} AND status = 'PENDING' AND "runAt" <= now()
          ORDER BY "runAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING id, payload, attempts`;
      const job = claimed[0];
      if (!job) continue;

      try {
        await handler((job.payload ?? {}) as Record<string, unknown>, { id: job.id, attempt: job.attempts });
        await this.prisma.queueJob.update({ where: { id: job.id }, data: { status: "DONE" } });
      } catch (err) {
        // ASCII-sanitize: error text may contain characters outside the
        // database client encoding on Windows.
        const message = (err instanceof Error ? err.message : String(err)).replace(/[^\x20-\x7E]/g, "?");
        const row = await this.prisma.queueJob.findUnique({ where: { id: job.id } });
        const exhausted = (row?.attempts ?? 1) >= (row?.maxAttempts ?? 5);
        await this.prisma.queueJob.update({
          where: { id: job.id },
          data: {
            status: exhausted ? "FAILED" : "PENDING",
            lastError: message.slice(0, 500),
            runAt: new Date(Date.now() + Math.min(60_000, 2 ** (row?.attempts ?? 1) * 1000)),
          },
        });
        if (exhausted) this.logger.error(`job ${job.id} on ${queue} failed permanently: ${message}`);
      }
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
