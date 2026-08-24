import { Module } from "@nestjs/common";
import { HelpdeskController } from "./helpdesk.controller";
import { HelpdeskService } from "./helpdesk.service";
import { TicketSlaJob } from "./ticket-sla.job";

@Module({
  controllers: [HelpdeskController],
  providers: [HelpdeskService, TicketSlaJob],
  exports: [HelpdeskService],
})
export class HelpdeskModule {}
