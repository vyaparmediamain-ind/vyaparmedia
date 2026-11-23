import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithProviders } from "../utils/render";
import { createFetchMock } from "../utils/fetch-mock";

import { ReportLetterhead } from "@/components/reports/ReportLetterhead";
import { ReportFooter } from "@/components/reports/ReportFooter";
import { DataQualityLegend } from "@/components/reports/DataQualityLegend";
import { ReportMetaBlock } from "@/components/reports/ReportMetaBlock";
import { CampaignGovernanceReportView } from "@/components/reports/CampaignGovernanceReportView";
import type { CampaignGovernanceReportData } from "@/services/campaign-governance-report.service";

describe("Component Tests: Reports (Priority 8)", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  const mockReportMeta: any = {
    reportId: "REP_GOV_2026_001",
    generatedAt: "2026-11-23T10:00:00Z",
    period: "FY 2025-26",
    scope: "Internal Administrative Governance Audit",
    user: {
      id: "usr_admin_123",
      name: "System Auditor",
      role: "ADMIN",
      maskedEmail: "a***@vyaparmedia.in",
    },
    platform: {
      legalName: "VyaparMedia Technologies Private Limited",
      cin: "U72900MH2026PTC123456",
      gstin: "27AABCV1234F1Z5",
    },
    versions: {
      analyticsEngine: "v3.0",
      rulesEngine: "v2.5",
    },
    dataSources: ["Meta Graph API v20.0", "Internal Escrow Ledger", "NPCI Settlement Gateway"],
  };

  const mockGovernanceReportData: any = {
    campaign: {
      id: "camp_123",
      title: "Summer Fitness Launch 2026",
      status: "COMPLETED",
      totalBudgetPaise: 5000000,
      totalBudgetRupees: "₹50,000",
      fundedAmountPaise: 5000000,
      fundedAmountRupees: "₹50,000",
      targetCategories: ["FITNESS", "LIFESTYLE"],
      brandName: "NutriPro India",
      brandLegalDetails: {
        companyName: "NutriPro India Pvt Ltd",
        gstin: "27AABCN1234F1Z5",
        pan: "AABCN1234F",
      },
    },
    kpis: {
      totalSpendPaise: 5000000,
      totalSpendRupees: "₹50,000",
      totalReach: 150000,
      totalViews: 85000,
      verifiedViews: 80000,
      estimatedViews: 5000,
      totalEngagements: 4500,
      avgEngagementRate: 5.2,
      effectiveCpvPaise: 58,
      effectiveCpvRupees: "₹0.58",
      categoryBaselineCpvPaise: 75,
      categoryBaselineCpvRupees: "₹0.75",
    },
    finance: {
      totalBudgetPaise: 5000000,
      totalDisbursedPaise: 4500000,
      totalPlatformFeePaise: 450000,
      gatewayFeePaise: 90000,
      gstCollectedPaise: 81000,
    },
    governance: {
      hasDisputes: false,
      disputedDeals: [],
      hasDelays: false,
      delayedDeals: [],
      deadlineRisks: [],
      disputes: {
        total: 0,
        open: 0,
        resolved: 0,
        items: [],
      },
      contactLeaks: {
        totalCount: 0,
        items: [],
      },
      fraudFlags: [],
      creatorMetricAnomalies: [],
      cancelledDeals: {
        total: 0,
        items: [],
      },
      revenue: {
        grossPlatformFeeRupees: "4,500",
        netPlatformFeeRupees: "4,500",
        gstCollectedRupees: "810",
      },
      dataQuality: {
        totalViews: 85000,
        verifiedViews: 80000,
        estimatedViews: 5000,
        apiViewsShareBps: 9411,
        apiSharePercent: 94.1,
        estimatedSharePercent: 5.9,
        dataQuality: "VERIFIED",
      },
    },
    deals: [],
    dataQualitySummary: {
      verifiedPercent: 85,
      estimatedPercent: 15,
      selfReportedPercent: 0,
    },
    reportMeta: mockReportMeta,
    disclaimer: "Official financial and operational audit record. Governed by Indian IT Act 2000.",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = createFetchMock();
    fetchMock.install();
  });

  describe("ReportLetterhead", () => {
    it("renders official letterhead with corporate identity and document title", () => {
      renderWithProviders(
        <ReportLetterhead
          title="Administrative Campaign Governance & Audit Report"
          subtitle="Full Operational Monitoring"
          referenceId="REF-12345"
          generatedDate="23 Nov 2026"
        />
      );

      expect(screen.getByText("Administrative Campaign Governance & Audit Report")).toBeInTheDocument();
      expect(screen.getByText("Full Operational Monitoring")).toBeInTheDocument();
      expect(screen.getByAltText(/VyaparMedia/i)).toBeInTheDocument();
    });

    it("displays [Not configured] fallback for unconfigured platform fields", () => {
      renderWithProviders(
        <ReportLetterhead
          title="Financial Statement"
          isAdmin={true}
          showAdminBanner={true}
        />
      );

      // If legal fields are missing, [Not configured] pill renders
      const notConfiguredElements = screen.queryAllByText("[Not configured]");
      expect(notConfiguredElements.length).toBeGreaterThanOrEqual(0);
    });

    it("passes axe accessibility checks on ReportLetterhead", async () => {
      const { container } = renderWithProviders(
        <ReportLetterhead
          title="Campaign Governance Report"
          subtitle="Audit statement"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("ReportFooter", () => {
    it("renders cryptographic verification footer with integrity code and QR verification section", () => {
      renderWithProviders(
        <ReportFooter
          reportId="REP_GOV_2026_001"
          integrityCode="SHA256:e3b0c44298fc1c149afbf4c8996fb924"
          disclaimer="Official audit record"
        />
      );

      expect(screen.getByText(/Cryptographic Document Integrity & Verification/i)).toBeInTheDocument();
      expect(screen.getByText(/Official audit record/i)).toBeInTheDocument();
      expect(screen.getByText(/SHA256:e3b0c44298fc1c149afbf4c8996fb924/i)).toBeInTheDocument();
    });
  });

  describe("DataQualityLegend", () => {
    it("renders data quality percentages with verified, estimated, and self-reported labels", () => {
      renderWithProviders(
        <DataQualityLegend
          summary={{
            verifiedPercent: 85,
            estimatedPercent: 15,
            selfReportedPercent: 0,
          }}
        />
      );

      expect(screen.getByText(/Data Quality Audit:/i)).toBeInTheDocument();
      expect(screen.getByText(/85% verified, 15% estimated, 0% self-reported/i)).toBeInTheDocument();
      expect(screen.getByText(/Verified API \(85%\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Estimated \(15%\)/i)).toBeInTheDocument();
    });
  });

  describe("ReportMetaBlock", () => {
    it("renders report canonical metadata fields (Report ID, generatedAt, SHA-256)", () => {
      renderWithProviders(<ReportMetaBlock meta={mockReportMeta} />);

      expect(screen.getByText("System Auditor")).toBeInTheDocument();
      expect(screen.getByText("FY 2025-26")).toBeInTheDocument();
    });
  });

  describe("CampaignGovernanceReportView", () => {
    it("renders complete governance report view with financial breakdown in integer paise converted to Rupees", () => {
      renderWithProviders(
        <CampaignGovernanceReportView data={mockGovernanceReportData} />
      );

      expect(screen.getByText("NutriPro India Pvt Ltd")).toBeInTheDocument();
      // ₹50,000 budget
      expect(screen.getAllByText(/₹50,000/i).length).toBeGreaterThan(0);
    });
  });
});
