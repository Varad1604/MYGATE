import { Module } from "@nestjs/common";
import { ResidentsService } from "./residents.service";
import { ResidentsController } from "./residents.controller";
import { CommunitiesModule } from "../communities/communities.module";

@Module({
  imports: [CommunitiesModule],
  controllers: [ResidentsController],
  providers: [ResidentsService],
  exports: [ResidentsService],
})
export class ResidentsModule {}
