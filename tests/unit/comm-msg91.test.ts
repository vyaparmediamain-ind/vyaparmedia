import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendSMS, resolveDltTemplateId } from "@/lib/communication";
import { withCircuitBreaker } from "@/lib/circuit-breaker";
import redis from "@/lib/redis";
import { POST as msg91WebhookPost, GET as msg91WebhookGet } from "@/app/api/webhooks/msg91/route";
import { NextRequest } from "next/server";

describe("COMM-MSG91-01: MSG91 DLT Template Resolution, Circuit Breaker & DLR Webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("DLT Template Resolution and Enforcement", () => {
    it("skips non-OTP SMS silently with a warning if no DLT template is configured in production", async () => {
      const origEnv = process.env.NODE_ENV;
      const origAuthKey = process.env.MSG91_AUTH_KEY;
      const origTemplate = process.env.MSG91_NOTIFICATION_TEMPLATE_ID;
      const origDefaultTemplate = process.env.MSG91_TEMPLATE_ID;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        process.env.MSG91_AUTH_KEY = "test_auth_key_12345";
        process.env.MSG91_NOTIFICATION_TEMPLATE_ID = "";
        process.env.MSG91_TEMPLATE_ID = "";

        const fetchSpy = vi.spyOn(global, "fetch");

        const result = await sendSMS("9876543210", "Hello creator, your profile is approved!", {
          category: "notification",
        });

        // Must skip without calling MSG91 API to prevent DLT penalty
        expect(result).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
        if (origAuthKey) process.env.MSG91_AUTH_KEY = origAuthKey;
        if (origTemplate) process.env.MSG91_NOTIFICATION_TEMPLATE_ID = origTemplate;
        if (origDefaultTemplate) process.env.MSG91_TEMPLATE_ID = origDefaultTemplate;
      }
    });

    it("fails loudly for OTP SMS if DLT template is missing in production", async () => {
      const origEnv = process.env.NODE_ENV;
      const origAuthKey = process.env.MSG91_AUTH_KEY;
      const origOtpTemplate = process.env.MSG91_OTP_TEMPLATE_ID;
      const origDefaultTemplate = process.env.MSG91_TEMPLATE_ID;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        process.env.MSG91_AUTH_KEY = "test_auth_key_12345";
        process.env.MSG91_OTP_TEMPLATE_ID = "";
        process.env.MSG91_TEMPLATE_ID = "";

        const result = await sendSMS("9876543210", "123456 is your code", {
          category: "otp",
        });

        expect(result).toBe(false);
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
        if (origAuthKey) process.env.MSG91_AUTH_KEY = origAuthKey;
        if (origOtpTemplate) process.env.MSG91_OTP_TEMPLATE_ID = origOtpTemplate;
        if (origDefaultTemplate) process.env.MSG91_TEMPLATE_ID = origDefaultTemplate;
      }
    });
  });

  describe("Circuit Breaker Protection", () => {
    it("fast-fails when MSG91 circuit breaker is OPEN", async () => {
      const origKey = process.env.MSG91_AUTH_KEY;
      const origTemplate = process.env.MSG91_TEMPLATE_ID;

      try {
        process.env.MSG91_AUTH_KEY = "test_auth_key";
        process.env.MSG91_TEMPLATE_ID = "DLT_TEMPLATE_123";

        // Mock Redis saying circuit is open
        vi.spyOn(redis, "get").mockImplementation(async (key: unknown) => {
          if (String(key) === "cb:open:msg91:api") return "OPEN";
          return null;
        });

        const fetchSpy = vi.spyOn(global, "fetch");

        const result = await sendSMS("9876543210", "123456 is your OTP", {
          category: "otp",
          templateId: "DLT_TEMPLATE_123",
        });

        expect(result).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        if (origKey) process.env.MSG91_AUTH_KEY = origKey;
        if (origTemplate) process.env.MSG91_TEMPLATE_ID = origTemplate;
      }
    });
  });

  describe("DLR Webhook Route", () => {
    it("processes delivery reports and records status in Redis", async () => {
      const redisSetSpy = vi.spyOn(redis, "setex").mockResolvedValue("OK" as never);

      const payload = {
        requestId: "req_msg91_888",
        mobile: "919876543210",
        status: "DELIVRD",
        desc: "Delivered to handset successfully",
      };

      const req = new NextRequest("https://vyaparmedia.in/api/webhooks/msg91", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await msg91WebhookPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(redisSetSpy).toHaveBeenCalledWith("sms:dlr:req_msg91_888", 86400, "DELIVRD");
    });
  });
});
