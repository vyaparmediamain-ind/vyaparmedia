import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getKYCProvider } from "@/lib/kyc";
import { MockKYCProvider } from "@/lib/kyc/providers/mock";
import { envSchema } from "@/env";

describe("KYC-PROD-01: Mock KYC Provider Forbidden in Production", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("fails envSchema validation in production if KYC_PROVIDER is set to mock", () => {
    const prodEnvWithMock = {
      NODE_ENV: "production",
      NEXTAUTH_URL: "https://vyaparmedia.com",
      AUTH_SECRET: "test-auth-secret-needs-to-be-at-least-32-chars-long",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      ENCRYPTION_KEYS: "v1:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      ALLOW_INSECURE_DATABASE: "false",
      KYC_PROVIDER: "mock",
    };

    const parseResult = envSchema.safeParse(prodEnvWithMock);
    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      const kycError = parseResult.error.issues.find((i) => i.path.includes("KYC_PROVIDER"));
      expect(kycError).toBeDefined();
      expect(kycError?.message).toMatch(/mock/i);
    }
  });

  it("prevents MockKYCProvider instantiation via getKYCProvider in production runtime", () => {
    process.env = { ...originalEnv, NODE_ENV: "production" };

    expect(() => getKYCProvider("mock")).toThrow(/production/i);
  });

  it("prevents direct new MockKYCProvider() instantiation in production runtime", () => {
    process.env = { ...originalEnv, NODE_ENV: "production" };

    expect(() => new MockKYCProvider()).toThrow(/forbidden in production/i);
  });
});
