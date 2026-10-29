import { describe, it, expect, beforeAll } from "vitest";
import prisma from "@/lib/db";
import { transitionDealState } from "@/lib/deal-state-machine";
import { DealService } from "@/services/deal.service";
import { verifyWebhookSecret } from "@/lib/shiprocket";
import { shiprocketWebhookPayloadSchema } from "@/lib/validations";

describe("E2E Test: Full Creator Campaign, Physical Product Seeding & Financial Settlement Lifecycle", () => {
  const timestamp = Date.now();
  let brandUserId = "";
  let brandProfileId = "";
  let influencerUserId = "";
  let influencerProfileId = "";
  let brandWalletId = "";
  let influencerWalletId = "";
  let campaignId = "";
  let dealId = "";

  beforeAll(async () => {
    // 1. Create real Brand User, Profile, and Wallet in PostgreSQL
    const brandUser = await prisma.user.create({
      data: {
        email: `brand_e2e_${timestamp}@example.com`,
        passwordHash: "secure_hash_password_999",
        userType: "BRAND",
        status: "ACTIVE",
        verificationLevel: "FULL",
        trustScore: 850,
        brandProfile: {
          create: {
            companyName: `Vyapar Brand E2E ${timestamp}`,
            website: "https://vyaparbrand.example.com",
            industry: "Beauty & Personal Care",
          },
        },
      },
      include: { brandProfile: true },
    });
    brandUserId = brandUser.id;
    brandProfileId = brandUser.brandProfile!.id;

    const brandWallet = await prisma.wallet.create({
      data: {
        userId: brandUserId,
        balance: 200000, // Rs 2,000 initial balance in paise
        pendingBalance: 0,
        isFrozen: false,
      },
    });
    brandWalletId = brandWallet.id;

    // 2. Create real Influencer User, Profile, and Wallet in PostgreSQL
    const influencerUser = await prisma.user.create({
      data: {
        email: `creator_e2e_${timestamp}@example.com`,
        passwordHash: "secure_hash_password_999",
        userType: "INFLUENCER",
        status: "ACTIVE",
        verificationLevel: "FULL",
        trustScore: 820,
        influencerProfile: {
          create: {
            displayName: `Aarav Tech Creator ${timestamp}`,
            instagramHandle: `aarav_e2e_${timestamp}`,
            categories: "tech,lifestyle",
            languages: "hindi,english",
          },
        },
      },
      include: { influencerProfile: true },
    });
    influencerUserId = influencerUser.id;
    influencerProfileId = influencerUser.influencerProfile!.id;

    const influencerWallet = await prisma.wallet.create({
      data: {
        userId: influencerUserId,
        balance: 0,
        pendingBalance: 0,
        isFrozen: false,
      },
    });
    influencerWalletId = influencerWallet.id;

    // 3. Create real Campaign in PostgreSQL
    const campaign = await prisma.campaign.create({
      data: {
        brand: { connect: { id: brandProfileId } },
        title: `E2E Product Launch Campaign ${timestamp}`,
        description: "Full end-to-end product seeding and promotional campaign",
        requirements: "Create a 60-second review reel featuring the product sample",
        deliverables: [{ type: "REEL", count: 1 }],
        targetCategories: ["lifestyle", "tech"],
        targetCities: ["Mumbai", "Delhi", "Bengaluru"],
        targetLanguages: ["hindi"],
        totalBudget: 150000,
        fundedAmount: 150000,
        contentDeadline: new Date(Date.now() + 10 * 86400000),
        postingDeadline: new Date(Date.now() + 15 * 86400000),
        status: "ACTIVE",
      },
    });
    campaignId = campaign.id;
  });

  it("executes the entire deal lifecycle: contract -> escrow -> address -> dispatch -> webhook delivery -> approval -> payout", async () => {
    // -------------------------------------------------------------------------
    // Phase 1: Create Deal and Lock Escrow in PostgreSQL
    // -------------------------------------------------------------------------
    const dealAmount = 50000; // Rs 500
    const deal = await prisma.deal.create({
      data: {
        campaign: { connect: { id: campaignId } },
        brand: { connect: { id: brandProfileId } },
        influencer: { connect: { id: influencerProfileId } },
        amount: dealAmount,
        totalAmount: dealAmount,
        influencerPayout: dealAmount,
        status: "PENDING_SIGNATURE",
        requiresProduct: true,
        productName: "Flagship Glow Serum 50ml",
        productValue: 15000,
        productFulfillmentStatus: "ADDRESS_PENDING",
        contractTerms: {
          deliverable: "1 Instagram Reel",
          fee: dealAmount,
          rights: "1-year digital usage",
        },
        submissionDeadline: new Date(Date.now() + 5 * 86400000),
        postingDeadline: new Date(Date.now() + 10 * 86400000),
        reviewPeriodHours: 48,
      },
    });
    dealId = deal.id;

    // Transition PENDING_SIGNATURE -> PAYMENT_HELD (LOCK_ESCROW)
    const escrowLock = await transitionDealState({
      dealId,
      fromState: "PENDING_SIGNATURE",
      toState: "PAYMENT_HELD",
      actor: { userId: brandUserId, role: "BRAND" },
      reason: "Brand escrow deposit confirmed",
    });

    expect(escrowLock.success).toBe(true);
    expect(escrowLock.financialEffect).toBe("LOCK_ESCROW");

    // Verify brand wallet reflects locked escrow (balance decreased, pendingBalance increased)
    const brandWalletAfterLock = await prisma.wallet.findUnique({
      where: { id: brandWalletId },
    });
    expect(brandWalletAfterLock?.balance).toBe(200000 - dealAmount); // 150,000
    expect(brandWalletAfterLock?.pendingBalance).toBe(dealAmount); // 50,000

    // Transition PAYMENT_HELD -> ACTIVE
    await transitionDealState({
      dealId,
      toState: "ACTIVE",
      actor: { userId: brandUserId, role: "SYSTEM" },
    });

    const activeDeal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(activeDeal?.status).toBe("ACTIVE");

    // -------------------------------------------------------------------------
    // Phase 2: Creator Submits Shipping Address
    // -------------------------------------------------------------------------
    const shippingAddress = {
      fullName: "Aarav Tech Creator",
      phone: "9876543210",
      line1: "Flat 801, Sea View Towers, Worli",
      city: "Mumbai",
      state: "Maharashtra",
      pinCode: "400018",
      country: "India",
    };

    const addressSubmittedDeal = await DealService.submitShippingAddress(
      influencerUserId,
      dealId,
      shippingAddress,
    );
    expect(addressSubmittedDeal.productFulfillmentStatus).toBe("READY_TO_DISPATCH");
    expect(addressSubmittedDeal.shippingAddress).toMatchObject(shippingAddress);

    // -------------------------------------------------------------------------
    // Phase 3: Brand Creates Shipment with Shiprocket
    // -------------------------------------------------------------------------
    const brandBalanceBeforeShipping = (
      await prisma.wallet.findUnique({ where: { id: brandWalletId } })
    )?.balance || 0;

    const dispatchResult = await DealService.createShiprocketShipment(
      brandUserId,
      dealId,
      {
        pickupLocation: "Primary Mumbai Warehouse",
        length: 12,
        breadth: 10,
        height: 8,
        weight: 0.35,
      },
    );

    expect(dispatchResult.deal.productFulfillmentStatus).toBe("DISPATCHED");
    expect(dispatchResult.shipment.awbCode).toBeDefined();
    expect(dispatchResult.courierChargePaise).toBeGreaterThan(0);

    // Verify brand wallet debited for shipping charge and platform treasury credited
    const brandWalletAfterShipping = await prisma.wallet.findUnique({
      where: { id: brandWalletId },
    });
    expect(brandWalletAfterShipping?.balance).toBe(
      brandBalanceBeforeShipping - dispatchResult.courierChargePaise,
    );

    const treasuryWallet = await prisma.wallet.findUnique({
      where: { userId: "PLATFORM_TREASURY" },
    });
    expect(treasuryWallet?.balance).toBeGreaterThanOrEqual(dispatchResult.courierChargePaise);

    // -------------------------------------------------------------------------
    // Phase 4: Incoming Shiprocket Webhook (Delivery Confirmation)
    // -------------------------------------------------------------------------
    // Validate webhook payload against Zod schema
    const webhookPayload = {
      awb: dispatchResult.shipment.awbCode,
      order_id: dispatchResult.shipment.orderId,
      current_status: "DELIVERED",
      courier_name: dispatchResult.shipment.courierName,
      scans: [
        {
          date: new Date(Date.now() - 86400000).toISOString(),
          status: "IN_TRANSIT",
          activity: "Package reached Mumbai hub",
          location: "Mumbai Sorting Centre",
        },
        {
          date: new Date().toISOString(),
          status: "DELIVERED",
          activity: "Package successfully handed to creator and signed",
          location: "Worli Delivery Hub",
        },
      ],
    };

    const parsedWebhook = shiprocketWebhookPayloadSchema.safeParse(webhookPayload);
    expect(parsedWebhook.success).toBe(true);

    // Verify webhook authentication check
    process.env.SHIPROCKET_WEBHOOK_SECRET = "shiprocket_e2e_secret_token";
    expect(verifyWebhookSecret("Bearer shiprocket_e2e_secret_token")).toBe(true);
    expect(verifyWebhookSecret("wrong_secret")).toBe(false);

    // Process webhook
    const webhookResult = await DealService.handleShiprocketWebhook(webhookPayload);
    expect(webhookResult.matched).toBe(true);
    expect(webhookResult.dealId).toBe(dealId);

    // Verify Deal state in PostgreSQL is updated to RECEIVED
    const deliveredDeal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(deliveredDeal?.productFulfillmentStatus).toBe("RECEIVED");
    expect(deliveredDeal?.shippingStatus).toBe("DELIVERED");
    expect(deliveredDeal?.productReceivedAt).not.toBeNull();

    // -------------------------------------------------------------------------
    // Phase 5: Influencer Submits Content -> Brand Approves Content
    // -------------------------------------------------------------------------
    await transitionDealState({
      dealId,
      toState: "CONTENT_SUBMITTED",
      actor: { userId: influencerUserId, role: "INFLUENCER" },
    });

    const submittedDeal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(submittedDeal?.status).toBe("CONTENT_SUBMITTED");

    await transitionDealState({
      dealId,
      toState: "CONTENT_APPROVED",
      actor: { userId: brandUserId, role: "BRAND" },
    });

    const approvedDeal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(approvedDeal?.status).toBe("CONTENT_APPROVED");

    // -------------------------------------------------------------------------
    // Phase 6: Deal Completion & Escrow Payout to Influencer
    // -------------------------------------------------------------------------
    const influencerWalletBefore = (
      await prisma.wallet.findUnique({ where: { id: influencerWalletId } })
    )?.balance || 0;

    const completion = await transitionDealState({
      dealId,
      toState: "COMPLETED",
      actor: { userId: brandUserId, role: "BRAND" },
    });

    expect(completion.success).toBe(true);
    expect(completion.toState).toBe("COMPLETED");
    expect(completion.financialEffect).toBe("RELEASE_ESCROW");

    // Verify Influencer received payout in PostgreSQL wallet
    const influencerWalletAfter = await prisma.wallet.findUnique({
      where: { id: influencerWalletId },
    });
    expect(influencerWalletAfter?.balance).toBeGreaterThan(influencerWalletBefore);

    // Verify Brand pending escrow is cleared to 0
    const finalBrandWallet = await prisma.wallet.findUnique({
      where: { id: brandWalletId },
    });
    expect(finalBrandWallet?.pendingBalance).toBe(0);

    // -------------------------------------------------------------------------
    // Phase 7: Terminal State Guard (Immutability)
    // -------------------------------------------------------------------------
    await expect(
      transitionDealState({
        dealId,
        toState: "ACTIVE",
        actor: { userId: brandUserId, role: "ADMIN" },
      }),
    ).rejects.toThrow("TERMINAL_STATE_LOCKED");

    // Verify Deal record in PostgreSQL is permanently COMPLETED
    const finalDeal = await prisma.deal.findUnique({ where: { id: dealId } });
    expect(finalDeal?.status).toBe("COMPLETED");
    expect(finalDeal?.completedAt).not.toBeNull();
  });
});
