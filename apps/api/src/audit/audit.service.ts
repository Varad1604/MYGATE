import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { getRequestContext } from "../common/request-context";

export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string;
  communityId?: string | null;
  actorUserId?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Append-only audit trail. High-risk actions MUST call this explicitly.
 * There is deliberately no update/delete path — see docs/SECURITY.md.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput): Promise<void> {
    const rctx = getRequestContext();
    try {
      await this.prisma.auditEvent.create({
        data: {
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          communityId: input.communityId ?? rctx?.communityId ?? null,
          actorUserId: input.actorUserId ?? rctx?.userId ?? null,
          before: input.before === undefined ? undefined : (input.before as object),
          after: input.after === undefined ? undefined : (input.after as object),
          ip: rctx?.ip,
          userAgent: rctx?.userAgent?.slice(0, 300),
          requestId: rctx?.requestId,
        },
      });
    } catch (err) {
      // Audit failure must not break the business operation, but must be loud.
      this.logger.error(`AUDIT WRITE FAILED for ${input.action}`, err as Error);
    }
  }
}
