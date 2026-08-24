import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const BOOT_RETRY_MS = 60_000;
const BOOT_RETRY_STEP = 2_000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"] });
  }

  /**
   * Boot tolerates a database that is still coming up (embedded dev server,
   * container orchestration cold start): retry with backoff for up to a minute
   * before failing the process.
   */
  async onModuleInit(): Promise<void> {
    const deadline = Date.now() + BOOT_RETRY_MS;
    for (;;) {
      try {
        await this.$connect();
        return;
      } catch (err) {
        if (Date.now() >= deadline) throw err;
        // eslint-disable-next-line no-console
        console.warn(`[prisma] database not ready, retrying in ${BOOT_RETRY_STEP / 1000}s…`);
        await new Promise((r) => setTimeout(r, BOOT_RETRY_STEP));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
