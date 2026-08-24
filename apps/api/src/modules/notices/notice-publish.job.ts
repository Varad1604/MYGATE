import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { IQueue } from "../../queue/queue.types";
import { NotificationService } from "../../notifications/notification.service";
import { NoticesService } from "./notices.service";

const QUEUE = "notices";

/**
 * Notice sweep (30s, in-process): publishes SCHEDULED notices whose
 * publishAt has arrived and expires notices past expiresAt. Per-notice
 * fanout still travels as a `notice.fanout` job on the queue.
 */
@Injectable()
export class NoticePublishJob implements OnModuleInit, OnModuleDestroy {
  private static readonly INTERVAL_MS = 30_000;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject("IQueue") private readonly queue: IQueue,
    private readonly notices: NoticesService,
    private readonly notify: NotificationService,
  ) {}

  onModuleInit(): void {
    this.queue.register(QUEUE, async (payload) => {
      if (payload.kind === "notice.fanout") {
        const noticeId = String(payload.noticeId ?? "");
        if (noticeId) {
          await this.notices.deliverFanout(noticeId, (input) => this.notify.notify(input));
        }
      }
    });
    const tick = async () => {
      try {
        await this.notices.scheduledPublishSweep();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[notice-sweep] publish sweep failed:", err instanceof Error ? err.message : err);
      }
      try {
        await this.notices.expireSweep();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[notice-sweep] expire failed:", err instanceof Error ? err.message : err);
      }
      this.timer = setTimeout(() => { void tick(); }, NoticePublishJob.INTERVAL_MS);
    };
    this.timer = setTimeout(() => { void tick(); }, 10_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
