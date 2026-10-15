import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendOTP } from "@/lib/sms";
import * as comm from "@/lib/communication";
import redis from "@/lib/redis";
import { envSchema } from "@/env";

describe("COMM-WABA-01: WhatsApp Meta Cloud API Primary + Twilio Fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attempts Meta Cloud API first, then falls back to Twilio WhatsApp when Meta fails", async () => {
    const origProvider = process.env.WHATSAPP_PROVIDER;
    const origPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const origToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const origTemplate = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
    const origTwilioSid = process.env.TWILIO_ACCOUNT_SID;
    const origTwilioToken = process.env.TWILIO_AUTH_TOKEN;
    const origTwilioFrom = process.env.TWILIO_WHATSAPP_FROM;

    try {
      process.env.WHATSAPP_PROVIDER = "auto";
      process.env.WHATSAPP_PHONE_NUMBER_ID = "phone_id_meta_123";
      process.env.WHATSAPP_ACCESS_TOKEN = "access_token_meta_123";
      process.env.WHATSAPP_OTP_TEMPLATE_NAME = "vyapar_otp_auth";
      process.env.TWILIO_ACCOUNT_SID = "AC_mock_twilio_account_sid_12345";
      process.env.TWILIO_AUTH_TOKEN = "auth_token_twilio_12345";
      process.env.TWILIO_WHATSAPP_FROM = "+14155238886";

      // Mock Redis for OTP
      vi.spyOn(redis, "ttl").mockResolvedValue(-2 as never);
      vi.spyOn(redis, "setex").mockResolvedValue("OK" as never);
      vi.spyOn(redis, "get").mockResolvedValue(null as never);

      const calledUrls: string[] = [];
      vi.spyOn(global, "fetch").mockImplementation(async (input: unknown) => {
        const url = String(input);
        calledUrls.push(url);

        if (url.includes("graph.facebook.com")) {
          // Meta API fails with 500
          return new Response(JSON.stringify({ error: { message: "Internal Server Error" } }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (url.includes("api.twilio.com")) {
          // Twilio succeeds
          return new Response(JSON.stringify({ sid: "SM12345" }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response("Not Found", { status: 404 });
      });

      const res = await sendOTP("9876543210", { purpose: "phone_verification" });

      expect(res.success).toBe(true);
      expect(res.channel).toBe("whatsapp");
      // Verify Meta was called first, then Twilio was called second
      expect(calledUrls.length).toBe(2);
      expect(calledUrls[0]).toContain("graph.facebook.com");
      expect(calledUrls[1]).toContain("api.twilio.com");
    } finally {
      process.env.WHATSAPP_PROVIDER = origProvider;
      process.env.WHATSAPP_PHONE_NUMBER_ID = origPhoneId;
      process.env.WHATSAPP_ACCESS_TOKEN = origToken;
      process.env.WHATSAPP_OTP_TEMPLATE_NAME = origTemplate;
      process.env.TWILIO_ACCOUNT_SID = origTwilioSid;
      process.env.TWILIO_AUTH_TOKEN = origTwilioToken;
      process.env.TWILIO_WHATSAPP_FROM = origTwilioFrom;
    }
  });

  it("falls back to MSG91 SMS when both Meta and Twilio WhatsApp fail", async () => {
    const origProvider = process.env.WHATSAPP_PROVIDER;
    const origPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const origToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const origTemplate = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
    const origTwilioSid = process.env.TWILIO_ACCOUNT_SID;
    const origTwilioToken = process.env.TWILIO_AUTH_TOKEN;
    const origTwilioFrom = process.env.TWILIO_WHATSAPP_FROM;

    try {
      process.env.WHATSAPP_PROVIDER = "auto";
      process.env.WHATSAPP_PHONE_NUMBER_ID = "phone_id_meta_123";
      process.env.WHATSAPP_ACCESS_TOKEN = "access_token_meta_123";
      process.env.WHATSAPP_OTP_TEMPLATE_NAME = "vyapar_otp_auth";
      process.env.TWILIO_ACCOUNT_SID = "AC_mock_twilio_account_sid_12345";
      process.env.TWILIO_AUTH_TOKEN = "auth_token_twilio_12345";
      process.env.TWILIO_WHATSAPP_FROM = "+14155238886";

      vi.spyOn(redis, "ttl").mockResolvedValue(-2 as never);
      vi.spyOn(redis, "setex").mockResolvedValue("OK" as never);
      vi.spyOn(redis, "get").mockResolvedValue(null as never);

      vi.spyOn(global, "fetch").mockImplementation(async (input: unknown) => {
        const url = String(input);
        if (url.includes("graph.facebook.com") || url.includes("api.twilio.com")) {
          return new Response(JSON.stringify({ error: "Provider outage" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not Found", { status: 404 });
      });

      const smsSpy = vi.spyOn(comm, "sendSMS").mockResolvedValue(true);

      const res = await sendOTP("9876543210", { purpose: "phone_verification" });

      expect(res.success).toBe(true);
      expect(smsSpy).toHaveBeenCalled();
      expect(res.fallbackUsed).toBe(true);
    } finally {
      process.env.WHATSAPP_PROVIDER = origProvider;
      process.env.WHATSAPP_PHONE_NUMBER_ID = origPhoneId;
      process.env.WHATSAPP_ACCESS_TOKEN = origToken;
      process.env.WHATSAPP_OTP_TEMPLATE_NAME = origTemplate;
      process.env.TWILIO_ACCOUNT_SID = origTwilioSid;
      process.env.TWILIO_AUTH_TOKEN = origTwilioToken;
      process.env.TWILIO_WHATSAPP_FROM = origTwilioFrom;
    }
  });

  it("validates WHATSAPP_PROVIDER='meta' requires template name, phone id, and access token in production", () => {
    const invalidMetaEnv = {
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
      RAZORPAY_KEY_ID: "rzp_live_validkey1234",
      NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_live_validkey1234",
      RAZORPAY_KEY_SECRET: "validsecret12345",
      CRON_SECRET: "12345678901234567890123456789012",
      REDIS_URL: "redis://localhost:6379",
      WHATSAPP_PROVIDER: "meta",
      // Missing WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_OTP_TEMPLATE_NAME
    };

    const parsed = envSchema.safeParse(invalidMetaEnv);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issuePaths = parsed.error.issues.map((i) => i.path.join("."));
      expect(issuePaths).toContain("WHATSAPP_PHONE_NUMBER_ID");
      expect(issuePaths).toContain("WHATSAPP_ACCESS_TOKEN");
      expect(issuePaths).toContain("WHATSAPP_OTP_TEMPLATE_NAME");
    }
  });
});
