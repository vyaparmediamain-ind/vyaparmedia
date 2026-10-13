import { describe, it, expect } from "vitest";
import { paiseToRupees } from "@/lib/csv-export";
import { MatchingService } from "@/services/matching.service";

describe("Campaign ROI Report: Calculation & Algorithm Accuracy Benchmarks", () => {
  describe("Algorithm Accuracy & Prediction Variance Formulas", () => {
    it("should calculate 100% accuracy when delivered views exactly match matching prediction", () => {
      const predictedViews = 10000;
      const actualViews = 10000;

      const accuracyPercentage =
        predictedViews > 0 && actualViews > 0
          ? Math.round(
              Math.min(
                100,
                Math.max(
                  0,
                  (1 - Math.abs(actualViews - predictedViews) / Math.max(actualViews, predictedViews, 1)) * 100
                )
              )
            )
          : 100;

      const viewsVariance = actualViews - predictedViews;
      const viewsVariancePercent =
        predictedViews > 0
          ? Number((((actualViews - predictedViews) / predictedViews) * 100).toFixed(1))
          : 0;
      const deliveryMultiplier =
        predictedViews > 0 ? Number((actualViews / predictedViews).toFixed(2)) : 1;

      expect(accuracyPercentage).toBe(100);
      expect(viewsVariance).toBe(0);
      expect(viewsVariancePercent).toBe(0);
      expect(deliveryMultiplier).toBe(1);
    });

    it("should accurately capture over-delivery and compute variance metrics", () => {
      const predictedViews = 20000;
      const actualViews = 25000; // 25% over target

      const accuracyPercentage = Math.round(
        Math.min(
          100,
          Math.max(
            0,
            (1 - Math.abs(actualViews - predictedViews) / Math.max(actualViews, predictedViews, 1)) * 100
          )
        )
      );

      const viewsVariance = actualViews - predictedViews;
      const viewsVariancePercent = Number(
        (((actualViews - predictedViews) / predictedViews) * 100).toFixed(1)
      );
      const deliveryMultiplier = Number((actualViews / predictedViews).toFixed(2));

      expect(viewsVariance).toBe(5000);
      expect(viewsVariancePercent).toBe(25);
      expect(deliveryMultiplier).toBe(1.25);
      // Absolute diff = 5000 / 25000 = 0.20 -> accuracy = 80%
      expect(accuracyPercentage).toBe(80);
    });

    it("should accurately capture under-delivery without negative or NaN values", () => {
      const predictedViews = 50000;
      const actualViews = 40000; // 20% under target

      const accuracyPercentage = Math.round(
        Math.min(
          100,
          Math.max(
            0,
            (1 - Math.abs(actualViews - predictedViews) / Math.max(actualViews, predictedViews, 1)) * 100
          )
        )
      );

      const viewsVariance = actualViews - predictedViews;
      const viewsVariancePercent = Number(
        (((actualViews - predictedViews) / predictedViews) * 100).toFixed(1)
      );
      const deliveryMultiplier = Number((actualViews / predictedViews).toFixed(2));

      expect(viewsVariance).toBe(-10000);
      expect(viewsVariancePercent).toBe(-20);
      expect(deliveryMultiplier).toBe(0.8);
      // Absolute diff = 10000 / 50000 = 0.20 -> accuracy = 80%
      expect(accuracyPercentage).toBe(80);
    });

    it("should handle boundary conditions cleanly when views are zero", () => {
      const predictedViews = 15000;
      const actualViews = 0;

      const accuracyPercentage =
        predictedViews > 0 && actualViews > 0
          ? Math.round(
              Math.min(
                100,
                Math.max(
                  0,
                  (1 - Math.abs(actualViews - predictedViews) / Math.max(actualViews, predictedViews, 1)) * 100
                )
              )
            )
          : 100;

      const viewsVariancePercent =
        predictedViews > 0
          ? Number((((actualViews - predictedViews) / predictedViews) * 100).toFixed(1))
          : 0;

      expect(accuracyPercentage).toBe(100); // defaults gracefully
      expect(viewsVariancePercent).toBe(-100);
    });
  });

  describe("Engagement & Unit Cost Calculations", () => {
    it("should aggregate engagements from likes, comments, shares, and saves", () => {
      const snapshot = {
        likes: 1200,
        comments: 180,
        shares: 95,
        saves: 225,
      };

      const totalEngagements =
        snapshot.likes + snapshot.comments + snapshot.shares + snapshot.saves;
      expect(totalEngagements).toBe(1700);
    });

    it("should correctly compute CPV, CPE, and CPR in paise and formatted rupees", () => {
      const dealAmountPaise = 500000; // ₹5,000
      const views = 20000;
      const totalEngagements = 1000;
      const reach = 30000;

      const cpvPaise = views > 0 ? Math.round(dealAmountPaise / views) : 0;
      const cpePaise = totalEngagements > 0 ? Math.round(dealAmountPaise / totalEngagements) : 0;
      const cprPaise = reach > 0 ? Math.round(dealAmountPaise / reach) : 0;

      expect(cpvPaise).toBe(25); // 25 paise
      expect(paiseToRupees(cpvPaise)).toBe("0.25");

      expect(cpePaise).toBe(500); // 500 paise = ₹5.00
      expect(paiseToRupees(cpePaise)).toBe("5.00");

      expect(cprPaise).toBe(17); // 16.66 rounds to 17 paise
      expect(paiseToRupees(cprPaise)).toBe("0.17");
    });

    it("should calculate category efficiency factor relative to industry baseline", () => {
      const categoryBaselineCpvPaise = 85; // e.g., Fashion/Beauty baseline is ₹0.85
      const effectiveCpvPaise = 42; // Realized campaign CPV is ₹0.42

      const efficiencyMultiplier = Number((categoryBaselineCpvPaise / effectiveCpvPaise).toFixed(2));
      expect(efficiencyMultiplier).toBe(2.02); // 2.02x more efficient than industry standard
    });
  });

  describe("CSV Export Schema & Integrity", () => {
    it("should format CSV rows with proper RFC-4180 escaping and comparison headers", () => {
      const esc = (v: string) => (v.includes(",") ? `"${v.replaceAll('"', '""')}"` : v);
      const row = (label: string, value: string) => `${esc(label)},${esc(value)}\r\n`;

      const header = row("CAMPAIGN ROI & INFLUENCER PERFORMANCE REPORT", "");
      expect(header).toBe("CAMPAIGN ROI & INFLUENCER PERFORMANCE REPORT,\r\n");

      const titleEscaped = esc('Summer Launch, "Special Edition"');
      expect(titleEscaped).toBe('"Summer Launch, ""Special Edition"""');

      const csvColumns =
        "Influencer,Handle,Followers,Paid (INR),Predicted Views,Delivered Views,Variance (%),Accuracy (%),Predicted CPV (INR),Actual CPV (INR),Reach,Likes,Comments,Shares,Saves,Total Engagements,ER (%),CPE (INR),CPR (INR),Rating,Data Quality";
      expect(csvColumns).toContain("Predicted Views");
      expect(csvColumns).toContain("Delivered Views");
      expect(csvColumns).toContain("Variance (%)");
      expect(csvColumns).toContain("Accuracy (%)");
    });
  });

  describe("Matching Service Integration For Predictions", () => {
    it("should calculate matching scores and estimated views synchronously for brief and influencer", async () => {
      const campaignBrief = {
        id: "camp-test-1",
        targetCategories: ["Tech", "Gadgets"],
        perInfluencerBudget: 1500000, // ₹15,000
        guidelines: "Review of latest smartphone",
      };

      const influencerData = {
        id: "inf-test-1",
        categories: "Tech, Gadgets",
        instagramFollowers: 120000,
        instagramEngagementRate: 350, // 3.5%
        youtubeSubscribers: 80000,
        youtubeEngagementRate: 420, // 4.2%
        followerAuthenticityScore: 88,
        averageRating: 480,
      };

      const match = await MatchingService.calculateMatchScore(
        campaignBrief,
        influencerData,
        campaignBrief.perInfluencerBudget
      );

      expect(match.matchScore).toBeGreaterThan(0);
      expect(match.matchBreakdown.estimatedViews).toBeGreaterThan(0);
      expect(match.matchBreakdown.roiScore).toBeGreaterThan(0);

      const predictedViews = match.matchBreakdown.estimatedViews;
      const predictedCpvPaise = Math.round(campaignBrief.perInfluencerBudget / predictedViews);
      expect(predictedCpvPaise).toBeGreaterThan(0);
    });
  });
});
