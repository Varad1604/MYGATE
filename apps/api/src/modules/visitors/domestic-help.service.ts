import { ForbiddenException, Injectable } from "@nestjs/common";
import { normalizePhone } from "@societyos/types";
import { PrismaService } from "../../prisma/prisma.service";
import { Errors } from "../../common/app-exception";
import { AuditService } from "../../audit/audit.service";

/** Permission that lets a resident manage staff for THEIR units only. */
const RESIDENT_STAFF_PERMS = ["resident.write"];

@Injectable()
export class DomesticHelpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Residents may only add staff to units they occupy; admins to any unit. */
  private async assertUnitsWritable(
    communityId: string,
    userId: string,
    permissions: string[],
    unitIds: string[],
  ) {
    if (RESIDENT_STAFF_PERMS.some((p) => permissions.includes(p))) return;
    const occupied = await this.prisma.unitOccupancy.findMany({
      where: { userId, effectiveTo: null, unit: { communityId } },
      select: { unitId: true },
    });
    const owned = new Set(occupied.map((o) => o.unitId));
    if (!unitIds.every((u) => owned.has(u))) {
      throw new ForbiddenException("You can only assign staff to your own unit.");
    }
  }

  async create(communityId: string, userId: string, permissions: string[], dto: {
    name: string; phone?: string; category: string; scheduleText?: string; unitIds: string[];
  }) {
    await this.assertUnitsWritable(communityId, userId, permissions, dto.unitIds);
    const validUnits = await this.prisma.unit.count({
      where: { id: { in: dto.unitIds }, communityId, deletedAt: null },
    });
    if (validUnits !== dto.unitIds.length) throw Errors.notFound("Unit");

    const profile = await this.prisma.domesticHelpProfile.create({
      data: {
        communityId,
        createdById: userId,
        name: dto.name,
        phone: dto.phone ? normalizePhone(dto.phone) : null,
        category: dto.category as never,
        scheduleText: dto.scheduleText,
        unitAssignments: {
          create: dto.unitIds.map((unitId) => ({ unitId })),
        },
      },
      include: { unitAssignments: true },
    });
    await this.audit.record({
      action: "domestic_help.created",
      entityType: "domestic_help_profile",
      entityId: profile.id,
      communityId,
      actorUserId: userId,
      after: { name: dto.name, category: dto.category, units: dto.unitIds.length },
    });
    return profile;
  }

  async list(communityId: string, opts: { category?: string; activeOnly?: boolean }) {
    return this.prisma.domesticHelpProfile.findMany({
      where: {
        communityId,
        ...(opts.category ? { category: opts.category as never } : {}),
        ...(opts.activeOnly ? { isActive: true } : {}),
      },
      include: {
        unitAssignments: { include: { unit: { select: { label: true, tower: { select: { code: true } } } } } },
      },
      orderBy: { name: "asc" },
    });
  }

  async assignUnit(communityId: string, userId: string, permissions: string[], profileId: string, unitId: string) {
    const profile = await this.prisma.domesticHelpProfile.findFirst({ where: { id: profileId, communityId } });
    if (!profile) throw Errors.notFound("Profile");
    await this.assertUnitsWritable(communityId, userId, permissions, [unitId]);
    const unit = await this.prisma.unit.findFirst({ where: { id: unitId, communityId, deletedAt: null } });
    if (!unit) throw Errors.notFound("Unit");
    const assignment = await this.prisma.domesticHelpUnitAssignment.upsert({
      where: { profileId_unitId: { profileId: profile.id, unitId } },
      update: {},
      create: { profileId: profile.id, unitId },
    });
    return assignment;
  }

  async deactivate(communityId: string, userId: string, profileId: string) {
    const profile = await this.prisma.domesticHelpProfile.findFirst({ where: { id: profileId, communityId } });
    if (!profile) throw Errors.notFound("Profile");
    // Only the creator or a society manager may deactivate.
    if (profile.createdById && profile.createdById !== userId) {
      const isManager = await this.prisma.communityMembership.findFirst({
        where: {
          userId,
          communityId,
          isActive: true,
          roles: { some: { role: { key: { in: ["SECURITY_MANAGER", "COMMUNITY_ADMIN"] } } } },
        },
      });
      if (!isManager) throw new ForbiddenException("Only the creator or a manager can deactivate.");
    }
    await this.prisma.domesticHelpProfile.update({
      where: { id: profile.id },
      data: { isActive: false },
    });
    await this.audit.record({
      action: "domestic_help.deactivated",
      entityType: "domestic_help_profile",
      entityId: profile.id,
      communityId,
      actorUserId: userId,
    });
    return { ok: true };
  }

  /** Gate lookup by phone — minimal PII projection for guards. */
  async gateLookup(communityId: string, phone: string) {
    const normalized = normalizePhone(phone);
    const profiles = await this.prisma.domesticHelpProfile.findMany({
      where: { communityId, phone: normalized, isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        photoFileId: true,
        scheduleText: true,
        unitAssignments: {
          select: { unit: { select: { label: true, tower: { select: { code: true } } } }, allowedDays: true },
        },
      },
    });
    return profiles.map((p) => ({
      ...p,
      phone: undefined, // guards never see numbers
      // unit.label already includes the tower prefix ("A-101").
      assignedUnits: p.unitAssignments.map((a) => a.unit.label),
      unitAssignments: undefined,
    }));
  }
}
