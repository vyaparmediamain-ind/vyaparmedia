import { describe, it, expect } from "vitest";
import { formatIndianRupees } from "@/components/dashboard/deals/EscrowTrustCard";
import { getStageIndex, DEAL_STAGES } from "@/components/dashboard/deals/DealProgressStepper";
import {
  isEscrowLockedStatus,
  isDisputeAllowedStatus,
  canRoleTransition,
} from "@/lib/deal-state-machine";

describe("Deal Detail Screen: Currency, Progress Stepper & Role-Based Actions", () => {
  describe("Requirement 2: Currency Display & Indian Numbering Format (en-IN)", () => {
    it("should format ₹1,00,000 with Indian grouping (not western 100,000)", () => {
      // 1 Lakh rupees in paise = 100000 * 100 = 10000000
      const formatted = formatIndianRupees(10000000);
      // Clean non-breaking spaces for regex match
      const cleaned = formatted.replace(/\u00A0/g, " ");

      expect(cleaned).toContain("₹");
      expect(cleaned).toContain("1,00,000");
      expect(cleaned).not.toBe("₹100,000");
    });

    it("should format multi-lakh amounts with Indian two-digit commas (e.g. ₹15,50,000)", () => {
      // 15.5 Lakh rupees in paise = 1550000 * 100 = 155000000
      const formatted = formatIndianRupees(155000000);
      const cleaned = formatted.replace(/\u00A0/g, " ");

      expect(cleaned).toContain("₹");
      expect(cleaned).toContain("15,50,000");
    });

    it("should format standard hundreds without fractional paise jitter (e.g. ₹500)", () => {
      // 500 rupees in paise = 50000
      const formatted = formatIndianRupees(50000);
      const cleaned = formatted.replace(/\u00A0/g, " ");

      expect(cleaned).toContain("500");
      expect(cleaned).not.toContain(".00");
    });
  });

  describe("Requirement 1: 6-Stage Progress Stepper Mapping", () => {
    it("should map all 6 canonical stages with clear labels and sublabels", () => {
      expect(DEAL_STAGES).toHaveLength(6);
      expect(DEAL_STAGES.map((s) => s.label)).toEqual([
        "Applied",
        "Accepted",
        "Submitted",
        "Under Review",
        "Approved",
        "Payout",
      ]);
    });

    it("should map PENDING_SIGNATURE and PAYMENT_PENDING to stage 0 (Applied)", () => {
      expect(getStageIndex("PENDING_SIGNATURE")).toBe(0);
      expect(getStageIndex("PAYMENT_PENDING")).toBe(0);
    });

    it("should map PAYMENT_HELD and ACTIVE to stage 1 (Accepted / Escrow Locked)", () => {
      expect(getStageIndex("PAYMENT_HELD")).toBe(1);
      expect(getStageIndex("ACTIVE")).toBe(1);
    });

    it("should map CONTENT_SUBMITTED to stage 2 (Submitted)", () => {
      expect(getStageIndex("CONTENT_SUBMITTED")).toBe(2);
    });

    it("should map REVISION_REQUESTED to stage 3 (Under Review)", () => {
      expect(getStageIndex("REVISION_REQUESTED")).toBe(3);
    });

    it("should map CONTENT_APPROVED, POSTED, and VERIFIED to stage 4 (Approved)", () => {
      expect(getStageIndex("CONTENT_APPROVED")).toBe(4);
      expect(getStageIndex("POSTED")).toBe(4);
      expect(getStageIndex("VERIFICATION_PENDING")).toBe(4);
      expect(getStageIndex("VERIFIED")).toBe(4);
    });

    it("should map COMPLETED to stage 5 (Payout Settled)", () => {
      expect(getStageIndex("COMPLETED")).toBe(5);
    });
  });

  describe("Requirement 3: Escrow Lock Status & Protection", () => {
    it("should correctly identify escrow locked statuses using production deal state machine", () => {
      expect(isEscrowLockedStatus("ACTIVE")).toBe(true);
      expect(isEscrowLockedStatus("PAYMENT_HELD")).toBe(true);
      expect(isEscrowLockedStatus("CONTENT_SUBMITTED")).toBe(true);
      expect(isEscrowLockedStatus("REVISION_REQUESTED")).toBe(true);
      expect(isEscrowLockedStatus("POSTED")).toBe(true);
      expect(isEscrowLockedStatus("VERIFIED")).toBe(true);
    });

    it("should not consider unsigned, completed, or cancelled deals as active escrow locked", () => {
      expect(isEscrowLockedStatus("PENDING_SIGNATURE")).toBe(false);
      expect(isEscrowLockedStatus("PAYMENT_PENDING")).toBe(false);
      expect(isEscrowLockedStatus("COMPLETED")).toBe(false);
      expect(isEscrowLockedStatus("CANCELLED")).toBe(false);
    });
  });

  describe("Requirement 4 & Definition of Done: Role-Isolated Action Matrix", () => {
    it("should NEVER allow an Influencer to perform Brand-only state transitions", () => {
      // Content approval, payment release, and cancellation of held escrow are Brand/Admin actions
      expect(canRoleTransition("CONTENT_SUBMITTED", "CONTENT_APPROVED", "INFLUENCER")).toBe(false);
      expect(canRoleTransition("POSTED", "COMPLETED", "INFLUENCER")).toBe(false);
      expect(canRoleTransition("VERIFIED", "COMPLETED", "INFLUENCER")).toBe(false);
      expect(canRoleTransition("PAYMENT_HELD", "CANCELLED", "INFLUENCER")).toBe(false);
    });

    it("should NEVER allow a Brand to perform Influencer-only state transitions", () => {
      // Submitting content and posting deliverable URLs are Influencer actions
      expect(canRoleTransition("ACTIVE", "CONTENT_SUBMITTED", "BRAND")).toBe(false);
      expect(canRoleTransition("REVISION_REQUESTED", "CONTENT_SUBMITTED", "BRAND")).toBe(false);
      expect(canRoleTransition("CONTENT_APPROVED", "POSTED", "BRAND")).toBe(false);
    });

    it("should allow Influencer to submit content when ACTIVE and post URL when CONTENT_APPROVED", () => {
      expect(canRoleTransition("ACTIVE", "CONTENT_SUBMITTED", "INFLUENCER")).toBe(true);
      expect(canRoleTransition("CONTENT_APPROVED", "POSTED", "INFLUENCER")).toBe(true);
      expect(canRoleTransition("CONTENT_APPROVED", "VERIFICATION_PENDING", "INFLUENCER")).toBe(true);
    });

    it("should allow Brand to review content when SUBMITTED and release payment when POSTED/VERIFIED", () => {
      expect(canRoleTransition("CONTENT_SUBMITTED", "CONTENT_APPROVED", "BRAND")).toBe(true);
      expect(canRoleTransition("CONTENT_SUBMITTED", "REVISION_REQUESTED", "BRAND")).toBe(true);
      expect(canRoleTransition("POSTED", "COMPLETED", "BRAND")).toBe(true);
      expect(canRoleTransition("VERIFIED", "COMPLETED", "BRAND")).toBe(true);
    });
  });

  describe("Requirement 5: Dispute Entry Point Logic", () => {
    it("should keep dispute entry point non-alarmist during active deal stages and allow dispute only on valid states", () => {
      expect(isDisputeAllowedStatus("ACTIVE")).toBe(true);
      expect(isDisputeAllowedStatus("PAYMENT_HELD")).toBe(true);
      expect(isDisputeAllowedStatus("CONTENT_SUBMITTED")).toBe(true);
      expect(isDisputeAllowedStatus("REVISION_REQUESTED")).toBe(true);
      expect(isDisputeAllowedStatus("CONTENT_APPROVED")).toBe(true);
      expect(isDisputeAllowedStatus("POSTED")).toBe(true);
      expect(isDisputeAllowedStatus("VERIFIED")).toBe(true);

      // Terminal or non-escrow states cannot be disputed
      expect(isDisputeAllowedStatus("PENDING_SIGNATURE")).toBe(false);
      expect(isDisputeAllowedStatus("COMPLETED")).toBe(false);
      expect(isDisputeAllowedStatus("CANCELLED")).toBe(false);
    });
  });
});
