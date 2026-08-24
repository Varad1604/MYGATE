import { Module } from "@nestjs/common";
import { VisitorsService } from "./visitors.service";
import { VisitorTokensService } from "./visitor-tokens.service";
import { GateOpsService } from "./gate-ops.service";
import { VisitorsController } from "./visitors.controller";
import { GateDirectoryController } from "./gate-directory.controller";
import { DomesticHelpController } from "./domestic-help.controller";
import { DomesticHelpService } from "./domestic-help.service";
import { VisitorExpiryJob } from "./visitor-expiry.job";

@Module({
  controllers: [VisitorsController, GateDirectoryController, DomesticHelpController],
  providers: [VisitorsService, VisitorTokensService, GateOpsService, DomesticHelpService, VisitorExpiryJob],
  exports: [VisitorsService, VisitorTokensService],
})
export class VisitorsModule {}
