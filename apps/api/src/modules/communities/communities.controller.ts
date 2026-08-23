import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CommunitiesService } from "./communities.service";
import { StructureService } from "./structure.service";
import {
  CreateCommunitySchema,
  CreateFloorSchema,
  CreateGateSchema,
  CreateTowerSchema,
  CreateUnitTypeSchema,
  CreateUnitsSchema,
  ListUnitsQuerySchema,
  UpdateCommunitySettingsSchema,
  UpdateUnitSchema,
} from "./communities.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUser } from "../../auth/current-user.decorator";
import { RequirePermissions } from "../../auth/permissions.guard";
import type { AccessContext } from "../../auth/auth.service";

/**
 * Platform-super-admin surface for onboarding communities.
 */
@Controller("platform/communities")
export class PlatformCommunitiesController {
  constructor(private readonly communities: CommunitiesService) {}

  @Post()
  @RequirePermissions("platform.communities.manage")
  async create(@CurrentUser() auth: AccessContext, @Body(new ZodValidationPipe(CreateCommunitySchema)) dto: unknown) {
    const community = await this.communities.createCommunity(dto as never, auth.userId);
    // The creating platform admin gets a membership so they can inspect it.
    return community;
  }

  @Get()
  @RequirePermissions("platform.communities.manage")
  listAll() {
    return this.communities.listAll();
  }

  @Patch(":id/status")
  @RequirePermissions("platform.communities.manage")
  setStatus(@Param("id") id: string, @Body() body: { status: "ONBOARDING" | "ACTIVE" | "SUSPENDED" }) {
    return this.communities.setStatus(id, body.status);
  }
}

/**
 * Community-scoped structure management.
 * All routes resolve tenant scope from the authenticated context — the
 * communityId in the path is validated against it (ADR-001).
 */
@Controller()
export class StructureController {
  constructor(
    private readonly communities: CommunitiesService,
    private readonly structure: StructureService,
  ) {}

  private assertTenant(auth: AccessContext, communityId: string) {
    this.communities.assertCommunityAccess(auth, communityId);
  }

  @Get("communities/:communityId")
  async getCommunity(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string) {
    this.assertTenant(auth, communityId);
    return this.communities.getById(communityId);
  }

  @Patch("communities/:communityId/settings")
  @RequirePermissions("community.settings.manage")
  async updateSettings(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Body(new ZodValidationPipe(UpdateCommunitySettingsSchema)) dto: unknown,
  ) {
    this.assertTenant(auth, communityId);
    return this.communities.updateSettings(communityId, dto as Record<string, number>);
  }

  // Towers
  @Post("communities/:communityId/towers")
  @RequirePermissions("society.write")
  createTower(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string, @Body(new ZodValidationPipe(CreateTowerSchema)) dto: unknown) {
    this.assertTenant(auth, communityId);
    return this.structure.createTower(communityId, dto as never);
  }

  @Get("communities/:communityId/towers")
  @RequirePermissions("society.read")
  listTowers(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string) {
    this.assertTenant(auth, communityId);
    return this.structure.listTowers(communityId);
  }

  @Post("towers/:towerId/floors")
  @RequirePermissions("society.write")
  createFloor(@Req() req: Request, @Param("towerId") towerId: string, @Body(new ZodValidationPipe(CreateFloorSchema)) dto: unknown) {
    void req;
    return this.structure.createFloor(towerId, dto as never);
  }

  // Unit types
  @Post("communities/:communityId/unit-types")
  @RequirePermissions("society.write")
  createUnitType(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string, @Body(new ZodValidationPipe(CreateUnitTypeSchema)) dto: unknown) {
    this.assertTenant(auth, communityId);
    return this.structure.createUnitType(communityId, dto as never);
  }

  @Get("communities/:communityId/unit-types")
  @RequirePermissions("society.read")
  listUnitTypes(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string) {
    this.assertTenant(auth, communityId);
    return this.structure.listUnitTypes(communityId);
  }

  // Units (bulk create + paginated list)
  @Post("communities/:communityId/units")
  @RequirePermissions("society.write")
  createUnits(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string, @Body(new ZodValidationPipe(CreateUnitsSchema)) dto: unknown) {
    this.assertTenant(auth, communityId);
    return this.structure.createUnits(communityId, dto as never, auth.userId);
  }

  @Get("communities/:communityId/units")
  @RequirePermissions("society.read")
  async listUnits(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Query(new ZodValidationPipe(ListUnitsQuerySchema)) query: unknown,
  ) {
    this.assertTenant(auth, communityId);
    const q = query as { towerId?: string; status?: string; q?: string; page: number; pageSize: number };
    const { items, total } = await this.structure.listUnits(communityId, {
      towerId: q.towerId,
      status: q.status,
      search: q.q,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Patch("units/:unitId")
  @RequirePermissions("society.write")
  updateUnit(@CurrentUser() auth: AccessContext, @Param("unitId") unitId: string, @Body(new ZodValidationPipe(UpdateUnitSchema)) dto: unknown) {
    return this.structure.updateUnit(unitId, dto as never, auth.userId);
  }

  // Gates
  @Post("communities/:communityId/gates")
  @RequirePermissions("society.write")
  createGate(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string, @Body(new ZodValidationPipe(CreateGateSchema)) dto: unknown) {
    this.assertTenant(auth, communityId);
    return this.structure.createGate(communityId, dto as never);
  }

  @Get("communities/:communityId/gates")
  @RequirePermissions("society.read")
  listGates(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string) {
    this.assertTenant(auth, communityId);
    return this.structure.listGates(communityId);
  }

  @Delete("gates/:gateId")
  @RequirePermissions("society.write")
  deactivateGate(@CurrentUser() auth: AccessContext, @Param("gateId") gateId: string) {
    return this.structure.deactivateGate(gateId, auth.userId);
  }
}
