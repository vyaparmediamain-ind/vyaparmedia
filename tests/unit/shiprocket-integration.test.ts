import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isShiprocketConfigured,
  createCompleteShipment,
  trackShipment,
  verifyWebhookSecret,
} from "@/lib/shiprocket";

describe("Shiprocket Logistics API Integration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Configuration detection", () => {
    it("reports not configured when email or password is missing", () => {
      delete process.env.SHIPROCKET_EMAIL;
      delete process.env.SHIPROCKET_PASSWORD;
      expect(isShiprocketConfigured()).toBe(false);
    });

    it("reports configured when both email and password are provided", () => {
      process.env.SHIPROCKET_EMAIL = "shipping@reachout.in";
      process.env.SHIPROCKET_PASSWORD = "supersecretpassword";
      expect(isShiprocketConfigured()).toBe(true);
    });
  });

  describe("Shipment Creation (Mock Mode for Dev & Testing)", () => {
    it("successfully creates a complete shipment with AWB and label in mock mode", async () => {
      delete process.env.SHIPROCKET_EMAIL;
      delete process.env.SHIPROCKET_PASSWORD;

      const sampleAddress = {
        fullName: "Aarav Sharma",
        phone: "9876543210",
        line1: "Flat 402, Sunshine Heights, Andheri West",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400053",
        country: "India",
      };

      const result = await createCompleteShipment({
        dealId: "cuid_deal_test_12345",
        campaignTitle: "Summer Skin Care Product Seeding",
        productName: "Glow Serum 50ml",
        productValuePaise: 250000, // Rs. 2,500
        shippingAddress: sampleAddress,
        creatorEmail: "aarav@influencer.com",
        pickupLocation: "Primary Warehouse",
        length: 15,
        breadth: 12,
        height: 8,
        weight: 0.45,
      });

      expect(result).toBeDefined();
      expect(result.orderId).toContain("SR-ORD");
      expect(result.shipmentId).toContain("SR-SHIP");
      expect(result.awbCode).toMatch(/^SRDEL\d+/);
      expect(result.courierName).toContain("Delhivery");
      expect(result.labelUrl).toContain(".pdf");
      expect(result.initialStatus).toBe("PICKUP_SCHEDULED");
      expect(result.trackingHistory).toHaveLength(1);
      expect(result.trackingHistory[0]!.status).toBe("PICKUP_SCHEDULED");
    });

    it("throws error in production when credentials are missing", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.SHIPROCKET_EMAIL;
      delete process.env.SHIPROCKET_PASSWORD;

      const sampleAddress = {
        fullName: "Aarav Sharma",
        phone: "9876543210",
        line1: "Flat 402, Sunshine Heights, Andheri West",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400053",
        country: "India",
      };

      await expect(
        createCompleteShipment({
          dealId: "cuid_deal_test_12345",
          campaignTitle: "Summer Skin Care Product Seeding",
          productName: "Glow Serum 50ml",
          productValuePaise: 250000,
          shippingAddress: sampleAddress,
        }),
      ).rejects.toThrow(/credentials.*are not configured in production/i);
    });
  });

  describe("Token Caching & Concurrency Deduplication", () => {
    it("deduplicates concurrent getShiprocketToken calls during cold start", async () => {
      process.env.SHIPROCKET_EMAIL = "shipping@reachout.in";
      process.env.SHIPROCKET_PASSWORD = "supersecretpassword";

      const originalFetch = global.fetch;
      let fetchCallCount = 0;

      global.fetch = vi.fn().mockImplementation(async () => {
        fetchCallCount++;
        // Simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          ok: true,
          json: async () => ({ token: "jwt_token_mock_12345" }),
          text: async () => "",
        } as Response;
      });

      const { getShiprocketToken } = await import("@/lib/shiprocket");

      // Execute 5 concurrent calls
      const tokens = await Promise.all([
        getShiprocketToken(),
        getShiprocketToken(),
        getShiprocketToken(),
        getShiprocketToken(),
        getShiprocketToken(),
      ]);

      expect(fetchCallCount).toBe(1);
      expect(tokens).toEqual([
        "jwt_token_mock_12345",
        "jwt_token_mock_12345",
        "jwt_token_mock_12345",
        "jwt_token_mock_12345",
        "jwt_token_mock_12345",
      ]);

      global.fetch = originalFetch;
    });
  });

  describe("Live Tracking Sync", () => {
    it("returns tracking timeline and current status for simulated shipments", async () => {
      delete process.env.SHIPROCKET_EMAIL;
      delete process.env.SHIPROCKET_PASSWORD;

      const tracking = await trackShipment("SRDEL9988776655", "DISPATCHED");

      expect(tracking.awbCode).toBe("SRDEL9988776655");
      expect(tracking.currentStatus).toBe("OUT_FOR_DELIVERY");
      expect(tracking.scans.length).toBeGreaterThanOrEqual(3);
      expect(tracking.scans[0]!.status).toBe("PICKUP_SCHEDULED");
    });

    it("returns DELIVERED status when stored status is DELIVERED", async () => {
      delete process.env.SHIPROCKET_EMAIL;
      delete process.env.SHIPROCKET_PASSWORD;

      const tracking = await trackShipment("SRDEL9988776655", "DELIVERED");

      expect(tracking.currentStatus).toBe("DELIVERED");
      expect(tracking.deliveredDate).not.toBeNull();
    });

    it("queries live Shiprocket API for real SRDEL AWBs when credentials are configured", async () => {
      process.env.SHIPROCKET_EMAIL = "shipping@reachout.in";
      process.env.SHIPROCKET_PASSWORD = "supersecretpassword";

      const originalFetch = global.fetch;
      let requestedUrl = "";

      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        requestedUrl = urlStr;
        if (urlStr.includes("/auth/login")) {
          return {
            ok: true,
            json: async () => ({ token: "jwt_valid_token" }),
          } as Response;
        }
        if (urlStr.includes("/courier/track/awb/")) {
          return {
            ok: true,
            json: async () => ({
              tracking_data: {
                track_status: "IN_TRANSIT",
                courier_name: "Delhivery Surface",
                shipment_track_activities: [
                  {
                    date: "2026-09-30 12:00:00",
                    status: "IN_TRANSIT",
                    activity: "In transit to hub",
                    location: "Bhiwandi Hub",
                  },
                ],
              },
            }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const tracking = await trackShipment("SRDEL1234567890");

      expect(requestedUrl).toContain("/courier/track/awb/SRDEL1234567890");
      expect(tracking.currentStatus).toBe("IN_TRANSIT");
      expect(tracking.courierName).toBe("Delhivery Surface");
      expect(tracking.scans[0]!.location).toBe("Bhiwandi Hub");

      global.fetch = originalFetch;
    });
  });

  describe("Webhook Security & Verification", () => {
    it("accepts any header when secret is not configured in dev/test", () => {
      delete process.env.SHIPROCKET_WEBHOOK_SECRET;
      (process.env as Record<string, string | undefined>).NODE_ENV = "test";
      expect(verifyWebhookSecret(null)).toBe(true);
      expect(verifyWebhookSecret("any_token")).toBe(true);
    });

    it("strictly rejects all webhooks in production if secret is not configured", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.SHIPROCKET_WEBHOOK_SECRET;

      expect(verifyWebhookSecret(null)).toBe(false);
      expect(verifyWebhookSecret("any_token")).toBe(false);
      expect(verifyWebhookSecret("Bearer some_token")).toBe(false);
    });

    it("strictly verifies matching secret when configured", () => {
      process.env.SHIPROCKET_WEBHOOK_SECRET = "shiprocket_secret_token_xyz";

      expect(verifyWebhookSecret("shiprocket_secret_token_xyz")).toBe(true);
      expect(verifyWebhookSecret("Bearer shiprocket_secret_token_xyz")).toBe(true);
      expect(verifyWebhookSecret("wrong_secret")).toBe(false);
      expect(verifyWebhookSecret(null)).toBe(false);
    });
  });

  describe("Webhook Payload Schema Validation", () => {
    it("validates and accepts valid webhook payload with awb and scans", async () => {
      const { shiprocketWebhookPayloadSchema } = await import("@/lib/validations");

      const validPayload = {
        awb: "1432567890123",
        order_id: "ORD-9988-1234",
        current_status: "DELIVERED",
        courier_name: "Delhivery Surface",
        scans: [
          {
            date: "2026-09-30 14:00:00",
            status: "DELIVERED",
            activity: "Delivered to recipient",
            location: "Mumbai",
          },
        ],
      };

      const result = shiprocketWebhookPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.awb).toBe("1432567890123");
        expect(result.data.current_status).toBe("DELIVERED");
      }
    });

    it("rejects payload missing both awb identifiers and order_id", async () => {
      const { shiprocketWebhookPayloadSchema } = await import("@/lib/validations");

      const invalidPayload = {
        current_status: "IN_TRANSIT",
        courier_name: "Blue Dart",
      };

      const result = shiprocketWebhookPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("converts numeric AWB to string cleanly", async () => {
      const { shiprocketWebhookPayloadSchema } = await import("@/lib/validations");

      const payload = {
        awb: 987654321012,
        current_status: "OUT_FOR_DELIVERY",
      };

      const result = shiprocketWebhookPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.awb).toBe("987654321012");
      }
    });
  });

  describe("Wallet Balance Pre-Flight Safeguard", () => {
    it("rejects shipment creation when live rate exceeds brand wallet balance before booking", async () => {
      process.env.SHIPROCKET_EMAIL = "shipping@reachout.in";
      process.env.SHIPROCKET_PASSWORD = "supersecretpassword";

      const originalFetch = global.fetch;

      global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/auth/login")) {
          return {
            ok: true,
            json: async () => ({ token: "valid_token" }),
          } as Response;
        }
        if (urlStr.includes("/courier/serviceability/")) {
          return {
            ok: true,
            json: async () => ({
              data: {
                available_courier_companies: [
                  { rate: 120, courier_name: "Blue Dart Surface" }, // ₹120 = 12000 paise
                ],
              },
            }),
          } as Response;
        }
        return { ok: true, json: async () => ({}) } as Response;
      });

      const sampleAddress = {
        fullName: "Aarav Sharma",
        phone: "9876543210",
        line1: "Flat 402, Sunshine Heights, Andheri West",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400053",
        country: "India",
      };

      // Wallet balance is ₹50 (5000 paise), courier rate is ₹120 (12000 paise)
      await expect(
        createCompleteShipment({
          dealId: "deal_preflight_test",
          campaignTitle: "Preflight Test",
          productName: "Sample",
          productValuePaise: 5000,
          shippingAddress: sampleAddress,
          walletBalancePaise: 5000,
        }),
      ).rejects.toThrow(/Insufficient wallet balance for shipping charge/i);

      global.fetch = originalFetch;
    });
  });
});

