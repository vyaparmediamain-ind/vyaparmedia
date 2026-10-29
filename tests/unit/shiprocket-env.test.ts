import { describe, it, expect } from "vitest";
import { envSchema } from "@/env";
import { ApiErrorCode, AppError } from "@/lib/errors";

describe("SR-ENV-01: Shiprocket Environment Boot Validation & Error Codes", () => {
  const baseValidProdEnv = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
    REDIS_URL: "rediss://localhost:6379",
    AUTH_SECRET: "a_valid_secret_that_is_at_least_32_characters_long",
    NEXTAUTH_SECRET: "a_valid_secret_that_is_at_least_32_characters_long",
    CRON_SECRET: "cron_secret_32_characters_long_1234",
    HMAC_KEY: "hmac_key_32_characters_long_12345",
    ENCRYPTION_KEY: "encryption_key_32_characters_long",
    ENCRYPTION_KEYS: "v1:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    PLATFORM_GSTIN: "29AABCV1234F1Z5",
    PLATFORM_CIN: "U74999KA2024PTC123456",
    PLATFORM_PHONE: "+91-8045678900",
    CONTRACT_SIGNING_SECRET: "signing_secret_32_characters_long",
    RAZORPAY_KEY_ID: "rzp_live_12345678901234",
    RAZORPAY_KEY_SECRET: "live_secret_12345678901234",
    NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_live_12345678901234",
  };

  it("fails production validation if SHIPROCKET_EMAIL is configured without SHIPROCKET_PASSWORD", () => {
    const result = envSchema.safeParse({
      ...baseValidProdEnv,
      SHIPROCKET_EMAIL: "logistics@reachout.platform",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("SHIPROCKET_PASSWORD");
    }
  });

  it("fails production validation if SHIPROCKET_EMAIL is configured without SHIPROCKET_WEBHOOK_SECRET", () => {
    const result = envSchema.safeParse({
      ...baseValidProdEnv,
      SHIPROCKET_EMAIL: "logistics@reachout.platform",
      SHIPROCKET_PASSWORD: "secure_shiprocket_password_123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("SHIPROCKET_WEBHOOK_SECRET");
    }
  });

  it("passes production validation when complete Shiprocket credentials are provided", () => {
    const result = envSchema.safeParse({
      ...baseValidProdEnv,
      SHIPROCKET_EMAIL: "logistics@reachout.platform",
      SHIPROCKET_PASSWORD: "secure_shiprocket_password_123",
      SHIPROCKET_WEBHOOK_SECRET: "webhook_secret_32_characters_long_123",
      SHIPROCKET_PICKUP_LOCATION: "Primary Warehouse",
      SHIPROCKET_PICKUP_PINCODE: "110001",
    });

    expect(result.success).toBe(true);
  });

  it("exports SHIPPING_NON_SERVICEABLE and SHIPPING_ADDRESS_REQUIRED in ApiErrorCode and AppError", () => {
    expect(ApiErrorCode.SHIPPING_NON_SERVICEABLE).toBe("SHIPPING_NON_SERVICEABLE");
    expect(ApiErrorCode.SHIPPING_ADDRESS_REQUIRED).toBe("SHIPPING_ADDRESS_REQUIRED");

    const err1 = AppError.shippingNonServiceable();
    expect(err1.statusCode).toBe(400);
    expect(err1.errorCode).toBe(ApiErrorCode.SHIPPING_NON_SERVICEABLE);
    expect(err1.message).toContain("cannot service this destination pincode");

    const err2 = AppError.shippingAddressRequired();
    expect(err2.statusCode).toBe(400);
    expect(err2.errorCode).toBe(ApiErrorCode.SHIPPING_ADDRESS_REQUIRED);
    expect(err2.message).toContain("Creator shipping address must be submitted");
  });
});
