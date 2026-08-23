import { Injectable } from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";
import type { VisitorInvitation, Visit } from "@prisma/client";
import { normalizePhone } from "@societyos/types";
import { PrismaService } from "../../prisma/prisma.service";
import { Errors } from "../../common/app-exception";
import { AuditService } from "../../audit/audit.service";
import { SseHubService } from "../../realtime/sse-hub.service";
import { NotificationService } from "../../notifications/notification.service";
import { assertTransition } from "./visitor-tokens.service";
import { VisitorsService } from "./visitors.service";
import { VisitorTokensService } from "./visitor-tokens.service";

/**
 * Guard-facing gate operations. Guards never receive resident phone numbers;
 * all projections go through VisitorsService.toGuardView.
 */
@Injectable()
export class GateOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: VisitorTokensService,
    private readonly visitors: VisitorsService,
    private readonly audit: AuditService,
    private readonly hub: SseHubService,
    private readonly notifications: NotificationService,
  ) {}

  /** Unexpected visitor at the gate → approval request to the unit's residents. */
  async spotRequest(communityId: string, guardUserId: string, dto: {
    unitId: string; gateId: string; visitorName: string; visitorPhone?: string;
    visitorType: string; vehicleNumber?: string; photoDataUrl?: string; remarks?: string;
  }) {
    const unit = await this.prisma.unit.findFirst({
      where: { id: dto.unitId, communityId, deletedAt: null },
      include: { tower: { select: { code: true } } },
    });
    if (!unit) throw Errors.notFound("Unit");
    const gate = await this.prisma.gate.findFirst({ where: { id: dto.gateId, communityId, isActive: true } });
    if (!gate) throw Errors.notFound("Gate");

    const timeoutSec = await this.visitors.approvalTimeoutSeconds(communityId);

    const invitation = await this.prisma.visitorInvitation.create({
      data: {
        communityId,
        unitId: dto.unitId,
        invitedByUserId: guardUserId,
        visitorName: dto.visitorName,
        visitorPhone: dto.visitorPhone ? normalizePhone(dto.visitorPhone) : null,
        visitorType: dto.visitorType as never,
        vehicleNumber: dto.vehicleNumber?.toUpperCase(),
        status: "WAITING_APPROVAL",
        notes: dto.remarks,
      },
      include: { unit: { select: { label: true } } },
    });

    // Realtime push to the residents of the destination unit.
    const occupants = await this.visitors.occupantUserIds(dto.unitId);
    this.hub.publishToUsers(occupants, {
      event: "visitor.approval_requested",
      communityId,
      data: {
        invitationId: invitation.id,
        visitorName: dto.visitorName,
        visitorType: dto.visitorType,
        vehicleNumber: dto.vehicleNumber ?? null,
        unitLabel: unit.label,
        towerCode: unit.tower.code,
        gateName: gate.name,
        photoFileId: null as string | null,
        expiresInSeconds: timeoutSec,
      },
    });

    await this.audit.record({
      action: "visitor.spot_requested",
      entityType: "visitor_invitation",
      entityId: invitation.id,
      communityId,
      actorUserId: guardUserId,
      after: { unitId: dto.unitId, gateId: dto.gateId, visitorType: dto.visitorType },
    });

    return {
      invitation: VisitorsService.toGuardView(invitation),
      expiresInSeconds: timeoutSec,
    };
  }

  /** Resident approves/rejects via SSE-driven decision (see VisitorsService.decide). */

  async checkIn(communityId: string, guardUserId: string, input: {
    invitationId?: string; token?: string; otp?: string; clientEventId?: string; vehicleNumber?: string;
  }): Promise<{ visit: Visit; invitation: VisitorInvitation }> {
    // Offline-sync idempotency: same clientEventId returns the original visit.
    if (input.clientEventId) {
      const existing = await this.prisma.visit.findUnique({
        where: { clientEventId: input.clientEventId },
        include: { gate: true, unit: true },
      });
      if (existing) {
        const inv = await this.prisma.visitorInvitation.findUnique({ where: { id: existing.invitationId ?? "" } });
        return { visit: existing, invitation: inv! };
      }
    }

    const inv = await this.tokens.resolveApprovedCredential({ communityId, ...input });
    if (!inv) throw Errors.notFound("Visitor credential");
    if (!["APPROVED", "OVERRIDDEN"].includes(inv.status)) {
      throw Errors.conflict(
        "VISITOR_NOT_APPROVED",
        `Visitor is ${inv.status.toLowerCase().replace(/_/g, " ")} and cannot be checked in.`,
      );
    }

    const gate = await this.prisma.gate.findFirst({
      where: { communityId, isActive: true },
      orderBy: { code: "asc" },
    });
    if (!gate) throw Errors.conflict("NO_ACTIVE_GATE", "No active gate is configured for this device.");

    assertTransition(inv.status, "CHECKED_IN");

    const visit = await this.prisma.$transaction(async (tx) => {
      await tx.visitorInvitation.update({ where: { id: inv.id }, data: { status: "CHECKED_IN" } });
      return tx.visit.create({
        data: {
          communityId,
          invitationId: inv.id,
          gateId: gate.id,
          unitId: inv.unitId,
          visitorName: inv.visitorName,
          visitorPhoneMasked: mask(inv.visitorPhone),
          visitorType: inv.visitorType,
          photoFileId: inv.photoFileId,
          vehicleNumber: input.vehicleNumber?.toUpperCase() ?? inv.vehicleNumber,
          requestedByUserId: inv.invitedByUserId,
          approvedByUserId: inv.approvedByUserId,
          approvalMethod: inv.approvalMethod,
          approvalAt: inv.approvedAt,
          checkedInAt: new Date(),
          checkedInByGuardId: guardUserId,
          status: "CHECKED_IN",
          clientEventId: input.clientEventId,
        },
        include: { gate: true, unit: true },
      });
    });

    // Notify residents that their guest entered.
    const occupants = await this.visitors.occupantUserIds(inv.unitId);
    await this.notifications.notify({
      communityId,
      recipientUserIds: occupants.filter((u) => u !== guardUserId),
      category: "visitor",
      title: "Visitor entered",
      body: `${inv.visitorName} checked in at ${gate.name}.`,
      data: { visitId: visit.id },
    });
    this.hub.publishToUsers(await this.visitors.gateAudienceUserIds(communityId), {
      event: "visitor.checked_in",
      communityId,
      data: { visitId: visit.id, visitorName: inv.visitorName },
    });

    return { visit, invitation: inv };
  }

  async checkOut(communityId: string, guardUserId: string, visitId: string, clientEventId?: string) {
    const visit = await this.prisma.visit.findFirst({
      where: clientEventId ? { clientEventId } : { id: visitId, communityId },
    });
    if (!visit || visit.communityId !== communityId) throw Errors.notFound("Visit");
    if (visit.status === "CHECKED_OUT") return { ok: true, alreadyOut: true };
    assertTransition(visit.status, "CHECKED_OUT");

    const updated = await this.prisma.visit.update({
      where: { id: visit.id },
      data: {
        status: "CHECKED_OUT",
        checkedOutAt: new Date(),
        checkedOutByGuardId: guardUserId,
      },
    });
    if (visit.invitationId) {
      await this.prisma.visitorInvitation.updateMany({
        where: { id: visit.invitationId, status: "CHECKED_IN" },
        data: { status: "CHECKED_OUT" },
      });
    }

    this.hub.publishToUsers(await this.visitors.gateAudienceUserIds(communityId), {
      event: "visitor.checked_out",
      communityId,
      data: { visitId: updated.id, visitorName: updated.visitorName },
    });
    return { ok: true, alreadyOut: false };
  }

  /** Security-manager override — requires reason, always audited (spec §10). */
  async override(communityId: string, managerUserId: string, invitationId: string, reason: string) {
    const inv = await this.visitors.getCommunityInvitation(communityId, invitationId);
    if (inv.status === "REJECTED") {
      throw Errors.conflict(
        "REJECTION_NOT_OVERRIDABLE",
        "An explicit resident rejection cannot be overridden.",
      );
    }
    assertTransition(inv.status, "OVERRIDDEN");

    await this.prisma.visitorInvitation.update({
      where: { id: inv.id },
      data: {
        status: "OVERRIDDEN",
        approvalMethod: "SECURITY_OVERRIDE",
        approvedByUserId: managerUserId,
        approvedAt: new Date(),
      },
    });
    await this.audit.record({
      action: "visitor.security_override",
      entityType: "visitor_invitation",
      entityId: inv.id,
      communityId,
      actorUserId: managerUserId,
      before: { status: inv.status },
      after: { status: "OVERRIDDEN", reason },
    });

    this.hub.publishToUsers(await this.visitors.gateAudienceUserIds(communityId), {
      event: "visitor.approved",
      communityId,
      data: { invitationId: inv.id, visitorName: inv.visitorName, overridden: true },
    });
    return { ok: true, status: "OVERRIDDEN" };
  }

  /** Leave-at-gate parcel hold with a pickup secret handed to the resident. */
  async holdParcel(communityId: string, guardUserId: string, invitationId: string, dto: {
    courierName?: string; description?: string;
  }) {
    const inv = await this.visitors.getCommunityInvitation(communityId, invitationId);
    if (inv.deliveryPreference && inv.deliveryPreference !== "LEAVE_AT_GATE") {
      throw Errors.conflict("DELIVERY_NOT_LEAVE_AT_GATE", "Resident did not choose leave-at-gate.");
    }
    const pickupToken = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
    const pickupTokenHash = createHash("sha256").update(pickupToken).digest("hex");

    const parcel = await this.prisma.parcel.create({
      data: {
        communityId,
        invitationId: inv.id,
        unitId: inv.unitId,
        recipientName: inv.visitorName === "Parcel" ? "Unit resident" : inv.visitorName,
        courierName: dto.courierName,
        description: dto.description,
        pickupTokenHash,
      },
    });

    const occupants = await this.visitors.occupantUserIds(inv.unitId);
    await this.notifications.notify({
      communityId,
      recipientUserIds: occupants,
      category: "parcel",
      title: "Parcel held at gate",
      body: `Pickup code: ${pickupToken}`,
      data: { parcelId: parcel.id },
    });
    return { parcelId: parcel.id, heldAt: parcel.heldAt };
  }

  async collectParcel(communityId: string, userId: string, parcelId: string, pickupToken: string) {
    const hash = createHash("sha256").update(pickupToken).digest("hex");
    const parcel = await this.prisma.parcel.findFirst({
      where: { id: parcelId, communityId, pickupTokenHash: hash },
    });
    if (!parcel) throw Errors.notFound("Parcel or code");
    if (parcel.status === "COLLECTED") throw Errors.conflict("PARCEL_ALREADY_COLLECTED", "Already collected.");
    await this.prisma.parcel.update({
      where: { id: parcel.id },
      data: { status: "COLLECTED", collectedAt: new Date(), collectedByUserId: userId },
    });
    return { ok: true };
  }

  /** Currently inside + recent activity for the guard home screen. */
  async guardHome(communityId: string) {
    const [inside, recent] = await Promise.all([
      this.prisma.visit.count({ where: { communityId, checkedInAt: { not: null }, checkedOutAt: null } }),
      this.prisma.visit.findMany({
        where: { communityId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          gate: { select: { name: true } },
          unit: { select: { label: true } },
        },
      }),
    ]);
    const waiting = await this.prisma.visitorInvitation.count({
      where: { communityId, status: "WAITING_APPROVAL" },
    });
    return { currentlyInside: inside, waitingApprovals: waiting, recent };
  }
}

function mask(phone: string | null): string | null {
  if (!phone) return null;
  return `${phone.slice(0, 3)}****${phone.slice(-2)}`;
}
