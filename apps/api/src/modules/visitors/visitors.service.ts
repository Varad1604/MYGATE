import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { VisitorInvitation, Prisma } from "@prisma/client";
import { normalizePhone } from "@societyos/types";
import { PrismaService } from "../../prisma/prisma.service";
import { Errors } from "../../common/app-exception";
import { AuditService } from "../../audit/audit.service";
import { SseHubService } from "../../realtime/sse-hub.service";
import { getEnv } from "../../config/env";
import { VisitorTokensService, assertTransition } from "./visitor-tokens.service";

/** Roles that receive realtime gate events. */
export const GATE_AUDIENCE_ROLE_KEYS = ["SECURITY_MANAGER", "COMMUNITY_ADMIN", "GUARD"];

export interface ResidentActor {
  userId: string;
  permissions: string[];
}

/**
 * Invitation lifecycle: pre-approvals (resident), spot approvals (guard→resident),
 * decisions, expiry and the visit log queries.
 */
@Injectable()
export class VisitorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: VisitorTokensService,
    private readonly audit: AuditService,
    private readonly hub: SseHubService,
  ) {}

  approvalTimeoutSeconds(communityId: string): Promise<number> {
    return this.prisma.community
      .findUniqueOrThrow({ where: { id: communityId }, select: { settings: true } })
      .then((c) => {
        const s = (c.settings ?? {}) as { visitorApprovalTimeoutSeconds?: number };
        return s.visitorApprovalTimeoutSeconds ?? getEnv().DEFAULT_VISITOR_APPROVAL_TIMEOUT_SECONDS;
      });
  }

  /** Users currently occupying a unit — the approval audience. */
  async occupantUserIds(unitId: string): Promise<string[]> {
    const rows = await this.prisma.unitOccupancy.findMany({
      where: { unitId, effectiveTo: null },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  /** Guards/admins of a community — realtime gate event audience. */
  async gateAudienceUserIds(communityId: string): Promise<string[]> {
    const memberships = await this.prisma.communityMembership.findMany({
      where: {
        communityId,
        isActive: true,
        roles: { some: { role: { key: { in: GATE_AUDIENCE_ROLE_KEYS } } } },
      },
      select: { userId: true },
    });
    return memberships.map((m) => m.userId);
  }

  // ── Resident: pre-approve ──────────────────────────────────────────────────

  async createInvitation(communityId: string, actor: ResidentActor, dto: {
    unitId: string;
    visitorName: string;
    visitorPhone: string;
    visitorType: string;
    expectedAt?: Date;
    vehicleNumber?: string;
    deliveryPreference?: string;
    notes?: string;
  }) {
    // Ownership check: resident must occupy the destination unit now.
    if (!actor.permissions.includes("resident.write")) {
      const occupies = await this.prisma.unitOccupancy.findFirst({
        where: { unitId: dto.unitId, userId: actor.userId, effectiveTo: null },
      });
      if (!occupies) throw Errors.forbidden("You can only invite visitors to your own unit.", "NOT_YOUR_UNIT");
    }
    const unit = await this.prisma.unit.findFirst({
      where: { id: dto.unitId, communityId, deletedAt: null },
    });
    if (!unit) throw Errors.notFound("Unit");

    const { token, tokenHash } = this.tokens.newInvitationToken();
    const { otp, otpHash } = this.tokens.newOtp();

    const invitation = await this.prisma.visitorInvitation.create({
      data: {
        communityId,
        unitId: dto.unitId,
        invitedByUserId: actor.userId,
        visitorName: dto.visitorName,
        visitorPhone: normalizePhone(dto.visitorPhone),
        visitorType: dto.visitorType as never,
        expectedAt: dto.expectedAt ?? new Date(Date.now() + 6 * 3600_000),
        expiresAt: new Date(Date.now() + 24 * 3600_000), // invitation valid 24h
        vehicleNumber: dto.vehicleNumber?.toUpperCase(),
        deliveryPreference: (dto.deliveryPreference as never) ?? undefined,
        notes: dto.notes,
        tokenHash,
        otpCodeHash: otpHash,
        status: "APPROVED",
        approvalMethod: "PRE_APPROVED_TOKEN",
        approvedByUserId: actor.userId,
        approvedAt: new Date(),
      },
    });

    await this.audit.record({
      action: "visitor.pre_approved",
      entityType: "visitor_invitation",
      entityId: invitation.id,
      communityId,
      actorUserId: actor.userId,
      after: { visitorName: dto.visitorName, unit: unit.label },
    });

    // Raw secrets are returned exactly once — shown as QR/OTP to the resident.
    return { invitation, qrToken: token, otpCode: otp };
  }

  async listMyInvitations(communityId: string, userId: string) {
    const myUnits = await this.prisma.unitOccupancy.findMany({
      where: { userId, effectiveTo: null, unit: { communityId } },
      select: { unitId: true },
    });
    const unitIds = myUnits.map((u) => u.unitId);
    return this.prisma.visitorInvitation.findMany({
      where: { communityId, unitId: { in: unitIds }, createdAt: { gt: new Date(Date.now() - 7 * 86400_000) } },
      include: { unit: { select: { label: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async pendingApprovals(communityId: string, userId: string) {
    const myUnits = await this.prisma.unitOccupancy.findMany({
      where: { userId, effectiveTo: null, unit: { communityId } },
      select: { unitId: true },
    });
    return this.prisma.visitorInvitation.findMany({
      where: {
        communityId,
        unitId: { in: myUnits.map((u) => u.unitId) },
        status: "WAITING_APPROVAL",
      },
      include: { unit: { select: { label: true, tower: { select: { code: true } } } } },
      orderBy: { createdAt: "asc" },
    });
  }

  // ── Resident decision ─────────────────────────────────────────────────────

  async decide(communityId: string, userId: string, invitationId: string, decision: "APPROVED" | "REJECTED") {
    const invitation = await this.getCommunityInvitation(communityId, invitationId);
    const occupants = await this.occupantUserIds(invitation.unitId);
    if (!occupants.includes(userId)) {
      throw Errors.forbidden("Only this unit's residents can respond.", "NOT_YOUR_UNIT");
    }
    assertTransition(invitation.status, decision);

    const updated = await this.prisma.visitorInvitation.update({
      where: { id: invitation.id },
      data: {
        status: decision,
        approvedByUserId: decision === "APPROVED" ? userId : null,
        approvedAt: decision === "APPROVED" ? new Date() : null,
        approvalMethod: decision === "APPROVED" ? "RESIDENT_APPROVAL" : undefined,
        expiresAt: decision === "APPROVED" ? new Date(Date.now() + 4 * 3600_000) : invitation.expiresAt,
      },
    });

    this.hub.publishToUsers(await this.gateAudienceUserIds(communityId), {
      event: decision === "APPROVED" ? "visitor.approved" : "visitor.rejected",
      communityId,
      data: { invitationId, visitorName: invitation.visitorName, unitId: invitation.unitId, decidedBy: userId },
    });

    await this.audit.record({
      action: `visitor.${decision.toLowerCase()}`,
      entityType: "visitor_invitation",
      entityId: invitation.id,
      communityId,
      actorUserId: userId,
      before: { status: invitation.status },
      after: { status: decision },
    });
    void updated;
    return { ok: true, status: decision };
  }

  async getCommunityInvitation(communityId: string, invitationId: string): Promise<VisitorInvitation> {
    const inv = await this.prisma.visitorInvitation.findUnique({ where: { id: invitationId } });
    if (!inv || inv.communityId !== communityId) throw Errors.notFound("Invitation");
    return inv;
  }

  // ── Expiry sweeper (queue-driven) ─────────────────────────────────────────

  async expireSweep(): Promise<{ expiredWaiting: number; expiredApproved: number }> {
    const communities = await this.prisma.community.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { id: true, settings: true },
    });
    let expiredWaiting = 0;
    let expiredApproved = 0;

    for (const c of communities) {
      const timeoutSec =
        ((c.settings ?? {}) as { visitorApprovalTimeoutSeconds?: number }).visitorApprovalTimeoutSeconds ??
        getEnv().DEFAULT_VISITOR_APPROVAL_TIMEOUT_SECONDS;

      const staleWaiting = await this.prisma.visitorInvitation.updateMany({
        where: {
          communityId: c.id,
          status: "WAITING_APPROVAL",
          createdAt: { lt: new Date(Date.now() - timeoutSec * 1000) },
        },
        data: { status: "EXPIRED" },
      });
      expiredWaiting += staleWaiting.count;

      const staleApproved = await this.prisma.visitorInvitation.updateMany({
        where: {
          communityId: c.id,
          status: "APPROVED",
          approvalMethod: { not: "SECURITY_OVERRIDE" },
          expiresAt: { lt: new Date() },
        },
        data: { status: "EXPIRED" },
      });
      expiredApproved += staleApproved.count;
    }
    return { expiredWaiting, expiredApproved };
  }

  // ── Visit log listing (admin/security) ────────────────────────────────────

  async listVisits(communityId: string, q: {
    gateId?: string; visitorType?: string; towerId?: string; unitId?: string;
    status?: string; inside?: boolean; dateFrom?: Date; dateTo?: Date;
    skip: number; take: number;
  }) {
    const where: Prisma.VisitWhereInput = {
      communityId,
      ...(q.gateId ? { gateId: q.gateId } : {}),
      ...(q.visitorType ? { visitorType: q.visitorType as never } : {}),
      ...(q.towerId ? { unit: { towerId: q.towerId } } : {}),
      ...(q.unitId ? { unitId: q.unitId } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.inside !== undefined ? { checkedInAt: { not: null }, checkedOutAt: q.inside ? null : { not: null } } : {}),
      ...((q.dateFrom || q.dateTo)
        ? { createdAt: { gte: q.dateFrom, lte: q.dateTo ?? new Date(Date.now() + 86400_000) } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        include: {
          gate: { select: { name: true, code: true } },
          unit: { select: { label: true, tower: { select: { code: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: q.skip,
        take: q.take,
      }),
      this.prisma.visit.count({ where }),
    ]);
    return { items, total };
  }

  /** Minimal PII projection for guard screens (spec §6). */
  static toGuardView(inv: VisitorInvitation & { unit?: { label: string } | null }) {
    return {
      id: inv.id,
      visitorName: inv.visitorName,
      visitorType: inv.visitorType,
      vehicleNumber: inv.vehicleNumber,
      photoFileId: inv.photoFileId,
      status: inv.status,
      unitLabel: inv.unit?.label ?? null,
      expectedAt: inv.expectedAt,
      createdAt: inv.createdAt,
    };
  }
}

export function badRequest(msg: string): never {
  throw new BadRequestException(msg);
}

export function forbiddenMsg(msg: string): never {
  throw new ForbiddenException(msg);
}
