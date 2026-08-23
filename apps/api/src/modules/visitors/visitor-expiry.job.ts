import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { VisitorsService } from "./visitors.service";
import type { IQueue } from "../../queue/queue.types";

const QUEUE = "visitors";
export const SWEEP_JOB = "expire-sweep";

/**
 * Self-rescheduling sweep job: expires WAITING_APPROVAL requests past the
 * community timeout and stale APPROVED invitations. Runs every 15s; the
 * dedupeKey prevents queue pile-up if a run takes longer than the interval.
 */
@Injectable()
export class VisitorExpiryJob implements OnModuleInit {
  constructor(
    @Inject("IQueue") private readonly queue: IQueue,
    private readonly visitors: VisitorsService,
  ) {}

  onModuleInit(): void {
    this.queue.register(QUEUE, async (_payload, meta) => {
      if (meta.attempt > 1) return; // never retry sweeps — next tick covers it
      await this.visitors.expireSweep();
      await this.queue.enqueue(QUEUE, {}, {
        runAt: new Date(Date.now() + 15_000),
        dedupeKey: `${SWEEP_JOB}`,
      });
    });
    // Seed the first tick (idempotent via dedupeKey).
    void this.queue.enqueue(QUEUE, {}, { runAt: new Date(Date.now() + 10_000), dedupeKey: SWEEP_JOB });
  }
}
