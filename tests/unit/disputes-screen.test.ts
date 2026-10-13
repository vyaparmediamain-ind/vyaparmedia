import { describe, it, expect } from "vitest";
import { disputeItemSchema, type DisputeItem } from "@/lib/schemas/dispute.schema";

describe("Disputes & Resolution Screen Unit Tests", () => {
  const sampleDispute: DisputeItem = {
    id: "cm1234567890abcdef",
    status: "TIER2_MEDIATION",
    type: "DELIVERABLE",
    description: "Influencer did not include the agreed discount code in the video description.",
    createdAt: "2026-09-20T10:00:00.000Z",
    deal: {
      id: "deal_987654321",
      amount: 4500000, // 45,000 INR
      campaign: {
        title: "Summer Fitness Shake Campaign",
      },
      influencer: {
        displayName: "Rohan V.",
        name: "Rohan Verma",
      },
      brand: {
        companyName: "FitFuel India",
        name: "FitFuel Corp",
      },
    },
  };

  it("should validate dispute schema contract correctly", () => {
    const parsed = disputeItemSchema.safeParse(sampleDispute);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.id).toBe("cm1234567890abcdef");
      expect(parsed.data.status).toBe("TIER2_MEDIATION");
      expect(parsed.data.deal.amount).toBe(4500000);
      expect(parsed.data.deal.campaign.title).toBe("Summer Fitness Shake Campaign");
    }
  });

  it("should handle filter category segregation accurately", () => {
    const disputes: DisputeItem[] = [
      sampleDispute,
      {
        ...sampleDispute,
        id: "cm_resolved_1",
        status: "RESOLVED",
      },
      {
        ...sampleDispute,
        id: "cm_open_1",
        status: "OPEN",
      },
      {
        ...sampleDispute,
        id: "cm_closed_1",
        status: "CLOSED",
      },
    ];

    const activeCases = disputes.filter(
      (d) =>
        d.status === "OPEN" ||
        d.status === "TIER1_AUTO" ||
        d.status === "TIER2_MEDIATION"
    );
    const resolvedCases = disputes.filter(
      (d) => d.status === "RESOLVED" || d.status === "CLOSED"
    );

    expect(activeCases.length).toBe(2);
    expect(resolvedCases.length).toBe(2);
  });

  it("should format search query matches across campaign, brand, and creator", () => {
    const query = "FitFuel".toLowerCase();
    const matchesBrand = sampleDispute.deal.brand?.companyName
      ?.toLowerCase()
      .includes(query);
    expect(matchesBrand).toBe(true);

    const queryCreator = "rohan".toLowerCase();
    const matchesCreator = sampleDispute.deal.influencer?.displayName
      ?.toLowerCase()
      .includes(queryCreator);
    expect(matchesCreator).toBe(true);
  });
});
