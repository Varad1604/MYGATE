import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { HelpdeskService } from "./helpdesk.service";
import type { IQueue } from "../../queue/queue.types";

const QUEUE = "helpdesk";

/**
 * SLA breach sweep — periodic, in-process. Runs every 60s regardless of
 * queue-row state (a queue-based self-reschedule silently dies when the
 * next tick is enqueued while its own row is still PROCESSING).
 */
@Injectable()
export class TicketSlaJob implements OnModuleInit, OnModuleDestroy {
  private static readonly INTERVAL_MS = 60_000;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject("IQueue") private readonly queue: IQueue,
    private readonly helpdesk: HelpdeskService,
  ) {}

  onModuleInit(): void {
    // Queue stays available for one-shot jobs on this queue.
    this.queue.register(QUEUE, async () => {
      await this.helpdesk.slaSweep();
    });
    const tick = async () => {
      try {
        await this.helpdesk.slaSweep();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[sla-sweep] failed:", err instanceof Error ? err.message : err);
      }
      this.timer = setTimeout(() => { void tick(); }, TicketSlaJob.INTERVAL_MS);
    };
    this.timer = setTimeout(() => { void tick(); }, 30_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
