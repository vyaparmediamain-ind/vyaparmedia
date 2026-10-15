import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, sendBlogNewsletterEmail, sendVerificationEmail } from "@/lib/email";
import redis from "@/lib/redis";
import { POST as resendWebhookPost } from "@/app/api/webhooks/resend/route";
import { NextRequest } from "next/server";
import { createHmac } from "node:crypto";

describe("COMM-EMAIL-01: Resend Idempotency-Key, List-Unsubscribe & Bounce/Complaint Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends Idempotency-Key header on all outbound Resend API requests", async () => {
    const origKey = process.env.RESEND_API_KEY;
    try {
      process.env.RESEND_API_KEY = "re_test_valid_key_12345";

      vi.spyOn(redis, "get").mockResolvedValue(null as never);

      let capturedHeaders: Record<string, string> = {};
      vi.spyOn(global, "fetch").mockImplementation(async (_input: unknown, init?: RequestInit) => {
        capturedHeaders = (init?.headers || {}) as Record<string, string>;
        return new Response(JSON.stringify({ id: "email_msg_123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const res = await sendEmail({
        to: "creator@example.com",
        subject: "Welcome to VyaparMedia",
        html: "<p>Hello</p>",
      });

      expect(res.success).toBe(true);
      expect(capturedHeaders["Idempotency-Key"]).toBeDefined();
      expect(capturedHeaders["Idempotency-Key"]).toContain("resend_");
    } finally {
      process.env.RESEND_API_KEY = origKey;
    }
  });

  it("adds RFC 8058 List-Unsubscribe headers in blog newsletter emails", async () => {
    const origKey = process.env.RESEND_API_KEY;
    try {
      process.env.RESEND_API_KEY = "re_test_valid_key_12345";
      vi.spyOn(redis, "get").mockResolvedValue(null as never);

      let capturedBody: any = null;
      vi.spyOn(global, "fetch").mockImplementation(async (_input: unknown, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body || "{}"));
        return new Response(JSON.stringify({ id: "email_msg_news_123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const success = await sendBlogNewsletterEmail(
        "subscriber@example.com",
        "Weekly Creator Spotlight",
        "Here are this week's top campaigns",
        "unsub_token_999",
      );

      expect(success).toBe(true);
      expect(capturedBody).not.toBeNull();
      expect(capturedBody.headers).toBeDefined();
      expect(capturedBody.headers["List-Unsubscribe"]).toContain("api/blog/unsubscribe?token=unsub_token_999");
      expect(capturedBody.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    } finally {
      process.env.RESEND_API_KEY = origKey;
    }
  });

  it("checks suppression list and blocks sending to bounced/complained addresses", async () => {
    const origKey = process.env.RESEND_API_KEY;
    try {
      process.env.RESEND_API_KEY = "re_test_valid_key_12345";

      // Mock Redis indicating email is suppressed
      vi.spyOn(redis, "get").mockImplementation(async (key: unknown) => {
        if (String(key) === "email:suppressed:bounced@example.com") {
          return "email.bounced";
        }
        return null;
      });

      const fetchSpy = vi.spyOn(global, "fetch");

      const res = await sendEmail({
        to: "bounced@example.com",
        subject: "Invoice Ready",
        html: "<p>Invoice details</p>",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("suppressed");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      process.env.RESEND_API_KEY = origKey;
    }
  });

  it("processes Resend bounce webhook and writes email to suppression list in Redis", async () => {
    const redisSetSpy = vi.spyOn(redis, "setex").mockResolvedValue("OK" as never);

    const webhookSecret = "whsec_mfasdjklfasdjklfasdjklfasdjkl12=";
    process.env.RESEND_WEBHOOK_SECRET = webhookSecret;

    const bodyObj = {
      type: "email.bounced",
      data: {
        to: ["bad-address@testdomain.com"],
        bounce_type: "hard",
      },
    };
    const bodyStr = JSON.stringify(bodyObj);

    const svixId = "msg_svix_123";
    const svixTimestamp = Math.floor(Date.now() / 1000).toString();
    const secretClean = webhookSecret.slice(6);
    const secretBytes = Buffer.from(secretClean, "base64");
    const sig = createHmac("sha256", secretBytes)
      .update(`${svixId}.${svixTimestamp}.${bodyStr}`)
      .digest("base64");

    const req = new NextRequest("https://vyaparmedia.in/api/webhooks/resend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": `v1,${sig}`,
      },
      body: bodyStr,
    });

    const res = await resendWebhookPost(req);
    expect(res.status).toBe(200);
    expect(redisSetSpy).toHaveBeenCalledWith(
      "email:suppressed:bad-address@testdomain.com",
      86400 * 90,
      "email.bounced",
    );
  });

  it("escapes dynamic inputs in verification emails to prevent HTML injection", async () => {
    const origKey = process.env.RESEND_API_KEY;
    try {
      process.env.RESEND_API_KEY = "re_test_valid_key_12345";
      vi.spyOn(redis, "get").mockResolvedValue(null as never);

      let capturedHtml = "";
      vi.spyOn(global, "fetch").mockImplementation(async (_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body || "{}"));
        capturedHtml = body.html;
        return new Response(JSON.stringify({ id: "email_msg_xss" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const maliciousOtp = `<script>alert('xss')</script>`;
      await sendVerificationEmail("user@example.com", maliciousOtp);

      expect(capturedHtml).not.toContain("<script>");
      expect(capturedHtml).toContain("&lt;script&gt;");
    } finally {
      process.env.RESEND_API_KEY = origKey;
    }
  });
});
