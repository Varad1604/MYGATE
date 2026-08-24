import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { DomesticHelpService } from "./domestic-help.service";
import { AssignUnitSchema, CreateHelpProfileSchema } from "./domestic-help.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUser } from "../../auth/current-user.decorator";
import { RequirePermissions } from "../../auth/permissions.guard";
import type { AccessContext } from "../../auth/auth.service";

const ListQuerySchema = z.object({
  category: z.string().trim().max(20).optional(),
  activeOnly: z.enum(["true", "false"]).optional(),
});
const LookupQuerySchema = z.object({ phone: z.string().trim().regex(/^(\+?\d[\d\s-]{7,17})$/) });

@Controller()
export class DomesticHelpController {
  constructor(private readonly help: DomesticHelpService) {}

  @Post("communities/:communityId/domestic-help")
  create(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Body(new ZodValidationPipe(CreateHelpProfileSchema)) dto: unknown,
  ) {
    return this.help.create(communityId, auth.userId, auth.permissions, dto as never);
  }

  @Get("communities/:communityId/domestic-help")
  async list(
    @CurrentUser() auth: AccessContext,
    @Param("communityId") communityId: string,
    @Query(new ZodValidationPipe(ListQuerySchema)) query: unknown,
  ) {
    const q = query as { category?: string; activeOnly?: string };
    return this.help.list(communityId, {
      category: q.category,
      activeOnly: q.activeOnly === undefined ? undefined : q.activeOnly === "true",
    });
  }

  @Post("domestic-help/:profileId/assign-unit")
  assignUnit(
    @CurrentUser() auth: AccessContext,
    @Param("profileId") profileId: string,
    @Body(new ZodValidationPipe(AssignUnitSchema)) dto: unknown,
  ) {
    const body = dto as { unitId: string };
    void (dto as { allowedDays?: string }).allowedDays; // stored per-assignment in a later slice
    return this.help.assignUnit(auth.communityId!, auth.userId, auth.permissions, profileId, body.unitId);
  }

  @Post("domestic-help/:profileId/deactivate")
  deactivate(@CurrentUser() auth: AccessContext, @Param("profileId") profileId: string) {
    return this.help.deactivate(auth.communityId!, auth.userId, profileId);
  }

  /** Guard entry-point lookup by phone — minimal PII. */
  @Get("gate/domestic-help/lookup")
  @RequirePermissions("visitor.gate.operations")
  lookup(
    @CurrentUser() _auth: AccessContext,
    @Query(new ZodValidationPipe(LookupQuerySchema)) query: unknown,
  ) {
    void _auth;
    return this.help.gateLookup(_auth.communityId!, (query as { phone: string }).phone);
  }
}
