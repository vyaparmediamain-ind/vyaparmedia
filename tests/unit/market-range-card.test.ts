import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MarketRangeCard,
  MarketRangeBadge,
  MarketRangeComparisonPill,
} from "@/components/pricing/MarketRangeCard";

describe("Market Range UI Component Suite", () => {
  describe("MarketRangeCard Component States", () => {
    it("renders loading skeleton with a11y labels when isLoading=true", () => {
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeCard, {
          isLoading: true,
          minPaise: 1500000,
          maxPaise: 2500000,
        })
      );

      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading estimated market range"');
      expect(html).toContain("animate-pulse");
      // Must not display numbers while loading
      expect(html).not.toContain("15,000");
    });

    it("renders error state with retry button when error string is supplied", () => {
      let retryClicked = false;
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeCard, {
          error: "Evaluation service temporarily unreachable",
          onRecompute: () => {
            retryClicked = true;
          },
        })
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain("Unable to load estimated market range");
      expect(html).toContain("Evaluation service temporarily unreachable");
      expect(html).toContain("Retry evaluation");
    });

    it("renders empty state ('Data kam hai') when minPaise or maxPaise is 0 or null", () => {
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeCard, {
          minPaise: 0,
          maxPaise: 0,
          onRecompute: () => {},
        })
      );

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain("Data kam hai");
      expect(html).toContain("Insufficient verified data to estimate market range");
      expect(html).toContain("Check for new metrics");
    });

    it("renders formatted rupee range with tabular-nums and confidence chip", () => {
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeCard, {
          minPaise: 1250000, // ₹12,500
          maxPaise: 2750000, // ₹27,500
          confidence: "HIGH",
          dataQuality: "VERIFIED",
        })
      );

      expect(html).toContain("tabular-nums");
      expect(html).toContain("₹12,500 – ₹27,500");
      expect(html).toContain("HIGH confidence");
      expect(html).toContain("Verified API Data");
      expect(html).toContain("per primary deliverable");
    });

    it("renders 'View Market Range Report' button when onViewReport is provided", () => {
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeCard, {
          minPaise: 1250000,
          maxPaise: 2750000,
          confidence: "HIGH",
          dataQuality: "VERIFIED",
          onViewReport: () => {},
        })
      );

      expect(html).toContain("View Market Range Report");
    });

    it("renders data quality chip accurately across VERIFIED, ESTIMATED, and SELF_REPORTED", () => {
      const verifiedHtml = renderToStaticMarkup(
        React.createElement(MarketRangeCard, {
          minPaise: 1000000,
          maxPaise: 2000000,
          dataQuality: "VERIFIED",
        })
      );
      expect(verifiedHtml).toContain("Verified API Data");

      const estimatedHtml = renderToStaticMarkup(
        React.createElement(MarketRangeCard, {
          minPaise: 1000000,
          maxPaise: 2000000,
          dataQuality: "ESTIMATED",
        })
      );
      expect(estimatedHtml).toContain("Estimated Views");

      const selfReportedHtml = renderToStaticMarkup(
        React.createElement(MarketRangeCard, {
          minPaise: 1000000,
          maxPaise: 2000000,
          dataQuality: "SELF_REPORTED",
        })
      );
      expect(selfReportedHtml).toContain("Self-reported");
    });

    it("renders non-blocking comparison hint when quotedRatePaise is supplied", () => {
      // 1. Within Range
      const withinHtml = renderToStaticMarkup(
        React.createElement(MarketRangeCard, {
          minPaise: 1000000,
          maxPaise: 2000000,
          quotedRatePaise: 1500000, // ₹15,000 (midpoint)
        })
      );
      expect(withinHtml).toContain("Within estimated market range");

      // 2. Above Range
      const aboveHtml = renderToStaticMarkup(
        React.createElement(MarketRangeCard, {
          minPaise: 1000000,
          maxPaise: 2000000,
          quotedRatePaise: 3000000, // ₹30,000 (100% above midpoint)
        })
      );
      expect(aboveHtml).toContain("above benchmark midpoint");

      // 3. Below Range
      const belowHtml = renderToStaticMarkup(
        React.createElement(MarketRangeCard, {
          minPaise: 1000000,
          maxPaise: 2000000,
          quotedRatePaise: 500000, // ₹5,000 (below min)
        })
      );
      expect(belowHtml).toContain("below benchmark midpoint");
    });

    it("renders plain-language labels for active diagnostic flags", () => {
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeCard, {
          minPaise: 1000000,
          maxPaise: 2000000,
          flags: [
            "LOW_REACH_RATIO",
            "LOW_ENGAGEMENT",
            "ESTIMATED_VIEWS",
            "PROFILE_STALE",
          ],
        })
      );

      expect(html).toContain("Reach ratio lower than peer average");
      expect(html).toContain("Engagement below tier benchmark");
      expect(html).toContain("Views projected via reach estimator");
      expect(html).toContain("Metrics last updated over 60 days ago");
    });

    it("renders 'Kaise nikala' breakdown toggle button with accessibility attributes", () => {
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeCard, {
          minPaise: 1000000,
          maxPaise: 2000000,
          explanation: [
            {
              step: "BASE_VIEWS",
              description: "Median of 12 recent posts: 45,000 views",
              contributionPaise: 1800000,
              runningTotalPaise: 1800000,
            },
            {
              step: "ENGAGEMENT_MULT",
              description: "High engagement boost (+10%)",
              contributionPaise: 180000,
              runningTotalPaise: 1980000,
            },
          ],
        })
      );

      expect(html).toContain("aria-expanded=");
      expect(html).toContain('aria-controls="market-range-explanation-list"');
      expect(html).toContain("Kaise nikala? (Calculation breakdown)");
    });
  });

  describe("MarketRangeBadge Component (Public Guarding)", () => {
    it("renders null when showPublicBadge is false", () => {
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeBadge, {
          dataQuality: "VERIFIED",
          isWithinRange: true,
          showPublicBadge: false,
        })
      );
      expect(html).toBe("");
    });

    it("renders null when dataQuality is not VERIFIED", () => {
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeBadge, {
          dataQuality: "ESTIMATED",
          isWithinRange: true,
          showPublicBadge: true,
        })
      );
      expect(html).toBe("");
    });

    it("renders null when isWithinRange is false", () => {
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeBadge, {
          dataQuality: "VERIFIED",
          isWithinRange: false,
          showPublicBadge: true,
        })
      );
      expect(html).toBe("");
    });

    it("renders 'Within estimated market range' when dataQuality is VERIFIED, isWithinRange=true, and showPublicBadge=true", () => {
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeBadge, {
          dataQuality: "VERIFIED",
          isWithinRange: true,
          showPublicBadge: true,
        })
      );

      expect(html).toContain("Within estimated market range");
      expect(html).toContain("bg-verified-muted");
      expect(html).toContain("text-verified");
    });
  });

  describe("MarketRangeComparisonPill Component", () => {
    it("returns null if min or max paise are invalid", () => {
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeComparisonPill, {
          quotedPaise: 1500000,
          minPaise: 0,
          maxPaise: 0,
        })
      );
      expect(html).toBe("");
    });

    it("renders 'Within estimated market range' chip when quoted rate falls inside range", () => {
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeComparisonPill, {
          quotedPaise: 1800000,
          minPaise: 1500000,
          maxPaise: 2500000,
        })
      );

      expect(html).toContain("Within estimated market range");
      expect(html).toContain("bg-verified-muted");
    });

    it("renders '+X% above benchmark' when quoted rate exceeds maximum", () => {
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeComparisonPill, {
          quotedPaise: 3000000,
          minPaise: 1500000,
          maxPaise: 2500000,
        })
      );

      expect(html).toContain("above benchmark");
      expect(html).toContain("bg-pending/10");
    });

    it("renders 'X% below benchmark' when quoted rate is below minimum", () => {
      const html = renderToStaticMarkup(
        React.createElement(MarketRangeComparisonPill, {
          quotedPaise: 1000000,
          minPaise: 1500000,
          maxPaise: 2500000,
        })
      );

      expect(html).toContain("below benchmark");
      expect(html).toContain("bg-muted");
    });
  });

  describe("Platform Copy & Compliance Audit", () => {
    it("strictly forbids 'guaranteed' or 'fair price' in all rendered copy", () => {
      const cardHtml = renderToStaticMarkup(
        React.createElement(MarketRangeCard, {
          minPaise: 1500000,
          maxPaise: 2500000,
          confidence: "HIGH",
          dataQuality: "VERIFIED",
          quotedRatePaise: 2000000,
          flags: ["LOW_REACH_RATIO", "ESTIMATED_VIEWS"],
          explanation: [
            {
              step: "STEP1",
              description: "Audience reach estimation",
              runningTotalPaise: 1500000,
            },
          ],
        })
      );

      const badgeHtml = renderToStaticMarkup(
        React.createElement(MarketRangeBadge, {
          dataQuality: "VERIFIED",
          isWithinRange: true,
          showPublicBadge: true,
        })
      );

      const pillHtml = renderToStaticMarkup(
        React.createElement(MarketRangeComparisonPill, {
          quotedPaise: 2000000,
          minPaise: 1500000,
          maxPaise: 2500000,
        })
      );

      const combined = (cardHtml + badgeHtml + pillHtml).toLowerCase();

      // Mandate check: MUST NOT contain "guaranteed" or "fair price"
      expect(combined).not.toContain("guaranteed");
      expect(combined).not.toContain("fair price");

      // Mandate check: MUST use "estimated market range"
      expect(combined).toContain("estimated market range");
    });
  });
});
