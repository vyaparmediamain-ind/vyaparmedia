import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyPostStatus, calculateClawbackPercentage } from "@/lib/post-monitor";
import prisma from "@/lib/db";
import { checkPostVerification } from "@/lib/fraud-detection";
import { NotificationService } from "@/services/notification.service";
import { createActivityLog } from "@/lib/audit";
import { applyProgressivePenalty } from "@/lib/penalty-system";

vi.mock("@/lib/db", () => {
  const mockDealFindUnique = vi.fn();
  const mockDealUpdate = vi.fn();
  const mockTxFindFirst = vi.fn();
  const mockDebtFindFirst = vi.fn();
  const mockTransaction = vi.fn((cb) =>
    cb({
      $queryRaw: vi.fn().mockResolvedValue([{ id: "w-influencer", balance: 100000, debt: 0 }]),
      wallet: {
        update: vi.fn().mockResolvedValue({}),
        upsert: vi.fn().mockResolvedValue({ id: "w-brand" }),
      },
      transaction: {
        create: vi.fn().mockResolvedValue({ id: "tx-1" }),
      },
      debtClaim: {
        create: vi.fn().mockResolvedValue({ id: "dc-1" }),
      },
    })
  );

  return {
    default: {
      deal: {
        findUnique: mockDealFindUnique,
        update: mockDealUpdate,
      },
      transaction: {
        findFirst: mockTxFindFirst,
      },
      debtClaim: {
        findFirst: mockDebtFindFirst,
      },
      $transaction: mockTransaction,
    },
    Prisma: {
      InputJsonValue: {},
    },
  };
});

vi.mock("@/lib/fraud-detection", () => ({
  checkPostVerification: vi.fn(),
}));

vi.mock("@/services/notification.service", () => ({
  NotificationService: {
    createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
  },
}));

vi.mock("@/lib/audit", () => ({
  createActivityLog: vi.fn().mockResolvedValue({ id: "log-1" }),
}));

vi.mock("@/lib/penalty-system", () => ({
  applyProgressivePenalty: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Option 4: ASCI & CCPA 2024 Automated Remediation & Escrow Freeze Loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateClawbackPercentage", () => {
    it("applies strict sliding scale penalties based on monitoring day", () => {
      expect(calculateClawbackPercentage(1)).toBe(100);
      expect(calculateClawbackPercentage(3)).toBe(100);
      expect(calculateClawbackPercentage(5)).toBe(75);
      expect(calculateClawbackPercentage(10)).toBe(50);
      expect(calculateClawbackPercentage(20)).toBe(25);
      expect(calculateClawbackPercentage(25)).toBe(15);
      expect(calculateClawbackPercentage(30)).toBe(15);
      expect(calculateClawbackPercentage(31)).toBe(0);
    });
  });

  describe("verifyPostStatus: ASCI Disclosure Non-Compliance Loop", () => {
    const baseMockDeal = {
      id: "deal-asci-001",
      postUrl: "https://www.instagram.com/p/C3XYZ123456/",
      contractTerms: {
        mandatoryElements: ["#ad", "@brand"],
      },
      postingDeadline: new Date(Date.now() - 86400 * 1000 * 5),
      completedAt: new Date(Date.now() - 86400 * 1000 * 2), // Day 2
      influencerId: "inf-123",
      consecutiveMissingChecks: 0,
      influencer: { userId: "user-influencer-1" },
    };

    it("1st Check: Emits DISCLOSURE_WARNING, issues 24h grace warning and freezes escrow payout", async () => {
      (prisma.deal.findUnique as any).mockResolvedValueOnce(baseMockDeal);

      // Simulate post crawler returning NO_AD_DISCLOSURE flag
      (checkPostVerification as any).mockResolvedValueOnce({
        dealId: "deal-asci-001",
        verified: false,
        fraudScore: 85,
        decision: "BLOCK",
        flags: [
          {
            rule: "NO_AD_DISCLOSURE",
            severity: "CRITICAL",
            description: "Missing mandatory #ad / #sponsored disclosure under ASCI & CCPA 2024 regulations",
          },
        ],
      });

      const result = await verifyPostStatus("deal-asci-001");

      expect(result.status).toBe("DISCLOSURE_WARNING");
      expect(result.isAlive).toBe(true);
      expect(result.message).toContain("First detected missing #ad disclosure");

      // Verify deal updated with 24-hour grace period & escrow hold
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "deal-asci-001" },
          data: expect.objectContaining({
            isPostAlive: true,
            contractTerms: expect.objectContaining({
              asciComplianceAudit: expect.objectContaining({
                consecutiveViolations: 1,
                status: "REMEDIATION_REQUIRED",
                isEscrowHoldActive: true,
              }),
            }),
          }),
        })
      );

      // Verify creator was notified with 24-hour grace period warning
      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-influencer-1",
          type: "trust_warning",
          title: expect.stringContaining("ASCI #ad Disclosure Missing (24h Grace Period)"),
          message: expect.stringContaining("within 24 hours to prevent permanent escrow freeze and deal clawback"),
        })
      );

      // Verify activity log audit trail
      expect(createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-influencer-1",
          action: "ASCI_DISCLOSURE_GRACE_PERIOD_ISSUED",
        })
      );
    });

    it("2nd Check (24h later, unresolved): Emits DISCLOSURE_BREACH, freezes escrow permanently, triggers clawback & DRS penalty", async () => {
      const dealWithPreviousWarning = {
        ...baseMockDeal,
        contractTerms: {
          mandatoryElements: ["#ad", "@brand"],
          asciComplianceAudit: {
            consecutiveViolations: 1,
            status: "REMEDIATION_REQUIRED",
            firstViolationAt: new Date(Date.now() - 86400 * 1000).toISOString(),
            isEscrowHoldActive: true,
          },
        },
      };

      (prisma.deal.findUnique as any)
        .mockResolvedValueOnce(dealWithPreviousWarning) // for initial lookup
        .mockResolvedValueOnce({
          ...dealWithPreviousWarning,
          amount: 200000,
          influencerPayout: 180000,
          brand: { userId: "user-brand-1" },
        }); // for executeClawback lookup

      (checkPostVerification as any).mockResolvedValueOnce({
        dealId: "deal-asci-001",
        verified: false,
        fraudScore: 85,
        decision: "BLOCK",
        flags: [
          {
            rule: "NO_AD_DISCLOSURE",
            severity: "CRITICAL",
            description: "Missing mandatory #ad / #sponsored disclosure",
          },
        ],
      });

      const result = await verifyPostStatus("deal-asci-001");

      expect(result.status).toBe("DISCLOSURE_BREACH");
      expect(result.isAlive).toBe(true);
      expect(result.message).toContain("escrow frozen and clawback executed");

      // Verify deal updated with PERMANENT_BREACH_FROZEN
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "deal-asci-001" },
          data: expect.objectContaining({
            contractTerms: expect.objectContaining({
              asciComplianceAudit: expect.objectContaining({
                consecutiveViolations: 2,
                status: "PERMANENT_BREACH_FROZEN",
                isEscrowHoldActive: true,
              }),
            }),
          }),
        })
      );

      // Verify progressive penalty applied against creator DRS trust score
      expect(applyProgressivePenalty).toHaveBeenCalledWith(
        "user-influencer-1",
        "OTHER",
        expect.stringContaining("Post missing mandatory ASCI #ad disclosure across multiple monitoring checks"),
        dealWithPreviousWarning.postUrl
      );

      // Verify creator breach notification
      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-influencer-1",
          type: "trust_warning",
          title: "Escrow Frozen: ASCI Compliance Breach",
        })
      );

      // Verify activity log audit trail for breach enforcement
      expect(createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-influencer-1",
          action: "ASCI_DISCLOSURE_BREACH_ENFORCED",
        })
      );
    });

    it("Remediation Recovery: When creator re-adds #ad disclosure, lifts escrow hold and restores COMPLIANT status", async () => {
      const dealUnderRemediation = {
        ...baseMockDeal,
        contractTerms: {
          mandatoryElements: ["#ad", "@brand"],
          asciComplianceAudit: {
            consecutiveViolations: 1,
            status: "REMEDIATION_REQUIRED",
            isEscrowHoldActive: true,
          },
        },
      };

      (prisma.deal.findUnique as any).mockResolvedValueOnce(dealUnderRemediation);

      // Post now has #ad restored -> checkPostVerification passes with 0 fraud flags
      (checkPostVerification as any).mockResolvedValueOnce({
        dealId: "deal-asci-001",
        verified: true,
        fraudScore: 0,
        decision: "APPROVE",
        flags: [],
      });

      const result = await verifyPostStatus("deal-asci-001");

      expect(result.status).toBe("ACTIVE");
      expect(result.isAlive).toBe(true);

      // Verify escrow hold lifted and status restored to COMPLIANT
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "deal-asci-001" },
          data: expect.objectContaining({
            isPostAlive: true,
            consecutiveMissingChecks: 0,
            contractTerms: expect.objectContaining({
              asciComplianceAudit: expect.objectContaining({
                consecutiveViolations: 0,
                status: "COMPLIANT",
                isEscrowHoldActive: false,
              }),
            }),
          }),
        })
      );

      // Verify notification sent confirming hold lifted
      expect(NotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-influencer-1",
          type: "system",
          title: "ASCI Compliance Verified",
          message: expect.stringContaining("Escrow hold has been lifted"),
        })
      );
    });
  });
});

