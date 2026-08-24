import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { HelpdeskService } from "./helpdesk.service";
import type { IQueue } from "../../queue/queue.types";

const QUEUE = "helpdesk";
const SWEEP = "sla-sweep";

/** Self-rescheduling SLA breach sweep — every 60s, deduped. */
@Injectable()
export class TicketSlaJob implements OnModuleInit {
  constructor(
    @Inject("IQueue") private readonly queue: IQueue,
    private readonly helpdesk: HelpdeskService,
  ) {}

  onModuleInit(): void {
    this.queue.register(QUEUE, async (_payload, meta) => {
      if (meta.attempt > 1) return; // sweeps never retry
      await this.helpdesk.slaSweep();
      await this.queue.enqueue(QUEUE, {}, { runAt: new Date(Date.now() + 60_000), dedupeKey: SWEEP });
    });
    void this.queue.enqueue(QUEUE, {}, { runAt: new Date(Date.now() + 30_000), dedupeKey: SWEEP });
  }
}
