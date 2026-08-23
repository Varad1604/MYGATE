import { Global, Module } from "@nestjs/common";
import { getEnv } from "../config/env";
import { DbQueueDriver } from "./db-queue.driver";
import { BullMqQueueDriver } from "./bullmq-queue.driver";
import type { IQueue } from "./queue.types";

@Global()
@Module({
  providers: [
    DbQueueDriver,
    BullMqQueueDriver,
    {
      provide: "IQueue",
      useFactory: (dbDriver: DbQueueDriver, bullDriver: BullMqQueueDriver): IQueue => {
        const env = getEnv();
        return env.REDIS_URL && env.NODE_ENV === "production" ? bullDriver : dbDriver;
      },
      inject: [DbQueueDriver, BullMqQueueDriver],
    },
  ],
  exports: ["IQueue"],
})
export class QueueModule {}
