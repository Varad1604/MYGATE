import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RequirePermissions } from "../../auth/permissions.guard";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AccessContext } from "../../auth/auth.service";

/** Guard-scoped lookups — minimal PII, no resident data. */
@Controller("gate")
export class GateDirectoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("gates")
  @RequirePermissions("visitor.read")
  gates(@CurrentUser() auth: AccessContext) {
    return this.prisma.gate.findMany({
      where: { communityId: auth.communityId!, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { code: "asc" },
    });
  }

  @Get("units")
  @RequirePermissions("visitor.gate.operations")
  async units(@CurrentUser() auth: AccessContext) {
    const units = await this.prisma.unit.findMany({
      where: { communityId: auth.communityId!, deletedAt: null },
      select: {
        id: true,
        label: true,
        tower: { select: { code: true } },
      },
      orderBy: [{ tower: { code: "asc" } }, { label: "asc" }],
    });
    return items(units);
  }
}

function items<T>(arr: T[]): T[] {
  return arr;
}
