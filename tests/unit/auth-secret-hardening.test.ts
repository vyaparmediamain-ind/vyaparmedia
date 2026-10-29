import { describe, it, expect } from "vitest";
import { envSchema, validateCriticalSecrets } from "@/env";
import * as fs from "fs";
import * as path from "path";

describe("O3-T1 / OA-01: Hardened Auth Secret & Production Validation", () => {
  const validProdBase = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@host:5432/db",
    DIRECT_URL: "postgresql://user:pass@host:5432/db",
    NEXTAUTH_URL: "https://vyaparmedia.in",
    NEXT_PUBLIC_APP_URL: "https://vyaparmedia.in",
    REDIS_URL: "redis://localhost:6379",
    CRON_SECRET: "cron_secret_test_min_32_chars_long_prod",
    ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    ENCRYPTION_KEYS: "v1:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    HMAC_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    AUTH_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    RAZORPAY_KEY_ID: "rzp_live_real_key_12345",
    RAZORPAY_KEY_SECRET: "real_razorpay_secret_12345",
  };

  it("fails production validation when AUTH_SECRET (and NEXTAUTH_SECRET) is missing", () => {
    const invalidEnv = { ...validProdBase, AUTH_SECRET: undefined, NEXTAUTH_SECRET: undefined };
    const res = envSchema.safeParse(invalidEnv);
    expect(res.success).toBe(false);
    if (!res.success) {
      const issuePaths = res.error.issues.map((i) => i.path[0]);
      expect(issuePaths).toContain("AUTH_SECRET");
    }
  });

  it("fails production validation when AUTH_SECRET is shorter than 32 chars", () => {
    const invalidEnv = { ...validProdBase, AUTH_SECRET: "short_secret_under_32" };
    const res = envSchema.safeParse(invalidEnv);
    expect(res.success).toBe(false);
    if (!res.success) {
      const issuePaths = res.error.issues.map((i) => i.path[0]);
      expect(issuePaths).toContain("AUTH_SECRET");
    }
  });

  it("fails production validation when AUTH_SECRET uses known fallback or placeholder", () => {
    const fallbackEnv = {
      ...validProdBase,
      AUTH_SECRET: "default_fallback_secret_min_32_chars_vyaparmedia",
    };
    const res = envSchema.safeParse(fallbackEnv);
    expect(res.success).toBe(false);
    if (!res.success) {
      const issuePaths = res.error.issues.map((i) => i.path[0]);
      expect(issuePaths).toContain("AUTH_SECRET");
    }

    const placeholderEnv = {
      ...validProdBase,
      AUTH_SECRET: "change_in_production_auth_secret_placeholder_32",
    };
    const res2 = envSchema.safeParse(placeholderEnv);
    expect(res2.success).toBe(false);
    if (!res2.success) {
      const issuePaths = res2.error.issues.map((i) => i.path[0]);
      expect(issuePaths).toContain("AUTH_SECRET");
    }
  });

  it("throws in validateCriticalSecrets when running in production with missing or placeholder secrets", () => {
    expect(() => {
      validateCriticalSecrets({
        NODE_ENV: "production",
        AUTH_SECRET: undefined,
      });
    }).toThrow(/AUTH_SECRET.*production/i);

    expect(() => {
      validateCriticalSecrets({
        NODE_ENV: "production",
        AUTH_SECRET: "default_fallback_secret_min_32_chars_vyaparmedia",
      });
    }).toThrow(/placeholder/i);

    expect(() => {
      validateCriticalSecrets({
        NODE_ENV: "production",
        AUTH_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        HMAC_KEY: "default_hmac_key_min_32_chars_vyaparmedia",
      });
    }).toThrow(/placeholder/i);

    expect(() => {
      validateCriticalSecrets({
        NODE_ENV: "production",
        AUTH_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        HMAC_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        ENCRYPTION_KEY: "change_in_production_key_placeholder_123456",
      });
    }).toThrow(/placeholder/i);
  });

  it("ensures source files never contain hardcoded fallback secret constants", () => {
    const rootDir = path.resolve(__dirname, "../../src");
    const checkFiles = [
      path.join(rootDir, "lib", "auth.ts"),
      path.join(rootDir, "auth.config.ts"),
      path.join(rootDir, "env.ts"),
    ];

    for (const file of checkFiles) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain("default_fallback_secret_min_32_chars_vyaparmedia");
      expect(content).not.toContain("default_hmac_key_min_32_chars_vyaparmedia");
    }
  });
});
