import { Module } from "@nestjs/common";
import { NoticesController } from "./notices.controller";
import { NoticesService } from "./notices.service";
import { NoticePublishJob } from "./notice-publish.job";

@Module({
  controllers: [NoticesController],
  providers: [NoticesService, NoticePublishJob],
  exports: [NoticesService],
})
export class NoticesModule {}
