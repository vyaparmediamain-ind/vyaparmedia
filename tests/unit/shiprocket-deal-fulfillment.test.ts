import { describe, it, expect } from "vitest";
import { checkProductFulfillmentEligibility } from "@/lib/action-eligibility";
import { validateShippingAddress } from "@/services/deal/helpers";

describe("Product Deal Shipping & Fulfillment Eligibility", () => {
  const baseDeal = {
    id: "deal_123",
    status: "ACTIVE",
    requiresProduct: true,
    productFulfillmentStatus: "READY_TO_DISPATCH",
    shippingAddress: {
      fullName: "Rohan Verma",
      phone: "9876543210",
      line1: "123 MG Road",
      city: "Bangalore",
      state: "Karnataka",
      pinCode: "560001",
      country: "India",
    },
    hasActiveDispute: false,
  };

  describe("Shipping Address Validation", () => {
    it("validates a complete Indian address correctly", () => {
      const valid = validateShippingAddress({
        fullName: "Pooja Hegde",
        phone: "9812345678",
        line1: "Plot 42, Hitech City",
        city: "Hyderabad",
        state: "Telangana",
        pinCode: "500081",
        country: "India",
      });

      expect(valid).toHaveProperty("fullName", "Pooja Hegde");
      expect(valid).toHaveProperty("pinCode", "500081");
      expect(valid).toHaveProperty("country", "India");
    });

    it("rejects an address with an invalid PIN code", () => {
      expect(() => {
        validateShippingAddress({
          fullName: "Pooja Hegde",
          phone: "9812345678",
          line1: "Plot 42, Hitech City",
          city: "Hyderabad",
          state: "Telangana",
          pinCode: "5000", // invalid
          country: "India",
        });
      }).toThrow(/Complete Indian shipping address/);
    });

    it("rejects an address with an invalid phone number", () => {
      expect(() => {
        validateShippingAddress({
          fullName: "Pooja Hegde",
          phone: "12345", // invalid
          line1: "Plot 42, Hitech City",
          city: "Hyderabad",
          state: "Telangana",
          pinCode: "500081",
          country: "India",
        });
      }).toThrow(/Complete Indian shipping address/);
    });
  });

  describe("checkProductFulfillmentEligibility predicates", () => {
    it("allows Brand to create Shiprocket shipment when deal is ready and escrow secured", () => {
      const res = checkProductFulfillmentEligibility(baseDeal, "BRAND", "create_shipment");
      expect(res.allowed).toBe(true);
    });

    it("forbids Influencer from creating shipment", () => {
      const res = checkProductFulfillmentEligibility(baseDeal, "INFLUENCER", "create_shipment");
      expect(res.allowed).toBe(false);
      expect(res.reasonCode).toBe("UNAUTHORIZED");
    });

    it("prevents shipment creation if deal escrow payment is not yet secured", () => {
      const unescrowedDeal = { ...baseDeal, status: "PAYMENT_PENDING" };
      const res = checkProductFulfillmentEligibility(unescrowedDeal, "BRAND", "create_shipment");
      expect(res.allowed).toBe(false);
      expect(res.reasonCode).toBe("PAYMENT_NOT_SECURED");
    });

    it("prevents shipment creation if creator address is missing", () => {
      const missingAddressDeal = {
        ...baseDeal,
        shippingAddress: null,
        productFulfillmentStatus: "ADDRESS_PENDING",
      };
      const res = checkProductFulfillmentEligibility(missingAddressDeal, "BRAND", "create_shipment");
      expect(res.allowed).toBe(false);
      expect(res.reasonCode).toBe("ADDRESS_MISSING");
    });

    it("allows creator to confirm receipt once deal is DISPATCHED", () => {
      const dispatchedDeal = {
        ...baseDeal,
        productFulfillmentStatus: "DISPATCHED",
      };
      const res = checkProductFulfillmentEligibility(dispatchedDeal, "INFLUENCER", "confirm_received");
      expect(res.allowed).toBe(true);
    });

    it("blocks receipt confirmation if product was never dispatched", () => {
      const res = checkProductFulfillmentEligibility(baseDeal, "INFLUENCER", "confirm_received");
      expect(res.allowed).toBe(false);
      expect(res.reasonCode).toBe("NOT_DISPATCHED");
    });

    it("blocks all shipping actions on cancelled or terminal deals", () => {
      const cancelledDeal = { ...baseDeal, status: "CANCELLED" };
      const res = checkProductFulfillmentEligibility(cancelledDeal, "BRAND", "create_shipment");
      expect(res.allowed).toBe(false);
      expect(res.reasonCode).toBe("TERMINAL_DEAL");
    });
  });
});
