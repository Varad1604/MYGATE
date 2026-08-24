import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { VisitorsService } from "./visitors.service";
import type { IQueue } from "../../queue/queue.types";

const QUEUE = "visitors";

/**
 * Visitor expiry sweep — periodic, in-process (15s). Queue-based
 * self-rescheduling proved fragile: the next tick enqueued while its own
 * row was PROCESSING no-ops on dedupe, silently killing the chain.
 */
@Injectable()
export class VisitorExpiryJob implements OnModuleInit, OnModuleDestroy {
  private static readonly INTERVAL_MS = 15_000;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject("IQueue") private readonly queue: IQueue,
    private readonly visitors: VisitorsService,
  ) {}

  onModuleInit(): void {
    this.queue.register(QUEUE, async () => {
      await this.visitors.expireSweep();
    });
    const tick = async () => {
      try {
        await this.visitors.expireSweep();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[visitor-expiry] failed:", err instanceof Error ? err.message : err);
      }
      this.timer = setTimeout(() => { void tick(); }, VisitorExpiryJob.INTERVAL_MS);
    };
    this.timer = setTimeout(() => { void tick(); }, 8_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
