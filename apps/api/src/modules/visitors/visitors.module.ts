import { Module } from "@nestjs/common";
import { VisitorsService } from "./visitors.service";
import { VisitorTokensService } from "./visitor-tokens.service";
import { GateOpsService } from "./gate-ops.service";
import { VisitorsController } from "./visitors.controller";
import { GateDirectoryController } from "./gate-directory.controller";
import { VisitorExpiryJob } from "./visitor-expiry.job";

@Module({
  controllers: [VisitorsController, GateDirectoryController],
  providers: [VisitorsService, VisitorTokensService, GateOpsService, VisitorExpiryJob],
  exports: [VisitorsService, VisitorTokensService],
})
export class VisitorsModule {}
