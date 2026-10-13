import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSchema, createCampaignSchema } from "@/lib/validations";
import {
  TDS_393_1_RATE,
  TDS_393_1_THRESHOLD_RUPEES,
  TDS_393_1_THRESHOLD_PAISE,
  TDS_194O_RATE,
  TDS_194O_THRESHOLD_RUPEES,
  TDS_194O_THRESHOLD_PAISE,
  GST_TCS_RATE,
} from "@/constants";
import { PLATFORM_CONFIG } from "@/lib/platform-config";
import { calculateGstTcs, getIndiaTaxSummary } from "@/lib/india-compliance";
import { validateAscidisclosure, generateContractTerms } from "@/lib/contract-engine";
import { creditInfluencerPayoutWithTax } from "@/lib/deal-settlement";
import type { Prisma } from "@prisma/client";

describe("P12 Compliance End-to-End Bug Regression Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("P0-COMP-01: RBI Payments & Route Escrow Double-Payout Prevention", () => {
    it("does not increment creator wallet balance when balanceImpact is false (direct gateway settlement)", async () => {
      const updatedMockWallet = { id: "wallet-creator-1", balance: 5000, totalEarned: 20000, debt: 0 };

      const updateWalletMock = vi.fn().mockResolvedValue(updatedMockWallet);
      const createTxMock = vi.fn().mockResolvedValue({ id: "tx-payout-1" });
      const dealUpdateMock = vi.fn().mockResolvedValue({ id: "deal-101" });

      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: "wallet-creator-1", debt: 0 }]),
        indiaTaxCompliance: {
          findUnique: vi.fn().mockResolvedValue({ panLast4: "1234", tdsSection: "194O" }),
        },
        deal: {
          findUnique: vi.fn().mockResolvedValue({ grossPayout: 0, tdsDeducted: 0 }),
          findMany: vi.fn().mockResolvedValue([]),
          update: dealUpdateMock,
        },
        wallet: {
          update: updateWalletMock,
        },
        transaction: {
          create: createTxMock,
        },
      } as unknown as Prisma.TransactionClient;

      const result = await creditInfluencerPayoutWithTax(mockTx, {
        userId: "user-creator-1",
        dealId: "deal-101",
        grossPayout: 10000, // Rs 100
        description: "Direct gateway settlement for deal: deal-101",
        razorpayPaymentId: null,
        metadata: {
          balanceImpact: false,
          source: "route_direct_settlement",
          directGatewaySettlement: true,
        },
        balanceImpact: false,
      });

      expect(result.grossPayout).toBe(10000);
      expect(updateWalletMock).toHaveBeenCalledWith({
        where: { id: "wallet-creator-1" },
        data: {
          // balance is NOT incremented!
          totalEarned: { increment: 10000 },
        },
      });

      // Verify the transaction created has balanceImpact: false
      expect(createTxMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              balanceImpact: false,
              source: "route_direct_settlement",
            }),
          }),
        }),
      );
    });
  });

  describe("P0-COMP-02: DPDPA 2023 & Indian Contract Act Minor Protection (Age Gating)", () => {
    it("registerSchema enforces isAdult requirement and rejects false", () => {
      const validPayload = {
        name: "Aarav Sharma",
        email: "aarav@example.com",
        phone: "9876543210",
        password: "Password@123",
        userType: "INFLUENCER",
        isAdult: true,
      };

      const validResult = registerSchema.safeParse(validPayload);
      expect(validResult.success).toBe(true);

      const invalidPayload = {
        ...validPayload,
        isAdult: false,
      };

      const invalidResult = registerSchema.safeParse(invalidPayload);
      expect(invalidResult.success).toBe(false);
      if (!invalidResult.success) {
        expect(invalidResult.error.issues[0]?.message).toContain("18 years of age");
      }
    });

    it("createCampaignSchema strictly rejects targetAgeMin below 18", () => {
      const baseCampaign = {
        title: "Summer Brand Launch",
        description: "Promote new product line across Instagram channels",
        requirements: "High quality reel with product placement",
        totalBudget: 5000000,
        targetCategories: ["Fashion", "Lifestyle"],
        maxFollowers: 100000,
        deliverables: [{ type: "REEL", count: 1 }],
        contentDeadline: new Date(Date.now() + 86400000 * 5).toISOString(),
        postingDeadline: new Date(Date.now() + 86400000 * 10).toISOString(),
      };

      // Age 13 or 17 must fail
      const resultMinor = createCampaignSchema.safeParse({
        ...baseCampaign,
        targetAgeMin: 13,
      });
      expect(resultMinor.success).toBe(false);

      const result17 = createCampaignSchema.safeParse({
        ...baseCampaign,
        targetAgeMin: 17,
      });
      expect(result17.success).toBe(false);

      // Age 18+ must pass
      const resultAdult = createCampaignSchema.safeParse({
        ...baseCampaign,
        targetAgeMin: 18,
      });
      expect(resultAdult.success).toBe(true);
    });
  });

  describe("P1-COMP-04: Income-tax Act, 2025 Section 393(1) & TDS Constants", () => {
    it("exports Section 393(1) constants and maintains equality with legacy Section 194-O aliases", () => {
      expect(TDS_393_1_RATE).toBe(0.001); // 0.1%
      expect(TDS_393_1_THRESHOLD_RUPEES).toBe(500000);
      expect(TDS_393_1_THRESHOLD_PAISE).toBe(50000000);

      // Backwards compatibility verification
      expect(TDS_194O_RATE).toBe(TDS_393_1_RATE);
      expect(TDS_194O_THRESHOLD_RUPEES).toBe(TDS_393_1_THRESHOLD_RUPEES);
      expect(TDS_194O_THRESHOLD_PAISE).toBe(TDS_393_1_THRESHOLD_PAISE);
    });
  });

  describe("P1-COMP-05: IT Rules 2021 Rule 3(2) Named Grievance Officer & CIN", () => {
    it("PLATFORM_CONFIG publishes valid 21-character MCA CIN and a named Grievance Officer", () => {
      const cin = PLATFORM_CONFIG.cin;
      expect(cin).toBeDefined();
      // Valid Indian CIN: [U/L][5 digits][2 state letters][4 year digits][PTC/PLC/LLC][6 digits]
      const cinRegex = /^[UL]\d{5}[A-Z]{2}\d{4}(PTC|PLC|LLC|NPL)\d{6}$/;
      expect(cinRegex.test(cin)).toBe(true);

      expect(PLATFORM_CONFIG.grievanceOfficer).toBeDefined();
      expect(PLATFORM_CONFIG.grievanceOfficer).toContain("Dhruv Agarwal");
      expect(PLATFORM_CONFIG.grievanceEmail).toBe("grievance@vyaparmedia.in");
    });
  });

  describe("P1-COMP-06: GST Section 52 (1% TCS) Helper Calculation", () => {
    it("calculates 1% TCS split into CGST and SGST for intra-state supplies", () => {
      const tcs = calculateGstTcs(100000, "29", "29"); // Rs 1000 in Karnataka
      expect(tcs.taxableAmountPaise).toBe(100000);
      expect(tcs.tcsRate).toBe(GST_TCS_RATE);
      expect(tcs.tcsAmountPaise).toBe(1000); // 1% of 100000
      expect(tcs.cgstPaise).toBe(500); // 0.5%
      expect(tcs.sgstPaise).toBe(500); // 0.5%
      expect(tcs.igstPaise).toBe(0);
      expect(tcs.isInterState).toBe(false);
    });

    it("calculates 1% TCS as IGST for inter-state supplies", () => {
      const tcs = calculateGstTcs(100000, "27", "29"); // Maharashtra supplier, Karnataka operator
      expect(tcs.tcsAmountPaise).toBe(1000);
      expect(tcs.cgstPaise).toBe(0);
      expect(tcs.sgstPaise).toBe(0);
      expect(tcs.igstPaise).toBe(1000);
      expect(tcs.isInterState).toBe(true);
    });

    it("includes advisory for GST-registered influencers in getIndiaTaxSummary", () => {
      const summary = getIndiaTaxSummary({
        userType: "INFLUENCER",
        panPresent: true,
        gstinPresent: true,
        gstRegistrationType: "REGISTERED",
        itrPresent: true,
      });

      const tcsAdvisory = summary.advisories.some((a) => a.includes("Section 52 TCS"));
      expect(tcsAdvisory).toBe(true);
    });
  });

  describe("P1-COMP-07: ASCI & CCPA Advertising Disclosure Validation", () => {
    it("detects valid ASCI tags in captions (#ad, #sponsored, #collab, etc.)", () => {
      expect(validateAscidisclosure("Loving this new smartwatch from BrandX! #ad").isCompliant).toBe(true);
      expect(validateAscidisclosure("Check out the summer collection #Sponsored").isCompliant).toBe(true);
      expect(validateAscidisclosure("My daily morning skincare routine #collab #skincare").isCompliant).toBe(true);
      expect(validateAscidisclosure("Paid promotion with BrandY #paidpartnership").isCompliant).toBe(true);
    });

    it("flags captions missing mandatory statutory disclosures", () => {
      const result = validateAscidisclosure("Loving this new smartwatch from BrandX! Use code SAVE20 for discount!");
      expect(result.isCompliant).toBe(false);
      expect(result.missingRequirement).toBeDefined();
      expect(result.missingRequirement).toContain("ASCI/CCPA");
    });
  });

  describe("P1-COMP-09: Contracts - Governing Law & Exclusive Jurisdiction", () => {
    it("generates contract terms with explicit Indian governing law and Bengaluru jurisdiction", async () => {
      const campaign = {
        id: "camp-1",
        title: "Diwali Fest",
        requirements: "Create reel with #ad tag",
        deliverables: [{ type: "REEL", count: 1, platform: "INSTAGRAM", details: "1 reel" }],
        contentDeadline: new Date(Date.now() + 86400000 * 7),
        postingDeadline: new Date(Date.now() + 86400000 * 14),
        totalBudget: 100000,
      };

      const terms = generateContractTerms(
        "deal-123",
        campaign as Parameters<typeof generateContractTerms>[1],
        { rate: 50000 },
      );

      expect(terms.governingLaw).toBeDefined();
      expect(terms.governingLaw).toContain("Republic of India");
      expect(terms.jurisdiction).toBeDefined();
      expect(terms.jurisdiction).toContain("Bengaluru, Karnataka");
      expect(terms.arbitrationClause).toBeDefined();
      expect(terms.arbitrationClause).toContain("Arbitration and Conciliation Act, 1996");
    });
  });
});
