import { Global, Module } from "@nestjs/common";
import { SseHubService } from "./sse-hub.service";
import { RealtimeController } from "./realtime.controller";

@Global()
@Module({
  controllers: [RealtimeController],
  providers: [SseHubService],
  exports: [SseHubService],
})
export class RealtimeModule {}
