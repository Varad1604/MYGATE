import "reflect-metadata";
import { loadDotenv } from "./config/load-dotenv";

loadDotenv();

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { getEnv } from "./config/env";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { newRequestContext, runWithRequestContext } from "./common/request-context";

async function bootstrap(): Promise<void> {
  const env = getEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  const origins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix("api/v1");
  // Validation is zod-per-route (ZodValidationPipe) — no global class-validator pipe.
  app.useGlobalFilters(new AllExceptionsFilter());

  // requestId propagation for every request (observability, audit)
  app.use((req: import("express").Request, res: import("express").Response, next: () => void) => {
    const ctx = newRequestContext(req.ip ?? undefined, req.headers["user-agent"]);
    res.setHeader("X-Request-Id", ctx.requestId);
    runWithRequestContext(ctx, next);
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("SocietyOS API")
    .setDescription("Multi-tenant Community Management ERP & Gate Security SaaS")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  const queue = app.get("IQueue") as { start: () => Promise<void> };
  await queue.start();

  await app.listen(env.PORT, "0.0.0.0");
  new Logger("Bootstrap").log(`API ready on http://localhost:${env.PORT}/api/v1 · OpenAPI /docs`);
}

void bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal bootstrap error:", err);
  process.exit(1);
});
