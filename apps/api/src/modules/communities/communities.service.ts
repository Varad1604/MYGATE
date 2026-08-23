import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLES } from "@societyos/permissions";
import { PrismaService } from "../../prisma/prisma.service";
import { Errors } from "../../common/app-exception";

const COMMUNITY_INCLUDE = {
  towers: { where: { deletedAt: null }, orderBy: { code: "asc" as const } },
  gates: { orderBy: { name: "asc" as const } },
  _count: { select: { units: true } },
};

/** Roles that exist per-community in the DB (PLATFORM_SUPER_ADMIN is a user flag). */
export const DB_SYSTEM_ROLES = SYSTEM_ROLES.filter((r) => r !== "PLATFORM_SUPER_ADMIN");

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async createCommunity(
    dto: { name: string; organizationName?: string; address?: string; city?: string; state?: string; postalCode?: string; timezone: string },
    createdByUserId: string,
  ) {
    const slugBase = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "community";

    const created = await this.prisma.$transaction(async (tx) => {
      let organizationId: string | undefined;
      if (dto.organizationName) {
        const orgSlug = `${slugBase}-${Date.now().toString(36)}`;
        const org = await tx.organization.create({
          data: { name: dto.organizationName, slug: orgSlug },
        });
        organizationId = org.id;
      }
      // Unique slug with suffix fallback
      let slug = slugBase;
      for (let i = 0; i < 5; i++) {
        const exists = await tx.community.findUnique({ where: { slug } });
        if (!exists) break;
        slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;
      }

      const community = await tx.community.create({
        data: {
          name: dto.name,
          slug,
          organizationId,
          address: dto.address,
          city: dto.city,
          state: dto.state,
          postalCode: dto.postalCode,
          timezone: dto.timezone,
          status: "ACTIVE",
          settings: { visitorApprovalTimeoutSeconds: 90 },
        },
      });

      // Seed system roles for this community.
      await tx.role.createMany({
        data: DB_SYSTEM_ROLES.map((key) => ({
          communityId: community.id,
          key,
          name: key
            .split("_")
            .map((w) => w[0] + w.slice(1).toLowerCase())
            .join(" "),
          isSystem: true,
          permissions: [...SYSTEM_ROLE_PERMISSIONS[key]],
        })),
      });

      return community;
    });

    return this.prisma.community.findUniqueOrThrow({
      where: { id: created.id },
      include: COMMUNITY_INCLUDE,
    });
  }

  /** Platform admin listing — every community. */
  async listAll() {
    return this.prisma.community.findMany({
      where: { deletedAt: null },
      include: COMMUNITY_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(communityId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: COMMUNITY_INCLUDE,
    });
    if (!community || community.deletedAt) throw Errors.notFound("Community");
    return community;
  }

  async updateSettings(communityId: string, patch: Record<string, number>) {
    const community = await this.getById(communityId);
    const current = (community.settings ?? {}) as Record<string, unknown>;
    const next = { ...current, ...patch } as unknown as Prisma.InputJsonObject;
    await this.prisma.community.update({ where: { id: communityId }, data: { settings: next } });
    return next;
  }

  async setStatus(communityId: string, status: "ONBOARDING" | "ACTIVE" | "SUSPENDED") {
    await this.getById(communityId);
    return this.prisma.community.update({ where: { id: communityId }, data: { status } });
  }

  /** Asserts the caller may operate within a community. Platform admins bypass. */
  assertCommunityAccess(auth: { communityId?: string; isPlatformSuperAdmin: boolean }, communityId: string): void {
    if (auth.isPlatformSuperAdmin) return;
    if (auth.communityId !== communityId) throw Errors.crossTenant();
  }
}

export type CommunityWithRelations = Prisma.CommunityGetPayload<{ include: typeof COMMUNITY_INCLUDE }>;
