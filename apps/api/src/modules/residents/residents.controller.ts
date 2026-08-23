import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CommunitiesService } from "../communities/communities.service";
import { ResidentsService } from "./residents.service";
import {
  AddResidentSchema,
  CreateEmergencyContactSchema,
  ListResidentsQuerySchema,
  UpdateResidentSchema,
} from "./residents.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { Errors } from "../../common/app-exception";
import { CurrentUser } from "../../auth/current-user.decorator";
import { RequirePermissions } from "../../auth/permissions.guard";
import type { AccessContext } from "../../auth/auth.service";

@Controller()
export class ResidentsController {
  constructor(
    private readonly residents: ResidentsService,
    private readonly communities: CommunitiesService,
  ) {}

  private assertTenant(auth: AccessContext, communityId: string) {
    this.communities.assertCommunityAccess(auth, communityId);
  }

  @Post("communities/:communityId/residents")
  @RequirePermissions("resident.write")
  async add(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Body(new ZodValidationPipe(AddResidentSchema)) dto: unknown,
  ) {
    this.assertTenant(auth, communityId);
    return this.residents.addResident(communityId, auth.userId, dto as never);
  }

  @Get("communities/:communityId/residents")
  @RequirePermissions("resident.read")
  async list(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Query(new ZodValidationPipe(ListResidentsQuerySchema)) query: unknown,
  ) {
    this.assertTenant(auth, communityId);
    const q = query as { unitId?: string; kind?: string; q?: string; page: number; pageSize: number };
    const { items, total } = await this.residents.listResidents(communityId, {
      unitId: q.unitId,
      kind: q.kind,
      search: q.q,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Get("communities/:communityId/residents/:userId")
  @RequirePermissions("resident.read")
  get(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string, @Param("userId") userId: string) {
    this.assertTenant(auth, communityId);
    return this.residents.getResidentProfile(communityId, userId);
  }

  @Patch("residents/:userId")
  async update(
    @CurrentUser() auth: AccessContext,
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(UpdateResidentSchema)) dto: unknown,
  ) {
    if (!auth.communityId) throw Errors.forbidden("Select an active community first.", "NO_ACTIVE_COMMUNITY");
    return this.residents.updateResident(auth.communityId, auth, userId, dto as never);
  }

  @Get("units/:unitId/occupants")
  @RequirePermissions("resident.read")
  async occupants(@CurrentUser() auth: AccessContext, @Param("unitId") unitId: string) {
    // Tenant check via the unit's community.
    const unit = await this.residents.myUnits(auth.userId).then((rows) => rows.find((r) => r.unit.id === unitId));
    const hasRead = auth.isPlatformSuperAdmin || auth.permissions.includes("resident.read");
    if (!hasRead && !unit) throw Errors.forbidden("Not your unit.", "PERMISSION_DENIED");
    return this.residents.currentOccupantUserIds(unitId);
  }

  @Post("occupancies/:occupancyId/end")
  @RequirePermissions("resident.write")
  endOccupancy(@CurrentUser() auth: AccessContext, @Param("occupancyId") occupancyId: string) {
    return this.residents.endOccupancy(occupancyId, auth.userId);
  }

  @Get("me/units")
  myUnits(@CurrentUser() auth: AccessContext) {
    return this.residents.myUnits(auth.userId);
  }

  @Get("me/emergency-contacts")
  listContacts(@CurrentUser() auth: AccessContext) {
    return this.residents.listEmergencyContacts(auth.userId);
  }

  @Post("me/emergency-contacts")
  addContact(@CurrentUser() auth: AccessContext, @Body(new ZodValidationPipe(CreateEmergencyContactSchema)) dto: unknown) {
    return this.residents.createEmergencyContact(auth.userId, dto as never);
  }

  @Delete("me/emergency-contacts/:contactId")
  removeContact(@CurrentUser() auth: AccessContext, @Param("contactId") contactId: string) {
    return this.residents.deleteEmergencyContact(auth.userId, contactId);
  }
}
