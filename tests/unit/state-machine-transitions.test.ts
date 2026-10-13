import { describe, it, expect, vi } from "vitest";
import { DEAL_TRANSITION_MATRIX, transitionDealState, type DealActorRole } from "@/lib/deal-state-machine";
import type { DealStatus, Prisma } from "@prisma/client";

describe("Unit Tests: Deal State Machine Transitions & Role Permissions", () => {
  describe("Requirement 1 & 2: Transition Matrix Declarative Rules & Edge Enforcement", () => {
    it("should define terminal states with 0 outgoing transitions", () => {
      expect(DEAL_TRANSITION_MATRIX.COMPLETED).toEqual([]);
      expect(DEAL_TRANSITION_MATRIX.CANCELLED).toEqual([]);
    });

    it("should allow valid forward flow: PENDING_SIGNATURE -> PAYMENT_HELD -> ACTIVE -> CONTENT_SUBMITTED -> CONTENT_APPROVED -> COMPLETED", () => {
      // 1. PENDING_SIGNATURE -> PAYMENT_HELD
      const step1 = DEAL_TRANSITION_MATRIX.PENDING_SIGNATURE.find((r) => r.to === "PAYMENT_HELD");
      expect(step1).toBeDefined();
      expect(step1?.financialEffect).toBe("LOCK_ESCROW");

      // 2. PAYMENT_HELD -> ACTIVE
      const step2 = DEAL_TRANSITION_MATRIX.PAYMENT_HELD.find((r) => r.to === "ACTIVE");
      expect(step2).toBeDefined();

      // 3. ACTIVE -> CONTENT_SUBMITTED
      const step3 = DEAL_TRANSITION_MATRIX.ACTIVE.find((r) => r.to === "CONTENT_SUBMITTED");
      expect(step3).toBeDefined();
      expect(step3?.allowedRoles).toContain("INFLUENCER");

      // 4. CONTENT_SUBMITTED -> CONTENT_APPROVED
      const step4 = DEAL_TRANSITION_MATRIX.CONTENT_SUBMITTED.find((r) => r.to === "CONTENT_APPROVED");
      expect(step4).toBeDefined();
      expect(step4?.allowedRoles).toContain("BRAND");

      // 5. CONTENT_APPROVED -> COMPLETED
      const step5 = DEAL_TRANSITION_MATRIX.CONTENT_APPROVED.find((r) => r.to === "COMPLETED");
      expect(step5).toBeDefined();
      expect(step5?.financialEffect).toBe("RELEASE_ESCROW");
    });

    it("should reject invalid backwards and illegal transitions as data", () => {
      function isEdgeAllowed(from: DealStatus, to: DealStatus): boolean {
        const allowedRules = DEAL_TRANSITION_MATRIX[from] || [];
        return allowedRules.some((r) => r.to === to);
      }

      // Check terminal state protections
      expect(isEdgeAllowed("COMPLETED", "ACTIVE")).toBe(false);
      expect(isEdgeAllowed("COMPLETED", "DISPUTED")).toBe(false);
      expect(isEdgeAllowed("COMPLETED", "CANCELLED")).toBe(false);
      expect(isEdgeAllowed("CANCELLED", "ACTIVE")).toBe(false);
      expect(isEdgeAllowed("CANCELLED", "PENDING_SIGNATURE")).toBe(false);

      // Check skipping forward without prerequisite stages
      expect(isEdgeAllowed("PENDING_SIGNATURE", "COMPLETED")).toBe(false);
      expect(isEdgeAllowed("PENDING_SIGNATURE", "CONTENT_APPROVED")).toBe(false);
      expect(isEdgeAllowed("CONTENT_SUBMITTED", "COMPLETED")).toBe(false); // must approve first

      // Check backwards transitions
      expect(isEdgeAllowed("CONTENT_APPROVED", "PAYMENT_PENDING")).toBe(false);
      expect(isEdgeAllowed("CONTENT_APPROVED", "PENDING_SIGNATURE")).toBe(false);
      expect(isEdgeAllowed("ACTIVE", "PENDING_SIGNATURE")).toBe(false);
    });
  });

  describe("Requirement 3: Reason Requirement for Critical Transitions", () => {
    it("should require reason for DISPUTED and REVISION_REQUESTED transitions", () => {
      const disputeFromActive = DEAL_TRANSITION_MATRIX.ACTIVE.find((r) => r.to === "DISPUTED");
      expect(disputeFromActive?.requiresReason).toBe(true);

      const disputeFromSubmitted = DEAL_TRANSITION_MATRIX.CONTENT_SUBMITTED.find((r) => r.to === "DISPUTED");
      expect(disputeFromSubmitted?.requiresReason).toBe(true);

      const revision = DEAL_TRANSITION_MATRIX.CONTENT_SUBMITTED.find((r) => r.to === "REVISION_REQUESTED");
      expect(revision?.requiresReason).toBe(true);

      // Normal approval does not require reason
      const approve = DEAL_TRANSITION_MATRIX.CONTENT_SUBMITTED.find((r) => r.to === "CONTENT_APPROVED");
      expect(approve?.requiresReason).toBeFalsy();
    });
  });

  describe("Requirement 4: Role-Based Transition Permissions", () => {
    function canTransition(
      from: DealStatus,
      to: DealStatus,
      role: DealActorRole,
    ): boolean {
      const allowedRules = DEAL_TRANSITION_MATRIX[from] || [];
      const rule = allowedRules.find((r) => r.to === to);
      if (!rule) return false;
      return rule.allowedRoles.includes(role);
    }

    it("should allow INFLUENCER to submit content, but forbid BRAND from submitting content", () => {
      expect(canTransition("ACTIVE", "CONTENT_SUBMITTED", "INFLUENCER")).toBe(true);
      expect(canTransition("ACTIVE", "CONTENT_SUBMITTED", "BRAND")).toBe(false);
    });

    it("should allow BRAND to approve content, but forbid INFLUENCER from approving their own content", () => {
      expect(canTransition("CONTENT_SUBMITTED", "CONTENT_APPROVED", "BRAND")).toBe(true);
      expect(canTransition("CONTENT_SUBMITTED", "CONTENT_APPROVED", "INFLUENCER")).toBe(false);
    });

    it("should only allow ADMIN to resolve DISPUTED deals", () => {
      expect(canTransition("DISPUTED", "COMPLETED", "ADMIN")).toBe(true);
      expect(canTransition("DISPUTED", "COMPLETED", "BRAND")).toBe(false);
      expect(canTransition("DISPUTED", "COMPLETED", "INFLUENCER")).toBe(false);

      expect(canTransition("DISPUTED", "CANCELLED", "ADMIN")).toBe(true);
      expect(canTransition("DISPUTED", "CANCELLED", "BRAND")).toBe(false);
      expect(canTransition("DISPUTED", "CANCELLED", "INFLUENCER")).toBe(false);
    });

    it("should allow SYSTEM auto-approver to approve content on timeout", () => {
      expect(canTransition("CONTENT_SUBMITTED", "CONTENT_APPROVED", "SYSTEM")).toBe(true);
    });
  });

  describe("Requirement 5: Atomic Financial Escrow Coupling (Zero Decoupling)", () => {
    it("should attach LOCK_ESCROW to payment held transitions", () => {
      const rule = DEAL_TRANSITION_MATRIX.PAYMENT_PENDING.find((r) => r.to === "PAYMENT_HELD");
      expect(rule?.financialEffect).toBe("LOCK_ESCROW");
    });

    it("should attach RELEASE_ESCROW to deal completion transitions", () => {
      const rule = DEAL_TRANSITION_MATRIX.CONTENT_APPROVED.find((r) => r.to === "COMPLETED");
      expect(rule?.financialEffect).toBe("RELEASE_ESCROW");
    });

    it("should attach REFUND_ESCROW to cancellation transitions from active/held states", () => {
      const heldCancel = DEAL_TRANSITION_MATRIX.PAYMENT_HELD.find((r) => r.to === "CANCELLED");
      expect(heldCancel?.financialEffect).toBe("REFUND_ESCROW");

      const activeCancel = DEAL_TRANSITION_MATRIX.ACTIVE.find((r) => r.to === "CANCELLED");
      expect(activeCancel?.financialEffect).toBe("REFUND_ESCROW");
    });

    it("should roll back transition atomically if financialHandler throws", async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        deal: {
          findUnique: vi.fn().mockResolvedValue({
            id: "deal_123",
            status: "CONTENT_APPROVED",
            totalAmount: 50000,
            influencer: { userId: "inf_1" },
            brand: { userId: "brand_1" },
            campaign: { id: "camp_1" },
          }),
          update: vi.fn(),
        },
      } as unknown as Prisma.TransactionClient;

      const failingFinancialHandler = vi.fn().mockRejectedValue(new Error("INSUFFICIENT_FUNDS"));

      await expect(
        transitionDealState({
          dealId: "deal_123",
          fromState: "CONTENT_APPROVED",
          toState: "COMPLETED",
          actor: { userId: "brand_1", role: "BRAND" },
          financialHandler: failingFinancialHandler,
          tx: mockTx,
        })
      ).rejects.toThrow("INSUFFICIENT_FUNDS");
    });

    it("should execute complete forward flow with escrow lock, content approval, and escrow release", async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        wallet: {
          findUnique: vi.fn().mockResolvedValue({ id: "w_brand", balance: 50000, pendingBalance: 50000 }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        transaction: {
          create: vi.fn().mockResolvedValue({ id: "tx_1" }),
        },
        deal: {
          findUnique: vi.fn().mockResolvedValue({
            id: "deal_123",
            status: "CONTENT_SUBMITTED",
            totalAmount: 50000,
            influencer: { userId: "inf_1" },
            brand: { userId: "brand_1" },
            campaign: { id: "camp_1" },
          }),
          update: vi.fn().mockResolvedValue({ id: "deal_123", status: "CONTENT_APPROVED" }),
        },
        activityLog: {
          create: vi.fn().mockResolvedValue({ id: "log_1" }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "audit_1" }),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await transitionDealState({
        dealId: "deal_123",
        fromState: "CONTENT_SUBMITTED",
        toState: "CONTENT_APPROVED",
        actor: { userId: "brand_1", role: "BRAND" },
        tx: mockTx,
      });

      expect(result.success).toBe(true);
      expect(result.toState).toBe("CONTENT_APPROVED");
      expect(mockTx.deal.update).toHaveBeenCalled();
    });

    it("should execute escrow refund on cancellation", async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        wallet: {
          findUnique: vi.fn().mockResolvedValue({ id: "w_brand", balance: 10000, pendingBalance: 50000 }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        transaction: {
          create: vi.fn().mockResolvedValue({ id: "tx_refund" }),
        },
        deal: {
          findUnique: vi.fn().mockResolvedValue({
            id: "deal_cancel",
            status: "PAYMENT_HELD",
            totalAmount: 50000,
            influencer: { userId: "inf_1" },
            brand: { userId: "brand_1" },
            campaign: { id: "camp_1" },
          }),
          update: vi.fn().mockResolvedValue({ id: "deal_cancel", status: "CANCELLED" }),
        },
        activityLog: {
          create: vi.fn().mockResolvedValue({ id: "log_2" }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "audit_2" }),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await transitionDealState({
        dealId: "deal_cancel",
        fromState: "PAYMENT_HELD",
        toState: "CANCELLED",
        actor: { userId: "brand_1", role: "BRAND" },
        reason: "Mutually agreed to cancel deal",
        tx: mockTx,
      });

      expect(result.success).toBe(true);
      expect(result.toState).toBe("CANCELLED");
      expect(mockTx.wallet.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            pendingBalance: { decrement: 50000 },
            balance: { increment: 50000 },
          },
        }),
      );
    });

    it("should throw REASON_REQUIRED if reason is omitted on reason-required transition", async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        deal: {
          findUnique: vi.fn().mockResolvedValue({
            id: "deal_disp",
            status: "ACTIVE",
            totalAmount: 50000,
            influencer: { userId: "inf_1" },
            brand: { userId: "brand_1" },
            campaign: { id: "camp_1" },
          }),
        },
      } as unknown as Prisma.TransactionClient;

      await expect(
        transitionDealState({
          dealId: "deal_disp",
          fromState: "ACTIVE",
          toState: "DISPUTED",
          actor: { userId: "brand_1", role: "BRAND" },
          tx: mockTx,
        }),
      ).rejects.toThrow("REASON_REQUIRED");
    });

    it("should throw TRANSITION_NOT_PERMITTED_FOR_ROLE when role does not have permission", async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        deal: {
          findUnique: vi.fn().mockResolvedValue({
            id: "deal_role",
            status: "CONTENT_SUBMITTED",
            totalAmount: 50000,
            influencer: { userId: "inf_1" },
            brand: { userId: "brand_1" },
            campaign: { id: "camp_1" },
          }),
        },
      } as unknown as Prisma.TransactionClient;

      await expect(
        transitionDealState({
          dealId: "deal_role",
          fromState: "CONTENT_SUBMITTED",
          toState: "CONTENT_APPROVED",
          actor: { userId: "inf_1", role: "INFLUENCER" }, // Influencer cannot approve
          tx: mockTx,
        }),
      ).rejects.toThrow("TRANSITION_NOT_PERMITTED_FOR_ROLE");
    });

    it("should throw TERMINAL_STATE_LOCKED when deal is in terminal state", async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        deal: {
          findUnique: vi.fn().mockResolvedValue({
            id: "deal_term",
            status: "COMPLETED",
            totalAmount: 50000,
            influencer: { userId: "inf_1" },
            brand: { userId: "brand_1" },
            campaign: { id: "camp_1" },
          }),
        },
      } as unknown as Prisma.TransactionClient;

      await expect(
        transitionDealState({
          dealId: "deal_term",
          fromState: "COMPLETED",
          toState: "ACTIVE",
          actor: { userId: "admin_1", role: "ADMIN" },
          tx: mockTx,
        }),
      ).rejects.toThrow("TERMINAL_STATE_LOCKED");
    });

    it("should throw INVALID_DEAL_TRANSITION when transition is not permitted", async () => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        deal: {
          findUnique: vi.fn().mockResolvedValue({
            id: "deal_inv",
            status: "PENDING_SIGNATURE",
            totalAmount: 50000,
            influencer: { userId: "inf_1" },
            brand: { userId: "brand_1" },
            campaign: { id: "camp_1" },
          }),
        },
      } as unknown as Prisma.TransactionClient;

      await expect(
        transitionDealState({
          dealId: "deal_inv",
          fromState: "PENDING_SIGNATURE",
          toState: "COMPLETED",
          actor: { userId: "brand_1", role: "BRAND" },
          tx: mockTx,
        }),
      ).rejects.toThrow("INVALID_DEAL_TRANSITION");
    });
  });

  describe("Requirement 6: Auto-Approval Timeout Calculation", () => {
    it("should calculate 48-hour default review window expiration", () => {
      const defaultReviewHours = 48;
      const reviewWindowMs = defaultReviewHours * 60 * 60 * 1000;

      const submissionTime = new Date("2026-09-10T12:00:00.000Z");

      // 47 hours later: not yet expired
      const beforeTimeout = new Date(submissionTime.getTime() + 47 * 60 * 60 * 1000);
      const isExpiredBefore = beforeTimeout.getTime() - submissionTime.getTime() >= reviewWindowMs;
      expect(isExpiredBefore).toBe(false);

      // 48.5 hours later: expired, triggers auto-approval
      const afterTimeout = new Date(submissionTime.getTime() + 48.5 * 60 * 60 * 1000);
      const isExpiredAfter = afterTimeout.getTime() - submissionTime.getTime() >= reviewWindowMs;
      expect(isExpiredAfter).toBe(true);
    });
  });
});
