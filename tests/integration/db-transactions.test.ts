import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/db";
import { transitionDealState } from "@/lib/deal-state-machine";
import { AppError } from "@/lib/errors";
import { DealService } from "@/services/deal.service";

describe("Integration Tests: Real Database Transactions & Constraints (PostgreSQL)", () => {
  const timestamp = Date.now();
  let brandUserId = "";
  let brandProfileId = "";
  let influencerUserId = "";
  let influencerProfileId = "";
  let testWalletId = "";
  let testCampaignId = "";
  let testDealId = "";
  let _testProductDealId = "";

  beforeAll(async () => {
    // 1. Create a real brand user & profile in PostgreSQL
    const brandUser = await prisma.user.create({
      data: {
        email: `brand_${timestamp}@example.com`,
        passwordHash: "test_hash_pw_123",
        userType: "BRAND",
        status: "ACTIVE",
        verificationLevel: "FULL",
        trustScore: 800,
        brandProfile: {
          create: {
            companyName: `Integration Brand ${timestamp}`,
          },
        },
      },
      include: { brandProfile: true },
    });
    brandUserId = brandUser.id;
    brandProfileId = brandUser.brandProfile!.id;

    // 2. Create a real influencer user & profile
    const influencerUser = await prisma.user.create({
      data: {
        email: `infl_${timestamp}@example.com`,
        passwordHash: "test_hash_pw_123",
        userType: "INFLUENCER",
        status: "ACTIVE",
        verificationLevel: "FULL",
        trustScore: 750,
        influencerProfile: {
          create: {
            displayName: `Integration Infl ${timestamp}`,
            instagramHandle: `infl_ig_${timestamp}`,
            categories: "tech",
            languages: "hindi,english",
          },
        },
      },
      include: { influencerProfile: true },
    });
    influencerUserId = influencerUser.id;
    influencerProfileId = influencerUser.influencerProfile!.id;

    // 3. Create a real wallet for brand user with starting balance of 100000 paise (Rs 1,000)
    const wallet = await prisma.wallet.create({
      data: {
        userId: brandUserId,
        balance: 100000,
        pendingBalance: 0,
        isFrozen: false,
      },
    });
    testWalletId = wallet.id;

    // 4. Create campaign for deal integration test
    const campaign = await prisma.campaign.create({
      data: {
        brand: { connect: { id: brandProfileId } },
        title: `Integration Campaign ${timestamp}`,
        description: "Testing state machine transitions in real DB",
        requirements: "Test requirements",
        deliverables: [{ type: "POST", count: 1 }],
        targetCategories: ["tech"],
        targetCities: ["Delhi"],
        targetLanguages: ["hindi"],
        totalBudget: 100000,
        fundedAmount: 100000,
        contentDeadline: new Date(Date.now() + 7 * 86400000),
        postingDeadline: new Date(Date.now() + 14 * 86400000),
        status: "ACTIVE",
      },
    });
    testCampaignId = campaign.id;
  });

  afterAll(async () => {
    // Clean up test data in foreign-key safe order
    // Note: Transactions in COMPLETED state are protected by PostgreSQL append-only ledger triggers
    try {
      if (testDealId) {
        await prisma.deal.deleteMany({ where: { id: testDealId } });
      }
      await prisma.processedWebhookEvent.deleteMany({
        where: { eventId: { startsWith: `test_evt_${timestamp}` } },
      });
    } catch {
      // Ledger integrity rules protect completed transactions from mutation
    }
  });

  it("should execute an atomic conditional balance deduction in real PostgreSQL transaction", async () => {
    const deductAmount = 30000; // Rs 300

    await prisma.$transaction(async (tx) => {
      const updateResult = await tx.wallet.updateMany({
        where: {
          id: testWalletId,
          balance: { gte: deductAmount },
          isFrozen: false,
        },
        data: {
          balance: { decrement: deductAmount },
        },
      });

      expect(updateResult.count).toBe(1);

      await tx.transaction.create({
        data: {
          walletId: testWalletId,
          amount: deductAmount,
          type: "DEBIT",
          status: "COMPLETED",
          description: "Integration test atomic deduction",
        },
      });
    });

    const updatedWallet = await prisma.wallet.findUnique({
      where: { id: testWalletId },
    });
    expect(updatedWallet?.balance).toBe(70000);
  });

  it("should reject atomic conditional deduction and rollback when balance is insufficient", async () => {
    const deductAmount = 999999; // Far exceeds balance of 70000

    await expect(
      prisma.$transaction(async (tx) => {
        const updateResult = await tx.wallet.updateMany({
          where: {
            id: testWalletId,
            balance: { gte: deductAmount },
            isFrozen: false,
          },
          data: {
            balance: { decrement: deductAmount },
          },
        });

        if (updateResult.count === 0) {
          throw AppError.badRequest("INSUFFICIENT_FUNDS: Atomic conditional update matched 0 rows");
        }
      }),
    ).rejects.toThrow("INSUFFICIENT_FUNDS");

    // Verify balance was untouched (rollback verified)
    const walletAfter = await prisma.wallet.findUnique({
      where: { id: testWalletId },
    });
    expect(walletAfter?.balance).toBe(70000);
  });

  it("should enforce real PostgreSQL unique constraint on ProcessedWebhookEvent table", async () => {
    const uniqueEventId = `test_evt_${timestamp}_xyz`;

    // First insert succeeds
    const first = await prisma.processedWebhookEvent.create({
      data: {
        eventId: uniqueEventId,
        eventType: "payment.captured",
      },
    });
    expect(first.eventId).toBe(uniqueEventId);

    // Duplicate insert on same eventId fails with Prisma P2002 unique constraint error
    await expect(
      prisma.processedWebhookEvent.create({
        data: {
          eventId: uniqueEventId,
          eventType: "payment.captured",
        },
      }),
    ).rejects.toThrow();
  });

  it("should execute real deal state transitions and generate real audit logs in PostgreSQL", async () => {
    // 1. Create a deal in PENDING_SIGNATURE status with all required fields
    const deal = await prisma.deal.create({
      data: {
        campaign: { connect: { id: testCampaignId } },
        brand: { connect: { id: brandProfileId } },
        influencer: { connect: { id: influencerProfileId } },
        amount: 50000,
        status: "PENDING_SIGNATURE",
        contractTerms: { scope: "1 Instagram Post", fee: 50000 },
        submissionDeadline: new Date(Date.now() + 3 * 86400000),
        postingDeadline: new Date(Date.now() + 7 * 86400000),
        reviewPeriodHours: 48,
      },
    });
    testDealId = deal.id;

    // 2. Transition from PENDING_SIGNATURE -> PAYMENT_HELD
    const step1 = await transitionDealState({
      dealId: testDealId,
      fromState: "PENDING_SIGNATURE",
      toState: "PAYMENT_HELD",
      actor: { userId: brandUserId, role: "BRAND" },
      reason: "Brand deposited escrow",
    });

    expect(step1.success).toBe(true);
    expect(step1.toState).toBe("PAYMENT_HELD");
    expect(step1.financialEffect).toBe("LOCK_ESCROW");

    // 3. Verify deal row in DB updated
    const dbDeal1 = await prisma.deal.findUnique({ where: { id: testDealId } });
    expect(dbDeal1?.status).toBe("PAYMENT_HELD");

    // 4. Verify audit log entry was created in DB
    const auditLogs = await prisma.activityLog.findMany({
      where: { entityId: testDealId },
    });
    expect(auditLogs.length).toBeGreaterThanOrEqual(1);

    // 5. Transition PAYMENT_HELD -> ACTIVE -> CONTENT_SUBMITTED -> CONTENT_APPROVED -> COMPLETED
    await transitionDealState({
      dealId: testDealId,
      toState: "ACTIVE",
      actor: { userId: brandUserId, role: "SYSTEM" },
    });

    await transitionDealState({
      dealId: testDealId,
      toState: "CONTENT_SUBMITTED",
      actor: { userId: influencerUserId, role: "INFLUENCER" },
    });

    await transitionDealState({
      dealId: testDealId,
      toState: "CONTENT_APPROVED",
      actor: { userId: brandUserId, role: "BRAND" },
    });

    const completionResult = await transitionDealState({
      dealId: testDealId,
      toState: "COMPLETED",
      actor: { userId: brandUserId, role: "BRAND" },
    });
    expect(completionResult.success).toBe(true);
    expect(completionResult.toState).toBe("COMPLETED");
    expect(completionResult.financialEffect).toBe("RELEASE_ESCROW");

    // 6. Terminal State Lock: COMPLETED deal cannot transition to any other status
    await expect(
      transitionDealState({
        dealId: testDealId,
        toState: "ACTIVE",
        actor: { userId: brandUserId, role: "ADMIN" },
      }),
    ).rejects.toThrow("TERMINAL_STATE_LOCKED");
  });

  it("should execute real end-to-end Shiprocket fulfillment pipeline in PostgreSQL", async () => {
    // 1. Create a real physical product deal in PostgreSQL
    const sampleAddress = {
      fullName: "Integration Creator",
      phone: "9876543210",
      line1: "402 Tech Hub, Bandra West",
      city: "Mumbai",
      state: "Maharashtra",
      pinCode: "400050",
      country: "India",
    };

    const productDeal = await prisma.deal.create({
      data: {
        campaign: { connect: { id: testCampaignId } },
        brand: { connect: { id: brandProfileId } },
        influencer: { connect: { id: influencerProfileId } },
        amount: 60000,
        status: "ACTIVE",
        requiresProduct: true,
        productName: "Organic Facial Cream 100g",
        productValue: 20000,
        productFulfillmentStatus: "READY_TO_DISPATCH",
        shippingAddress: sampleAddress,
        contractTerms: { scope: "Product review video", fee: 60000 },
        submissionDeadline: new Date(Date.now() + 5 * 86400000),
        postingDeadline: new Date(Date.now() + 10 * 86400000),
        reviewPeriodHours: 48,
      },
    });
    _testProductDealId = productDeal.id;

    const brandWalletBefore = await prisma.wallet.findUnique({
      where: { id: testWalletId },
    });
    const balanceBefore = brandWalletBefore?.balance || 0;

    // 2. Execute real DealService.createShiprocketShipment in PostgreSQL
    const shipmentResult = await DealService.createShiprocketShipment(
      brandUserId,
      productDeal.id,
      { pickupLocation: "Primary Warehouse", weight: 0.5 },
    );

    expect(shipmentResult.deal.productFulfillmentStatus).toBe("DISPATCHED");
    expect(shipmentResult.shipment.awbCode).toBeDefined();
    expect(shipmentResult.courierChargePaise).toBeGreaterThan(0);

    // 3. Verify PostgreSQL brand wallet was debited and transaction logged
    const brandWalletAfter = await prisma.wallet.findUnique({
      where: { id: testWalletId },
    });
    expect(brandWalletAfter?.balance).toBe(balanceBefore - shipmentResult.courierChargePaise);

    const shippingTx = await prisma.transaction.findFirst({
      where: {
        dealId: productDeal.id,
        type: "SHIPPING_CHARGE",
      },
    });
    expect(shippingTx).not.toBeNull();
    expect(shippingTx?.amount).toBe(shipmentResult.courierChargePaise);

    // 4. Verify PostgreSQL deal row was updated with shipping info
    const dbDispatchedDeal = await prisma.deal.findUnique({
      where: { id: productDeal.id },
    });
    expect(dbDispatchedDeal?.productFulfillmentStatus).toBe("DISPATCHED");
    expect(dbDispatchedDeal?.shippingAwbCode).toBe(shipmentResult.shipment.awbCode);
    expect(dbDispatchedDeal?.shippingStatus).toBe("PICKUP_SCHEDULED");

    // 5. Execute real DealService.handleShiprocketWebhook in PostgreSQL
    const webhookResult = await DealService.handleShiprocketWebhook({
      awb: shipmentResult.shipment.awbCode,
      current_status: "DELIVERED",
      scans: [
        {
          date: new Date().toISOString(),
          status: "DELIVERED",
          activity: "Package handed over to creator and signed",
          location: "Mumbai",
        },
      ],
    });

    expect(webhookResult.matched).toBe(true);
    expect(webhookResult.dealId).toBe(productDeal.id);

    // 6. Verify deal row in PostgreSQL is now marked RECEIVED
    const dbDeliveredDeal = await prisma.deal.findUnique({
      where: { id: productDeal.id },
    });
    expect(dbDeliveredDeal?.productFulfillmentStatus).toBe("RECEIVED");
    expect(dbDeliveredDeal?.shippingStatus).toBe("DELIVERED");
    expect(dbDeliveredDeal?.productReceivedAt).not.toBeNull();

    // 7. Verify notifications created in PostgreSQL for brand and creator
    const notifications = await prisma.notification.findMany({
      where: {
        userId: { in: [brandUserId, influencerUserId] },
      },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(2);
  });
});
