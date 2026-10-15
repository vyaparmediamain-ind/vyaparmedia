import { describe, it, expect } from "vitest";
import { envSchema } from "@/env";

describe("RZP-KEY-01: Razorpay Key Environment Security & Mode Matching", () => {
  const baseValidProdEnv = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/db",
    AUTH_SECRET: "12345678901234567890123456789012",
    HMAC_KEY: "12345678901234567890123456789012",
    CRON_SECRET: "12345678901234567890123456789012",
    ENCRYPTION_KEYS: "v1:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    PLATFORM_GSTIN: "07AAAAA0000A1Z5",
    PLATFORM_CIN: "U74999DL2024PTC999999",
    PLATFORM_PHONE: "+91-9876543210",
    REDIS_URL: "redis://localhost:6379",
    STORAGE_PROVIDER: "local",
  };

  it("fails production validation if RAZORPAY_KEY_ID is rzp_test_ and ALLOW_RZP_TEST is not true", () => {
    const result = envSchema.safeParse({
      ...baseValidProdEnv,
      RAZORPAY_KEY_ID: "rzp_test_12345678901234",
      RAZORPAY_KEY_SECRET: "live_secret_12345678901234",
      NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_12345678901234",
      ALLOW_RZP_TEST: "false",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("RAZORPAY_KEY_ID");
      const rzpIssue = result.error.issues.find((i) => i.path.includes("RAZORPAY_KEY_ID"));
      expect(rzpIssue?.message).toContain("rzp_test_");
    }
  });

  it("passes production validation with rzp_test_ if ALLOW_RZP_TEST=true is explicitly configured", () => {
    const result = envSchema.safeParse({
      ...baseValidProdEnv,
      RAZORPAY_KEY_ID: "rzp_test_12345678901234",
      RAZORPAY_KEY_SECRET: "live_secret_12345678901234",
      NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_12345678901234",
      ALLOW_RZP_TEST: "true",
    });

    expect(result.success).toBe(true);
  });

  it("fails if NEXT_PUBLIC_RAZORPAY_KEY_ID mode does not match RAZORPAY_KEY_ID mode", () => {
    const result = envSchema.safeParse({
      ...baseValidProdEnv,
      RAZORPAY_KEY_ID: "rzp_live_12345678901234",
      RAZORPAY_KEY_SECRET: "live_secret_12345678901234",
      NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_12345678901234",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("NEXT_PUBLIC_RAZORPAY_KEY_ID");
    }
  });

  it("passes production validation with valid rzp_live_ keys in matching modes", () => {
    const result = envSchema.safeParse({
      ...baseValidProdEnv,
      RAZORPAY_KEY_ID: "rzp_live_12345678901234",
      RAZORPAY_KEY_SECRET: "live_secret_12345678901234",
      NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_live_12345678901234",
    });

    expect(result.success).toBe(true);
  });
});
