import { z } from "zod";
import { randomBytes } from "crypto";

// Ephemeral per-process secrets for dev and test ONLY — never a constant in source
const devFallbackAuthSecret =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production"
    ? randomBytes(32).toString("hex")
    : undefined;
const devFallbackHmacKey =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production"
    ? randomBytes(32).toString("hex")
    : undefined;

// Standard platform fee defaults (aligned with @/constants/deals.ts)
const DEFAULT_BRAND_PLATFORM_FEE_PERCENT = 10;
const DEFAULT_GATEWAY_FEE_PERCENT = 2;

const shouldSkipValidation =
  typeof process !== "undefined" &&
  (
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true"
  );

const _isBuildTime =
  typeof process !== "undefined" &&
  !shouldSkipValidation &&
  (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE?.includes("build") ||
    process.env.npm_lifecycle_event === "build" ||
    process.env.npm_lifecycle_event === "deploy:check" ||
    process.argv.some((arg) => /next|build/i.test(arg))
  );

const detectedAppUrl =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_BASE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  "https://vyaparmedia-nine.vercel.app";

const emptyAsUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (typeof val === "string" && val.trim() === "" ? undefined : val), schema);

export const envSchema = z.object({
  // Server-side
  DATABASE_URL: z.preprocess(
    (val) => (typeof val === "string" && val.trim() !== "" ? val : "postgresql://postgres:postgres@localhost:5432/vyaparmedia"),
    z.string().min(1)
  ),
  PGBOUNCER_URL: emptyAsUndefined(z.string().min(1).optional()),
  PRISMA_ACCELERATE_URL: emptyAsUndefined(z.string().min(1).optional()),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXTAUTH_URL: z.string().url().default(detectedAppUrl),
  NEXT_PUBLIC_APP_URL: z.string().url().default(detectedAppUrl),
  APP_BASE_URL: z.string().url().default(detectedAppUrl),
  NEXTAUTH_SECRET: emptyAsUndefined(z.string().min(32).optional()),

  // Redis: required in production for rate limiting, idempotency, and queues.
  REDIS_URL: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: emptyAsUndefined(z.string().url().optional()),
  UPSTASH_REDIS_REST_TOKEN: emptyAsUndefined(z.string().min(1).optional()),

  // Upstash QStash (Background & Cron Scheduler)
  QSTASH_TOKEN: emptyAsUndefined(z.string().min(1).optional()),
  QSTASH_CURRENT_SIGNING_KEY: emptyAsUndefined(z.string().min(1).optional()),
  QSTASH_NEXT_SIGNING_KEY: emptyAsUndefined(z.string().min(1).optional()),

  // Database Read Replica & Tuning
  DATABASE_READ_REPLICA_URL: emptyAsUndefined(z.string().min(1).optional()),
  ALLOW_INSECURE_DATABASE: z.enum(["true", "false"]).optional().default("false"),
  DB_SLOW_QUERY_THRESHOLD_MS: z.coerce.number().optional().default(process.env.NODE_ENV === "production" ? 1000 : 2500),
  SLOW_QUERY_THRESHOLD_MS: z.coerce.number().optional().default(process.env.NODE_ENV === "production" ? 1000 : 2500),
  AWS_LAMBDA_FUNCTION_NAME: emptyAsUndefined(z.string().optional()),

  // Third-party APIs & Realtime
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z
    .string()
    .optional()
    .default("rzp_test_placeholder"),
  RAZORPAY_KEY_ID: z
    .string()
    .optional()
    .default("rzp_test_placeholder"),
  ALLOW_RZP_TEST: z.enum(["true", "false"]).optional().default("false"),
  RAZORPAY_KEY_SECRET: z.string().optional().default("placeholder_secret"),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default("placeholder_webhook_secret"),
  RAZORPAY_ACCOUNT_NUMBER: emptyAsUndefined(z.string().min(1).optional()),
  RESEND_API_KEY: emptyAsUndefined(z.string().min(1).optional()),
  GOOGLE_CLIENT_ID: emptyAsUndefined(z.string().optional()),
  GOOGLE_CLIENT_SECRET: emptyAsUndefined(z.string().optional()),
  DIGILOCKER_CLIENT_ID: emptyAsUndefined(z.string().min(1).optional()),
  DIGILOCKER_CLIENT_SECRET: emptyAsUndefined(z.string().min(1).optional()),
  REPLY_TO_EMAIL: z.string().email().default("support@VyaparMedia.in"),
  FROM_EMAIL: emptyAsUndefined(z.string().email().optional().default("noreply@vyaparmedia.in")),
  MARKETING_FROM_EMAIL: emptyAsUndefined(z.string().email().optional().default("newsletter@mail.vyaparmedia.in")),

  // Shiprocket Logistics
  SHIPROCKET_EMAIL: emptyAsUndefined(z.string().min(1).optional()),
  SHIPROCKET_PASSWORD: emptyAsUndefined(z.string().min(1).optional()),
  SHIPROCKET_WEBHOOK_SECRET: emptyAsUndefined(z.string().min(1).optional()),
  SHIPROCKET_PICKUP_LOCATION: emptyAsUndefined(z.string().min(1).optional().default("Primary")),
  SHIPROCKET_PICKUP_PINCODE: emptyAsUndefined(z.string().min(6).optional().default("110001")),

  // Social Media OAuth & APIs
  INSTAGRAM_APP_ID: emptyAsUndefined(z.string().min(1).optional()),
  INSTAGRAM_APP_SECRET: emptyAsUndefined(z.string().min(1).optional()),
  INSTAGRAM_REDIRECT_URI: emptyAsUndefined(z.string().url().optional()),
  YOUTUBE_API_KEY: emptyAsUndefined(z.string().min(1).optional()),
  YOUTUBE_DAILY_QUOTA: z.coerce.number().optional().default(10000),

  // SMS & WhatsApp Communications
  TWILIO_ACCOUNT_SID: emptyAsUndefined(z.string().min(1).optional()),
  TWILIO_AUTH_TOKEN: emptyAsUndefined(z.string().min(1).optional()),
  TWILIO_WHATSAPP_FROM: emptyAsUndefined(z.string().min(1).optional()),
  WHATSAPP_ACCESS_TOKEN: emptyAsUndefined(z.string().min(1).optional()),
  WHATSAPP_PHONE_NUMBER_ID: emptyAsUndefined(z.string().min(1).optional()),
  WHATSAPP_PROVIDER: z.enum(["auto", "twilio", "meta"]).optional().default("auto"),
  WHATSAPP_OTP_TEMPLATE_NAME: emptyAsUndefined(z.string().optional()),
  WHATSAPP_TEMPLATE_LANGUAGE: emptyAsUndefined(z.string().optional().default("en_US")),
  MSG91_AUTH_KEY: emptyAsUndefined(z.string().min(1).optional()),
  MSG91_SENDER_ID: emptyAsUndefined(z.string().min(1).optional().default("DCSNL")),
  SMS_API_KEY: emptyAsUndefined(z.string().min(1).optional()),
  SMS_SENDER_ID: emptyAsUndefined(z.string().min(1).optional().default("DCSNL")),
  OTP_PRIMARY_CHANNEL: z.enum(["whatsapp", "sms"]).optional().default("whatsapp"),
  OTP_SMS_FALLBACK: z.preprocess((val) => val === "true" || val === true || val === "1" || val === 1, z.boolean()).optional().default(true),


  // Web Push Notifications
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: emptyAsUndefined(z.string().min(1).optional()),
  VAPID_PUBLIC_KEY: emptyAsUndefined(z.string().min(1).optional()),
  VAPID_PRIVATE_KEY: emptyAsUndefined(z.string().min(1).optional()),
  VAPID_SUBJECT: emptyAsUndefined(z.string().min(1).optional().default("mailto:security@vyaparmedia.in")),
  ENABLE_WEB_PUSH: z
    .preprocess((val) => val === "true" || val === true || val === "1", z.boolean())
    .optional()
    .default(false),

  // Computer Vision OCR (Contact Leakage Detection)
  VISION_API_KEY: emptyAsUndefined(z.string().min(1).optional()),
  ENABLE_VISION_OCR: z
    .preprocess((val) => val === "true" || val === true || val === "1", z.boolean())
    .optional()
    .default(true),

  // Logging and monitoring
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PROMETHEUS_AUTH_TOKEN: emptyAsUndefined(z.string().min(32).optional()),
  HEALTHCHECK_SECRET: emptyAsUndefined(z.string().min(32).optional()),
  SENTRY_DSN: emptyAsUndefined(z.string().url().optional()),
  NEXT_PUBLIC_SENTRY_DSN: emptyAsUndefined(z.string().url().optional()),
  SENTRY_ENVIRONMENT: emptyAsUndefined(z.string().min(1).optional()),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: emptyAsUndefined(z.string().min(1).optional()),
  SENTRY_RELEASE: emptyAsUndefined(z.string().min(1).optional()),
  NEXT_PUBLIC_SENTRY_RELEASE: emptyAsUndefined(z.string().min(1).optional()),
  SENTRY_AUTH_TOKEN: emptyAsUndefined(z.string().min(1).optional()),
  SENTRY_ORG: emptyAsUndefined(z.string().min(1).optional()),
  SENTRY_PROJECT: emptyAsUndefined(z.string().min(1).optional()),
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
  AUTH_SECRET: emptyAsUndefined(z.string().min(32).optional()),
  CRON_SECRET: z.string().min(32).optional(),
  CONTRACT_SIGNING_SECRET: z.string().min(32).optional(),
  HMAC_KEY: emptyAsUndefined(z.string().min(32).optional()),
  ENCRYPTION_KEYS: z.preprocess(
    (val) => (typeof val === "string" && val.trim() !== "" ? val : "v1:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
    z.string().min(67)
  ), // Format: v1:<64hex> = minimum 67 chars
  ENCRYPTION_KEY: z.string().min(32).optional(),
  KYC_PROVIDER: z.enum(["manual", "surepass", "mock"]).default("manual"),
  KYC_API_KEY: z.string().min(1).optional(),
  MSG91_TEMPLATE_ID: z.string().min(1).optional(),
  OTP_HASH_SECRET: emptyAsUndefined(z.string().min(16).optional()),

  // Platform Corporate & Tax Compliance Details (Used in CSV/PDF statement exports)
  PLATFORM_GSTIN: emptyAsUndefined(z.string().optional()),
  PLATFORM_CIN: emptyAsUndefined(z.string().optional()),
  PLATFORM_PAN: emptyAsUndefined(z.string().optional()),
  PLATFORM_ADDRESS: emptyAsUndefined(z.string().optional()),
  PLATFORM_EMAIL: z.string().email().default("support@VyaparMedia.in"),
  PLATFORM_PHONE: z.string().default("+91-8045678900"),
  PLATFORM_WEBSITE: z.string().default("https://vyaparmedia-nine.vercel.app"),
  NEXT_PUBLIC_PLATFORM_GSTIN: emptyAsUndefined(z.string().optional()),
  NEXT_PUBLIC_PLATFORM_CIN: emptyAsUndefined(z.string().optional()),
  NEXT_PUBLIC_PLATFORM_PHONE: emptyAsUndefined(z.string().optional()),

  // Feature flags and limits
  PLATFORM_FEE_PERCENTAGE: z.coerce.number().default(DEFAULT_BRAND_PLATFORM_FEE_PERCENT),
  GATEWAY_FEE_PERCENTAGE: z.coerce.number().default(DEFAULT_GATEWAY_FEE_PERCENT),
  MIN_WITHDRAWAL_AMOUNT: z.coerce.number().default(50000),
  MAX_WITHDRAWAL_AMOUNT: z.coerce.number().default(50000000),
  NEXT_PUBLIC_MIN_WITHDRAWAL_AMOUNT: z.coerce.number().optional().default(50000),
  NEXT_PUBLIC_MAX_WITHDRAWAL_AMOUNT: z.coerce.number().optional().default(50000000),
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

  // Runtime environment metadata
  VERCEL: emptyAsUndefined(z.string().optional()),
  VERCEL_URL: emptyAsUndefined(z.string().optional()),
  VERCEL_PROJECT_PRODUCTION_URL: emptyAsUndefined(z.string().optional()),
  NEXT_PHASE: emptyAsUndefined(z.string().optional()),
  VITEST: emptyAsUndefined(z.string().optional()),
}).superRefine((env, ctx) => {
if (env.NODE_ENV !== "production") return;

const isVercel = process.env.VERCEL === "1";

validateGeneralAndApi(env, ctx);
validateSmsAndKyc(env, ctx);
validateDatabaseAndRedis(env, ctx, isVercel);
validateMonitoringAndApp(env, ctx);
validateStorage(env, ctx);
validateLogistics(env, ctx);
validateWebPush(env, ctx);
validatePlatformCompliance(env, ctx);
});

function validatePlatformCompliance(env: Record<string, unknown>, ctx: z.RefinementCtx) {
  const gstin = env.PLATFORM_GSTIN as string | undefined;
  if (!gstin || gstin.includes("XXXX") || gstin === "07AABCV1234F1Z5") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["PLATFORM_GSTIN"],
      message: "PLATFORM_GSTIN must not be dummy or empty in production.",
    });
  }

  const cin = env.PLATFORM_CIN as string | undefined;
  if (!cin || cin.includes("XXXX") || cin === "U74999DL2024PTC123456") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["PLATFORM_CIN"],
      message: "PLATFORM_CIN must not be dummy or empty in production.",
    });
  }

  const phone = env.PLATFORM_PHONE as string | undefined;
  if (!phone || phone.includes("XXXX") || phone === "+91-XXXXXXXXXX") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["PLATFORM_PHONE"],
      message: "PLATFORM_PHONE must not be dummy or empty in production.",
    });
  }
}

function validateGeneralAndApi(env: Record<string, unknown>, ctx: z.RefinementCtx) {
  // Enforce critical auth and HMAC secrets in production
  const authSecret = (env.AUTH_SECRET || env.NEXTAUTH_SECRET) as string | undefined;
  const KNOWN_AUTH_PLACEHOLDERS = [
    "default_fallback_secret",
    "default_hmac_key",
    "generate-with:",
    "your_",
    "change_in_production",
    "xxx",
  ];

  if (!authSecret || authSecret.trim().length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AUTH_SECRET"],
      message: "AUTH_SECRET (or NEXTAUTH_SECRET) must be configured with at least 32 characters in production.",
    });
  } else if (KNOWN_AUTH_PLACEHOLDERS.some((p) => authSecret.toLowerCase().includes(p.toLowerCase()))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AUTH_SECRET"],
      message: "AUTH_SECRET must not use a known fallback or placeholder in production.",
    });
  }

  const hmacKey = env.HMAC_KEY as string | undefined;
  if (!hmacKey || hmacKey.trim().length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["HMAC_KEY"],
      message: "HMAC_KEY must be configured with at least 32 characters in production.",
    });
  } else if (KNOWN_AUTH_PLACEHOLDERS.some((p) => hmacKey.toLowerCase().includes(p.toLowerCase()))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["HMAC_KEY"],
      message: "HMAC_KEY must not use a known fallback or placeholder in production.",
    });
  }

  // P1-REL-12 / RZP-KEY-01: Enforce critical payment and cron secrets in production
  const rzpKeyId = env.RAZORPAY_KEY_ID as string | undefined;
  const allowRzpTest = env.ALLOW_RZP_TEST === "true" || process.env.ALLOW_RZP_TEST === "true";
  if (!rzpKeyId || rzpKeyId === "rzp_test_placeholder" || rzpKeyId.trim() === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["RAZORPAY_KEY_ID"],
      message: "RAZORPAY_KEY_ID must be configured with a valid Razorpay key in production.",
    });
  } else if (rzpKeyId.startsWith("rzp_test_") && !allowRzpTest) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["RAZORPAY_KEY_ID"],
      message: "RAZORPAY_KEY_ID must not use test key (rzp_test_*) in production environment unless ALLOW_RZP_TEST=true is explicitly configured.",
    });
  }

  const nextPublicRzpKeyId = env.NEXT_PUBLIC_RAZORPAY_KEY_ID as string | undefined;
  if (rzpKeyId && nextPublicRzpKeyId) {
    const serverIsTest = rzpKeyId.startsWith("rzp_test_");
    const clientIsTest = nextPublicRzpKeyId.startsWith("rzp_test_");
    if (serverIsTest !== clientIsTest) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_RAZORPAY_KEY_ID"],
        message: `NEXT_PUBLIC_RAZORPAY_KEY_ID mode (${clientIsTest ? "test" : "live"}) must match server RAZORPAY_KEY_ID mode (${serverIsTest ? "test" : "live"}).`,
      });
    }
  }

  const rzpKeySecret = env.RAZORPAY_KEY_SECRET as string | undefined;
  if (!rzpKeySecret || rzpKeySecret === "placeholder_secret" || rzpKeySecret.trim() === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["RAZORPAY_KEY_SECRET"],
      message: "RAZORPAY_KEY_SECRET must be configured with a valid Razorpay secret in production.",
    });
  }

  const cronSecret = env.CRON_SECRET as string | undefined;
  if (!cronSecret || cronSecret.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CRON_SECRET"],
      message: "CRON_SECRET must be configured with at least 32 characters in production.",
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
    console.warn("[PRODUCTION WARNING] CONTRACT_SIGNING_SECRET is not configured in production.");
  }

  const isInstagramEnabled =
    env.FEATURE_INSTAGRAM === "true" ||
    process.env.FEATURE_INSTAGRAM === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_INSTAGRAM === "true";

  if (isInstagramEnabled) {
    const igAppId = env.INSTAGRAM_APP_ID as string | undefined;
    if (!igAppId || igAppId.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["INSTAGRAM_APP_ID"],
        message: "INSTAGRAM_APP_ID must be configured in production when Instagram integration is enabled.",
      });
    }

    const igAppSecret = env.INSTAGRAM_APP_SECRET as string | undefined;
    if (!igAppSecret || igAppSecret.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["INSTAGRAM_APP_SECRET"],
        message: "INSTAGRAM_APP_SECRET must be configured in production when Instagram integration is enabled.",
      });
    }
  }
}

function validateSmsAndKyc(env: Record<string, unknown>, ctx: z.RefinementCtx) {
  if (env.KYC_PROVIDER === "mock") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["KYC_PROVIDER"],
      message: "CRITICAL_SECURITY_VIOLATION: KYC_PROVIDER cannot be 'mock' in production environment.",
    });
  }
  if (env.KYC_PROVIDER !== "manual" && env.KYC_PROVIDER !== "mock" && !env.KYC_API_KEY) {
    console.warn("[PRODUCTION WARNING] KYC_API_KEY is missing for non-manual KYC provider.");
  }

  // Enforce Meta WhatsApp Cloud API credentials when provider is meta in production
  if (env.WHATSAPP_PROVIDER === "meta") {
    if (!env.WHATSAPP_PHONE_NUMBER_ID || (env.WHATSAPP_PHONE_NUMBER_ID as string).trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["WHATSAPP_PHONE_NUMBER_ID"],
        message: "WHATSAPP_PHONE_NUMBER_ID must be configured in production when WHATSAPP_PROVIDER is 'meta'.",
      });
    }
    if (!env.WHATSAPP_ACCESS_TOKEN || (env.WHATSAPP_ACCESS_TOKEN as string).trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["WHATSAPP_ACCESS_TOKEN"],
        message: "WHATSAPP_ACCESS_TOKEN must be configured in production when WHATSAPP_PROVIDER is 'meta'.",
      });
    }
    if (!env.WHATSAPP_OTP_TEMPLATE_NAME || (env.WHATSAPP_OTP_TEMPLATE_NAME as string).trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["WHATSAPP_OTP_TEMPLATE_NAME"],
        message: "WHATSAPP_OTP_TEMPLATE_NAME must be configured in production when WHATSAPP_PROVIDER is 'meta'.",
      });
    }
  }
}

function validateDatabaseAndRedis(env: Record<string, unknown>, ctx: z.RefinementCtx, isVercel: boolean) {
  if (!env.REDIS_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["REDIS_URL"],
      message: "REDIS_URL must be configured in production for distributed locking, rate limiting, and queues.",
    });
  } else if (isVercel && !(env.REDIS_URL as string).startsWith("rediss://")) {
    console.warn("[PRODUCTION WARNING] REDIS_URL should use TLS (rediss://) on Vercel.");
  }

  if (isVercel && !env.PGBOUNCER_URL && !env.PRISMA_ACCELERATE_URL) {
    console.warn("[PRODUCTION WARNING] PGBOUNCER_URL or PRISMA_ACCELERATE_URL is recommended on Vercel to avoid connection limits.");
  }
}

function validateMonitoringAndApp(env: Record<string, unknown>, _ctx: z.RefinementCtx) {
  if (!env.PROMETHEUS_AUTH_TOKEN) {
    console.warn("[PRODUCTION WARNING] PROMETHEUS_AUTH_TOKEN is not configured to protect /api/metrics.");
  }
}

function validateStorage(env: Record<string, unknown>, _ctx: z.RefinementCtx) {
  if (env.STORAGE_PROVIDER === "r2" || env.STORAGE_PROVIDER === "s3") {
    const requiredStorageVars = ["S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"] as const;
    for (const key of requiredStorageVars) {
      if (!env[key]) {
        console.warn(`[PRODUCTION WARNING] ${key} is not configured for storage provider ${String(env.STORAGE_PROVIDER)}.`);
      }
    }
  }
}

function validateLogistics(env: Record<string, unknown>, ctx: z.RefinementCtx) {
  if (env.SHIPROCKET_EMAIL) {
    if (!env.SHIPROCKET_PASSWORD || (env.SHIPROCKET_PASSWORD as string).trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SHIPROCKET_PASSWORD"],
        message: "SHIPROCKET_PASSWORD must be configured in production when SHIPROCKET_EMAIL is set.",
      });
    }
    if (!env.SHIPROCKET_WEBHOOK_SECRET || (env.SHIPROCKET_WEBHOOK_SECRET as string).trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SHIPROCKET_WEBHOOK_SECRET"],
        message: "SHIPROCKET_WEBHOOK_SECRET must be configured in production when SHIPROCKET_EMAIL is set.",
      });
    }
  }
}

function validateWebPush(env: Record<string, unknown>, ctx: z.RefinementCtx) {
  if (env.ENABLE_WEB_PUSH === true) {
    const vapidPub = (env.VAPID_PUBLIC_KEY || env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) as string | undefined;
    const vapidPriv = env.VAPID_PRIVATE_KEY as string | undefined;
    if (!vapidPub || vapidPub.trim() === "" || vapidPub.includes("placeholder")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["VAPID_PUBLIC_KEY"],
        message: "VAPID_PUBLIC_KEY (or NEXT_PUBLIC_VAPID_PUBLIC_KEY) is required in production when ENABLE_WEB_PUSH is true.",
      });
    }
    if (!vapidPriv || vapidPriv.trim() === "" || vapidPriv.includes("placeholder")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["VAPID_PRIVATE_KEY"],
        message: "VAPID_PRIVATE_KEY is required in production when ENABLE_WEB_PUSH is true.",
      });
    }
  }
}

const isServer = typeof window === "undefined";

const _env = envSchema.safeParse(process.env);

export function validateCriticalSecrets(envVars: Record<string, string | undefined> = process.env) {
  const isProd = envVars.NODE_ENV === "production";
  const authSecret = envVars.AUTH_SECRET || envVars.NEXTAUTH_SECRET;

  if (isProd && (!authSecret || authSecret.trim().length < 32)) {
    throw new Error("[SECURITY CRITICAL] AUTH_SECRET (or NEXTAUTH_SECRET) >= 32 characters is required in production.");
  }

  const PLACEHOLDER_PREFIXES = [
    "generate-with:",
    "your_",
    "change_in_production",
    "xxx",
    "default_fallback_secret",
    "default_hmac_key",
  ];
  const CRITICAL_SECRETS = [
    "AUTH_SECRET",
    "NEXTAUTH_SECRET",
    "CRON_SECRET",
    "CONTRACT_SIGNING_SECRET",
    "HMAC_KEY",
    "ENCRYPTION_KEY",
    "ENCRYPTION_KEYS",
  ] as const;

  for (const key of CRITICAL_SECRETS) {
    const val = envVars[key];
    if (val && PLACEHOLDER_PREFIXES.some((prefix) => val.toLowerCase().includes(prefix.toLowerCase()))) {
      const msg = `[SECURITY NOTICE] ${key} contains an ungenerated placeholder value. Run: openssl rand -hex 32`;
      if (isProd) {
        throw new Error(msg);
      }
      console.warn("\x1b[33m%s\x1b[0m", msg);
    }
  }
}

if (!_env.success && !shouldSkipValidation) {
  const formatted = _env.error.format();
  const errorMessage = `Environment variables validation failed:\n${JSON.stringify(
    formatted,
    null,
    2,
  )}`;

  if (process.env.NODE_ENV === "production") {
    throw new Error(errorMessage);
  } else if (isServer) {
    console.warn("[ENVIRONMENT NOTICE]", errorMessage);
  }
}

export const env = (_env.success
  ? _env.data
  : (process.env as unknown as z.infer<typeof envSchema>)) as z.infer<typeof envSchema>;

if (env.NODE_ENV !== "production") {
  if (!env.AUTH_SECRET && !env.NEXTAUTH_SECRET) {
    env.AUTH_SECRET = devFallbackAuthSecret;
    env.NEXTAUTH_SECRET = devFallbackAuthSecret;
    if (typeof process !== "undefined" && !process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET && devFallbackAuthSecret) {
      process.env.AUTH_SECRET = devFallbackAuthSecret;
    }
  }
  if (!env.HMAC_KEY) {
    env.HMAC_KEY = devFallbackHmacKey;
    if (typeof process !== "undefined" && !process.env.HMAC_KEY && devFallbackHmacKey) {
      process.env.HMAC_KEY = devFallbackHmacKey;
    }
  }
}

if (isServer) {
  if (_env.success && env.NODE_ENV !== "production" && !env.CONTRACT_SIGNING_SECRET) {
    console.warn(
      "\x1b[33m%s\x1b[0m",
      "[WARNING] CONTRACT_SIGNING_SECRET is not set in non-production environment.",
    );
  }

  if (!shouldSkipValidation) {
    validateCriticalSecrets(process.env);
  }
}
