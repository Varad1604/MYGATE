import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { ParkingService } from "./parking.service";
import {
  AllocateSlotSchema,
  CreateParkingAreaSchema,
  CreateSlotsSchema,
  RegisterVehicleSchema,
} from "./parking.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUser } from "../../auth/current-user.decorator";
import { RequirePermissions } from "../../auth/permissions.guard";
import type { AccessContext } from "../../auth/auth.service";

const PlateQuery = z.object({ number: z.string().trim().min(4).max(15) });

@Controller()
export class ParkingController {
  constructor(private readonly parking: ParkingService) {}

  // ── Resident self-service ──────────────────────────────────────────────────

  @Post("me/vehicles")
  registerMine(
    @CurrentUser() auth: AccessContext,
    @Body(new ZodValidationPipe(RegisterVehicleSchema)) dto: unknown,
  ) {
    return this.parking.registerVehicle(auth.communityId!, auth.userId, false, undefined, dto as never);
  }

  @Get("me/vehicles")
  mine(@CurrentUser() auth: AccessContext) {
    return this.parking.myVehicles(auth.communityId!, auth.userId);
  }

  // ── Admin management ───────────────────────────────────────────────────────

  @Post("communities/:communityId/vehicles")
  @RequirePermissions("parking.manage")
  registerForUnit(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Body(new ZodValidationPipe(RegisterVehicleSchema.extend({ unitId: z.string().uuid() }))) dto: unknown,
  ) {
    const d = dto as { unitId: string; number: string; type: string; make?: string; model?: string; color?: string };
    return this.parking.registerVehicle(communityId, auth.userId, true, d.unitId, d);
  }

  @Get("communities/:communityId/vehicles")
  @RequirePermissions("parking.read")
  all(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string) {
    void auth;
    return this.parking.allVehicles(communityId);
  }

  @Post("vehicles/:vehicleId/deactivate")
  async deactivate(
    @CurrentUser() auth: AccessContext,
    @Param("vehicleId") vehicleId: string,
  ) {
    const isAdmin = auth.permissions.includes("parking.manage");
    return this.parking.deactivateVehicle(auth.communityId!, auth.userId, isAdmin, vehicleId);
  }

  @Post("communities/:communityId/parking/areas")
  @RequirePermissions("parking.manage")
  createArea(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Body(new ZodValidationPipe(CreateParkingAreaSchema)) dto: unknown,
  ) {
    void auth;
    return this.parking.createArea(communityId, dto as never);
  }

  @Get("communities/:communityId/parking/areas")
  areas(@CurrentUser() auth: AccessContext, @Param("communityId") communityId: string) {
    void auth;
    return this.parking.listAreas(communityId);
  }

  @Post("parking/areas/:areaId/slots")
  @RequirePermissions("parking.manage")
  createSlots(
    @CurrentUser() auth: AccessContext,
    @Param("areaId") areaId: string,
    @Body(new ZodValidationPipe(CreateSlotsSchema)) dto: unknown,
  ) {
    void auth;
    return this.parking.createSlots(auth.communityId!, areaId, (dto as { slots: never }).slots);
  }

  @Post("parking/slots/:slotId/allocate")
  @RequirePermissions("parking.manage")
  allocate(
    @CurrentUser() auth: AccessContext,
    @Param("slotId") slotId: string,
    @Body(new ZodValidationPipe(AllocateSlotSchema)) dto: unknown,
  ) {
    return this.parking.allocateSlot(auth.communityId!, auth.userId, slotId, dto as never);
  }

  @Delete("parking/slots/:slotId/allocate")
  @RequirePermissions("parking.manage")
  deallocate(@CurrentUser() auth: AccessContext, @Param("slotId") slotId: string) {
    return this.parking.deallocateSlot(auth.communityId!, auth.userId, slotId);
  }

  // ── Guard lookup ───────────────────────────────────────────────────────────

  @Get("gate/parking/lookup")
  gateLookup(
    @CurrentUser() auth: AccessContext,
    @Query(new ZodValidationPipe(PlateQuery)) query: unknown,
  ) {
    void auth;
    return this.parking.gateLookup(auth.communityId!, (query as { number: string }).number);
  }
}
