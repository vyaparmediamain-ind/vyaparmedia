import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

let mockSessionUser: { id: string; email?: string; userType: string; status: string } | null = null;

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockImplementation(async () => {
    if (!mockSessionUser) return null;
    return { user: mockSessionUser };
  }),
}));

import { POST as resendWebhookPost } from "@/app/api/webhooks/resend/route";
import { POST as msg91WebhookPost } from "@/app/api/webhooks/msg91/route";
import { PATCH as disputesIdPatch } from "@/app/api/disputes/[id]/route";
import { AdminAnalyticsService } from "@/services/admin-analytics.service";
import prisma from "@/lib/db";
import { formatUserError } from "@/lib/user-messages";
import { getDealParticipantRole, getDealTotalAmount } from "@/lib/utils-client";

describe("Phase 13 Deep Backend Hardening Suite (P13-BACKEND)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUser = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockSessionUser = null;
  });

  describe("P13-01: Disputes [id] Endpoint PATCH Handler", () => {
    it("rejects unauthorized PATCH request with 401", async () => {
      mockSessionUser = null;

      const req = new NextRequest("http://localhost:3000/api/disputes/disp_123", {
        method: "PATCH",
        body: JSON.stringify({ action: "accept" }),
        headers: { "content-type": "application/json" },
      });

      const res = await disputesIdPatch(req, {
        params: Promise.resolve({ id: "disp_123" }),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("rejects invalid actions with allowed values", async () => {
      mockSessionUser = {
        id: "user_test_123",
        email: "test@example.com",
        userType: "BRAND",
        status: "ACTIVE",
      };

      const req = new NextRequest("http://localhost:3000/api/disputes/disp_123", {
        method: "PATCH",
        body: JSON.stringify({ action: "invalid_action" }),
        headers: { "content-type": "application/json" },
      });

      const res = await disputesIdPatch(req, {
        params: Promise.resolve({ id: "disp_123" }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Invalid action. Allowed values: accept, reject, withdraw, escalate");
    });
  });

  describe("P13-02: Resend Webhook Production Secret Protection", () => {
    it("rejects unauthenticated requests in production if RESEND_WEBHOOK_SECRET is missing", async () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.RESEND_WEBHOOK_SECRET;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        delete process.env.RESEND_WEBHOOK_SECRET;

        const req = new NextRequest("http://localhost:3000/api/webhooks/resend", {
          method: "POST",
          body: JSON.stringify({
            type: "email.bounced",
            data: { to: ["victim@example.com"] },
          }),
          headers: { "content-type": "application/json" },
        });

        const res = await resendWebhookPost(req);
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.error).toBe("Webhook secret not configured");
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
        if (origSecret) process.env.RESEND_WEBHOOK_SECRET = origSecret;
      }
    });
  });

  describe("P13-03: Deal Participant Role & Null Safety", () => {
    it("safely resolves role when influencer is undefined or null without throwing TypeError", () => {
      const role1 = getDealParticipantRole(
        { influencer: null, brand: { userId: "brand_user_1" } },
        "brand_user_1"
      );
      expect(role1.isInfluencer).toBe(false);
      expect(role1.isBrand).toBe(true);
      expect(role1.isParticipant).toBe(true);

      const role2 = getDealParticipantRole(
        { influencer: undefined, brand: null },
        "stranger"
      );
      expect(role2.isInfluencer).toBe(false);
      expect(role2.isBrand).toBe(false);
      expect(role2.isParticipant).toBe(false);
    });
  });

  describe("P13-04: Escrow Funding Technical Error Scrubbing", () => {
    it("scrubs internal Prisma/database exceptions using formatUserError", () => {
      const rawError = "Invalid `prisma.paymentHold.create()` invocation: Unique constraint failed on the fields: (`razorpayOrderId`)";
      const sanitized = formatUserError(rawError, "Failed to initialize escrow payment.");

      expect(sanitized).not.toContain("prisma");
      expect(sanitized).not.toContain("Unique constraint");
      expect(sanitized).not.toContain("razorpayOrderId");
    });
  });

  describe("P13-05: Admin Analytics Canonical GMV Aggregation", () => {
    it("sums canonical amount field with fallback to deprecated totalAmount", async () => {
      vi.spyOn(prisma.deal, "aggregate").mockResolvedValue({
        _sum: {
          amount: 500000,
          totalAmount: 500000,
          platformFee: 50000,
          gatewayFee: 10000,
          influencerPayout: 440000,
        },
        _count: { _all: 10 },
      } as never);

      vi.spyOn(prisma.deal, "groupBy").mockResolvedValue([
        { status: "COMPLETED", _count: { _all: 10 } },
      ] as never);

      const res = await AdminAnalyticsService.getFinancialOverview();

      expect(res.overview.gmv).toBe(500000);
      expect(res.overview.platformRevenue).toBe(50000);
    });
  });

  describe("P13-06: getDealTotalAmount Canonical Amount Fallback", () => {
    it("prioritizes canonical amount when totalAmount is 0 or null", () => {
      // Default Prisma schema column value for totalAmount is 0
      const dealWithZeroTotal = { amount: 75000, totalAmount: 0 };
      expect(getDealTotalAmount(dealWithZeroTotal)).toBe(75000);

      const dealWithNullTotal = { amount: 50000, totalAmount: null };
      expect(getDealTotalAmount(dealWithNullTotal)).toBe(50000);

      const dealWithLegacyTotal = { amount: 0, totalAmount: 30000 };
      expect(getDealTotalAmount(dealWithLegacyTotal)).toBe(30000);

      // When funded gross escrow is present, totalAmount is never cut
      const dealWithBoth = { amount: 50000, totalAmount: 59000 };
      expect(getDealTotalAmount(dealWithBoth)).toBe(59000);
    });
  });

  describe("P13-07: MSG91 Webhook Production Secret Protection", () => {
    it("rejects unauthenticated requests in production if secret is missing", async () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.MSG91_WEBHOOK_SECRET;
      const origAuthKey = process.env.MSG91_AUTH_KEY;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        delete process.env.MSG91_WEBHOOK_SECRET;
        delete process.env.MSG91_AUTH_KEY;

        const req = new NextRequest("http://localhost:3000/api/webhooks/msg91", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requestId: "req_123", status: "Delivered" }),
        });

        const res = await msg91WebhookPost(req);
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.error).toContain("Webhook secret is not configured");
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
        if (origSecret) process.env.MSG91_WEBHOOK_SECRET = origSecret;
        if (origAuthKey) process.env.MSG91_AUTH_KEY = origAuthKey;
      }
    });

    it("rejects invalid secret tokens when secret is configured", async () => {
      const origSecret = process.env.MSG91_WEBHOOK_SECRET;

      try {
        process.env.MSG91_WEBHOOK_SECRET = "super_secure_msg91_secret";

        const req = new NextRequest("http://localhost:3000/api/webhooks/msg91", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-msg91-secret": "wrong_secret",
          },
          body: JSON.stringify({ requestId: "req_123", status: "Delivered" }),
        });

        const res = await msg91WebhookPost(req);
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error).toBe("Unauthorized");
      } finally {
        if (origSecret) process.env.MSG91_WEBHOOK_SECRET = origSecret;
        else delete process.env.MSG91_WEBHOOK_SECRET;
      }
    });
  });
});

