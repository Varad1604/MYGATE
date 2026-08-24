import { Controller, Get, Param, Query } from "@nestjs/common";
import { z } from "zod";
import { ReportsService } from "./reports.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { RequirePermissions } from "../../auth/permissions.guard";

const WindowQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
const PeriodQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("communities/:communityId/reports/summary")
  @RequirePermissions("reports.view")
  summary(@Param("communityId") communityId: string) {
    return this.reports.summary(communityId);
  }

  @Get("communities/:communityId/reports/collections")
  @RequirePermissions("reports.view")
  collections(
    @Param("communityId") communityId: string,
    @Query(new ZodValidationPipe(PeriodQuery)) query: unknown,
  ) {
    const q = query as { from?: string; to?: string };
    return this.reports.collections(communityId, { from: q.from, to: q.to });
  }

  @Get("communities/:communityId/reports/helpdesk")
  @RequirePermissions("reports.view")
  helpdesk(
    @Param("communityId") communityId: string,
    @Query(new ZodValidationPipe(WindowQuery)) query: unknown,
  ) {
    return this.reports.helpdesk(communityId, (query as { days: number }).days);
  }

  @Get("communities/:communityId/reports/visitors")
  @RequirePermissions("reports.view")
  visitors(
    @Param("communityId") communityId: string,
    @Query(new ZodValidationPipe(WindowQuery)) query: unknown,
  ) {
    return this.reports.visitorReport(communityId, (query as { days: number }).days);
  }
}
