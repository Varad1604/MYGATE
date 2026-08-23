import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness — always cheap. */
  @Public()
  @Get()
  health() {
    return { status: "ok", at: new Date().toISOString() };
  }

  /** Readiness — verifies DB connectivity. */
  @Public()
  @Get("ready")
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "up" };
    } catch {
      return { status: "degraded", database: "down" };
    }
  }
}
