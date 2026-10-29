import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { validateCronSecret } from "@/app/api/cron/guard";
import { withCircuitBreaker } from "@/lib/circuit-breaker";
import redis from "@/lib/redis";
import {
  isKillSwitchActive,
  assertKillSwitchInactive,
  setKillSwitch,
  clearKillSwitchOverrides,
  KILL_SWITCH_FEATURES,
  KILL_SWITCH_MESSAGES,
} from "@/lib/kill-switch";
import { resolveDltTemplateId } from "@/lib/communication";
import { scrubPiiString, scrubPiiObject } from "@/lib/sentry-sanitizer";
import { envSchema } from "@/env";

const mockHeaderStore: Record<string, string> = {};

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (name: string) => mockHeaderStore[name.toLowerCase()] || null,
  })),
}));

describe("P11 Reliability & Ops End-to-End Bug Regression Suite", () => {
  beforeEach(() => {
    clearKillSwitchOverrides();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearKillSwitchOverrides();
    vi.restoreAllMocks();
  });

  describe("P0-REL-03: Cron Guard Rejection of Query Parameter Secrets", () => {
    const origSecret = process.env.CRON_SECRET;

    beforeEach(() => {
      process.env.CRON_SECRET = "super_secure_cron_secret_min_32_characters_long";
    });

    afterEach(() => {
      process.env.CRON_SECRET = origSecret;
    });

    it("strictly rejects ?key=<secret> query parameter to prevent token exposure in access logs", async () => {
      const mockReq = new Request(
        `https://vyaparmedia.in/api/cron/post-monitor?key=${process.env.CRON_SECRET}`,
      );
      await expect(validateCronSecret(mockReq)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("strictly rejects ?secret=<secret> query parameter", async () => {
      const mockReq = new Request(
        `https://vyaparmedia.in/api/cron/post-monitor?secret=${process.env.CRON_SECRET}`,
      );
      await expect(validateCronSecret(mockReq)).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe("P1-REL-05: vercel.json Function Max Duration Coverage", () => {
    it("ensures all heavy cron and background processing routes are configured with maxDuration: 60", () => {
      const vercelJsonPath = path.join(process.cwd(), "vercel.json");
      const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"));
      const functions = vercelConfig.functions;

      const expectedRoutes = [
        "src/app/api/cron/reconcile-ledger-settlements/route.ts",
        "src/app/api/cron/tenure-badges/route.ts",
        "src/app/api/jobs/consumer/route.ts",
        "src/app/api/jobs/dlq/route.ts",
        "src/app/api/admin/financial/route.ts",
      ];

      for (const route of expectedRoutes) {
        expect(functions[route], `Route ${route} must be configured in vercel.json functions`).toBeDefined();
        expect(functions[route].maxDuration).toBe(60);
      }
    });
  });

  describe("P1-REL-06: QStash Cron Scheduler IST Timezone Configuration", () => {
    it("verifies scripts/setup-qstash-crons.ts configures Upstash-Cron-Timezone: Asia/Kolkata", () => {
      const scriptPath = path.join(process.cwd(), "scripts/setup-qstash-crons.ts");
      const content = fs.readFileSync(scriptPath, "utf8");

      expect(content).toContain('"Upstash-Cron-Timezone": "Asia/Kolkata"');
    });
  });

  describe("P1-REL-07: Shiprocket HTTP Timeout & Circuit Breaker Integration", () => {
    it("verifies shiprocket.ts uses shiprocketFetch with withCircuitBreaker and AbortSignal.timeout", () => {
      const shiprocketPath = path.join(process.cwd(), "src/lib/shiprocket.ts");
      const content = fs.readFileSync(shiprocketPath, "utf8");

      expect(content).toContain('"shiprocket:api"');
      expect(content).toContain("withCircuitBreaker");
      expect(content).toContain("AbortSignal.timeout(");
      expect(content).toContain("shiprocketFetch(");
      // Ensure raw fetch() without timeout is not used for API endpoints
      expect(content).not.toMatch(/await fetch\(`\$\{SHIPROCKET_API_BASE\}/);
    });
  });

  describe("P1-REL-08: Circuit Breaker Fail-Open on Redis Outage", () => {
    it("fails open and executes downstream action when redis.get throws during open state check", async () => {
      vi.spyOn(redis, "get").mockRejectedValue(new Error("Connection to Upstash timed out / quota exceeded"));

      const mockAction = vi.fn().mockResolvedValue("action_success");

      const result = await withCircuitBreaker("test:payment:razorpay", mockAction);

      expect(result).toBe("action_success");
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it("trips and blocks downstream action when circuit is genuinely OPEN", async () => {
      vi.spyOn(redis, "get").mockResolvedValue("true");

      const mockAction = vi.fn().mockResolvedValue("action_success");

      await expect(withCircuitBreaker("test:blocked:service", mockAction)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("Circuit is OPEN"),
      });

      expect(mockAction).not.toHaveBeenCalled();
    });
  });

  describe("P1-REL-09: Granular Operational Kill Switches", () => {
    it("allows operations by default when kill switch is inactive", async () => {
      clearKillSwitchOverrides();
      vi.spyOn(redis, "get").mockResolvedValue(null);

      const active = await isKillSwitchActive(KILL_SWITCH_FEATURES.WITHDRAWALS);
      expect(active).toBe(false);

      await expect(assertKillSwitchInactive(KILL_SWITCH_FEATURES.WITHDRAWALS)).resolves.toBeUndefined();
    });

    it("blocks withdrawals with 503 and exact user message when killswitch:withdrawals is active", async () => {
      await setKillSwitch(KILL_SWITCH_FEATURES.WITHDRAWALS, true);

      await expect(assertKillSwitchInactive(KILL_SWITCH_FEATURES.WITHDRAWALS)).rejects.toMatchObject({
        statusCode: 503,
        message: KILL_SWITCH_MESSAGES[KILL_SWITCH_FEATURES.WITHDRAWALS],
      });
    });

    it("blocks wallet deposits with 503 when killswitch:add_funds is active", async () => {
      await setKillSwitch(KILL_SWITCH_FEATURES.ADD_FUNDS, true);

      await expect(assertKillSwitchInactive(KILL_SWITCH_FEATURES.ADD_FUNDS)).rejects.toMatchObject({
        statusCode: 503,
        message: KILL_SWITCH_MESSAGES[KILL_SWITCH_FEATURES.ADD_FUNDS],
      });
    });

    it("blocks new campaign submissions with 503 when killswitch:campaigns is active", async () => {
      await setKillSwitch(KILL_SWITCH_FEATURES.CAMPAIGNS, true);

      await expect(assertKillSwitchInactive(KILL_SWITCH_FEATURES.CAMPAIGNS)).rejects.toMatchObject({
        statusCode: 503,
        message: KILL_SWITCH_MESSAGES[KILL_SWITCH_FEATURES.CAMPAIGNS],
      });
    });

    it("blocks user signups with 503 when killswitch:signups is active", async () => {
      await setKillSwitch(KILL_SWITCH_FEATURES.SIGNUPS, true);

      await expect(assertKillSwitchInactive(KILL_SWITCH_FEATURES.SIGNUPS)).rejects.toMatchObject({
        statusCode: 503,
        message: KILL_SWITCH_MESSAGES[KILL_SWITCH_FEATURES.SIGNUPS],
      });
    });

    it("blocks messaging with 503 when killswitch:messaging is active", async () => {
      await setKillSwitch(KILL_SWITCH_FEATURES.MESSAGING, true);

      await expect(assertKillSwitchInactive(KILL_SWITCH_FEATURES.MESSAGING)).rejects.toMatchObject({
        statusCode: 503,
        message: KILL_SWITCH_MESSAGES[KILL_SWITCH_FEATURES.MESSAGING],
      });
    });

    it("fails open if Redis throws during kill switch check", async () => {
      clearKillSwitchOverrides();
      vi.spyOn(redis, "get").mockRejectedValue(new Error("Redis unreachable"));

      const active = await isKillSwitchActive(KILL_SWITCH_FEATURES.WITHDRAWALS);
      expect(active).toBe(false);
      await expect(assertKillSwitchInactive(KILL_SWITCH_FEATURES.WITHDRAWALS)).resolves.toBeUndefined();
    });
  });

  describe("P1-REL-10: TRAI DLT Template Mapping in Communication Layer", () => {
    it("resolves OTP template ID when category is otp or message contains 6-digit OTP", () => {
      const origOtp = process.env.MSG91_OTP_TEMPLATE_ID;
      try {
        process.env.MSG91_OTP_TEMPLATE_ID = "DLT_OTP_1001";
        expect(resolveDltTemplateId("otp")).toBe("DLT_OTP_1001");
        expect(resolveDltTemplateId(undefined, "Your OTP is 654321")).toBe("DLT_OTP_1001");
      } finally {
        process.env.MSG91_OTP_TEMPLATE_ID = origOtp;
      }
    });

    it("resolves fulfillment template ID when category is fulfillment or shipping", () => {
      const origFulfill = process.env.MSG91_FULFILLMENT_TEMPLATE_ID;
      try {
        process.env.MSG91_FULFILLMENT_TEMPLATE_ID = "DLT_FULFILL_2002";
        expect(resolveDltTemplateId("fulfillment")).toBe("DLT_FULFILL_2002");
        expect(resolveDltTemplateId("shipping")).toBe("DLT_FULFILL_2002");
      } finally {
        process.env.MSG91_FULFILLMENT_TEMPLATE_ID = origFulfill;
      }
    });

    it("resolves transactional template ID when category is transactional or deal", () => {
      const origTx = process.env.MSG91_TRANSACTIONAL_TEMPLATE_ID;
      try {
        process.env.MSG91_TRANSACTIONAL_TEMPLATE_ID = "DLT_TX_3003";
        expect(resolveDltTemplateId("transactional")).toBe("DLT_TX_3003");
        expect(resolveDltTemplateId("deal")).toBe("DLT_TX_3003");
      } finally {
        process.env.MSG91_TRANSACTIONAL_TEMPLATE_ID = origTx;
      }
    });
  });

  describe("P1-REL-12: Strict Production Environment Validation", () => {
    const validBaseEnv = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/vyaparmedia",
      NODE_ENV: "production",
      NEXTAUTH_URL: "https://vyaparmedia.in",
      NEXT_PUBLIC_APP_URL: "https://vyaparmedia.in",
      APP_BASE_URL: "https://vyaparmedia.in",
      NEXTAUTH_SECRET: "12345678901234567890123456789012",
      AUTH_SECRET: "12345678901234567890123456789012",
      HMAC_KEY: "12345678901234567890123456789012",
      ENCRYPTION_KEYS: "v1:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      PLATFORM_GSTIN: "29AABCV1234F1Z5",
      PLATFORM_CIN: "U74999KA2024PTC123456",
      PLATFORM_PHONE: "+91-8045678900",
      RAZORPAY_KEY_ID: "rzp_live_real_key_123456",
      RAZORPAY_KEY_SECRET: "real_razorpay_secret_654321",
      CRON_SECRET: "real_cron_secret_min_32_characters_long_abcdef",
      REDIS_URL: "rediss://default:token@cluster.upstash.io:6379",
    };

    it("rejects production configuration when RAZORPAY_KEY_ID is placeholder", () => {
      const parsed = envSchema.safeParse({
        ...validBaseEnv,
        RAZORPAY_KEY_ID: "rzp_test_placeholder",
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues;
        expect(issues.some((i) => i.path.includes("RAZORPAY_KEY_ID"))).toBe(true);
      }
    });

    it("rejects production configuration when RAZORPAY_KEY_SECRET is placeholder", () => {
      const parsed = envSchema.safeParse({
        ...validBaseEnv,
        RAZORPAY_KEY_SECRET: "placeholder_secret",
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues;
        expect(issues.some((i) => i.path.includes("RAZORPAY_KEY_SECRET"))).toBe(true);
      }
    });

    it("rejects production configuration when CRON_SECRET is missing or shorter than 32 chars", () => {
      const parsed = envSchema.safeParse({
        ...validBaseEnv,
        CRON_SECRET: "short_secret",
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues;
        expect(issues.some((i) => i.path.includes("CRON_SECRET"))).toBe(true);
      }
    });

    it("rejects production configuration when REDIS_URL is not set", () => {
      const { REDIS_URL: _unused, ...envWithoutRedis } = validBaseEnv;
      const parsed = envSchema.safeParse(envWithoutRedis);

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues;
        expect(issues.some((i) => i.path.includes("REDIS_URL"))).toBe(true);
      }
    });
  });

  describe("P2-REL-14: Protected Health Route Simulation", () => {
    it("verifies health route only accepts ?simulate=db_down in dev mode or with authorization", () => {
      const routePath = path.join(process.cwd(), "src/app/api/health/route.ts");
      const content = fs.readFileSync(routePath, "utf8");

      expect(content).toContain('process.env.NODE_ENV !== "production" || isAuthorizedDeepHealth(request)');
      expect(content).toContain('simulateDbDown = allowSimulation && simulate === "db_down"');
    });
  });

  describe("P2-REL-15: Indian Financial PII Sanitization for Sentry", () => {
    it("scrubs 10-character Indian PAN cards", () => {
      const text = "Error inserting KYC record for PAN ABCDE1234F in database";
      expect(scrubPiiString(text)).toBe("Error inserting KYC record for PAN [REDACTED_PAN] in database");
    });

    it("scrubs 12-digit Indian Aadhaar numbers", () => {
      const text = "Verification failed for Aadhaar 1234 5678 9012";
      expect(scrubPiiString(text)).toBe("Verification failed for Aadhaar [REDACTED_AADHAAR]");
    });

    it("scrubs 10-digit Indian mobile numbers", () => {
      const text = "Failed to send OTP to +919876543210 or 9876543210";
      expect(scrubPiiString(text)).toBe("Failed to send OTP to [REDACTED_PHONE] or [REDACTED_PHONE]");
    });

    it("scrubs bank account numbers", () => {
      const text = "Payout transfer failed for account 12345678901234";
      expect(scrubPiiString(text)).toBe("Payout transfer failed for account [REDACTED_ACCOUNT]");
    });

    it("scrubs UPI IDs", () => {
      const text = "Payment dispute on UPI handle creator.business@okhdfcbank";
      expect(scrubPiiString(text)).toBe("Payment dispute on UPI handle [REDACTED_UPI]");
    });

    it("recursively scrubs nested Sentry event objects and redacts sensitive keys", () => {
      const event = {
        message: "Payout failed for 9876543210 with PAN ABCDE1234F",
        extra: {
          accountNumber: "9123456789012",
          panNumber: "ABCDE1234F",
          metadata: {
            phone: "+919123456789",
            details: "Transferred to 554433221122",
          },
        },
      };

      const sanitized = scrubPiiObject(event);

      expect(sanitized.message).toBe("Payout failed for [REDACTED_PHONE] with PAN [REDACTED_PAN]");
      expect(sanitized.extra.accountNumber).toBe("[REDACTED]");
      expect(sanitized.extra.panNumber).toBe("[REDACTED]");
      expect(sanitized.extra.metadata.phone).toBe("[REDACTED]");
      expect(sanitized.extra.metadata.details).toBe("Transferred to [REDACTED_ACCOUNT]");
    });
  });
});
