import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Environment variables
process.env.CRON_SECRET = "secret_cron_guard_token_xyz";
process.env.RESEND_WEBHOOK_SECRET = "whsec_dGVzdF9zZWNyZXRfdmFsdWVfeXo=";
process.env.MSG91_WEBHOOK_SECRET = "secret_msg91_token_xyz";

let mockHeaderStore: Record<string, string> = {};

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (name: string) => mockHeaderStore[name.toLowerCase()] || null,
  })),
}));

vi.mock("@/lib/lock", () => ({
  acquireDistributedLock: vi.fn().mockResolvedValue("lock_token_123"),
  releaseDistributedLock: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/idempotency", () => ({
  cleanupExpiredIdempotencyKeys: vi.fn().mockResolvedValue(42),
  claimIdempotencyKey: vi.fn().mockResolvedValue({ isDuplicate: false }),
  releaseIdempotencyKey: vi.fn().mockResolvedValue(true),
  saveIdempotencyResponse: vi.fn().mockResolvedValue(true),
  isWebhookProcessed: vi.fn().mockResolvedValue(false),
  markWebhookProcessed: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/razorpay", () => ({
  processSecureWebhook: vi.fn(async (_body: string, signature: string, eventId: string) => {
    if (signature === "invalid_sig") {
      return { isValid: false, isDuplicate: false, eventKey: `ev_${eventId}` };
    }
    if (eventId === "ev_duplicate") {
      return { isValid: true, isDuplicate: true, eventKey: `ev_${eventId}` };
    }
    return { isValid: true, isDuplicate: false, eventKey: `ev_${eventId}` };
  }),
  verifyWebhookSignature: vi.fn((_body: string, signature: string) => {
    return signature === "valid_hmac_signature";
  }),
  calculateTotalAmount: vi.fn().mockReturnValue({ totalAmount: 10000 }),
}));

vi.mock("@/lib/shiprocket", () => ({
  verifyWebhookSecret: vi.fn((secret?: string | null) => {
    return secret === "valid_shiprocket_secret";
  }),
}));

vi.mock("@/services/deal.service", () => ({
  DealService: {
    handleShiprocketWebhook: vi.fn().mockResolvedValue({ status: "DELIVERED" }),
  },
}));

vi.mock("@/lib/qstash", () => ({
  publishWebhookJob: vi.fn().mockResolvedValue({ messageId: "msg_123" }),
}));

vi.mock("@/lib/razorpay-webhook-processor", () => ({
  processWebhookEventInternal: vi.fn().mockResolvedValue({ success: true, message: "Processed" }),
}));

vi.mock("@/lib/redis", () => ({
  default: {
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  },
  redis: {
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  },
}));

// Import route handlers
import { GET as cronCleanupGet } from "@/app/api/cron/cleanup-idempotency/route";
import { POST as razorpayWebhookPost } from "@/app/api/webhooks/razorpay/route";
import { POST as paymentsWebhookPost } from "@/app/api/payments/webhook/route";
import { POST as shiprocketWebhookPost } from "@/app/api/webhooks/shiprocket/route";
import { POST as msg91WebhookPost } from "@/app/api/webhooks/msg91/route";
import { POST as resendWebhookPost } from "@/app/api/webhooks/resend/route";
import { POST as qstashProcessPost } from "@/app/api/webhooks/razorpay/process/route";

describe("Webhooks & Crons Contract Tests (Requirement 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaderStore = {};
  });

  describe("Cron Authentication & Guard Protection (/api/cron/*)", () => {
    it("rejects unauthenticated request missing cron secret with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/cleanup-idempotency");
      const res = await cronCleanupGet(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("UNAUTHORIZED");
      expect(json.message).toContain("Cron Secret");
    });

    it("rejects request with invalid cron secret with 401", async () => {
      mockHeaderStore["authorization"] = "Bearer wrong_secret_token";
      const req = new NextRequest("http://localhost:3000/api/cron/cleanup-idempotency", {
        headers: {
          authorization: "Bearer wrong_secret_token",
        },
      });
      const res = await cronCleanupGet(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("UNAUTHORIZED");
    });

    it("executes handler successfully when valid Bearer Authorization header is passed", async () => {
      mockHeaderStore["authorization"] = `Bearer ${process.env.CRON_SECRET}`;
      const req = new NextRequest("http://localhost:3000/api/cron/cleanup-idempotency", {
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      });
      const res = await cronCleanupGet(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.deleted).toBe(42);
    });

    it("executes handler successfully when valid x-cron-secret header is passed", async () => {
      mockHeaderStore["x-cron-secret"] = process.env.CRON_SECRET || "";
      const req = new NextRequest("http://localhost:3000/api/cron/cleanup-idempotency", {
        headers: {
          "x-cron-secret": process.env.CRON_SECRET || "",
        },
      });
      const res = await cronCleanupGet(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe("Razorpay Ingress Webhook (/api/webhooks/razorpay)", () => {
    it("rejects request missing x-razorpay-signature with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
        method: "POST",
        body: JSON.stringify({ event: "payment.captured" }),
      });
      const res = await razorpayWebhookPost(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Missing signature");
    });

    it("rejects empty payload with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
        method: "POST",
        headers: { "x-razorpay-signature": "some_sig" },
        body: "",
      });
      const res = await razorpayWebhookPost(req);

      expect(res.status).toBe(400);
    });

    it("rejects invalid signature with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
        method: "POST",
        headers: { "x-razorpay-signature": "invalid_sig" },
        body: JSON.stringify({ event: "payment.captured", id: "ev_123" }),
      });
      const res = await razorpayWebhookPost(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Invalid webhook signature");
    });

    it("handles duplicate webhook event idempotently by acknowledging with 200 OK", async () => {
      const req = new NextRequest("http://localhost:3000/api/webhooks/razorpay", {
        method: "POST",
        headers: { "x-razorpay-signature": "valid_sig" },
        body: JSON.stringify({ event: "payment.captured", id: "ev_duplicate" }),
      });
      const res = await razorpayWebhookPost(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toContain("Duplicate webhook acknowledged");
    });
  });

  describe("Payments Webhook Route (/api/payments/webhook)", () => {
    it("rejects missing signature with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/payments/webhook", {
        method: "POST",
        body: JSON.stringify({ event: "payment.captured" }),
      });
      const res = await paymentsWebhookPost(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toBe("Missing signature");
    });

    it("rejects invalid signature with 400", async () => {
      mockHeaderStore["x-razorpay-signature"] = "bad_sig";
      const req = new NextRequest("http://localhost:3000/api/payments/webhook", {
        method: "POST",
        headers: { "x-razorpay-signature": "bad_sig" },
        body: JSON.stringify({ event: "payment.captured" }),
      });
      const res = await paymentsWebhookPost(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toBe("Invalid signature");
    });

    it("accepts valid signature and enqueues processing with 200 OK", async () => {
      mockHeaderStore["x-razorpay-signature"] = "valid_hmac_signature";
      const payload = {
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_12345" } } },
      };
      const req = new NextRequest("http://localhost:3000/api/payments/webhook", {
        method: "POST",
        headers: { "x-razorpay-signature": "valid_hmac_signature" },
        body: JSON.stringify(payload),
      });
      const res = await paymentsWebhookPost(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain("acknowledged");
    });
  });

  describe("QStash Background Consumer Guard (/api/webhooks/razorpay/process)", () => {
    it("rejects request missing Upstash-Signature header with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/webhooks/razorpay/process", {
        method: "POST",
        body: JSON.stringify({ eventId: "ev_1", eventType: "payment.dispute.created" }),
      });
      const res = await qstashProcessPost(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Missing Upstash-Signature header");
    });
  });

  describe("Shiprocket Logistics Webhook (/api/webhooks/shiprocket)", () => {
    it("rejects unauthorized webhook missing secret with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/webhooks/shiprocket", {
        method: "POST",
        body: JSON.stringify({ awb: "12345678" }),
      });
      const res = await shiprocketWebhookPost(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized webhook");
    });

    it("processes valid webhook successfully with 200", async () => {
      const req = new NextRequest("http://localhost:3000/api/webhooks/shiprocket", {
        method: "POST",
        headers: { "x-shiprocket-secret": "valid_shiprocket_secret" },
        body: JSON.stringify({ awb: "12345678", status: "DELIVERED" }),
      });
      const res = await shiprocketWebhookPost(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe("MSG91 SMS/OTP Delivery Webhook (/api/webhooks/msg91)", () => {
    it("rejects unauthorized webhook with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/webhooks/msg91", {
        method: "POST",
        headers: { "x-msg91-secret": "wrong_token" },
        body: JSON.stringify({ request_id: "req_1", status: "DELIVRD" }),
      });
      const res = await msg91WebhookPost(req);

      expect(res.status).toBe(401);
    });

    it("accepts valid secret and records delivery with 200", async () => {
      const req = new NextRequest("http://localhost:3000/api/webhooks/msg91", {
        method: "POST",
        headers: { "x-msg91-secret": process.env.MSG91_WEBHOOK_SECRET || "" },
        body: JSON.stringify({ requestId: "req_1", status: "DELIVRD" }),
      });
      const res = await msg91WebhookPost(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe("Resend Email Delivery Webhook (/api/webhooks/resend)", () => {
    it("rejects request missing Svix headers with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        body: JSON.stringify({ type: "email.bounced" }),
      });
      const res = await resendWebhookPost(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Missing signature headers");
    });

    it("rejects request with expired Svix timestamp with 401", async () => {
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
        method: "POST",
        headers: {
          "svix-id": "msg_test",
          "svix-timestamp": expiredTimestamp.toString(),
          "svix-signature": "v1,abc",
        },
        body: JSON.stringify({ type: "email.bounced" }),
      });
      const res = await resendWebhookPost(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Timestamp expired");
    });
  });
});
