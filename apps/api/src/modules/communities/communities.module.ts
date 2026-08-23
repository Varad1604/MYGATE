import { Module } from "@nestjs/common";
import { CommunitiesService } from "./communities.service";
import { StructureService } from "./structure.service";
import { PlatformCommunitiesController, StructureController } from "./communities.controller";

@Module({
  controllers: [PlatformCommunitiesController, StructureController],
  providers: [CommunitiesService, StructureService],
  exports: [CommunitiesService, StructureService],
})
export class CommunitiesModule {}
