import { z } from "zod";

const isBuildTime =
typeof process !== "undefined" &&
(
process.env.NEXT_PHASE === "phase-production-build" ||
process.env.NEXT_PHASE?.includes("build") ||
process.env.npm_lifecycle_event === "build" ||
process.env.npm_lifecycle_event === "deploy:check" ||
process.argv.some((arg) => /next|build/i.test(arg)) ||
process.env.SKIP_ENV_VALIDATION === "true"
);

const envSchema = z.object({
// Server-side
DATABASE_URL: z.string().min(1),
PGBOUNCER_URL: z.string().min(1).optional(),
PRISMA_ACCELERATE_URL: z.string().min(1).optional(),
NODE_ENV: z
.enum(["development", "test", "production"])
.default("development"),
NEXTAUTH_URL: z.string().url(),
NEXT_PUBLIC_APP_URL: z.string().url().optional(),
APP_BASE_URL: z.string().url().optional(),
NEXTAUTH_SECRET: z.string().min(32),

// Redis: required in production for rate limiting, idempotency, and queues.
REDIS_URL: z.string().min(1).optional(),

// Third-party APIs
RAZORPAY_KEY_ID: z
.string()
.regex(/^rzp_(test|live)_[A-Za-z0-9]+$/, "RAZORPAY_KEY_ID must be a public Razorpay key"),
RAZORPAY_KEY_SECRET: z.string().min(1),
RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
RAZORPAY_ACCOUNT_NUMBER: z.string().min(1).optional(),
RESEND_API_KEY: z.string().min(1).optional(),
GOOGLE_CLIENT_ID: z.string().min(1),
GOOGLE_CLIENT_SECRET: z.string().min(1),
DIGILOCKER_CLIENT_ID: z.string().min(1).optional(),
DIGILOCKER_CLIENT_SECRET: z.string().min(1).optional(),
REPLY_TO_EMAIL: z.string().email().default("support@VyaparMedia.in"),

// Logging and monitoring
LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
PROMETHEUS_AUTH_TOKEN: z.string().min(32).optional(),
HEALTHCHECK_SECRET: z.string().min(32).optional(),
SENTRY_DSN: z.string().url().optional(),
NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
SENTRY_ENVIRONMENT: z.string().min(1).optional(),
NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().min(1).optional(),
SENTRY_RELEASE: z.string().min(1).optional(),
NEXT_PUBLIC_SENTRY_RELEASE: z.string().min(1).optional(),
SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
SENTRY_ORG: z.string().min(1).optional(),
SENTRY_PROJECT: z.string().min(1).optional(),
SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: z.coerce
.number()
.min(0)
.max(1)
.default(0.1),
NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: z.coerce
.number()
.min(0)
.max(1)
.default(0),

// Security
CRON_SECRET: z.string().min(32).optional(),
CONTRACT_SIGNING_SECRET: z.string().min(32).optional(),
HMAC_KEY: z.string().min(32),
ENCRYPTION_KEYS: z.string().min(67), // Format: v1:<64hex> = minimum 67 chars
ENCRYPTION_KEY: z.string().min(32).optional(),
KYC_PROVIDER: z.enum(["manual", "surepass"]).default("manual"),
KYC_API_KEY: z.string().min(1).optional(),
MSG91_TEMPLATE_ID: z.string().min(1).optional(),

// Feature flags and limits
PLATFORM_FEE_PERCENTAGE: z.coerce.number().default(10),
GATEWAY_FEE_PERCENTAGE: z.coerce.number().default(2),
MIN_WITHDRAWAL_AMOUNT: z.coerce.number().default(50000),
MAX_WALLET_BALANCE: z.coerce.number().default(1000000000),
ADMIN_EMAILS: z
.string()
.min(1)
.optional()
.refine(
(val) => {
if (!val) return true;
const emails = val.split(",").map((email) => email.trim());
return emails.every((email) => z.string().email().safeParse(email).success);
},
{
message: "All values in ADMIN_EMAILS must be valid emails separated by commas.",
}
),
E2E_MAGIC_OTP: z.string().optional(),

// Storage
STORAGE_PROVIDER: z
.enum(["local", "s3", "r2"])
.default("local"),
S3_BUCKET: z.string().optional(),
S3_REGION: z.string().optional(),
S3_ACCESS_KEY: z.string().optional(),
S3_SECRET_KEY: z.string().optional(),
S3_ENDPOINT: z.string().optional(),
STORAGE_PUBLIC_URL: z.string().optional(),
R2_PUBLIC_URL: z.string().optional(),
}).superRefine((env, ctx) => {
if (env.NODE_ENV !== "production") return;

const isVercel = process.env.VERCEL === "1";

validateGeneralAndApi(env, ctx);
validateSmsAndKyc(env, ctx);
validateDatabaseAndRedis(env, ctx, isVercel);
validateMonitoringAndApp(env, ctx);
validateStorage(env, ctx);
});

function validateGeneralAndApi(env: Record<string, unknown>, ctx: z.RefinementCtx) {
if (!env.CRON_SECRET) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["CRON_SECRET"],
message: "CRON_SECRET is required in production for Vercel Cron routes.",
});
}

if (!env.RESEND_API_KEY) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["RESEND_API_KEY"],
message: "RESEND_API_KEY is required in production for sending emails.",
});
}

if (env.E2E_MAGIC_OTP === "true") {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["E2E_MAGIC_OTP"],
message: "E2E_MAGIC_OTP must not be enabled in production environment.",
});
}

if (!env.CONTRACT_SIGNING_SECRET) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["CONTRACT_SIGNING_SECRET"],
message: "CONTRACT_SIGNING_SECRET is required in production for contract signing verification.",
});
}

if (!env.NEXT_PUBLIC_APP_URL && !env.APP_BASE_URL) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["NEXT_PUBLIC_APP_URL"],
message: "NEXT_PUBLIC_APP_URL or APP_BASE_URL is required for production links and callbacks.",
});
}
}

function validateSmsAndKyc(env: Record<string, unknown>, ctx: z.RefinementCtx) {
if (env.KYC_PROVIDER === "manual") {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["KYC_PROVIDER"],
message: "KYC_PROVIDER=manual is not allowed in production.",
});
}

if (env.KYC_PROVIDER !== "manual" && !env.KYC_API_KEY) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["KYC_API_KEY"],
message: "KYC_API_KEY is required when KYC_PROVIDER is not manual.",
});
}

if (!env.MSG91_TEMPLATE_ID) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["MSG91_TEMPLATE_ID"],
message: "MSG91_TEMPLATE_ID is required in production for DLT-compliant SMS.",
});
}
}

function validateDatabaseAndRedis(env: Record<string, unknown>, ctx: z.RefinementCtx, isVercel: boolean) {
if (!env.REDIS_URL) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["REDIS_URL"],
message: "REDIS_URL is required in production. Use Upstash rediss:// on Vercel.",
});
} else if (isVercel && !(env.REDIS_URL as string).startsWith("rediss://")) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["REDIS_URL"],
message: "Use a TLS rediss:// Redis URL for Upstash/Vercel production.",
});
}

if (isVercel && !env.PGBOUNCER_URL && !env.PRISMA_ACCELERATE_URL) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["PGBOUNCER_URL"],
message:
"PGBOUNCER_URL or PRISMA_ACCELERATE_URL is required on Vercel to avoid exhausting Supabase Postgres connections.",
});
}

if (env.PGBOUNCER_URL && !(env.PGBOUNCER_URL as string).includes("pgbouncer=true")) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["PGBOUNCER_URL"],
message: "PGBOUNCER_URL should include pgbouncer=true for Prisma transaction pooling.",
});
}
}

function validateMonitoringAndApp(env: Record<string, unknown>, ctx: z.RefinementCtx) {
if (!env.RAZORPAY_ACCOUNT_NUMBER) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["RAZORPAY_ACCOUNT_NUMBER"],
message: "RAZORPAY_ACCOUNT_NUMBER is required in production for RazorpayX payouts.",
});
}

if (!env.PROMETHEUS_AUTH_TOKEN) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["PROMETHEUS_AUTH_TOKEN"],
message: "PROMETHEUS_AUTH_TOKEN is required in production to protect /api/metrics.",
});
}

if (!env.SENTRY_DSN || !env.NEXT_PUBLIC_SENTRY_DSN) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["SENTRY_DSN"],
message:
"SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN are required in production for API, server, and browser error monitoring.",
});
}

if (!env.SENTRY_ENVIRONMENT || !env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["SENTRY_ENVIRONMENT"],
message:
"SENTRY_ENVIRONMENT and NEXT_PUBLIC_SENTRY_ENVIRONMENT should be set to production in production monitoring.",
});
}
}

function validateStorage(env: Record<string, unknown>, ctx: z.RefinementCtx) {
if (env.STORAGE_PROVIDER === "local") {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["STORAGE_PROVIDER"],
message: "Use STORAGE_PROVIDER=r2 or s3 in production; local uploads are not durable on Vercel.",
});
}

if (env.STORAGE_PROVIDER === "r2" || env.STORAGE_PROVIDER === "s3") {
const requiredStorageVars = ["S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"] as const;
for (const key of requiredStorageVars) {
if (!env[key]) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: [key],
message: `${key} is required when STORAGE_PROVIDER=${env.STORAGE_PROVIDER}.`,
});
}
}

if (!env.STORAGE_PUBLIC_URL && !env.R2_PUBLIC_URL) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["STORAGE_PUBLIC_URL"],
message:
"STORAGE_PUBLIC_URL or R2_PUBLIC_URL is required so uploaded files resolve from a durable public domain.",
});
}

if (env.STORAGE_PROVIDER === "r2" && !env.S3_ENDPOINT) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["S3_ENDPOINT"],
message: "S3_ENDPOINT is required for Cloudflare R2.",
});
}
}
}

const isServer = typeof window === "undefined";

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  const errorMessage = `Invalid environment variables:\n${JSON.stringify(
    _env.error.format(),
    null,
    2,
  )}`;

  if (!isBuildTime && isServer) {
    console.error(errorMessage);
    throw new Error(
      "Application cannot start: missing or invalid environment variables. Check server logs.",
    );
  } else if (isBuildTime) {
    // During build, log warning but don't throw. Vercel injects runtime secrets separately.
    console.warn("[BUILD] Environment variable warning:", errorMessage);
  }
}

// Security: in production runtime, never fall back to raw process.env.
if (
  !_env.success &&
  !isBuildTime &&
  isServer &&
  process.env.NODE_ENV === "production"
) {
  throw new Error(
    `[FATAL] Environment validation failed in production. Fix .env before deploying.\n${_env.error?.message ?? "Unknown validation error"}`,
  );
}

export const env = (_env.success
  ? _env.data
  : (process.env as unknown as z.infer<typeof envSchema>)) as z.infer<typeof envSchema>;

if (isServer) {
  if (_env.success && env.NODE_ENV !== "production" && !env.CONTRACT_SIGNING_SECRET) {
    console.warn(
      "\x1b[33m%s\x1b[0m",
      "[WARNING] CONTRACT_SIGNING_SECRET is not set in non-production environment. Contract signing and verification will throw errors until it is configured.",
    );
  }

  // Placeholder / ungenerated secret detection
  // Catches secrets that were copy-pasted from .env as-is without running `openssl rand -hex 32`.
  const PLACEHOLDER_PREFIXES = ["generate-with:", "your_", "change_in_production", "xxx"];
  const CRITICAL_SECRETS = [
    "CRON_SECRET",
    "CONTRACT_SIGNING_SECRET",
    "SIGNING_SECRET",
    "HMAC_KEY",
    "NEXTAUTH_SECRET",
  ] as const;

  for (const key of CRITICAL_SECRETS) {
    const val = process.env[key];
    if (val && PLACEHOLDER_PREFIXES.some((prefix) => val.toLowerCase().startsWith(prefix))) {
      const msg = `[SECURITY] ${key} contains an ungenerated placeholder value ("${val.slice(0, 20)}..."). Run: openssl rand -hex 32`;
      if (process.env.NODE_ENV === "production") {
        throw new Error(msg);
      } else {
        console.warn("\x1b[31m%s\x1b[0m", msg);
      }
    }
  }
}
