import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportLetterhead } from "@/components/reports/ReportLetterhead";
import { ReportMetaBlock } from "@/components/reports/ReportMetaBlock";
import { DataQualityLegend } from "@/components/reports/DataQualityLegend";
import { ReportFooter } from "@/components/reports/ReportFooter";
import { buildReportMeta } from "@/lib/report-meta";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

describe("Report Shared Component Suite (Report Standard v3)", () => {
  const meta = buildReportMeta({
    type: "ROI",
    scope: "Campaign: Diwali Boost",
    period: "FY 2025-26",
    user: {
      name: "Sneha Reddy",
      email: "sneha.reddy@enterprise.in",
      role: "BRAND",
    },
    dataQualitySummary: {
      verifiedPercent: 85,
      estimatedPercent: 15,
      selfReportedPercent: 0,
    },
    now: new Date("2026-11-22T10:00:00.000Z"),
  });

  describe("ReportLetterhead", () => {
    it("renders official logo with explicit dimensions, alt='VyaparMedia', and print color adjust", () => {
      const html = renderToStaticMarkup(
        React.createElement(ReportLetterhead, {
          title: "Wallet Account Statement",
          subtitle: "Official Escrow Ledger",
        })
      );

      // Logo check
      expect(html).toContain('alt="VyaparMedia"');
      expect(html).toContain("logo-vm.png");
      expect(html).toContain("print-color-adjust:exact");
      expect(html).toContain("Wallet Account Statement");
      expect(html).toContain("Official Escrow Ledger");
    });

    it("renders configured platform corporate details", () => {
      const html = renderToStaticMarkup(
        React.createElement(ReportLetterhead, {
          title: "Test Statement",
        })
      );

      if (PLATFORM_CONFIG.legalName) {
        expect(html).toContain(PLATFORM_CONFIG.legalName);
      }
      if (PLATFORM_CONFIG.gstin) {
        expect(html).toContain(PLATFORM_CONFIG.gstin);
      }
      if (PLATFORM_CONFIG.address) {
        expect(html).toContain(PLATFORM_CONFIG.address);
      }
    });

    it("renders admin warning banner when required tax fields are missing and isAdmin=true", () => {
      const html = renderToStaticMarkup(
        React.createElement(ReportLetterhead, {
          title: "Test Statement",
          isAdmin: true,
          showAdminBanner: true,
        })
      );

      // If any tax field is unconfigured in test environment, admin banner appears
      if (!PLATFORM_CONFIG.legalName || !PLATFORM_CONFIG.gstin || !PLATFORM_CONFIG.address) {
        expect(html).toContain("Platform Configuration Warning");
        expect(html).toContain("Admin System");
      }
    });
  });

  describe("ReportMetaBlock", () => {
    it("renders Report ID, masked email, role, and period", () => {
      const html = renderToStaticMarkup(React.createElement(ReportMetaBlock, { meta }));

      expect(html).toContain(meta.reportId);
      expect(html).toContain("Sneha Reddy");
      expect(html).toContain("BRAND");
      expect(html).toContain("s***@enterprise.in");
      expect(html).toContain("FY 2025-26");
      expect(html).toContain(meta.generatedAtIst);
    });
  });

  describe("DataQualityLegend", () => {
    it("renders verified, estimated, and self-reported percentages accurately", () => {
      const html = renderToStaticMarkup(
        React.createElement(DataQualityLegend, {
          summary: meta.dataQualitySummary,
        })
      );

      expect(html).toContain("85% verified, 15% estimated, 0% self-reported");
      expect(html).toContain("Verified API (85%)");
      expect(html).toContain("Estimated (15%)");
      expect(html).toContain("Self-Reported");
    });
  });

  describe("ReportFooter", () => {
    it("renders legal disclaimer and page counter elements", () => {
      const html = renderToStaticMarkup(
        React.createElement(ReportFooter, {
          reportId: meta.reportId,
          integrityCode: meta.integrityCode,
          showQrCode: false,
        })
      );

      expect(html).toContain("Estimated figures are indicative. This report is not tax, legal or financial advice.");
      expect(html).toContain(meta.integrityCode);
      expect(html).toContain("Page");
      expect(html).toContain("page-number");
    });
  });
});
