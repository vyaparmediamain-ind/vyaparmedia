import { describe, it, expect } from "vitest";
import { getDealStatusInfo } from "@/components/dashboard/deals/DealPipelineCard";
import { DEAL_STATUS_TABS } from "@/components/dashboard/deals/DealsFilterToolbar";

describe("Deals Pipeline List Screen Unit Tests: Status Matrix & Filter Configurations", () => {
  describe("Requirement 1: Semantic Status Badge Matrix & Icons", () => {
    it("should return warning tone and Clock icon for PENDING_SIGNATURE", () => {
      const info = getDealStatusInfo("PENDING_SIGNATURE");
      expect(info.label).toBe("Awaiting Signature");
      expect(info.tone).toBe("warning");
      expect(info.icon).toBeDefined();
    });

    it("should return cyan tone for ACTIVE and POSTED", () => {
      const activeInfo = getDealStatusInfo("ACTIVE");
      expect(activeInfo.label).toBe("Active");
      expect(activeInfo.tone).toBe("cyan");

      const postedInfo = getDealStatusInfo("POSTED");
      expect(postedInfo.label).toBe("Post Submitted");
      expect(postedInfo.tone).toBe("cyan");
    });

    it("should return success tone for PAYMENT_HELD, CONTENT_APPROVED, and COMPLETED", () => {
      const held = getDealStatusInfo("PAYMENT_HELD");
      expect(held.label).toBe("Payment Secured");
      expect(held.tone).toBe("success");

      const approved = getDealStatusInfo("CONTENT_APPROVED");
      expect(approved.label).toBe("Ready to Post");
      expect(approved.tone).toBe("success");

      const completed = getDealStatusInfo("COMPLETED");
      expect(completed.label).toBe("Completed");
      expect(completed.tone).toBe("success");
    });

    it("should return danger tone for REVISION_REQUESTED and DISPUTED", () => {
      const revision = getDealStatusInfo("REVISION_REQUESTED");
      expect(revision.label).toBe("Revision Needed");
      expect(revision.tone).toBe("danger");

      const disputed = getDealStatusInfo("DISPUTED");
      expect(disputed.label).toBe("Disputed");
      expect(disputed.tone).toBe("danger");
    });

    it("should return muted tone for CANCELLED or unknown statuses", () => {
      const cancelled = getDealStatusInfo("CANCELLED");
      expect(cancelled.label).toBe("Cancelled");
      expect(cancelled.tone).toBe("muted");

      const unknown = getDealStatusInfo("CUSTOM_FUTURE_STATUS");
      expect(unknown.label).toBe("CUSTOM FUTURE STATUS");
      expect(unknown.tone).toBe("muted");
    });
  });

  describe("Requirement 2: Deals Filter Tabs Configuration", () => {
    it("should contain all key lifecycle stage tabs", () => {
      const tabKeys = DEAL_STATUS_TABS.map((t) => t.key);
      expect(tabKeys).toContain("all");
      expect(tabKeys).toContain("PENDING_SIGNATURE");
      expect(tabKeys).toContain("ACTIVE");
      expect(tabKeys).toContain("CONTENT_SUBMITTED");
      expect(tabKeys).toContain("REVISION_REQUESTED");
      expect(tabKeys).toContain("CONTENT_APPROVED");
      expect(tabKeys).toContain("POSTED");
      expect(tabKeys).toContain("COMPLETED");
      expect(tabKeys).toContain("DISPUTED");
      expect(tabKeys).toContain("CANCELLED");
    });
  });
});
