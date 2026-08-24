import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001,http://localhost:3002"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().default(2_592_000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().optional(),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_DIR: z.string().default(".localdata/storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  FILE_SIGNED_URL_TTL_SECONDS: z.coerce.number().default(600),
  OTP_PROVIDER: z.enum(["mock", "sms-adapter", "email-adapter"]).default("mock"),
  EMAIL_PROVIDER: z.enum(["mock"]).default("mock"),
  OTP_TTL_SECONDS: z.coerce.number().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_REQUESTS_PER_10MIN: z.coerce.number().default(3),
  MOCK_PAYMENT_WEBHOOK_SECRET: z.string().default("dev-mock-payment-secret"),
  DEFAULT_VISITOR_APPROVAL_TIMEOUT_SECONDS: z.coerce.number().default(90),
});

/**
 * Production must not run on developer conveniences: the demo webhook secret
 * and mock SMS provider would silently make money flows forgeable and login
 * non-functional against real phones.
 */
const envSchemaWithProdGuards = envSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV !== "production") return;
  if (env.MOCK_PAYMENT_WEBHOOK_SECRET === "dev-mock-payment-secret") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["MOCK_PAYMENT_WEBHOOK_SECRET"],
      message: "Set a strong MOCK_PAYMENT_WEBHOOK_SECRET before accepting payments.",
    });
  }
  if (env.OTP_PROVIDER === "mock") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["OTP_PROVIDER"],
      message: "Configure a real OTP_PROVIDER (sms-adapter/email-adapter) for production.",
    });
  }
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Parse and cache process.env once; throw a readable error on misconfiguration. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchemaWithProdGuards.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration → ${issues}`);
  }
  cached = parsed.data;
  return cached;
}
