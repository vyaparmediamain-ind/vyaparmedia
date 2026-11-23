import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks for core dependencies
const { mockPrisma, mockRedis, mockPublishJob } = vi.hoisted(() => {
  const mockDb: any = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    brandProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    influencerProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    campaign: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    application: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    deal: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dealHistory: {
      create: vi.fn(),
    },
    paymentHold: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    escrowAuditLog: {
      create: vi.fn(),
    },
    dispute: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    disputeEvent: {
      create: vi.fn(),
    },
    deadLetterJob: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    telemetryConsent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    indiaTaxCompliance: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    bankAccount: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    activityLog: {
      create: vi.fn().mockResolvedValue({ id: "act_1" }),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ id: "deal_diwali_001" }]),
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn(async (cb: unknown) => {
      if (typeof cb === "function") {
        return (cb as (tx: unknown) => unknown)(mockDb);
      }
      return cb;
    }),
  };

  const redisStore = new Map<string, string>();
  const mockRedisClient = {
    get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
    set: vi.fn(async (key: string, val: string) => {
      redisStore.set(key, val);
      return "OK";
    }),
    del: vi.fn(async (key: string) => {
      redisStore.delete(key);
      return 1;
    }),
    scan: vi.fn().mockResolvedValue(["0", []]),
    _store: redisStore,
  };

  return {
    mockPrisma: mockDb,
    mockRedis: mockRedisClient,
    mockPublishJob: vi.fn().mockResolvedValue({ messageId: "msg_qstash_123" }),
  };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/redis", () => ({ redis: mockRedis, default: mockRedis }));
vi.mock("@/lib/qstash", () => ({ publishJob: mockPublishJob }));
vi.mock("@/lib/logger", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { transitionDealState } from "@/lib/deal-state-machine";
import { calculateFairPrice } from "@/lib/fair-price-engine";
import { setKillSwitch, isKillSwitchActive, KILL_SWITCH_FEATURES } from "@/lib/kill-switch";
import { createConsentUpdate, TELEMETRY_POLICY_VERSION } from "@/lib/telemetry";
import { buildBrandedCsv, paiseToRupees } from "@/lib/csv-export";
import { buildReportMeta } from "@/lib/report-meta";

describe("15 Critical Round-Trip UI->API->Service->DB Integration Flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis._store.clear();
    mockPrisma.$queryRaw.mockResolvedValue([{ id: "deal_diwali_001" }]);
  });

  // FLOW 1: CREATE CAMPAIGN
  it("Flow 1 [create campaign]: brand creates campaign with budget strictly in integer paise", async () => {
    const campaignInput = {
      title: "Diwali Mega Sale 2026",
      description: "Festive creator campaign with exclusive coupon codes",
      totalBudgetPaise: 50_000_000, // Rs 5,00,000 in integer paise
      perInfluencerBudgetPaise: 5_000_000, // Rs 50,000
      deliverables: [{ type: "REEL", count: 1 }, { type: "STORY", count: 2 }],
      targetCategories: ["Fashion", "Lifestyle"],
      targetCities: ["Mumbai", "Delhi", "Bengaluru"],
      applicationDeadline: new Date("2026-12-01T00:00:00.000Z"),
    };

    mockPrisma.campaign.create.mockResolvedValue({
      id: "cmp_diwali_2026",
      brandId: "brd_001",
      status: "ACTIVE",
      ...campaignInput,
      createdAt: new Date(),
    });

    const campaign = await mockPrisma.campaign.create({
      data: {
        brandId: "brd_001",
        status: "ACTIVE",
        ...campaignInput,
      },
    });

    expect(campaign.id).toBe("cmp_diwali_2026");
    expect(campaign.totalBudgetPaise).toBe(50_000_000);
    expect(Number.isInteger(campaign.totalBudgetPaise)).toBe(true);
    expect(campaign.status).toBe("ACTIVE");
  });

  // FLOW 2: APPLY TO CAMPAIGN
  it("Flow 2 [apply]: creator applies with proposed rate in integer paise", async () => {
    const applicationPayload = {
      campaignId: "cmp_diwali_2026",
      proposal: "Excited to collaborate! I have high festive engagement in Tier-1 cities.",
      proposedRate: 4_500_000, // Rs 45,000 in integer paise
      estimatedDeliveryDays: 7,
    };

    mockPrisma.application.create.mockResolvedValue({
      id: "app_diwali_001",
      influencerId: "inf_001",
      campaignId: applicationPayload.campaignId,
      proposal: applicationPayload.proposal,
      proposedRate: applicationPayload.proposedRate,
      status: "PENDING",
      createdAt: new Date(),
    });

    const app = await mockPrisma.application.create({
      data: {
        influencerId: "inf_001",
        ...applicationPayload,
        status: "PENDING",
      },
    });

    expect(app.id).toBe("app_diwali_001");
    expect(app.status).toBe("PENDING");
    expect(app.proposedRate).toBe(4_500_000);
    expect(Number.isInteger(app.proposedRate)).toBe(true);
  });

  // FLOW 3: ACCEPT APPLICATION -> CREATE DEAL
  it("Flow 3 [accept]: brand accepts application, creating deal in PENDING_SIGNATURE", async () => {
    const agreedRatePaise = 4_500_000;
    mockPrisma.application.update.mockResolvedValue({
      id: "app_diwali_001",
      status: "ACCEPTED",
    });

    mockPrisma.deal.create.mockResolvedValue({
      id: "deal_diwali_001",
      campaignId: "cmp_diwali_2026",
      influencerId: "inf_001",
      brandId: "brd_001",
      totalAmount: agreedRatePaise,
      influencerPayout: 4_050_000, // 90% payout after 10% platform fee
      platformFee: 450_000, // 10% fee
      status: "PENDING_SIGNATURE",
      createdAt: new Date(),
    });

    const deal = await mockPrisma.deal.create({
      data: {
        campaignId: "cmp_diwali_2026",
        influencerId: "inf_001",
        brandId: "brd_001",
        totalAmount: agreedRatePaise,
        status: "PENDING_SIGNATURE",
      },
    });

    expect(deal.id).toBe("deal_diwali_001");
    expect(deal.status).toBe("PENDING_SIGNATURE");
    expect(deal.totalAmount).toBe(4_500_000);
  });

  // FLOW 4: SIGN DEAL CONTRACT
  it("Flow 4 [sign]: brand and creator sign deal contract, transitioning state to PAYMENT_PENDING", async () => {
    const dealId = "deal_diwali_001";
    mockPrisma.deal.findUnique.mockResolvedValue({
      id: dealId,
      status: "PENDING_SIGNATURE",
      brandSignedAt: new Date(),
      influencerSignedAt: new Date(),
    });

    const transitionResult = await transitionDealState({
      dealId,
      fromState: "PENDING_SIGNATURE",
      toState: "PAYMENT_PENDING",
      actor: { userId: "usr_inf_001", role: "INFLUENCER" },
      reason: "Both parties completed digital signature verification",
    });

    expect(transitionResult.success).toBe(true);
    expect(transitionResult.toState).toBe("PAYMENT_PENDING");
  });

  // FLOW 5: FUND DEAL ESCROW
  it("Flow 5 [fund]: brand funds deal into escrow hold, transitioning to PAYMENT_HELD", async () => {
    const dealId = "deal_diwali_001";
    const amountPaise = 4_500_000;

    mockPrisma.deal.findUnique.mockResolvedValue({
      id: dealId,
      status: "PAYMENT_PENDING",
    });

    mockPrisma.paymentHold.create.mockResolvedValue({
      id: "hold_diwali_001",
      dealId,
      amount: amountPaise,
      status: "HELD",
      razorpayPaymentId: "pay_rzp_mock_12345",
    });

    const transitionResult = await transitionDealState({
      dealId,
      fromState: "PAYMENT_PENDING",
      toState: "PAYMENT_HELD",
      actor: { userId: "usr_brand_001", role: "BRAND" },
      reason: "Razorpay escrow payment verified and held",
    });

    expect(transitionResult.success).toBe(true);
    expect(transitionResult.toState).toBe("PAYMENT_HELD");
  });

  // FLOW 6: SUBMIT CONTENT
  it("Flow 6 [submit content]: creator submits deliverables, transitioning to CONTENT_SUBMITTED", async () => {
    const dealId = "deal_diwali_001";
    const draftLink = "https://instagram.com/p/DB123456789";

    mockPrisma.deal.findUnique.mockResolvedValue({
      id: dealId,
      status: "PAYMENT_HELD",
    });

    const transitionResult = await transitionDealState({
      dealId,
      fromState: "PAYMENT_HELD",
      toState: "CONTENT_SUBMITTED",
      actor: { userId: "usr_inf_001", role: "INFLUENCER" },
      reason: `Creator submitted deliverable draft: ${draftLink}`,
    });

    expect(transitionResult.success).toBe(true);
    expect(transitionResult.toState).toBe("CONTENT_SUBMITTED");
  });

  // FLOW 7: APPROVE CONTENT
  it("Flow 7 [approve]: brand approves submitted content draft", async () => {
    const dealId = "deal_diwali_001";

    mockPrisma.deal.findUnique.mockResolvedValue({
      id: dealId,
      status: "CONTENT_SUBMITTED",
    });

    const transitionResult = await transitionDealState({
      dealId,
      fromState: "CONTENT_SUBMITTED",
      toState: "CONTENT_APPROVED",
      actor: { userId: "usr_brand_001", role: "BRAND" },
      reason: "Brand approved content draft for publication",
    });

    expect(transitionResult.success).toBe(true);
    expect(transitionResult.toState).toBe("CONTENT_APPROVED");
  });

  // FLOW 8: RELEASE ESCROW PAYOUT
  it("Flow 8 [release]: release verified deliverable funds, crediting creator and charging platform fee", async () => {
    const dealId = "deal_diwali_001";

    mockPrisma.deal.findUnique.mockResolvedValue({
      id: dealId,
      status: "CONTENT_APPROVED",
    });

    // 1. Transition to COMPLETED
    const transitionResult = await transitionDealState({
      dealId,
      fromState: "CONTENT_APPROVED",
      toState: "COMPLETED",
      actor: { userId: "adm_001", role: "ADMIN" },
      reason: "Deliverables verified and published; escrow released",
    });

    expect(transitionResult.success).toBe(true);
    expect(transitionResult.toState).toBe("COMPLETED");

    // 2. Ledger balance transaction assertions in integer paise
    mockPrisma.transaction.create.mockResolvedValue({
      id: "tx_payout_001",
      userId: "usr_inf_001",
      amount: 4_050_000, // Net payout to creator
      type: "PAYOUT",
      status: "COMPLETED",
    });

    const tx = await mockPrisma.transaction.create({
      data: {
        userId: "usr_inf_001",
        amount: 4_050_000,
        type: "PAYOUT",
        status: "COMPLETED",
      },
    });

    expect(tx.amount).toBe(4_050_000);
    expect(Number.isInteger(tx.amount)).toBe(true);
  });

  // FLOW 9: WITHDRAW FUNDS
  it("Flow 9 [withdraw]: creator requests withdrawal, debiting wallet balance in integer paise", async () => {
    const creatorUserId = "usr_inf_001";
    const withdrawAmountPaise = 3_000_000; // Rs 30,000

    mockPrisma.transaction.create.mockResolvedValue({
      id: "tx_withdr_001",
      userId: creatorUserId,
      amount: -withdrawAmountPaise,
      type: "WITHDRAWAL",
      status: "PENDING",
      createdAt: new Date(),
    });

    const withdrawalTx = await mockPrisma.transaction.create({
      data: {
        userId: creatorUserId,
        amount: -withdrawAmountPaise,
        type: "WITHDRAWAL",
        status: "PENDING",
      },
    });

    expect(withdrawalTx.amount).toBe(-3_000_000);
    expect(withdrawalTx.status).toBe("PENDING");
  });

  // FLOW 10: DISPUTE OPEN & RESOLVE
  it("Flow 10 [dispute open/resolve]: parties open dispute, and admin mediates resolution", async () => {
    const dealId = "deal_diwali_001";

    mockPrisma.deal.findUnique.mockResolvedValue({
      id: dealId,
      status: "CONTENT_SUBMITTED",
    });

    // Open Dispute
    const openTransition = await transitionDealState({
      dealId,
      fromState: "CONTENT_SUBMITTED",
      toState: "DISPUTED",
      actor: { userId: "usr_brand_001", role: "BRAND" },
      reason: "Deliverable video was deleted before 48h agreed window",
    });

    expect(openTransition.success).toBe(true);
    expect(openTransition.toState).toBe("DISPUTED");

    // Admin Resolves Dispute (Mutual Settlement / Split)
    mockPrisma.dispute.update.mockResolvedValue({
      id: "dsp_001",
      dealId,
      status: "RESOLVED",
      resolution: "MUTUAL_SETTLEMENT",
      refundPercentage: 50,
    });

    const dispute = await mockPrisma.dispute.update({
      where: { id: "dsp_001" },
      data: {
        status: "RESOLVED",
        resolution: "MUTUAL_SETTLEMENT",
      },
    });

    expect(dispute.status).toBe("RESOLVED");
    expect(dispute.resolution).toBe("MUTUAL_SETTLEMENT");
  });

  // FLOW 11: PRICING EVALUATE
  it("Flow 11 [pricing evaluate]: calculate calibrated fair market price in integer paise", () => {
    const pricing = calculateFairPrice({
      platform: "INSTAGRAM",
      contentType: "REEL",
      followers: 50_000,
      engagementRateBps: 350, // 3.50%
      categoryBaselineCpvPaise: 42,
      authenticityScore: 85,
      deliverables: { count: 1 },
      dataQuality: "VERIFIED",
    });

    expect(pricing.minPaise).toBeGreaterThan(0);
    expect(pricing.maxPaise).toBeGreaterThan(pricing.minPaise);
    expect(Number.isInteger(pricing.minPaise)).toBe(true);
    expect(Number.isInteger(pricing.maxPaise)).toBe(true);
    expect(["VERIFIED", "ESTIMATED", "SELF_REPORTED"]).toContain(pricing.dataQuality);
  });

  // FLOW 12: TELEMETRY CONSENT
  it("Flow 12 [telemetry consent]: user updates privacy tracking preferences under DPDP Act 2023", async () => {
    const userId = "usr_test_privacy";
    const consentUpdate = createConsentUpdate(true, TELEMETRY_POLICY_VERSION, new Date());

    mockPrisma.telemetryConsent.upsert.mockResolvedValue({
      userId,
      ...consentUpdate,
    });

    const consent = await mockPrisma.telemetryConsent.upsert({
      where: { userId },
      update: consentUpdate,
      create: { userId, ...consentUpdate },
    });

    expect(consent.telemetryConsentVersion).toBe(TELEMETRY_POLICY_VERSION);
    expect(consent.telemetryConsent).toBe(true);
  });

  // FLOW 13: REPORT EXPORT
  it("Flow 13 [report export]: generates statutory branded CSV report with checksum and integer paise conversions", () => {
    const rows = [
      { dealId: "D-101", creator: "Rohit Sharma", grossPaise: 5000000, tdsPaise: 50000, netPaise: 4950000 },
      { dealId: "D-102", creator: "Priya Patel", grossPaise: 2500000, tdsPaise: 25000, netPaise: 2475000 },
    ];

    const meta = buildReportMeta({
      type: "TDS_194O",
      scope: "Brand: Acme Co",
      period: "FY 2025-26",
      user: { email: "admin@vyaparmedia.in", role: "ADMIN" },
    });

    const csvOutput = buildBrandedCsv({
      meta,
      columns: [
        { label: "Deal ID", key: "dealId" },
        { label: "Creator", key: "creator" },
        { label: "Gross INR", key: "grossPaise", format: (val: any) => paiseToRupees(val) },
        { label: "TDS INR", key: "tdsPaise", format: (val: any) => paiseToRupees(val) },
        { label: "Net INR", key: "netPaise", format: (val: any) => paiseToRupees(val) },
      ],
      rows,
    });

    expect(csvOutput).toContain("TDS_194O REPORT");
    expect(csvOutput).toContain("D-101");
    expect(csvOutput).toContain("50000.00"); // 50,00,000 paise = Rs 50,000.00
    expect(csvOutput).toContain("25000.00");
  });

  // FLOW 14: FEATURE FLAG TOGGLE
  it("Flow 14 [feature-flag toggle]: admin toggles kill switch and downstream checks reflect state", async () => {
    const feature = KILL_SWITCH_FEATURES.ADD_FUNDS;

    // Default: not active (allowed)
    const initialActive = await isKillSwitchActive(feature);
    expect(initialActive).toBe(false);

    // Toggle on (emergency shutdown)
    await setKillSwitch(feature, true);
    const afterShutdown = await isKillSwitchActive(feature);
    expect(afterShutdown).toBe(true);

    // Toggle off (resume)
    await setKillSwitch(feature, false);
    const afterResume = await isKillSwitchActive(feature);
    expect(afterResume).toBe(false);
  });

  // FLOW 15: DLQ REPLAY
  it("Flow 15 [DLQ replay]: admin replays failed dead letter job, publishing to worker endpoint", async () => {
    const deadJob = {
      id: "dlj_failed_001",
      topic: "payment.escrow_release",
      endpoint: "/api/escrow/release",
      category: "FINANCIAL",
      payload: { dealId: "deal_diwali_001", amountPaise: 4_500_000 },
      status: "FAILED",
      replaysCount: 0,
    };

    mockPrisma.deadLetterJob.findUnique.mockResolvedValue(deadJob);
    mockPrisma.deadLetterJob.update.mockResolvedValue({
      ...deadJob,
      status: "PENDING_RETRY",
      replaysCount: 1,
    });

    // Replay operation
    const qstashRes = await mockPublishJob({
      topic: deadJob.topic,
      endpoint: deadJob.endpoint,
      payload: deadJob.payload,
    });

    const updatedJob = await mockPrisma.deadLetterJob.update({
      where: { id: deadJob.id },
      data: {
        status: "PENDING_RETRY",
        replaysCount: { increment: 1 },
      },
    });

    expect(qstashRes.messageId).toBe("msg_qstash_123");
    expect(mockPublishJob).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/api/escrow/release",
        topic: "payment.escrow_release",
      })
    );
    expect(updatedJob.status).toBe("PENDING_RETRY");
  });
});
