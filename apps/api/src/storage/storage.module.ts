import { Global, Module } from "@nestjs/common";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getEnv } from "../config/env";
import { LocalStorageDriver, S3StorageDriver, type IStorage } from "./storage";

@Global()
@Module({
  providers: [
    {
      provide: "IStorage",
      useFactory: (): IStorage => {
        const env = getEnv();
        if (env.STORAGE_DRIVER === "s3") {
          if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
            throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY");
          }
          return new S3StorageDriver({
            endpoint: env.S3_ENDPOINT,
            region: env.S3_REGION,
            bucket: env.S3_BUCKET,
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            publicBaseUrl: `http://localhost:${env.PORT}`,
          });
        }
        // Dev signing secret: derive deterministically from the JWT secret so
        // restarts don't invalidate outstanding URLs. Not used in production.
        return new LocalStorageDriver(
          path.resolve(process.cwd(), env.LOCAL_STORAGE_DIR),
          env.JWT_ACCESS_SECRET + ":file-signing",
          `http://localhost:${env.PORT}`,
          env.FILE_SIGNED_URL_TTL_SECONDS,
        );
      },
      inject: [],
    },
  ],
  exports: ["IStorage"],
})
export class StorageModule {
  static devSecret(): string {
    return randomBytes(16).toString("hex");
  }
}
