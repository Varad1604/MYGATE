import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Errors } from "../../common/app-exception";
import { AuditService } from "../../audit/audit.service";
import { normalizePhone } from "../../auth/auth.service";

const RESIDENT_ROLE_KEY: Record<"OWNER" | "TENANT" | "FAMILY", string> = {
  OWNER: "RESIDENT_OWNER",
  TENANT: "RESIDENT_TENANT",
  FAMILY: "FAMILY_MEMBER",
};

@Injectable()
export class ResidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Links (or creates) a user and records occupancy. Historical occupancies
   * are never overwritten — moving out closes the record with effectiveTo.
   */
  async addResident(
    communityId: string,
    actorUserId: string,
    dto: {
      unitId: string;
      kind: "OWNER" | "TENANT" | "FAMILY";
      fullName: string;
      phone?: string;
      email?: string;
      isPrimaryContact: boolean;
      effectiveFrom?: Date;
    },
  ) {
    const unit = await this.prisma.unit.findFirst({ where: { id: dto.unitId, communityId, deletedAt: null } });
    if (!unit) throw Errors.notFound("Unit");

    const phone = dto.phone ? normalizePhone(dto.phone) : undefined;
    const email = dto.email?.toLowerCase() || undefined;

    const result = await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findFirst({
        where: {
          OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])],
          deletedAt: null,
        },
      });
      const isNewUser = !user;
      if (!user) {
        user = await tx.user.create({
          data: {
            fullName: dto.fullName,
            phone,
            email,
            status: "ACTIVE",
          },
        });
      }

      const membership = await tx.communityMembership.upsert({
        where: { userId_communityId: { userId: user.id, communityId } },
        update: { isActive: true },
        create: { userId: user.id, communityId },
        include: { roles: { include: { role: true } } },
      });

      // Attach the resident-kind system role if not present.
      const wantedRoleKey = RESIDENT_ROLE_KEY[dto.kind];
      if (!membership.roles.some((mr) => mr.role.key === wantedRoleKey)) {
        const role = await tx.role.findFirst({ where: { communityId, key: wantedRoleKey, isSystem: true } });
        if (!role) throw new Error(`System role ${wantedRoleKey} missing for community ${communityId}`);
        const alreadyHasResidentKind = membership.roles.some((mr) =>
          ["RESIDENT_OWNER", "RESIDENT_TENANT", "FAMILY_MEMBER"].includes(mr.role.key),
        );
        if (!alreadyHasResidentKind) {
          await tx.membershipRole.create({ data: { membershipId: membership.id, roleId: role.id } });
        }
      }

      const occupancy = await tx.unitOccupancy.create({
        data: {
          unitId: unit.id,
          userId: user.id,
          kind: dto.kind,
          isPrimaryContact: dto.isPrimaryContact,
          effectiveFrom: dto.effectiveFrom ?? new Date(),
        },
        include: { user: { select: { id: true, fullName: true, phone: true } } },
      });

      // Recompute unit status.
      const activeKinds = await tx.unitOccupancy.findMany({
        where: { unitId: unit.id, effectiveTo: null },
        select: { kind: true },
      });
      const nextStatus =
        activeKinds.some((o) => o.kind === "TENANT")
          ? "TENANT_OCCUPIED"
          : activeKinds.length > 0
            ? "OWNER_OCCUPIED"
            : "VACANT";
      await tx.unit.update({ where: { id: unit.id }, data: { status: nextStatus } });

      return { user: { id: user.id, fullName: user.fullName }, occupancy, isNewUser };
    });

    await this.audit.record({
      action: "resident.added",
      entityType: "unit_occupancy",
      entityId: result.occupancy.id,
      communityId,
      actorUserId,
      after: {
        unitId: unit.id,
        kind: dto.kind,
        userId: result.user.id,
        newUser: result.isNewUser,
      },
    });
    return result;
  }

  async listResidents(communityId: string, q: { unitId?: string; kind?: string; search?: string; skip: number; take: number }) {
    const occupancyWhere = {
      effectiveTo: null,
      ...(q.unitId ? { unitId: q.unitId } : {}),
      ...(q.kind ? { kind: q.kind as never } : {}),
      ...(q.search
        ? {
            OR: [
              { user: { fullName: { contains: q.search, mode: "insensitive" as const } } },
              { user: { phone: { contains: q.search.replace(/\D/g, "") } } },
              { unit: { label: { contains: q.search.toUpperCase() } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.unitOccupancy.findMany({
        where: { ...occupancyWhere, unit: { communityId, deletedAt: null } },
        include: {
          user: { select: { id: true, fullName: true, phone: true, email: true, createdAt: true } },
          unit: { select: { id: true, label: true, tower: { select: { name: true, code: true } } } },
        },
        orderBy: [{ unit: { label: "asc" } }],
        skip: q.skip,
        take: q.take,
      }),
      this.prisma.unitOccupancy.count({ where: { ...occupancyWhere, unit: { communityId, deletedAt: null } } }),
    ]);
    return { items, total };
  }

  async getResidentProfile(communityId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true, fullName: true, phone: true, email: true, status: true, createdAt: true,
        memberships: { where: { communityId }, include: { roles: { include: { role: true } } } },
        occupancies: {
          where: { unit: { communityId } },
          include: { unit: { select: { id: true, label: true, status: true, tower: { select: { code: true } } } } },
          orderBy: { effectiveFrom: "desc" },
        },
        vehicles: { where: { communityId, isActive: true } },
      },
    });
    if (!user || user.memberships.length === 0) throw Errors.notFound("Resident");
    return user;
  }

  async updateResident(communityId: string, actor: { userId: string; permissions: string[] }, targetUserId: string, patch: { fullName?: string; email?: string }) {
    const isSelf = actor.userId === targetUserId;
    if (!isSelf && !actor.permissions.includes("resident.write")) {
      throw Errors.forbidden("You cannot edit this profile.", "PERMISSION_DENIED");
    }
    const membershipExists = await this.prisma.communityMembership.findFirst({
      where: { userId: targetUserId, communityId, isActive: true },
    });
    if (!membershipExists && !isSelf) throw Errors.notFound("Resident");
    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: patch,
      select: { id: true, fullName: true, email: true },
    });
    await this.audit.record({
      action: "resident.updated",
      entityType: "user",
      entityId: targetUserId,
      communityId,
      actorUserId: actor.userId,
      after: patch,
    });
    return user;
  }

  async endOccupancy(occupancyId: string, actorUserId: string) {
    const occ = await this.prisma.unitOccupancy.findUnique({
      where: { id: occupancyId },
      include: { unit: true },
    });
    if (!occ || occ.effectiveTo) throw Errors.notFound("Active occupancy");
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.unitOccupancy.update({ where: { id: occupancyId }, data: { effectiveTo: new Date() } });
      const remaining = await tx.unitOccupancy.count({ where: { unitId: occ.unitId, effectiveTo: null } });
      await tx.unit.update({
        where: { id: occ.unitId },
        data: { status: remaining > 0 ? occ.unit.status : "VACANT" },
      });
      return u;
    });
    await this.audit.record({
      action: "resident.moveout",
      entityType: "unit_occupancy",
      entityId: occupancyId,
      communityId: occ.unit.communityId,
      actorUserId,
      before: { effectiveTo: null },
      after: { effectiveTo: updated.effectiveTo },
    });
    return updated;
  }

  /** Occupants of a unit — used by visitors/helpdesk/billing to resolve audiences. */
  async currentOccupantUserIds(unitId: string): Promise<string[]> {
    const rows = await this.prisma.unitOccupancy.findMany({
      where: { unitId, effectiveTo: null },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async myUnits(userId: string) {
    return this.prisma.unitOccupancy.findMany({
      where: { userId, effectiveTo: null },
      include: {
        unit: {
          select: {
            id: true, label: true, status: true,
            tower: { select: { name: true, code: true } },
            community: { select: { id: true, name: true, timezone: true } },
          },
        },
      },
    });
  }

  // ── Emergency contacts (self-service) ─────────────────────────────────────

  createEmergencyContact(userId: string, dto: { name: string; phone: string; relation?: string }) {
    return this.prisma.emergencyContact.create({
      data: { ownerUser: userId, name: dto.name, phone: normalizePhone(dto.phone), relation: dto.relation },
    });
  }

  listEmergencyContacts(userId: string) {
    return this.prisma.emergencyContact.findMany({ where: { ownerUser: userId }, orderBy: { name: "asc" } });
  }

  async deleteEmergencyContact(userId: string, contactId: string) {
    const contact = await this.prisma.emergencyContact.findUnique({ where: { id: contactId } });
    if (!contact || contact.ownerUser !== userId) throw Errors.notFound("Emergency contact");
    await this.prisma.emergencyContact.delete({ where: { id: contactId } });
    return { ok: true };
  }
}
