import { BadRequestException, Injectable } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Errors } from "../../common/app-exception";
import { AuditService } from "../../audit/audit.service";
import type { IQueue } from "../../queue/queue.types";
import type { Notice } from "@prisma/client";

@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject("IQueue") private readonly queue: IQueue,
  ) {}

  async create(communityId: string, userId: string, dto: {
    title: string; body: string; type: string; audience: string; audienceTarget: Record<string, unknown>;
    requireAcknowledgement: boolean; publishAt: Date; expiresAt?: Date;
  }): Promise<Notice> {
    const status = dto.publishAt.getTime() <= Date.now() ? "PUBLISHED" : "SCHEDULED";
    const notice = await this.prisma.notice.create({
      data: {
        communityId,
        title: dto.title,
        body: dto.body,
        type: dto.type as never,
        audience: dto.audience as never,
        audienceTarget: (dto.audienceTarget ?? {}) as object,
        requireAcknowledgement: dto.requireAcknowledgement,
        publishAt: dto.publishAt,
        expiresAt: dto.expiresAt,
        status: status as never,
        publishedById: userId,
      },
    });
    await this.audit.record({
      action: "notice.created", entityType: "notice", entityId: notice.id,
      communityId, actorUserId: userId, after: { title: dto.title, audience: dto.audience },
    });
    if (status === "PUBLISHED") await this.fanOut(notice);
    return notice;
  }

  /**
   * Resolves the recipient user IDs for a notice based on its audience rule.
   * Membership-scoped: only ACTIVE community members receive notices.
   */
  private async resolveAudience(communityId: string, audience: string, target: Record<string, unknown>): Promise<string[]> {
    const memberWhere = { communityId, isActive: true } as const;
    const base = { memberships: { some: memberWhere } };

    if (audience === "ALL") {
      const users = await this.prisma.user.findMany({ where: base, select: { id: true } });
      return users.map((u) => u.id);
    }
    if (audience === "OWNERS" || audience === "TENANTS") {
      const roleKey = audience === "OWNERS" ? "RESIDENT_OWNER" : "RESIDENT_TENANT";
      const users = await this.prisma.user.findMany({
        where: {
          memberships: { some: { ...memberWhere, roles: { some: { role: { key: roleKey } } } } },
        },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    if (audience === "TOWER" || audience === "FLOOR" || audience === "UNIT") {
      const unitWhere: Record<string, unknown> = { communityId, deletedAt: null };
      if (audience === "TOWER" && target.towerId) unitWhere.towerId = target.towerId;
      if (audience === "FLOOR") {
        if (!target.towerId || target.floor === undefined) throw new BadRequestException("FLOOR needs towerId+floor.");
        unitWhere.towerId = target.towerId;
        // Unit -> Floor relation; level is the numeric floor.
        unitWhere.floor = { level: target.floor };
      }
      if (audience === "UNIT") {
        const ids = (target.unitIds as string[]) ?? [];
        if (!ids.length) throw new BadRequestException("UNIT needs unitIds.");
        unitWhere.id = { in: ids };
      }
      const occupants = await this.prisma.unitOccupancy.findMany({
        where: { effectiveTo: null, unit: unitWhere },
        select: { userId: true },
      });
      // Keep only active members.
      const ids = [...new Set(occupants.map((o) => o.userId))];
      const members = await this.prisma.communityMembership.findMany({
        where: { ...memberWhere, userId: { in: ids } },
        select: { userId: true },
      });
      return members.map((m) => m.userId);
    }
    if (audience === "CUSTOM_GROUP") {
      return ((target.userIds as string[]) ?? []).filter(Boolean);
    }
    return [];
  }

  /** Persists fanout job for a published notice (worker delivers notifications). */
  async fanOut(notice: Notice): Promise<void> {
    await this.queue.enqueue("notices", { kind: "notice.fanout", noticeId: notice.id }, {
      dedupeKey: `notice-fanout:${notice.id}`,
    });
  }

  /** Called by the worker to deliver notifications for one notice. */
  async deliverFanout(noticeId: string, notify: (input: {
    communityId?: string; recipientUserIds: Iterable<string>; category: string; title: string; body: string;
    data?: Record<string, unknown>;
  }) => Promise<void>): Promise<void> {
    const notice = await this.prisma.notice.findUnique({ where: { id: noticeId } });
    if (!notice || notice.status !== "PUBLISHED") return;
    const target = (notice.audienceTarget ?? {}) as Record<string, unknown>;
    const recipients = await this.resolveAudience(notice.communityId, notice.audience, target);
    await notify({
      communityId: notice.communityId,
      recipientUserIds: recipients,
      category: "notice",
      title: notice.title,
      body: notice.body.slice(0, 300),
      data: { noticeId: notice.id, requireAck: notice.requireAcknowledgement, type: notice.type },
    });
  }

  async publishNow(communityId: string, userId: string, noticeId: string) {
    const notice = await this.getCommunityNotice(communityId, noticeId);
    if (notice.status !== "SCHEDULED" && notice.status !== "DRAFT") {
      throw Errors.conflict("ALREADY_PUBLISHED", `Notice is ${notice.status}.`);
    }
    const updated = await this.prisma.notice.update({
      where: { id: notice.id },
      data: { status: "PUBLISHED", publishAt: new Date() },
    });
    await this.audit.record({
      action: "notice.published", entityType: "notice", entityId: notice.id,
      communityId, actorUserId: userId,
    });
    await this.fanOut(updated);
    return updated;
  }

  /** Resident feed: published, non-expired notices targeted at them. */
  async listForMe(communityId: string, userId: string) {
    const now = new Date();
    const notices = await this.prisma.notice.findMany({
      where: {
        communityId,
        status: "PUBLISHED",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { publishAt: "desc" },
      take: 50,
      include: {
        acknowledgements: { where: { userId }, select: { acknowledgedAt: true } },
      },
    });

    // Audience filtering in-app (small N; correctness over cleverness).
    const myUnits = await this.prisma.unitOccupancy.findMany({
      where: { userId, effectiveTo: null },
      select: { unit: { select: { id: true, towerId: true, floor: { select: { level: true } } } } },
    });
    const membership = await this.prisma.communityMembership.findFirst({
      where: { userId, communityId, isActive: true },
      select: { roles: { select: { role: { select: { key: true } } } } },
    });
    if (!membership) return [];
    const roleKeys = membership.roles.map((r) => r.role.key);

    return notices.filter((n) => {
      const t = (n.audienceTarget ?? {}) as Record<string, unknown>;
      switch (n.audience) {
        case "ALL": return true;
        case "OWNERS": return roleKeys.includes("RESIDENT_OWNER");
        case "TENANTS": return roleKeys.includes("RESIDENT_TENANT");
        case "TOWER": return myUnits.some((u) => u.unit.towerId === t.towerId);
        case "FLOOR": return myUnits.some((u) => u.unit.towerId === t.towerId && u.unit.floor.level === t.floor);
        case "UNIT": return myUnits.some((u) => ((t.unitIds as string[]) ?? []).includes(u.unit.id));
        case "CUSTOM_GROUP": return ((t.userIds as string[]) ?? []).includes(userId);
        default: return false;
      }
    }).map((n) => ({
      ...n,
      acknowledged: n.acknowledgements.length > 0,
      acknowledgements: undefined,
    }));
  }

  listAll(communityId: string) {
    return this.prisma.notice.findMany({
      where: { communityId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async ack(communityId: string, userId: string, noticeId: string) {
    const notice = await this.getCommunityNotice(communityId, noticeId);
    if (!notice.requireAcknowledgement) throw new BadRequestException("This notice needs no acknowledgement.");
    if (notice.status !== "PUBLISHED") throw Errors.conflict("NOT_PUBLISHED", "Notice is not live.");
    await this.prisma.noticeAcknowledgement.upsert({
      where: { noticeId_userId: { noticeId: notice.id, userId } },
      create: { noticeId: notice.id, userId },
      update: {},
    });
    return { ok: true };
  }

  private async getCommunityNotice(communityId: string, noticeId: string) {
    const notice = await this.prisma.notice.findFirst({ where: { id: noticeId, communityId } });
    if (!notice) throw Errors.notFound("Notice");
    return notice;
  }

  /** Expiry sweep â€” flips PUBLISHED notices past expiresAt to EXPIRED. */
  async expireSweep(): Promise<number> {
    const res = await this.prisma.notice.updateMany({
      where: { status: "PUBLISHED", expiresAt: { lte: new Date() } },
      data: { status: "EXPIRED" },
    });
    return res.count;
  }

  /** Publish sweep for SCHEDULED notices whose time has come. */
  async scheduledPublishSweep(): Promise<number> {
    const due = await this.prisma.notice.findMany({
      where: { status: "SCHEDULED", publishAt: { lte: new Date() } },
      take: 50,
    });
    let count = 0;
    for (const n of due) {
      await this.prisma.notice.update({ where: { id: n.id }, data: { status: "PUBLISHED" } });
      await this.fanOut(n);
      count++;
    }
    return count;
  }
}
