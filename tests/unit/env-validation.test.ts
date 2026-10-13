import { describe, it, expect } from "vitest";
import { envSchema } from "@/env";

describe("R1-ENV: Environment Variable Validation & Drift Guard", () => {
  it("exposes all 30 production and integration variables in envSchema", () => {
    // 30 variables identified in Phase 1 Recon (audit/P1-recon.md §4.1)
    const requiredEnvKeys = [
      "SHIPROCKET_EMAIL",
      "SHIPROCKET_PASSWORD",
      "SHIPROCKET_WEBHOOK_SECRET",
      "SHIPROCKET_PICKUP_LOCATION",
      "SHIPROCKET_PICKUP_PINCODE",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "INSTAGRAM_APP_ID",
      "INSTAGRAM_APP_SECRET",
      "YOUTUBE_API_KEY",
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "TWILIO_WHATSAPP_FROM",
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_PROVIDER",
      "WHATSAPP_OTP_TEMPLATE_NAME",
      "WHATSAPP_TEMPLATE_LANGUAGE",
      "MSG91_AUTH_KEY",
      "MSG91_SENDER_ID",
      "SMS_API_KEY",
      "SMS_SENDER_ID",
      "FROM_EMAIL",
      "AUTH_SECRET",
      "AWS_LAMBDA_FUNCTION_NAME",
      "NEXT_PUBLIC_MIN_WITHDRAWAL_AMOUNT",
      "NEXT_PUBLIC_MAX_WITHDRAWAL_AMOUNT",
      "OTP_PRIMARY_CHANNEL",
      "OTP_SMS_FALLBACK",
      "SLOW_QUERY_THRESHOLD_MS",
    ] as const;

    for (const key of requiredEnvKeys) {
      expect(
        key in envSchema.shape,
        `Expected environment variable '${key}' to be declared in src/env.ts envSchema`
      ).toBe(true);
    }
  });

  it("parses integration variables with defaults and trims properly", () => {
    const parsed = envSchema.safeParse({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/db",
      NEXTAUTH_SECRET: "12345678901234567890123456789012",
      HMAC_KEY: "12345678901234567890123456789012",
      ENCRYPTION_KEYS: "v1:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      SHIPROCKET_EMAIL: "logistics@vyaparmedia.in",
      SHIPROCKET_PASSWORD: "secret_password",
      SHIPROCKET_WEBHOOK_SECRET: "shiprocket_webhook_secret_key_123",
      UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "upstash_token_123",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.SHIPROCKET_EMAIL).toBe("logistics@vyaparmedia.in");
      expect(parsed.data.SHIPROCKET_PICKUP_LOCATION).toBe("Primary");
      expect(parsed.data.UPSTASH_REDIS_REST_URL).toBe("https://test.upstash.io");
      expect(parsed.data.FROM_EMAIL).toBe("noreply@vyaparmedia.in");
      expect(parsed.data.OTP_PRIMARY_CHANNEL).toBe("whatsapp");
    }
  });
});
