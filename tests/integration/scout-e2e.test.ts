import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma, { ensurePlatformTreasury } from "@/lib/db";
import { ScoutService } from "@/services/scout.service";

describe("In-Depth E2E Verification: Vyapar Scout / Campus Partner Program (PostgreSQL)", () => {
  const ts = Date.now();
  let adminUserId = "";
  let scoutUserId = "";
  let scoutProfileId = "";
  let scoutCode = "";
  let creatorUserId = "";
  let creatorProfileId = "";
  let brandUserId = "";
  let brandProfileId = "";
  let testCampaignId = "";
  let testDealId = "";

  beforeAll(async () => {
    // 1. Create an Admin user
    const adminUser = await prisma.user.create({
      data: {
        email: `admin_scout_${ts}@test.com`,
        passwordHash: "test_pw_hash",
        userType: "ADMIN",
        status: "ACTIVE",
        verificationLevel: "FULL",
      },
    });
    adminUserId = adminUser.id;

    // 2. Create a Scout User
    const scoutUser = await prisma.user.create({
      data: {
        email: `scout_${ts}@college.edu`,
        phone: `98${String(ts).slice(-8)}`,
        passwordHash: "test_pw_hash",
        userType: "SCOUT",
        status: "PENDING_VERIFICATION",
        verificationLevel: "NONE",
      },
    });
    scoutUserId = scoutUser.id;

    // 3. Ensure Platform Treasury exists and is funded
    const treasury = await ensurePlatformTreasury();
    await prisma.wallet.update({
      where: { id: treasury.id },
      data: { balance: { increment: 100_000_00 } }, // ₹1,00,000 funding for test
    });
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    try {
      if (testDealId) {
        await prisma.transaction.deleteMany({ where: { dealId: testDealId } });
        await prisma.deal.deleteMany({ where: { id: testDealId } });
      }
      if (testCampaignId) {
        await prisma.campaign.deleteMany({ where: { id: testCampaignId } });
      }
      if (scoutProfileId) {
        await prisma.scoutProfile.deleteMany({ where: { id: scoutProfileId } });
      }
      const userIdsToDelete = [scoutUserId, creatorUserId, brandUserId, adminUserId].filter(Boolean);
      if (userIdsToDelete.length > 0) {
        await prisma.notification.deleteMany({ where: { userId: { in: userIdsToDelete } } });
        await prisma.activityLog.deleteMany({ where: { userId: { in: userIdsToDelete } } });
        const wallets = await prisma.wallet.findMany({ where: { userId: { in: userIdsToDelete } } });
        const walletIds = wallets.map((w) => w.id);
        // Hard delete test transactions via executeRaw to satisfy foreign key constraint
        // since prisma.transaction.deleteMany is soft-deleted via middleware
        if (walletIds.length > 0) {
          await prisma.$executeRawUnsafe(`DELETE FROM "Transaction" WHERE "walletId" = ANY($1::text[])`, walletIds);
        }
        await prisma.wallet.deleteMany({ where: { id: { in: walletIds } } });
        await prisma.influencerProfile.deleteMany({ where: { userId: { in: userIdsToDelete } } });
        await prisma.brandProfile.deleteMany({ where: { userId: { in: userIdsToDelete } } });
        await prisma.user.deleteMany({ where: { id: { in: userIdsToDelete } } });
      }
    } catch (e) {
      console.error("Cleanup error in scout-e2e test:", e);
    }
  });

  it("Step 1: Gated state for brand-new unregistered scout", async () => {
    const dashboard = await ScoutService.getDashboard(scoutUserId);
    expect(dashboard.isRegistered).toBe(false);
    expect(dashboard.verificationStatus).toBe("NOT_REGISTERED");
    expect(dashboard.scoutProfile).toBeNull();
  });

  it("Step 2: Submit 18+ KYC Details (PAN + Aadhaar + College/City)", async () => {
    const scout = await ScoutService.submitKyc(scoutUserId, {
      fullName: "Arjun Mehta",
      phone: `98${String(ts).slice(-8)}`,
      city: "Jaipur",
      state: "Rajasthan",
      college: "MNIT Jaipur",
      panNumber: "abcde1234f", // Test lowercase normalization
      aadhaarNumber: "1234 5678 9012", // Test space removal & masking
    });

    expect(scout).toBeDefined();
    expect(scout.id).toBeDefined();
    scoutProfileId = scout.id;
    scoutCode = scout.scoutCode;

    // Direct DB checks
    const dbProfile = await prisma.scoutProfile.findUnique({ where: { id: scoutProfileId } });
    expect(dbProfile).not.toBeNull();
    expect(dbProfile!.verificationStatus).toBe("PENDING");
    expect(dbProfile!.panNumber).toBe("ABCDE1234F"); // Normalized to uppercase
    expect(dbProfile!.aadhaarNumber).toBe("XXXXXXXX9012"); // Masked for UIDAI compliance
    expect(dbProfile!.city).toBe("Jaipur");
    expect(dbProfile!.college).toBe("MNIT Jaipur");
    expect(dbProfile!.royaltyPercent).toBe(1.0);
    expect(dbProfile!.isRoyaltyPaused).toBe(false);

    // Audit log check
    const audit = await prisma.activityLog.findFirst({
      where: { userId: scoutUserId, action: "SCOUT_KYC_SUBMITTED" },
    });
    expect(audit).not.toBeNull();
  });

  it("Step 3: Admin Review Queue & Approval Flow", async () => {
    // Admin list pending
    const listRes = await ScoutService.adminListScouts({ status: "PENDING", search: "Arjun" });
    const pendingScout = listRes.scouts.find((s) => s.id === scoutProfileId);
    expect(pendingScout).toBeDefined();

    // Admin approves scout
    const approved = await ScoutService.adminApproveScout(scoutProfileId, adminUserId);
    expect(approved.verificationStatus).toBe("APPROVED");
    expect(approved.rejectionReason).toBeNull();

    // Notification check
    const notif = await prisma.notification.findFirst({
      where: { userId: scoutUserId, type: "system" },
    });
    expect(notif).not.toBeNull();
    expect(notif!.title).toContain("Verified");
  });

  it("Step 4: Scout Dashboard is Unlocked after Approval", async () => {
    const dashboard = await ScoutService.getDashboard(scoutUserId);
    expect(dashboard.isRegistered).toBe(true);
    expect(dashboard.verificationStatus).toBe("APPROVED");
    expect(dashboard.scoutCode).toBe(scoutCode);
    expect(dashboard.scoutProfile).toBeDefined();
    expect(dashboard.scoutProfile!.fullName).toBe("Arjun Mehta");
    expect(dashboard.scoutProfile!.royaltyPercent).toBe(1.0);
    expect(dashboard.shareableLinks.creatorInviteLink).toContain(`ref=${scoutCode}`);
    expect(dashboard.shareableLinks.brandInviteLink).toContain(`ref=${scoutCode}`);
  });

  it("Step 5: Scout onboards Creator & Brand into their network", async () => {
    // Create Creator referred by scout
    const creatorUser = await prisma.user.create({
      data: {
        email: `creator_scout_${ts}@test.com`,
        passwordHash: "test_pw",
        userType: "INFLUENCER",
        status: "ACTIVE",
        referredBy: scoutUserId,
        influencerProfile: {
          create: {
            displayName: "Pooja Vlogs",
            instagramHandle: `pooja_vlogs_${ts}`,
            categories: "lifestyle",
            languages: "hindi",
          },
        },
      },
      include: { influencerProfile: true },
    });
    creatorUserId = creatorUser.id;
    creatorProfileId = creatorUser.influencerProfile!.id;

    // Create Brand referred by scout
    const brandUser = await prisma.user.create({
      data: {
        email: `brand_scout_${ts}@test.com`,
        passwordHash: "test_pw",
        userType: "BRAND",
        status: "ACTIVE",
        referredBy: scoutUserId,
        brandProfile: {
          create: {
            companyName: "Jaipur Artisan Cafe",
            isGstVerified: true,
          },
        },
      },
      include: { brandProfile: true },
    });
    brandUserId = brandUser.id;
    brandProfileId = brandUser.brandProfile!.id;

    // Verify network list API
    const network = await ScoutService.getNetworkList(scoutUserId);
    expect(network.length).toBe(2);

    const creatorItem = network.find((item) => item.id === creatorUserId);
    expect(creatorItem).toBeDefined();
    expect(creatorItem!.userType).toBe("CREATOR");
    expect(creatorItem!.status).toBe("VERIFIED");
    expect(creatorItem!.nudgeUrl).toContain("wa.me");

    const brandItem = network.find((item) => item.id === brandUserId);
    expect(brandItem).toBeDefined();
    expect(brandItem!.userType).toBe("BRAND");
    expect(brandItem!.status).toBe("VERIFIED");

    // Verify that onboarding verified partners activates monthly quota
    const dashboard = await ScoutService.getDashboard(scoutUserId);
    expect(dashboard.monthlyQuota.isMet).toBe(true);
    expect(dashboard.monthlyQuota.currentMonthNewVerified).toBeGreaterThanOrEqual(1);
  });

  it("Step 6: Deal Completion triggers 1% Lifetime Royalty via Double-Entry Treasury Debit", async () => {
    // 1. Create a Campaign and Deal between this Brand and Creator
    const campaign = await prisma.campaign.create({
      data: {
        brand: { connect: { id: brandProfileId } },
        title: `Test Campaign ${ts}`,
        description: "Test description",
        requirements: "Test requirements",
        deliverables: [{ type: "POST", count: 1 }],
        targetCategories: ["lifestyle"],
        targetCities: ["Jaipur"],
        targetLanguages: ["hindi"],
        totalBudget: 100_000,
        fundedAmount: 100_000,
        contentDeadline: new Date(Date.now() + 7 * 86400000),
        postingDeadline: new Date(Date.now() + 14 * 86400000),
        status: "ACTIVE",
      },
    });
    testCampaignId = campaign.id;

    const deal = await prisma.deal.create({
      data: {
        campaign: { connect: { id: campaign.id } },
        brand: { connect: { id: brandProfileId } },
        influencer: { connect: { id: creatorProfileId } },
        amount: 20_000_00, // ₹20,000 deal = 2,000,000 paise
        status: "COMPLETED",
        contractTerms: { scope: "1 Instagram Post", fee: 2000000 },
        submissionDeadline: new Date(Date.now() + 3 * 86400000),
        postingDeadline: new Date(Date.now() + 7 * 86400000),
        reviewPeriodHours: 48,
      },
    });
    testDealId = deal.id;

    // 2. Process deal royalty inside transaction
    const royaltyResult = await prisma.$transaction(async (tx) => {
      return ScoutService.processDealRoyalty(
        tx,
        deal.id,
        2_000_000, // ₹20,000
        creatorUserId,
        brandUserId
      );
    });

    // Both Creator & Brand were onboarded by same Scout -> Deduped single credit
    expect(royaltyResult.creditedScoutsCount).toBe(1);

    // 3. Verify Scout Wallet Balance
    // 1% of ₹20,000 = ₹200 = 20,000 paise
    const scoutWallet = await prisma.wallet.findUnique({
      where: { userId: scoutUserId },
    });
    expect(scoutWallet).not.toBeNull();
    expect(scoutWallet!.balance).toBe(20_000); // Exactly ₹200
    expect(scoutWallet!.totalEarned).toBe(20_000);

    // 4. Verify Double-Entry Transactions
    const transactions = await prisma.transaction.findMany({
      where: { dealId: deal.id },
    });
    expect(transactions.length).toBe(2);

    const treasuryDebitTx = transactions.find((t) => t.type === "DEBIT");
    expect(treasuryDebitTx).toBeDefined();
    expect(treasuryDebitTx!.amount).toBe(20_000);
    expect(treasuryDebitTx!.description).toContain("Treasury Debit");

    const scoutCreditTx = transactions.find((t) => t.type === "CREDIT");
    expect(scoutCreditTx).toBeDefined();
    expect(scoutCreditTx!.amount).toBe(20_000);
    expect(scoutCreditTx!.walletId).toBe(scoutWallet!.id);

    // 5. Verify Scout Profile Total Earnings in DB
    const updatedProfile = await prisma.scoutProfile.findUnique({
      where: { id: scoutProfileId },
    });
    expect(updatedProfile!.totalRoyaltyEarned).toBe(20_000);

    // 6. Verify Notification sent to Scout
    const royaltyNotif = await prisma.notification.findFirst({
      where: { userId: scoutUserId, type: "wallet_credit" },
    });
    expect(royaltyNotif).not.toBeNull();
    expect(royaltyNotif!.message).toContain("₹200.00");
  });

  it("Step 7: Idempotency Guard (No double payout on duplicate trigger)", async () => {
    // Re-run for same dealId
    const secondRun = await prisma.$transaction(async (tx) => {
      return ScoutService.processDealRoyalty(
        tx,
        testDealId,
        2_000_000,
        creatorUserId,
        brandUserId
      );
    });

    expect(secondRun.creditedScoutsCount).toBe(0);

    // Wallet balance remains ₹200 (not ₹400)
    const wallet = await prisma.wallet.findUnique({ where: { userId: scoutUserId } });
    expect(wallet!.balance).toBe(20_000);
  });

  it("Step 8: Admin Pause & Custom Royalty Rate Tuning", async () => {
    // Admin pauses scout royalty
    const paused = await ScoutService.adminToggleRoyaltyPause(
      scoutProfileId,
      true,
      "Compliance audit",
      adminUserId
    );
    expect(paused.isRoyaltyPaused).toBe(true);

    // When paused, processDealRoyalty skips payout
    const deal2 = await prisma.deal.create({
      data: {
        campaign: { connect: { id: testCampaignId } },
        brand: { connect: { id: brandProfileId } },
        influencer: { connect: { id: creatorProfileId } },
        amount: 10_000_00,
        status: "COMPLETED",
        contractTerms: { scope: "1 Story", fee: 1000000 },
        submissionDeadline: new Date(Date.now() + 3 * 86400000),
        postingDeadline: new Date(Date.now() + 7 * 86400000),
        reviewPeriodHours: 48,
      },
    });

    const pausedRun = await prisma.$transaction(async (tx) => {
      return ScoutService.processDealRoyalty(
        tx,
        deal2.id,
        1_000_000,
        creatorUserId,
        brandUserId
      );
    });
    expect(pausedRun.creditedScoutsCount).toBe(0);

    // Admin unpauses and grants 30-day Exam Grace Pass
    await ScoutService.adminToggleRoyaltyPause(scoutProfileId, false, "Audit passed", adminUserId);
    const exempt = await ScoutService.adminGrantQuotaExemption(scoutProfileId, 30, adminUserId);
    expect(exempt.monthlyQuotaExemptUntil).not.toBeNull();
    expect(new Date(exempt.monthlyQuotaExemptUntil!).getTime()).toBeGreaterThan(Date.now());

    // Admin upgrades scout royalty rate to 1.5%
    const upgraded = await ScoutService.adminUpdateRoyaltyPercent(scoutProfileId, 1.5, adminUserId);
    expect(upgraded.royaltyPercent).toBe(1.5);

    // Now deal2 completes with 1.5% cut (15,000 paise on 1,000,000 paise)
    const activeRun = await prisma.$transaction(async (tx) => {
      return ScoutService.processDealRoyalty(
        tx,
        deal2.id,
        1_000_000,
        creatorUserId,
        brandUserId
      );
    });
    expect(activeRun.creditedScoutsCount).toBe(1);

    const finalWallet = await prisma.wallet.findUnique({ where: { userId: scoutUserId } });
    // Previous 20,000 + 15,000 = 35,000 paise (₹350)
    expect(finalWallet!.balance).toBe(35_000);

    // Clean up deal2
    await prisma.transaction.deleteMany({ where: { dealId: deal2.id } });
    await prisma.deal.deleteMany({ where: { id: deal2.id } });
  });
});
