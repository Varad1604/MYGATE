import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Prisma, Ticket, TicketStatus } from "@prisma/client";
import { TICKET_TRANSITIONS } from "@societyos/types";
import { PrismaService } from "../../prisma/prisma.service";
import { Errors } from "../../common/app-exception";
import { AuditService } from "../../audit/audit.service";
import { SseHubService } from "../../realtime/sse-hub.service";

function assertTicketTransition(from: TicketStatus, to: TicketStatus) {
  if (!(TICKET_TRANSITIONS[from] ?? []).includes(to)) {
    throw new BadRequestException(`Cannot move ticket from ${from} to ${to}.`);
  }
}

@Injectable()
export class HelpdeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly hub: SseHubService,
  ) {}

  /** Society managers + admins of the community — staff notification audience. */
  private async staffUserIds(communityId: string): Promise<string[]> {
    const rows = await this.prisma.communityMembership.findMany({
      where: {
        communityId,
        isActive: true,
        roles: { some: { role: { key: { in: ["SECURITY_MANAGER", "COMMUNITY_ADMIN"] } } } },
      },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  /** Active categories with their SLA expectations (for the raise-ticket form). */
  async listCategories(communityId: string) {
    return this.prisma.ticketCategory.findMany({
      where: { communityId, isActive: true },
      select: {
        id: true, name: true, departmentLabel: true,
        slaFirstResponseMins: true, slaResolutionMins: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async create(communityId: string, userId: string, dto: {
    categoryId: string; unitId?: string; locationText?: string; title: string;
    description: string; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; clientEventId?: string;
  }): Promise<Ticket> {
    // Offline dedupe.
    if (dto.clientEventId) {
      const dupe = await this.prisma.ticket.findFirst({ where: { clientEventId: dto.clientEventId } });
      if (dupe) return dupe;
    }

    const category = await this.prisma.ticketCategory.findFirst({
      where: { id: dto.categoryId, communityId, isActive: true },
    });
    if (!category) throw Errors.notFound("Category");

    if (dto.unitId) {
      const unit = await this.prisma.unit.findFirst({
        where: { id: dto.unitId, communityId, deletedAt: null },
      });
      if (!unit) throw Errors.notFound("Unit");
      // Residents may only raise for their own units.
      const isStaff = await this.prisma.communityMembership.findFirst({
        where: {
          userId, communityId, isActive: true,
          roles: { some: { role: { key: { in: ["SECURITY_MANAGER", "COMMUNITY_ADMIN"] } } } },
        },
      });
      if (!isStaff) {
        const occupies = await this.prisma.unitOccupancy.findFirst({
          where: { unitId: dto.unitId, userId, effectiveTo: null },
        });
        if (!occupies) throw new ForbiddenException("You can only raise tickets for your own unit.");
      }
    }

    const now = Date.now();
    const reference = `TKT-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;

    const ticket = await this.prisma.ticket.create({
      data: {
        communityId,
        reference,
        categoryId: dto.categoryId,
        unitId: dto.unitId,
        locationText: dto.locationText,
        raisedById: userId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        slaFirstResponseDueAt: category.slaFirstResponseMins
          ? new Date(now + category.slaFirstResponseMins * 60_000)
          : null,
        slaResolutionDueAt: category.slaResolutionMins
          ? new Date(now + category.slaResolutionMins * 60_000)
          : null,
        clientEventId: dto.clientEventId,
        history: {
          create: { actorId: userId, action: "created", meta: { title: dto.title } },
        },
      },
    });

    const staff = await this.staffUserIds(communityId);
    this.hub.publishToUsers(staff, {
      event: "ticket.created",
      communityId,
      data: { ticketId: ticket.id, reference, title: ticket.title, priority: ticket.priority },
    });
    return ticket;
  }

  async list(communityId: string, q: {
    status?: string; priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; categoryId?: string;
    mine?: boolean; raisedByMe?: boolean; breachedOnly?: boolean; skip: number; take: number;
  }, viewerUserId: string) {
    const where: Prisma.TicketWhereInput = {
      communityId,
      ...(q.status ? { status: { equals: q.status as TicketStatus } } : {}),
      ...(q.priority ? { priority: { equals: q.priority } } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.mine ? { assignedToUserId: viewerUserId } : {}),
      ...(q.raisedByMe ? { raisedById: viewerUserId } : {}),
      ...(q.breachedOnly
        ? { OR: [
            { firstResponseAt: null, slaFirstResponseDueAt: { lt: new Date() } },
            { resolvedAt: null, slaResolutionDueAt: { lt: new Date() } },
          ] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: {
          category: { select: { name: true } },
          unit: { select: { label: true } },
          raisedBy: { select: { fullName: true } },
          assignedTo: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: q.skip,
        take: q.take,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items, total };
  }

  async get(communityId: string, ticketId: string, viewerPermissions: string[], viewerUserId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, communityId },
      include: {
        category: { select: { name: true, departmentLabel: true } },
        unit: { select: { label: true, tower: { select: { code: true } } } },
        raisedBy: { select: { fullName: true } },
        assignedTo: { select: { fullName: true } },
        comments: { orderBy: { createdAt: "asc" } },
        history: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!ticket) throw Errors.notFound("Ticket");
    // Residents see only their own tickets unless they have read permission.
    if (!viewerPermissions.includes("helpdesk.read") && ticket.raisedById !== viewerUserId) {
      throw Errors.notFound("Ticket");
    }
    // Internal comments are staff-only.
    if (!viewerPermissions.includes("helpdesk.read")) {
      return { ...ticket, comments: ticket.comments.filter((c) => !c.isInternal) };
    }
    return ticket;
  }

  async comment(communityId: string, userId: string, permissions: string[], ticketId: string, body: string, isInternal: boolean) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, communityId } });
    if (!ticket) throw Errors.notFound("Ticket");
    const isStaff = permissions.includes("helpdesk.read");
    const isOwner = ticket.raisedById === userId;
    if (!isStaff && !isOwner) throw Errors.notFound("Ticket");
    if (isInternal && !isStaff) throw new ForbiddenException("Internal notes are staff-only.");

    const isFirstStaffResponse = isStaff && !isOwner && ticket.firstResponseAt === null;

    const [comment] = await this.prisma.$transaction([
      this.prisma.ticketComment.create({
        data: { ticketId: ticket.id, authorId: userId, body, isInternal },
      }),
      ...(isFirstStaffResponse
        ? [this.prisma.ticket.update({ where: { id: ticket.id }, data: { firstResponseAt: new Date() } })]
        : []),
    ]);
    void comment;

    // Notify the other party.
    const audience = isStaff ? [ticket.raisedById] : await this.staffUserIds(communityId);
    this.hub.publishToUsers(audience.filter((u) => u !== userId), {
      event: "ticket.commented",
      communityId,
      data: { ticketId: ticket.id, reference: ticket.reference, by: isStaff ? "staff" : "resident" },
    });
    return { ok: true };
  }

  async assign(communityId: string, userId: string, ticketId: string, assigneeUserId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, communityId } });
    if (!ticket) throw Errors.notFound("Ticket");
    const nextStatus: TicketStatus = ticket.status === "OPEN" ? "ASSIGNED" : ticket.status;
    assertTicketTransition(ticket.status, nextStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      const t = await tx.ticket.update({
        where: { id: ticket.id },
        data: { assignedToUserId: assigneeUserId, status: nextStatus },
      });
      await tx.ticketHistory.create({
        data: {
          ticketId: t.id, actorId: userId, action: "assigned",
          fromStatus: ticket.status, toStatus: nextStatus,
          meta: { assigneeUserId },
        },
      });
      return t;
    });

    this.hub.publishToUsers([assigneeUserId], {
      event: "ticket.assigned",
      communityId,
      data: { ticketId: updated.id, reference: updated.reference },
    });
    return updated;
  }

  async changeStatus(communityId: string, userId: string, permissions: string[], ticketId: string, next: TicketStatus, note?: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, communityId } });
    if (!ticket) throw Errors.notFound("Ticket");
    const isStaff = permissions.includes("helpdesk.resolve") || permissions.includes("helpdesk.assign");
    // The technician currently holding the assignment can always progress it.
    const isAssignee = ticket.assignedToUserId === userId;
    const isOwner = ticket.raisedById === userId;

    // Residents may close/reopen their own tickets; staff may do everything.
    if (!isStaff && !isAssignee) {
      if (!isOwner) throw Errors.notFound("Ticket");
      if (!["CLOSED", "REOPENED"].includes(next)) {
        throw new ForbiddenException("Residents can only close or reopen their tickets.");
      }
    }
    assertTicketTransition(ticket.status, next);

    const now = new Date();
    const patch: Prisma.TicketUpdateInput = { status: next };
    if (next === "RESOLVED") patch.resolvedAt = now;
    if (next === "REOPENED") {
      patch.resolvedAt = null;
      patch.reopenedCount = { increment: 1 };
      // Restart resolution SLA on reopen.
      const cat = await this.prisma.ticketCategory.findUnique({ where: { id: ticket.categoryId } });
      if (cat?.slaResolutionMins) patch.slaResolutionDueAt = new Date(Date.now() + cat.slaResolutionMins * 60_000);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const t = await tx.ticket.update({ where: { id: ticket.id }, data: patch });
      await tx.ticketHistory.create({
        data: {
          ticketId: t.id, actorId: userId, action: `status:${next}`,
          fromStatus: ticket.status, toStatus: next, meta: note ? { note } : {},
        },
      });
      return t;
    });

    const audience = [...await this.staffUserIds(communityId), ticket.raisedById].filter((u) => u !== userId);
    this.hub.publishToUsers([...new Set(audience)], {
      event: "ticket.status_changed",
      communityId,
      data: { ticketId: updated.id, reference: updated.reference, status: next },
    });
    return updated;
  }

  async rate(communityId: string, userId: string, ticketId: string, rating: number, comment?: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, communityId } });
    if (!ticket) throw Errors.notFound("Ticket");
    if (ticket.raisedById !== userId) throw Errors.forbidden("Only the raiser can rate.");
    if (!["RESOLVED", "CLOSED"].includes(ticket.status)) {
      throw Errors.conflict("NOT_RESOLVED", "Rate after the ticket is resolved.");
    }
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { satisfactionRating: rating, ratingComment: comment },
    });
    return { ok: true };
  }

  /**
   * SLA sweep: flags breached tickets and fires escalation SSE events.
   * Runs on the queue every minute. Returns counts for observability.
   */
  async slaSweep(): Promise<{ responseBreached: number; resolutionBreached: number }> {
    const now = new Date();
    const responseBreached = await this.prisma.ticket.count({
      where: { status: { in: ["OPEN", "ASSIGNED"] }, firstResponseAt: null, slaFirstResponseDueAt: { lt: now } },
    });
    const resolutionBreached = await this.prisma.ticket.count({
      where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "REOPENED"] }, resolvedAt: null, slaResolutionDueAt: { lt: now } },
    });
    if (responseBreached > 0 || resolutionBreached > 0) {
      const communities = await this.prisma.ticket.findMany({
        where: {
          OR: [
            { status: { in: ["OPEN", "ASSIGNED"] }, firstResponseAt: null, slaFirstResponseDueAt: { lt: now } },
            { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "REOPENED"] }, resolvedAt: null, slaResolutionDueAt: { lt: now } },
          ],
        },
        select: { communityId: true, id: true, reference: true, title: true },
        take: 50,
      });
      const byCommunity = new Map<string, typeof communities>();
      for (const t of communities) {
        byCommunity.set(t.communityId, [...(byCommunity.get(t.communityId) ?? []), t]);
      }
      for (const [cid, tickets] of byCommunity) {
        this.hub.publishToUsers(await this.staffUserIds(cid), {
          event: "ticket.sla_breached",
          communityId: cid,
          data: { count: tickets.length, tickets: tickets.map((t) => ({ id: t.id, reference: t.reference })) },
        });
      }
    }
    return { responseBreached, resolutionBreached };
  }
}
