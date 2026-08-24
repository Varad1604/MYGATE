import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Errors } from "../../common/app-exception";
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class ParkingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Residents register their own vehicles; admins register for any unit. */
  async registerVehicle(communityId: string, userId: string, isAdmin: boolean, unitOverride: string | undefined, dto: {
    number: string; type: string; make?: string; model?: string; color?: string;
  }) {
    let unitId = unitOverride ?? null;
    if (!isAdmin) {
      const occ = await this.prisma.unitOccupancy.findFirst({
        where: { userId, effectiveTo: null, unit: { communityId } },
        select: { unitId: true },
      });
      if (!occ) throw new ForbiddenException("Only residents with an assigned unit can register vehicles.");
      unitId = occ.unitId;
    }
    const dupe = await this.prisma.vehicle.findUnique({
      where: { communityId_number: { communityId, number: dto.number } },
    });
    if (dupe) {
      throw new ConflictException(`Vehicle ${dto.number} is already registered in this community.`);
    }
    const vehicle = await this.prisma.vehicle.create({
      data: {
        communityId,
        ownerUserId: userId,
        unitId,
        number: dto.number,
        type: dto.type as never,
        make: dto.make,
        model: dto.model,
        color: dto.color,
      },
    });
    await this.audit.record({
      action: "parking.vehicle_registered", entityType: "vehicle", entityId: vehicle.id,
      communityId, actorUserId: userId, after: { number: dto.number },
    });
    return vehicle;
  }

  myVehicles(communityId: string, userId: string) {
    return this.prisma.vehicle.findMany({
      where: { communityId, ownerUserId: userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  allVehicles(communityId: string) {
    return this.prisma.vehicle.findMany({
      where: { communityId, isActive: true },
      orderBy: { createdAt: "desc" },
      include: {
        unit: { select: { label: true } },
        allocations: {
          where: { effectiveTo: null },
          include: { slot: { select: { code: true, area: { select: { name: true } } } } },
          take: 1,
        },
      },
    });
  }

  async deactivateVehicle(communityId: string, userId: string, isAdmin: boolean, vehicleId: string) {
    const v = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, communityId } });
    if (!v) throw Errors.notFound("Vehicle");
    if (!isAdmin && v.ownerUserId !== userId) throw Errors.notFound("Vehicle");
    // End any active allocation.
    await this.prisma.parkingAllocation.updateMany({
      where: { vehicleId: v.id, effectiveTo: null },
      data: { effectiveTo: new Date() },
    });
    const updated = await this.prisma.vehicle.update({
      where: { id: v.id },
      data: { isActive: false },
    });
    await this.audit.record({
      action: "parking.vehicle_deactivated", entityType: "vehicle", entityId: v.id,
      communityId, actorUserId: userId,
    });
    return updated;
  }

  createArea(communityId: string, dto: { name: string; note?: string }) {
    return this.prisma.parkingArea.create({ data: { ...dto, communityId } });
  }

  listAreas(communityId: string) {
    return this.prisma.parkingArea.findMany({
      where: { communityId },
      include: { slots: { orderBy: { code: "asc" } } },
      orderBy: { name: "asc" },
    });
  }

  async createSlots(communityId: string, areaId: string, slots: Array<{ code: string; kind: string }>) {
    const area = await this.prisma.parkingArea.findFirst({ where: { id: areaId, communityId } });
    if (!area) throw Errors.notFound("Parking area");
    const created = await this.prisma.parkingSlot.createMany({
      data: slots.map((s) => ({
        communityId,
        areaId,
        code: s.code.toUpperCase(),
        kind: s.kind as never,
      })),
      skipDuplicates: true,
    });
    return { created: created.count };
  }

  /**
   * Allocates an open slot to a vehicle. Transactional + advisory lock on the
   * slot prevents double-allocation under concurrency (same pattern as
   * amenities). One ACTIVE allocation per slot and per vehicle.
   */
  async allocateSlot(communityId: string, adminUserId: string, slotId: string, dto: { vehicleId: string; note?: string }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${slotId})) IS NULL AS locked`;

      const slot = await tx.parkingSlot.findFirst({ where: { id: slotId, communityId, isActive: true } });
      if (!slot) throw Errors.notFound("Slot");

      const vehicle = await tx.vehicle.findFirst({ where: { id: dto.vehicleId, communityId, isActive: true } });
      if (!vehicle) throw Errors.notFound("Vehicle");

      if (slot.kind === "TWO_WHEELER" && vehicle.type !== "TWO_WHEELER") {
        throw new BadRequestException("This slot is reserved for two-wheelers.");
      }

      const activeOnSlot = await tx.parkingAllocation.findFirst({
        where: { slotId: slot.id, effectiveTo: null },
      });
      if (activeOnSlot) throw Errors.conflict("SLOT_OCCUPIED", "Slot already has an active allocation.");

      const activeForVehicle = await tx.parkingAllocation.findFirst({
        where: { vehicleId: vehicle.id, effectiveTo: null },
      });
      if (activeForVehicle) throw Errors.conflict("VEHICLE_PARKED", "Vehicle already holds a slot.");

      const alloc = await tx.parkingAllocation.create({
        data: {
          slotId: slot.id,
          vehicleId: vehicle.id,
          unitId: vehicle.unitId,
          allocatedByUserId: adminUserId,
          note: dto.note,
        },
      });
      return alloc;
    });
  }

  async deallocateSlot(communityId: string, adminUserId: string, slotId: string) {
    const active = await this.prisma.parkingAllocation.findFirst({
      where: { slot: { id: slotId, communityId }, effectiveTo: null },
    });
    if (!active) throw Errors.notFound("Active allocation");
    const updated = await this.prisma.parkingAllocation.update({
      where: { id: active.id },
      data: { effectiveTo: new Date() },
    });
    void updated;
    await this.audit.record({
      action: "parking.slot_deallocated", entityType: "parking_slot", entityId: slotId,
      communityId, actorUserId: adminUserId,
    });
    return { ok: true };
  }

  /** Guard-facing lookup: which vehicle/slot belongs to a plate. */
  async gateLookup(communityId: string, plate: string) {
    const normalized = plate.toUpperCase().replace(/[\s-]/g, "");
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { communityId_number: { communityId, number: normalized } },
      select: {
        id: true, number: true, type: true, color: true,
        unit: { select: { label: true } },
        allocations: {
          where: { effectiveTo: null },
          select: { slot: { select: { code: true, area: { select: { name: true } } } } },
          take: 1,
        },
      },
    });
    if (!vehicle) throw Errors.notFound("Vehicle");
    return {
      number: vehicle.number,
      type: vehicle.type,
      color: vehicle.color,
      unitLabel: vehicle.unit?.label ?? null,
      parkingSlot: vehicle.allocations[0]?.slot
        ? `${vehicle.allocations[0].slot.area.name} / ${vehicle.allocations[0].slot.code}`
        : null,
    };
  }
}
