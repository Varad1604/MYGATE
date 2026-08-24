import { Controller, Get, Param, Query } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { RequirePermissions } from "../auth/permissions.guard";

const ListQuery = z.object({
  action: z.string().trim().max(60).optional(),
  entityType: z.string().trim().max(40).optional(),
  actorUserId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

/**
 * Read-only audit access for managers/auditors. The trail itself is
 * append-only (no update/delete endpoints exist anywhere by design).
 */
@Controller()
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("communities/:communityId/audit")
  @RequirePermissions("audit.view")
  async list(
    @Param("communityId") communityId: string,
    @Query(new ZodValidationPipe(ListQuery)) query: unknown,
  ) {
    const q = query as {
      action?: string; entityType?: string; actorUserId?: string; page: number; pageSize: number;
    };
    const where = {
      communityId,
      ...(q.action ? { action: { contains: q.action } } : {}),
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.actorUserId ? { actorUserId: q.actorUserId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return { items, total };
  }
}
