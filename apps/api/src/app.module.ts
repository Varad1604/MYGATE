import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { getEnv } from "./config/env";
import { PrismaModule } from "./prisma/prisma.module";
import { QueueModule } from "./queue/queue.module";
import { StorageModule } from "./storage/storage.module";
import { AuthController } from "./auth/auth.controller";
import { DevAuthController } from "./auth/dev-auth.controller";
import { AuthService } from "./auth/auth.service";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./auth/permissions.guard";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { AuditModule } from "./audit/audit.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { CommunitiesModule } from "./modules/communities/communities.module";
import { ResidentsModule } from "./modules/residents/residents.module";
import { VisitorsModule } from "./modules/visitors/visitors.module";
import { HelpdeskModule } from "./modules/helpdesk/helpdesk.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: "default", ttl: 60_000, limit: 300 }],
    }),
    JwtModule.registerAsync({
      useFactory: () => {
        const env = getEnv();
        return {
          secret: env.JWT_ACCESS_SECRET,
          signOptions: { expiresIn: env.ACCESS_TOKEN_TTL_SECONDS },
        };
      },
    }),
    PrismaModule,
    QueueModule,
    StorageModule,
    AuditModule,
    RealtimeModule,
    NotificationsModule,
    CommunitiesModule,
    ResidentsModule,
    VisitorsModule,
    HelpdeskModule,
  ],
  controllers: [AuthController, DevAuthController, HealthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
