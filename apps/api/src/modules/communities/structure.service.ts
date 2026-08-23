import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Errors } from "../../common/app-exception";
import { AuditService } from "../../audit/audit.service";

/** Towers, floors, unit types, units and gates — the physical structure. */
@Injectable()
export class StructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Towers ────────────────────────────────────────────────────────────────

  async createTower(communityId: string, dto: { name: string; code: string }) {
    return this.prisma.tower.create({ data: { communityId, name: dto.name, code: dto.code.toUpperCase() } });
  }

  async listTowers(communityId: string) {
    return this.prisma.tower.findMany({
      where: { communityId, deletedAt: null },
      orderBy: { code: "asc" },
      include: { _count: { select: { units: true } } },
    });
  }

  async createFloor(towerId: string, dto: { level: number; label?: string }) {
    const tower = await this.prisma.tower.findFirst({ where: { id: towerId, deletedAt: null } });
    if (!tower) throw Errors.notFound("Tower");
    const floor = await this.prisma.floor.upsert({
      where: { towerId_level: { towerId, level: dto.level } },
      update: { label: dto.label },
      create: { towerId, level: dto.level, label: dto.label ?? String(dto.level) },
    });
    return floor;
  }

  // ── Unit types ────────────────────────────────────────────────────────────

  async createUnitType(communityId: string, dto: { name: string; bedrooms?: number; areaSqft?: number }) {
    return this.prisma.unitType.create({
      data: {
        communityId,
        name: dto.name,
        bedrooms: dto.bedrooms,
        areaSqft: dto.areaSqft,
      },
    });
  }

  async listUnitTypes(communityId: string) {
    return this.prisma.unitType.findMany({ where: { communityId }, orderBy: { name: "asc" } });
  }

  // ── Units ─────────────────────────────────────────────────────────────────

  async createUnits(
    communityId: string,
    dto: {
      towerId: string;
      floorLevel: number;
      labels: string[];
      unitTypeId?: string;
      areaSqft?: number;
    },
    actorUserId: string,
  ) {
    const tower = await this.prisma.tower.findFirst({ where: { id: dto.towerId, communityId, deletedAt: null } });
    if (!tower) throw Errors.notFound("Tower");

    const created = await this.prisma.$transaction(async (tx) => {
      const floor = await tx.floor.upsert({
        where: { towerId_level: { towerId: dto.towerId, level: dto.floorLevel } },
        update: {},
        create: { towerId: dto.towerId, level: dto.floorLevel, label: String(dto.floorLevel) },
      });
      // createMany skips duplicates via skipDuplicates
      await tx.unit.createMany({
        data: dto.labels.map((label) => ({
          communityId,
          towerId: dto.towerId,
          floorId: floor.id,
          unitTypeId: dto.unitTypeId,
          label: label.toUpperCase(),
          areaSqft: dto.areaSqft,
        })),
        skipDuplicates: true,
      });
      return tx.unit.findMany({
        where: { towerId: dto.towerId, floorId: floor.id, label: { in: dto.labels.map((l) => l.toUpperCase()) } },
      });
    });

    await this.audit.record({
      action: "units.bulk_created",
      entityType: "unit",
      communityId,
      actorUserId,
      after: { count: created.length, tower: tower.code, floorLevel: dto.floorLevel },
    });
    return created;
  }

  async listUnits(communityId: string, q: { towerId?: string; status?: string; search?: string; skip: number; take: number }) {
    const where = {
      communityId,
      deletedAt: null,
      ...(q.towerId ? { towerId: q.towerId } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.search ? { label: { contains: q.search.toUpperCase() } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.unit.findMany({
        where,
        orderBy: [{ towerId: "asc" }, { label: "asc" }],
        skip: q.skip,
        take: q.take,
        include: {
          tower: { select: { name: true, code: true } },
          occupancies: {
            where: { effectiveTo: null },
            include: { user: { select: { id: true, fullName: true, phone: true } } },
          },
        },
      }),
      this.prisma.unit.count({ where }),
    ]);
    return { items, total };
  }

  async updateUnit(unitId: string, patch: { status?: string; unitTypeId?: string | null; areaSqft?: number | null }, actorUserId: string) {
    const unit = await this.prisma.unit.findFirst({ where: { id: unitId, deletedAt: null } });
    if (!unit) throw Errors.notFound("Unit");
    const updated = await this.prisma.unit.update({
      where: { id: unitId },
      data: {
        ...(patch.status ? { status: patch.status as never } : {}),
        ...(patch.unitTypeId !== undefined ? { unitTypeId: patch.unitTypeId } : {}),
        ...(patch.areaSqft !== undefined ? { areaSqft: patch.areaSqft } : {}),
      },
    });
    await this.audit.record({
      action: "unit.updated",
      entityType: "unit",
      entityId: unitId,
      communityId: unit.communityId,
      actorUserId,
      before: { status: unit.status, unitTypeId: unit.unitTypeId },
      after: { status: updated.status, unitTypeId: updated.unitTypeId },
    });
    return updated;
  }

  // ── Gates ─────────────────────────────────────────────────────────────────

  async createGate(communityId: string, dto: { name: string; code: string }) {
    return this.prisma.gate.create({ data: { communityId, name: dto.name, code: dto.code.toUpperCase() } });
  }

  async listGates(communityId: string) {
    return this.prisma.gate.findMany({ where: { communityId, isActive: true }, orderBy: { name: "asc" } });
  }

  async deactivateGate(gateId: string, actorUserId: string) {
    const gate = await this.prisma.gate.findUnique({ where: { id: gateId } });
    if (!gate) throw Errors.notFound("Gate");
    const updated = await this.prisma.gate.update({ where: { id: gateId }, data: { isActive: false } });
    await this.audit.record({
      action: "gate.deactivated",
      entityType: "gate",
      entityId: gateId,
      communityId: gate.communityId,
      actorUserId,
      before: { isActive: true },
      after: { isActive: false },
    });
    return updated;
  }
}
