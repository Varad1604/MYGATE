import { Controller, Body, Get, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { VisitorsService } from "./visitors.service";
import { GateOpsService } from "./gate-ops.service";
import {
  ApprovalDecisionSchema,
  CheckInSchema,
  CheckOutSchema,
  CollectParcelSchema,
  CreateInvitationSchema,
  HoldParcelSchema,
  ListVisitsQuerySchema,
  OverrideSchema,
  SpotRequestSchema,
} from "./visitors.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUser } from "../../auth/current-user.decorator";
import { RequirePermissions } from "../../auth/permissions.guard";
import type { AccessContext } from "../../auth/auth.service";

const HoldParcelWithInvitation = HoldParcelSchema.extend({ invitationId: z.string().uuid() });

@Controller()
export class VisitorsController {
  constructor(
    private readonly visitors: VisitorsService,
    private readonly gate: GateOpsService,
  ) {}

  // ── Resident surface ───────────────────────────────────────────────────────

  @Post("communities/:communityId/visitors/invitations")
  @RequirePermissions("visitor.create")
  createInvitation(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Body(new ZodValidationPipe(CreateInvitationSchema)) dto: unknown,
  ) {
    return this.visitors.createInvitation(communityId, auth, dto as never);
  }

  @Get("me/visitors")
  myInvitations(@CurrentUser() auth: AccessContext) {
    return this.visitors.listMyInvitations(auth.communityId!, auth.userId);
  }

  @Get("me/visitors/pending")
  pending(@CurrentUser() auth: AccessContext) {
    return this.visitors.pendingApprovals(auth.communityId!, auth.userId);
  }

  @Post("me/visitors/:invitationId/approve")
  approve(
    @CurrentUser() auth: AccessContext,
    @Param("invitationId") invitationId: string,
    @Body(new ZodValidationPipe(ApprovalDecisionSchema)) _dto: unknown,
  ) {
    void _dto;
    return this.visitors.decide(auth.communityId!, auth.userId, invitationId, "APPROVED");
  }

  @Post("me/visitors/:invitationId/reject")
  reject(
    @CurrentUser() auth: AccessContext,
    @Param("invitationId") invitationId: string,
    @Body(new ZodValidationPipe(ApprovalDecisionSchema)) _dto: unknown,
  ) {
    void _dto;
    return this.visitors.decide(auth.communityId!, auth.userId, invitationId, "REJECTED");
  }

  // ── Guard surface ──────────────────────────────────────────────────────────

  @Post("gate/visitors/spot-request")
  @RequirePermissions("visitor.create")
  spotRequest(@CurrentUser() auth: AccessContext, @Body(new ZodValidationPipe(SpotRequestSchema)) dto: unknown) {
    // photoDataUrl is stored via storage in a later slice; accepted+length-checked now.
    const body = { ...(dto as Record<string, unknown>) } as never as Parameters<GateOpsService["spotRequest"]>[2];
    return this.gate.spotRequest(auth.communityId!, auth.userId, body);
  }

  @Post("gate/visitors/check-in")
  @RequirePermissions("visitor.gate.operations")
  checkIn(@CurrentUser() auth: AccessContext, @Body(new ZodValidationPipe(CheckInSchema)) dto: unknown) {
    return this.gate.checkIn(auth.communityId!, auth.userId, dto as never);
  }

  @Post("gate/visitors/check-out")
  @RequirePermissions("visitor.gate.operations")
  checkOut(@CurrentUser() auth: AccessContext, @Body(new ZodValidationPipe(CheckOutSchema)) dto: unknown) {
    const { visitId, clientEventId } = dto as { visitId: string; clientEventId?: string };
    return this.gate.checkOut(auth.communityId!, auth.userId, visitId, clientEventId);
  }

  @Get("gate/home")
  @RequirePermissions("visitor.read")
  guardHome(@CurrentUser() auth: AccessContext) {
    return this.gate.guardHome(auth.communityId!);
  }

  @Post("gate/parcels/hold")
  @RequirePermissions("visitor.gate.operations")
  holdParcel(
    @CurrentUser() auth: AccessContext,
    @Body(new ZodValidationPipe(HoldParcelWithInvitation)) dto: unknown,
  ) {
    const { invitationId, ...rest } = dto as { invitationId: string; courierName?: string; description?: string };
    return this.gate.holdParcel(auth.communityId!, auth.userId, invitationId, rest);
  }

  @Post("gate/parcels/:parcelId/collect")
  @RequirePermissions("visitor.gate.operations")
  collectParcel(
    @CurrentUser() auth: AccessContext,
    @Param("parcelId") parcelId: string,
    @Body(new ZodValidationPipe(CollectParcelSchema)) dto: unknown,
  ) {
    return this.gate.collectParcel(auth.communityId!, auth.userId, parcelId, (dto as { pickupToken: string }).pickupToken);
  }

  // ── Security manager ──────────────────────────────────────────────────────

  @Post("visitors/:invitationId/override")
  @RequirePermissions("visitor.override")
  override(
    @CurrentUser() auth: AccessContext,
    @Param("invitationId") invitationId: string,
    @Body(new ZodValidationPipe(OverrideSchema)) dto: unknown,
  ) {
    return this.gate.override(auth.communityId!, auth.userId, invitationId, (dto as { reason: string }).reason);
  }

  // ── Admin/security log ────────────────────────────────────────────────────

  @Get("communities/:communityId/visits")
  @RequirePermissions("visitor.read")
  async listVisits(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Query(new ZodValidationPipe(ListVisitsQuerySchema)) query: unknown,
  ) {
    const q = query as {
      gateId?: string; visitorType?: string; towerId?: string; unitId?: string;
      status?: string; inside?: string; dateFrom?: Date; dateTo?: Date;
      page: number; pageSize: number;
    };
    const { items, total } = await this.visitors.listVisits(communityId, {
      gateId: q.gateId,
      visitorType: q.visitorType,
      towerId: q.towerId,
      unitId: q.unitId,
      status: q.status,
      inside: q.inside === undefined ? undefined : q.inside === "true",
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
}
