import { BadRequestException, Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import type { AccessContext } from "../auth/auth.service";

const ListQuerySchema = z.object({
  unreadOnly: z.enum(["true", "false"]).optional(),
  category: z.string().trim().max(30).optional(),
});

/** Resident notification inbox (SSE pushes land here durably). */
@Controller()
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("me/notifications")
  async list(
    @CurrentUser() auth: AccessContext,
    @Query(new ZodValidationPipe(ListQuerySchema)) q: unknown,
  ) {
    const query = q as { unreadOnly?: string; category?: string };
    const where = {
      recipientUserId: auth.userId,
      communityId: auth.communityId ?? undefined,
      ...(query.unreadOnly === "true" ? { readAt: null } : {}),
      ...(query.category ? { category: query.category } : {}),
    };
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { items, unreadCount };
  }

  @Post("me/notifications/:notificationId/read")
  async markRead(@CurrentUser() auth: AccessContext, @Param("notificationId") notificationId: string) {
    const row = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!row || row.recipientUserId !== auth.userId) throw new BadRequestException("Not your notification.");
    await this.prisma.notification.update({ where: { id: row.id }, data: { readAt: new Date() } });
    return { ok: true };
  }
}
