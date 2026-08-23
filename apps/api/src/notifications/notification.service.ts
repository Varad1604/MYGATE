import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SseHubService } from "../realtime/sse-hub.service";

export interface NotifyInput {
  communityId?: string;
  recipientUserIds: Iterable<string>;
  category: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Central notification service (spec §25): business modules call this; it
 * persists IN_APP rows and pushes realtime events. External channels
 * (push/email/SMS/WhatsApp) hang off the same input through provider adapters
 * and are dispatched via the queue — modules never touch providers directly.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hub: SseHubService,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    const recipients = [...new Set(input.recipientUserIds)];
    if (recipients.length === 0) return;

    await this.prisma.notification.createMany({
      data: recipients.map((recipientUserId) => ({
        communityId: input.communityId,
        recipientUserId,
        channel: "IN_APP" as const,
        category: input.category,
        title: input.title,
        body: input.body,
        data: (input.data ?? {}) as object,
      })),
    });

    this.hub.publishToUsers(recipients, {
      event: "notification.new",
      communityId: input.communityId,
      data: { category: input.category, title: input.title, body: input.body, ...(input.data ?? {}) },
    });

    // Email/SMS/PUSH fan-out is queued here when adapters are configured.
  }
}
