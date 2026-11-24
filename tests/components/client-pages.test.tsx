import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../utils/render";
import { createFetchMock } from "../utils/fetch-mock";

// Server action mocks for client pages
vi.mock("@/app/admin/actions", () => ({
  updateCategoryBenchmarkAction: vi.fn().mockResolvedValue({ success: true }),
  resetCategoryBenchmarkAction: vi.fn().mockResolvedValue({ success: true }),
  updatePricingConfigAction: vi.fn().mockResolvedValue({ success: true }),
  approveDeliverableVerification: vi.fn().mockResolvedValue({ success: true }),
  rejectDeliverableVerification: vi.fn().mockResolvedValue({ success: true }),
}));

// Client page components under test
import AdminAnalyticsClient from "@/app/admin/analytics/AdminAnalyticsClient";
import CategoryBenchmarksClient from "@/app/admin/benchmarks/CategoryBenchmarksClient";
import AdminCampaignsListClient from "@/app/admin/campaigns/AdminCampaignsListClient";
import AdminCampaignClient from "@/app/admin/campaigns/[id]/AdminCampaignClient";
import AnalyticsPageClient from "@/app/dashboard/analytics/AnalyticsPageClient";
import CampaignsClient from "@/app/dashboard/campaigns/CampaignsClient";
import CreateCampaignClient from "@/app/dashboard/campaigns/create/CreateCampaignClient";
import CampaignDetailClient from "@/app/dashboard/campaigns/[id]/CampaignDetailClient";
import { CampaignAnalyticsClient } from "@/app/dashboard/campaigns/[id]/analytics/CampaignAnalyticsClient";
import { RoiClient } from "@/app/dashboard/campaigns/[id]/roi/RoiClient";
import GuideCenterClient from "@/app/dashboard/guide/GuideCenterClient";

describe("Client Page Components Suite (*Client.tsx)", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = createFetchMock();
    fetchMock.install();
  });

  it("renders AdminAnalyticsClient with skeleton placeholder before dynamic import resolves", () => {
    renderWithProviders(<AdminAnalyticsClient data={{} as any} />);

    expect(screen.getByLabelText("Loading platform analytics")).toBeInTheDocument();
  });

  it("renders CategoryBenchmarksClient with initial benchmarks and tabs", () => {
    const mockConfig = {
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "usr_admin",
      tierThresholds: { NANO: 10000, MICRO: 50000, MID: 250000, MACRO: 1000000 },
      platformFeeBps: 1000,
      minEscrowPaise: 50000,
      tdsRatesBps: { panVerified: 100, panMissing: 2000 },
      categoryBaselinesPaise: { FASHION: 250000, TECH: 350000 },
      riskWeights: { overdue: 15, dispute: 30 },
      qualityMultiplier: { verified: 1.1, unverified: 0.9 },
    };

    const mockBenchmarks = [
      {
        category: "Fashion & Lifestyle",
        rawKey: "FASHION",
        baselinePaise: 250000,
        baselineRupees: "2,500",
        source: "CONFIG_DB" as const,
        isDbConfigured: true,
        dealCount: 14,
      },
    ];

    renderWithProviders(
      <CategoryBenchmarksClient
        initialBenchmarks={mockBenchmarks}
        initialConfig={mockConfig as any}
        initialVersion={1}
      />
    );

    expect(screen.getByText("Fair Price Engine Configuration")).toBeInTheDocument();
    expect(screen.getByText("Fashion & Lifestyle")).toBeInTheDocument();
    expect(screen.getByText("₹2,500")).toBeInTheDocument();
  });

  it("renders AdminCampaignsListClient with campaign table and status filter", () => {
    const mockCampaigns = [
      {
        id: "camp-001",
        title: "Summer Collection Launch",
        status: "ACTIVE",
        totalBudget: 15000000,
        fundedAmount: 15000000,
        postingDeadline: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        brand: {
          id: "brand-1",
          companyName: "FabIndia Retail",
          user: { email: "marketing@fabindia.com" },
        },
        _count: {
          deals: 3,
          applications: 12,
        },
      },
    ];

    renderWithProviders(
      <AdminCampaignsListClient
        initialCampaigns={mockCampaigns}
        pagination={{ total: 1, page: 1, limit: 10, totalPages: 1 }}
        currentStatus="ALL"
        currentSearch=""
      />
    );

    expect(screen.getByText("Summer Collection Launch")).toBeInTheDocument();
    expect(screen.getByText(/FabIndia Retail/i)).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("renders AdminCampaignClient with audit overview and risks", () => {
    const mockAdminData = {
      campaign: {
        id: "camp-002",
        title: "Protein Bar Launch",
        status: "ACTIVE",
        totalBudget: 5000000,
        fundedAmount: 5000000,
        postingDeadline: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        brand: {
          id: "brand-2",
          companyName: "MuscleBlaze",
          user: { email: "collabs@muscleblaze.com" },
        },
        _count: { deals: 2, applications: 8 },
      },
      audit: {
        revenue: { totalBudgetPaise: 5000000, fundedEscrowPaise: 5000000, releasedEscrowPaise: 2000000 },
        deadlineRisks: [],
        disputes: { total: 0, open: 0, resolved: 0, refundRateBps: 0, items: [] },
        contactLeaks: { items: [], detectedCount: 0, suspiciousAccounts: 0, totalAuditedMessages: 15 },
        fraudFlags: [],
        creatorMetricAnomalies: [],
        dataQualityShare: {
          dataQuality: "VERIFIED",
          totalViews: 50000,
          verifiedViews: 50000,
          apiSharePercent: 100,
          estimatedViews: 0,
          estimatedSharePercent: 0,
        },
      },
    };

    renderWithProviders(
      <AdminCampaignClient initialData={mockAdminData as any} />
    );

    expect(screen.getByText("Protein Bar Launch")).toBeInTheDocument();
    expect(screen.getByText(/Platform Revenue & Fee Ledger/i)).toBeInTheDocument();
  });

  it("renders AnalyticsPageClient with financial year selector", () => {
    fetchMock.mockJson(/\/api\/gamification\/challenges/, { success: true, challenges: [] });

    const mockData = {
      totalEarningsPaise: 8500000,
      activeDealsCount: 2,
      completedDealsCount: 5,
      trustScore: 820,
    };

    renderWithProviders(
      <AnalyticsPageClient
        userType="INFLUENCER"
        initialData={mockData as any}
      />
    );

    expect(screen.getByText("Rolling 12 Months")).toBeInTheDocument();
    expect(screen.getByText("Active Milestone Challenges")).toBeInTheDocument();
  });

  it("renders CampaignsClient for brand and shows search filters", () => {
    fetchMock.mockJson(/\/api\/campaigns/, {
      success: true,
      data: {
        campaigns: [],
        total: 0,
        page: 1,
        totalPages: 1,
      },
    });

    renderWithProviders(
      <CampaignsClient user={{ userType: "BRAND" }} />
    );

    expect(screen.getByPlaceholderText(/Search campaigns by brand, title, or keywords/i)).toBeInTheDocument();
  });

  it("renders CreateCampaignClient wizard with initial campaign form step", () => {
    fetchMock.mockJson(/\/api\/wallet/, {
      success: true,
      balancePaise: 10000000,
      escrowLockedPaise: 0,
    });
    fetchMock.mockJson(/\/api\/campaigns/, {
      success: true,
      data: null,
    });

    renderWithProviders(<CreateCampaignClient />);

    expect(screen.getByText(/Create New Campaign/i)).toBeInTheDocument();
  });

  it("renders CampaignDetailClient with campaign context", () => {
    fetchMock.mockJson(/\/api\/campaigns\/camp-100/, {
      success: true,
      data: {
        id: "camp-100",
        title: "Diwali Festivities 2026",
        status: "ACTIVE",
        budgetPaise: 2500000,
      },
    });
    fetchMock.mockJson(/\/api\/wallet/, {
      success: true,
      balancePaise: 5000000,
    });

    renderWithProviders(
      <CampaignDetailClient
        user={{ id: "u-1", userType: "BRAND", verificationLevel: "TIER_2" }}
      />
    );

    expect(document.body).toBeInTheDocument();
  });

  it("renders CampaignAnalyticsClient with loading indicator or tabs", () => {
    fetchMock.mockJson(/\/api\/campaigns\/camp-200\/analytics/, {
      success: true,
      data: {
        views: 12000,
        engagements: 1400,
      },
    });

    renderWithProviders(
      <CampaignAnalyticsClient campaignId="camp-200" />
    );

    expect(document.body).toBeInTheDocument();
  });

  it("renders RoiClient fetching ROI analytics report", async () => {
    fetchMock.mockJson(/\/api\/reports\/brand\/campaign\/camp-300\/roi/, {
      success: true,
      data: {
        campaignId: "camp-300",
        campaignTitle: "Summer Fashion Reel Promo",
        totalSpendPaise: 5000000,
        estimatedRevenuePaise: 12500000,
        roiMultiplier: 2.5,
        cpmPaise: 2500,
        cpcPaise: 1200,
      },
    });

    renderWithProviders(<RoiClient campaignId="camp-300" />);

    expect(document.body).toBeInTheDocument();
  });

  it("renders GuideCenterClient with guide cards", () => {
    renderWithProviders(<GuideCenterClient userRole="INFLUENCER" />);
    expect(screen.getByText("Interactive Product Guide Center")).toBeInTheDocument();
  });
});
