import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCompleteShipment, clearCachedShiprocketToken } from "@/lib/shiprocket";
import { ApiErrorCode, AppError } from "@/lib/errors";
import { redis } from "@/lib/redis";

describe("SR-IDEMP-01 & SR-SVC-01: Deterministic Order ID, Idempotency & Serviceability Gating", () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      SHIPROCKET_EMAIL: "logistics@vyaparmedia.in",
      SHIPROCKET_PASSWORD: "secure-api-password-123",
      SHIPROCKET_WEBHOOK_SECRET: "shiprocket_secret_token_live",
      SHIPROCKET_PICKUP_LOCATION: "Primary Warehouse",
      SHIPROCKET_PICKUP_PINCODE: "110001",
    };
    await clearCachedShiprocketToken();
    vi.spyOn(redis, "get").mockImplementation(async (key: any) => {
      if (String(key) === "shiprocket:auth:token") return "mock_valid_token";
      return null;
    });
    vi.spyOn(redis, "ttl").mockResolvedValue(3600);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("fails fast with SHIPPING_ADDRESS_REQUIRED when pincode is not a valid 6-digit Indian pincode", async () => {
    const invalidAddressParams = {
      dealId: "deal_invalid_pin_123",
      campaignTitle: "Summer Shoes Promo",
      productName: "Air Runners",
      productValuePaise: 499900,
      shippingAddress: {
        fullName: "Rahul Sharma",
        phone: "9876543210",
        line1: "Flat 402, Lotus Heights",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "012345", // Invalid (starts with 0)
        country: "India",
      },
    };

    await expect(createCompleteShipment(invalidAddressParams)).rejects.toThrowError(
      expect.objectContaining({
        errorCode: ApiErrorCode.SHIPPING_ADDRESS_REQUIRED,
      }),
    );
  });

  it("fails fast with SHIPPING_NON_SERVICEABLE when courier serviceability returns no available couriers", async () => {
    const validParams = {
      dealId: "deal_serviceable_test",
      campaignTitle: "Beauty Launch",
      productName: "Glow Serum",
      productValuePaise: 150000,
      shippingAddress: {
        fullName: "Pooja Hegde",
        phone: "9812345678",
        line1: "Hill View, MG Road",
        city: "Shimla",
        state: "Himachal Pradesh",
        pinCode: "171001",
        country: "India",
      },
    };

    // Mock fetch for courier serviceability returning 0 available couriers
    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/courier/serviceability")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 200,
            data: {
              available_courier_companies: [],
            },
          }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    await expect(createCompleteShipment(validParams)).rejects.toThrowError(
      expect.objectContaining({
        errorCode: ApiErrorCode.SHIPPING_NON_SERVICEABLE,
      }),
    );
  });

  it("uses deterministic order_id (VM-DEAL-<dealId>), captures country_of_origin: 'India', and prepaid payment", async () => {
    const params = {
      dealId: "cl_deal_deterministic_99",
      campaignTitle: "Smart Watch Review",
      productName: "Smart Watch V2",
      productValuePaise: 299900,
      shippingAddress: {
        fullName: "Aarav Patel",
        phone: "9123456789",
        line1: "123 Navrangpura",
        city: "Ahmedabad",
        state: "Gujarat",
        pinCode: "380009",
        country: "India",
      },
      walletBalancePaise: 50000, // ₹500
    };

    let adhocPayload: any = null;

    vi.spyOn(global, "fetch").mockImplementation(async (url: any, init: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/courier/serviceability")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 200,
            data: {
              available_courier_companies: [{ courier_company_id: 1, rate: 85, courier_name: "Blue Dart" }],
            },
          }),
        } as any;
      }
      if (urlStr.includes("/orders/create/adhoc")) {
        adhocPayload = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            order_id: adhocPayload.order_id,
            shipment_id: "SR_SHIP_12345",
            status: "NEW",
          }),
        } as any;
      }
      if (urlStr.includes("/courier/assign/awb")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            response: {
              data: {
                awb_code: "AWB99887766",
                courier_name: "Blue Dart Express",
              },
            },
          }),
        } as any;
      }
      if (urlStr.includes("/courier/generate/label")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ label_url: "https://shiprocket.co/label/123.pdf" }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const res = await createCompleteShipment(params);
    expect(res.orderId).toBe("VM-DEAL-cl_deal_deterministic_99");
    expect(res.awbCode).toBe("AWB99887766");
    expect(res.courierChargePaise).toBe(8500);

    // Verify adhoc payload requirements
    expect(adhocPayload).toBeDefined();
    expect(adhocPayload.order_id).toBe("VM-DEAL-cl_deal_deterministic_99");
    expect(adhocPayload.payment_method).toBe("Prepaid");
    expect(adhocPayload.order_items[0].country_of_origin).toBe("India");
  });

  it("detects and reuses existing order on retry (idempotency) when Shiprocket returns 422 order already taken", async () => {
    const params = {
      dealId: "cl_deal_retry_test_55",
      campaignTitle: "Skincare Campaign",
      productName: "Face Wash",
      productValuePaise: 80000,
      shippingAddress: {
        fullName: "Neha Roy",
        phone: "9876543210",
        line1: "Sector 14",
        city: "Gurugram",
        state: "Haryana",
        pinCode: "122001",
        country: "India",
      },
      walletBalancePaise: 100000,
    };

    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/courier/serviceability")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 200,
            data: {
              available_courier_companies: [{ courier_company_id: 2, rate: 60, courier_name: "Delhivery" }],
            },
          }),
        } as any;
      }
      // Order creation returns 422 duplicate order error
      if (urlStr.includes("/orders/create/adhoc")) {
        return {
          ok: false,
          status: 422,
          text: async () =>
            JSON.stringify({
              message: "The order id has already been taken.",
              status_code: 422,
            }),
        } as any;
      }
      // Query existing order endpoint returns existing order and shipment
      if (urlStr.includes("/orders/show")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              id: "VM-DEAL-cl_deal_retry_test_55",
              order_id: "VM-DEAL-cl_deal_retry_test_55",
              shipments: [{ id: "SR_EXISTING_SHIP_88", status: "NEW", awb: "AWB_EXISTING_123" }],
            },
          }),
        } as any;
      }
      if (urlStr.includes("/courier/assign/awb")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            response: {
              data: {
                awb_code: "AWB_EXISTING_123",
                courier_name: "Delhivery Surface",
              },
            },
          }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    const res = await createCompleteShipment(params);
    expect(res.orderId).toBe("VM-DEAL-cl_deal_retry_test_55");
    expect(res.shipmentId).toBe("SR_EXISTING_SHIP_88");
  });

  it("never leaks raw provider JSON or technical errors to user message", async () => {
    const params = {
      dealId: "cl_deal_error_masking",
      campaignTitle: "Headphones Test",
      productName: "Wireless ANC",
      productValuePaise: 500000,
      shippingAddress: {
        fullName: "Vikram Das",
        phone: "9988776655",
        line1: "B-201, Green Park",
        city: "Delhi",
        state: "Delhi",
        pinCode: "110016",
        country: "India",
      },
      walletBalancePaise: 50000,
    };

    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("/courier/serviceability")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 200,
            data: {
              available_courier_companies: [{ courier_company_id: 1, rate: 70 }],
            },
          }),
        } as any;
      }
      if (urlStr.includes("/orders/create/adhoc")) {
        return {
          ok: false,
          status: 500,
          text: async () =>
            JSON.stringify({
              error: {
                code: "INTERNAL_DATABASE_DEADLOCK",
                sql: "SELECT * FROM sr_shippers WHERE id = 1293 FOR UPDATE",
                stack: "Traceback at shiprocket.internal.py:99",
              },
            }),
        } as any;
      }
      return { ok: false, status: 404 } as any;
    });

    try {
      await createCompleteShipment(params);
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err).toBeInstanceOf(AppError);
      // Ensure zero technical leak: no SQL, no JSON string, no internal error details
      expect(err.message).not.toContain("INTERNAL_DATABASE_DEADLOCK");
      expect(err.message).not.toContain("SELECT *");
      expect(err.message).not.toContain("Traceback");
      expect(err.message).not.toContain("{");
      expect(err.message).toContain("Courier shipment could not be initiated");
    }
  });
});
