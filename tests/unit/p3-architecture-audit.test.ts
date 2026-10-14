import { describe, it, expect } from "vitest";
import { canTransition, getAllowedTransitions } from "@/lib/deal-state-machine";
import { formatUserError } from "@/lib/user-messages";
import {
  registerProgressivePenaltyHandler,
  getProgressivePenaltyHandler,
} from "@/lib/penalty/hooks";

describe("P3 Architecture, State Machine & Error Hardening", () => {
  describe("Dispute Status Restore Transitions in Deal State Machine", () => {
    const validPreDisputeStatuses = [
      "ACTIVE",
      "PAYMENT_HELD",
      "CONTENT_SUBMITTED",
      "REVISION_REQUESTED",
      "CONTENT_APPROVED",
      "POSTED",
      "VERIFICATION_PENDING",
      "VERIFIED",
    ] as const;

    it("permits BRAND, INFLUENCER, ADMIN, and SYSTEM to restore deal status from DISPUTED", () => {
      for (const targetStatus of validPreDisputeStatuses) {
        expect(
          canTransition("DISPUTED", targetStatus, "BRAND"),
          `BRAND should be allowed to restore DISPUTED -> ${targetStatus}`
        ).toBe(true);

        expect(
          canTransition("DISPUTED", targetStatus, "INFLUENCER"),
          `INFLUENCER should be allowed to restore DISPUTED -> ${targetStatus}`
        ).toBe(true);

        expect(
          canTransition("DISPUTED", targetStatus, "ADMIN"),
          `ADMIN should be allowed to restore DISPUTED -> ${targetStatus}`
        ).toBe(true);

        expect(
          canTransition("DISPUTED", targetStatus, "SYSTEM"),
          `SYSTEM should be allowed to restore DISPUTED -> ${targetStatus}`
        ).toBe(true);
      }
    });

    it("does not permit unauthorized transitions from DISPUTED to PENDING_SIGNATURE or PAYMENT_PENDING", () => {
      expect(canTransition("DISPUTED", "PENDING_SIGNATURE", "BRAND")).toBe(false);
      expect(canTransition("DISPUTED", "PAYMENT_PENDING", "INFLUENCER")).toBe(false);
    });

    it("declares all pre-dispute active statuses in getAllowedTransitions", () => {
      const transitions = getAllowedTransitions("DISPUTED");
      const targetStatuses = transitions.map((t) => t.to);

      for (const status of validPreDisputeStatuses) {
        expect(targetStatuses).toContain(status);
      }
    });
  });

  describe("Sanitized Gateway & Escrow Error Messaging (MESSAGES.md Compliance)", () => {
    it("maps ESCROW_RELEASE_FAILED to friendly copy without technical leaks", () => {
      const err = new Error("ESCROW_RELEASE_FAILED: Gateway failed to release escrow hold");
      const result = formatUserError(err);

      expect(result).not.toContain("Razorpay");
      expect(result).not.toContain("Route");
      expect(result).not.toContain("transfer ID");
      expect(result).toContain("payment gateway could not process this disbursement");
    });

    it("maps PAYOUT_REJECTED to friendly copy without raw 4xx exception text", () => {
      const err = new Error("PAYOUT_REJECTED: Withdrawal request rejected by payout gateway");
      const result = formatUserError(err);

      expect(result).not.toContain("Razorpay");
      expect(result).not.toContain("4xx");
      expect(result).toContain("payment gateway could not process this disbursement");
    });
  });

  describe("Inversion of Control Penalty Hook (Circular Import Decoupling)", () => {
    it("allows registering and retrieving progressive penalty handler without circular imports", async () => {
      let called = false;
      registerProgressivePenaltyHandler(async (userId, category, reason) => {
        called = true;
        return { userId, category, reason };
      });

      const handler = getProgressivePenaltyHandler();
      expect(handler).toBeDefined();

      if (handler) {
        await handler("user_test", "MISSED_DEADLINE", "Test reason");
      }
      expect(called).toBe(true);
    });
  });
});
