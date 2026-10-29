import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import prisma from "@/lib/db";
import { redis } from "@/lib/redis";
import { handleShiprocketWebhook, mapShiprocketStatus } from "@/services/deal/product";

describe("SR-HOOK-01, SR-OPS-01 & DPDP: Webhook Status Lifecycle, Replay & Out-of-Order Guards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("mapShiprocketStatus", () => {
    it("correctly maps all Shiprocket carrier statuses to canonical status codes", () => {
      expect(mapShiprocketStatus("DELIVERED")).toBe("DELIVERED");
      expect(mapShiprocketStatus("OUT FOR DELIVERY")).toBe("OUT_FOR_DELIVERY");
      expect(mapShiprocketStatus("IN TRANSIT")).toBe("IN_TRANSIT");
      expect(mapShiprocketStatus("SHIPPED")).toBe("IN_TRANSIT");
      expect(mapShiprocketStatus("PICKUP SCHEDULED")).toBe("PICKUP_SCHEDULED");
      expect(mapShiprocketStatus("PICKED UP")).toBe("PICKUP_SCHEDULED");
      expect(mapShiprocketStatus("RTO INITIATED")).toBe("RTO_INITIATED");
      expect(mapShiprocketStatus("RTO DELIVERED")).toBe("RTO_DELIVERED");
      expect(mapShiprocketStatus("CANCELED")).toBe("CANCELLED");
      expect(mapShiprocketStatus("CANCELLED")).toBe("CANCELLED");
      expect(mapShiprocketStatus("LOST")).toBe("LOST");
      expect(mapShiprocketStatus("DAMAGED")).toBe("DAMAGED");
      expect(mapShiprocketStatus("UNRECOGNIZED_CARRIER_CODE")).toBe("UNKNOWN");
    });
  });

  describe("handleShiprocketWebhook lifecycle & guards", () => {
    it("updates deal to RECEIVED on DELIVERED webhook and sends notifications", async () => {
      const mockDeal = {
        id: "deal_webhook_deliver_1",
        shippingStatus: "IN_TRANSIT",
        productFulfillmentStatus: "DISPATCHED",
        campaign: { title: "Lipstick Campaign" },
        brand: { userId: "user_brand_10", companyName: "Glam Co" },
        influencer: { userId: "user_inf_10", displayName: "Aanya" },
      };

      vi.spyOn(redis, "set").mockResolvedValue("OK");
      vi.spyOn(prisma.deal, "findFirst").mockResolvedValue(mockDeal as any);
      const updateSpy = vi.fn().mockResolvedValue({ ...mockDeal, shippingStatus: "DELIVERED", productFulfillmentStatus: "RECEIVED" });
      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
        return cb({
          deal: { update: updateSpy },
          notification: { createMany: vi.fn(), create: vi.fn() },
        });
      });

      const payload = {
        awb: "AWB_DELIVER_123",
        current_status: "DELIVERED",
        current_timestamp: "2026-10-15T12:00:00Z",
      };

      const result = await handleShiprocketWebhook(payload);
      expect(result.matched).toBe(true);
      expect(result.status).toBe("DELIVERED");
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shippingStatus: "DELIVERED",
            productFulfillmentStatus: "RECEIVED",
          }),
        }),
      );
    });

    it("prevents out-of-order downgrade when an older IN TRANSIT webhook arrives after DELIVERED", async () => {
      const deliveredDeal = {
        id: "deal_already_delivered_99",
        shippingStatus: "DELIVERED",
        productFulfillmentStatus: "RECEIVED",
        productReceivedAt: new Date("2026-10-15T10:00:00Z"),
        campaign: { title: "Smart Shoes" },
        brand: { userId: "user_brand_22" },
        influencer: { userId: "user_inf_22" },
      };

      vi.spyOn(redis, "set").mockResolvedValue("OK");
      vi.spyOn(prisma.deal, "findFirst").mockResolvedValue(deliveredDeal as any);
      const updateSpy = vi.fn();
      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
        return cb({
          deal: { update: updateSpy },
          notification: { create: vi.fn() },
        });
      });

      // Older delayed webhook arrives
      const payload = {
        awb: "AWB_DELAYED_456",
        current_status: "IN TRANSIT",
        current_timestamp: "2026-10-15T08:00:00Z",
      };

      const result = await handleShiprocketWebhook(payload);
      expect(result.matched).toBe(true);
      // Ensure deal.productFulfillmentStatus is NOT downgraded back to DISPATCHED
      if (updateSpy.mock.calls.length > 0) {
        const updateArg = updateSpy.mock.calls[0]?.[0];
        expect(updateArg?.data?.productFulfillmentStatus).toBeUndefined();
      }
    });

    it("detects and short-circuits replayed/duplicate webhooks via Redis deduplication key", async () => {
      const mockDeal = {
        id: "deal_replay_test",
        shippingStatus: "IN_TRANSIT",
        productFulfillmentStatus: "DISPATCHED",
      };

      // Redis returns null for duplicate (SET key val EX 86400 NX -> null)
      vi.spyOn(redis, "set").mockResolvedValue(null);
      vi.spyOn(prisma.deal, "findFirst").mockResolvedValue(mockDeal as any);
      const txSpy = vi.spyOn(prisma, "$transaction");

      const payload = {
        awb: "AWB_REPLAY_777",
        current_status: "IN TRANSIT",
        current_timestamp: "2026-10-15T11:00:00Z",
      };

      const result = await handleShiprocketWebhook(payload);
      expect(result.matched).toBe(true);
      expect(result.duplicate).toBe(true);
      // No DB mutation should have run
      expect(txSpy).not.toHaveBeenCalled();
    });

    it("handles unknown/new Shiprocket status gracefully without crashing or throwing", async () => {
      const mockDeal = {
        id: "deal_unknown_status",
        shippingStatus: "IN_TRANSIT",
        productFulfillmentStatus: "DISPATCHED",
        campaign: { title: "Campaign X" },
        brand: { userId: "user_b" },
        influencer: { userId: "user_i" },
      };

      vi.spyOn(redis, "set").mockResolvedValue("OK");
      vi.spyOn(prisma.deal, "findFirst").mockResolvedValue(mockDeal as any);
      const updateSpy = vi.fn().mockResolvedValue(mockDeal);
      vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
        return cb({
          deal: { update: updateSpy },
          notification: { create: vi.fn() },
        });
      });

      const payload = {
        awb: "AWB_CUSTOMS_111",
        current_status: "CUSTOMS_CLEARANCE_HOLD",
      };

      const result = await handleShiprocketWebhook(payload);
      expect(result.matched).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shippingStatus: "CUSTOMS_CLEARANCE_HOLD",
          }),
        }),
      );
    });
  });

  describe("SR-OPS-01: Stale fulfillment cron timeout declaration", () => {
    it("exports maxDuration = 60 for serverless execution limit", () => {
      const routePath = path.join(process.cwd(), "src/app/api/cron/stale-fulfillment/route.ts");
      const content = fs.readFileSync(routePath, "utf8");
      expect(content).toMatch(/export\s+const\s+maxDuration\s*=\s*60/);
    });
  });
});
