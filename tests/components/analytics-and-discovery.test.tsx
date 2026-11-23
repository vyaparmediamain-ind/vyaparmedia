import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../utils/render";
import { axe } from "vitest-axe";
import { createFetchMock } from "../utils/fetch-mock";

// Components under test
import BrandDashboard, { type BrandAnalyticsData } from "@/components/analytics/BrandDashboard";
import InfluencerDashboard, { type InfluencerAnalyticsData } from "@/components/analytics/InfluencerDashboard";
import AdminAnalyticsView from "@/components/analytics/AdminAnalyticsView";
import CreatorDiscoveryCard from "@/components/discovery/CreatorDiscoveryCard";
import CampaignDiscoveryCard from "@/components/discovery/CampaignDiscoveryCard";
import FilterBottomSheet from "@/components/discovery/FilterBottomSheet";
import DiscoveryFeed from "@/components/discovery/DiscoveryFeed";
import type { CreatorDiscoveryItem, CampaignDiscoveryItem } from "@/components/discovery/types";
import { GST_STANDARD_RATE_PERCENT_STRING, TDS_194O_RATE_PERCENT_STRING } from "@/constants";

// Mock recharts ResponsiveContainer to avoid 0x0 container size in jsdom
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div className="recharts-responsive-container" style={{ width: 800, height: 400 }}>
        {children}
      </div>
    ),
  };
});

describe("Analytics & Discovery Component Suite (Priority 9 & 10)", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = createFetchMock();
    fetchMock.install();
  });

  const mockBrandData: BrandAnalyticsData = {
    overview: {
      totalSpent: 45000000, // 450,000 INR in paise
      activeCampaigns: 3,
      totalCampaigns: 12,
      activeDeals: 5,
      trustScore: 92,
      completedDeals: 28,
      avgDealCost: 1500000,
      memberSince: new Date("2025-01-15T00:00:00Z"),
    },
    spendHistory: [
      { month: "Jan", amount: 10000000 },
      { month: "Feb", amount: 15000000 },
      { month: "Mar", amount: 20000000 },
    ],
    recentCampaigns: [
      {
        id: "camp-001",
        title: "Summer Fitness Launch 2026",
        status: "ACTIVE",
        budget: 20000000,
        dealsCount: 4,
        category: "FITNESS",
        completedDeals: 2,
        amountSpent: 12000000,
      },
    ],
    dealStatusBreakdown: [
      { status: "COMPLETED", count: 28, totalAmount: 35000000 },
      { status: "ACTIVE", count: 5, totalAmount: 10000000 },
    ],
    microVsMacro: {
      micro: { count: 20, avgCost: 1000000, avgRating: "4.8" },
      macro: { count: 8, avgCost: 2500000, avgRating: "4.9" },
    },
    referralStats: {
      totalReferrals: 4,
      activeReferrals: 2,
      totalEarnings: 500000,
      tier: { label: "Silver Partner" },
      earnings: 500000,
      referralCode: "BRANDVIP2026",
    },
    campaignVisibility: {
      campaignBriefViews: 125000,
      uniqueViewers: 8400,
      avgReadTimeMs: 45000,
      avgReadTimeSec: 45,
      totalApplications: 120,
      applicationsPer100Views: 0.96,
      applicationsRateBps: 96,
      bestCategories: [{ category: "Fitness", applicationsCount: 80, percentShare: 66.7 }],
      dataQuality: "VERIFIED",
    },
  };

  const mockInfluencerData: InfluencerAnalyticsData = {
    overview: {
      totalEarnings: 32000000, // 320,000 INR in paise
      completedDeals: 18,
      activeDeals: 2,
      averageRating: 4.85,
      trustScore: 88,
      level: 4,
      xp: 4200,
      successRate: 95.5,
      memberSince: new Date("2025-03-01T00:00:00Z"),
    },
    earningsHistory: [
      { month: "Jan", amount: 8000000 },
      { month: "Feb", amount: 11000000 },
      { month: "Mar", amount: 13000000 },
    ],
    performance: {
      deliveryRate: 98.0,
      engagementRate: 4.6,
      successRate: 95.5,
    },
    topContent: [
      {
        id: "deal-001",
        campaignTitle: "Hydration Bottle Campaign",
        amount: 2500000,
        completedAt: new Date("2026-02-15T00:00:00Z"),
        postUrl: "https://instagram.com/p/mock123",
      },
    ],
    categoryBreakdown: [
      { category: "Fitness", count: 12, percentage: 66.7 },
      { category: "Wellness", count: 6, percentage: 33.3 },
    ],
    recentActivity: [],
    gamification: {
      recentBadges: [],
      referralStats: {
        totalReferrals: 3,
        activeReferrals: 1,
        totalEarnings: 250000,
        tier: { label: "Bronze" },
        earnings: 250000,
        referralCode: "CREATOR88",
      },
    },
    visibility: {
      views: 85000,
      uniqueViewers: 3200,
      avgTimeOnProfileMs: 45000,
      avgTimeOnProfileSec: 45,
      trendVsPrevious30d: { trendPercent: 12.5, trendBps: 1250, direction: "up" },
      applicationsCount: 14,
      conversionRatePercent: 4.2,
      conversionRateBps: 420,
      identifiedBrands: [],
      totalIdentifiedBrandsCount: 0,
      isSmallNumberSuppressed: false,
      dataQuality: "VERIFIED",
    },
  };

  const mockCreatorItem: CreatorDiscoveryItem = {
    id: "inf-101",
    name: "Aanya Sharma",
    handle: "aanyafit",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
    niche: "Fitness & Health",
    city: "Mumbai",
    followers: 85000,
    engagementRate: 4.8,
    isKycVerified: true,
    startingRatePaise: 2500000, // ₹25,000
    trustScore: 91,
    isSaved: false,
    fairRateMinPaise: 2000000,
    fairRateMaxPaise: 3000000,
  };

  const mockCampaignItem: CampaignDiscoveryItem = {
    id: "camp-202",
    title: "Organic Superfood Reel Showcase",
    description: "Create an authentic 60s Instagram Reel reviewing our organic matcha blend.",
    brandId: "brand-55",
    brandName: "PureRoots Organics",
    brandAvatar: "https://images.unsplash.com/photo-1542744094-3a31f272c490",
    isBrandGstVerified: true,
    budgetPaise: 3500000, // ₹35,000
    isEscrowSecured: true,
    niche: "Health & Wellness",
    city: "Pan-India",
    deadline: "2026-12-15T23:59:59Z",
    deliverables: ["INSTAGRAM_REEL", "INSTAGRAM_STORY"],
    isSaved: false,
  };

  describe("BrandDashboard", () => {
    it("renders financial overview formatted in INR from integer paise", () => {
      renderWithProviders(<BrandDashboard data={mockBrandData} />);

      // Total spent ₹4,50,000
      expect(screen.getAllByText("₹4,50,000").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Summer Fitness Launch 2026")).toBeInTheDocument();
      expect(screen.getByText("BRANDVIP2026")).toBeInTheDocument();
    });

    it("displays GST compliance notice with standard rate", () => {
      renderWithProviders(<BrandDashboard data={mockBrandData} />);

      expect(screen.getAllByText(new RegExp(`${GST_STANDARD_RATE_PERCENT_STRING}|GST`, "i")).length).toBeGreaterThanOrEqual(1);
    });

    it("renders BrandCampaignVisibilitySection with verified metrics", () => {
      renderWithProviders(<BrandDashboard data={mockBrandData} />);

      expect(screen.getByText("1,25,000")).toBeInTheDocument();
      expect(screen.getByText("8,400")).toBeInTheDocument();
    });

    it("handles empty campaign states gracefully with EmptyState", () => {
      const emptyBrandData: BrandAnalyticsData = {
        ...mockBrandData,
        overview: {
          ...mockBrandData.overview,
          activeCampaigns: 0,
          totalCampaigns: 0,
          totalSpent: 0,
        },
        recentCampaigns: [],
        dealStatusBreakdown: [],
      };

      renderWithProviders(<BrandDashboard data={emptyBrandData} />);
      expect(screen.getByText(/No Campaigns Created/i)).toBeInTheDocument();
    });

    it("passes axe accessibility checks on BrandDashboard", async () => {
      const { container } = renderWithProviders(<BrandDashboard data={mockBrandData} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("InfluencerDashboard", () => {
    it("renders creator earnings overview formatted in INR from integer paise", () => {
      renderWithProviders(<InfluencerDashboard data={mockInfluencerData} userName="Aanya" />);

      // Total earnings ₹3,20,000
      expect(screen.getAllByText("₹3,20,000").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Hydration Bottle Campaign")).toBeInTheDocument();
      expect(screen.getByText(/Level 4/i)).toBeInTheDocument();
    });

    it("displays TDS Section 194-O statutory notice", () => {
      renderWithProviders(<InfluencerDashboard data={mockInfluencerData} />);

      expect(screen.getByText(new RegExp(`194-O|${TDS_194O_RATE_PERCENT_STRING}`, "i"))).toBeInTheDocument();
    });

    it("renders CreatorVisibilitySection with impressions and views", () => {
      renderWithProviders(<InfluencerDashboard data={mockInfluencerData} />);

      expect(screen.getByText("85,000")).toBeInTheDocument();
      expect(screen.getByText("3,200")).toBeInTheDocument();
    });

    it("passes axe accessibility checks on InfluencerDashboard", async () => {
      const { container } = renderWithProviders(<InfluencerDashboard data={mockInfluencerData} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("CreatorDiscoveryCard", () => {
    it("renders creator identity, niche, followers count and fair rate", () => {
      renderWithProviders(<CreatorDiscoveryCard creator={mockCreatorItem} />);

      expect(screen.getByText("Aanya Sharma")).toBeInTheDocument();
      expect(screen.getByText("@aanyafit")).toBeInTheDocument();
      expect(screen.getByText("85.0K")).toBeInTheDocument();
      expect(screen.getByText("₹25,000")).toBeInTheDocument();
    });

    it("handles bookmark click and invokes callback", async () => {
      const user = userEvent.setup();
      const mockToggleBookmark = vi.fn().mockResolvedValue(undefined);

      renderWithProviders(
        <CreatorDiscoveryCard
          creator={mockCreatorItem}
          onToggleBookmark={mockToggleBookmark}
        />
      );

      const bookmarkButton = screen.getByRole("button", { name: /Save creator|Bookmark/i });
      await user.click(bookmarkButton);

      expect(mockToggleBookmark).toHaveBeenCalledWith("inf-101", true);
    });

    it("passes axe accessibility checks on CreatorDiscoveryCard", async () => {
      const { container } = renderWithProviders(<CreatorDiscoveryCard creator={mockCreatorItem} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("CampaignDiscoveryCard", () => {
    it("renders campaign title, brand company name, formatted budget and deliverables", () => {
      renderWithProviders(<CampaignDiscoveryCard campaign={mockCampaignItem} />);

      expect(screen.getByText("Organic Superfood Reel Showcase")).toBeInTheDocument();
      expect(screen.getByText("PureRoots Organics")).toBeInTheDocument();
      expect(screen.getByText("₹35,000")).toBeInTheDocument();
      expect(screen.getByText(/IG Reel/i)).toBeInTheDocument();
      expect(screen.getByText(/IG Story/i)).toBeInTheDocument();
    });

    it("passes axe accessibility checks on CampaignDiscoveryCard", async () => {
      const { container } = renderWithProviders(<CampaignDiscoveryCard campaign={mockCampaignItem} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("FilterBottomSheet", () => {
    it("renders filter categories and budget ranges when open", () => {
      renderWithProviders(
        <FilterBottomSheet
          isOpen={true}
          onClose={vi.fn()}
          filters={{}}
          onApplyFilters={vi.fn()}
          mode="campaigns"
        />
      );

      expect(screen.getByText(/Filters & Sorting/i)).toBeInTheDocument();
      expect(screen.getByText("Tech & Gadgets")).toBeInTheDocument();
      expect(screen.getByText("₹15,000 – ₹50,000")).toBeInTheDocument();
    });

    it("calls onApplyFilters when user selects a category and clicks Apply", async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      const onClose = vi.fn();

      renderWithProviders(
        <FilterBottomSheet
          isOpen={true}
          onClose={onClose}
          filters={{}}
          onApplyFilters={onApply}
          mode="campaigns"
        />
      );

      const techChip = screen.getByRole("button", { name: "Tech & Gadgets" });
      await user.click(techChip);

      const applyButton = screen.getByRole("button", { name: /Apply Filters/i });
      await user.click(applyButton);

      expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ niche: "Tech & Gadgets" }));
      expect(onClose).toHaveBeenCalled();
    });

    it("resets filters when Reset button is clicked", async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();

      renderWithProviders(
        <FilterBottomSheet
          isOpen={true}
          onClose={vi.fn()}
          filters={{ niche: "Fitness & Health" }}
          onApplyFilters={onApply}
          mode="campaigns"
        />
      );

      const resetButton = screen.getByRole("button", { name: /Reset/i });
      await user.click(resetButton);

      expect(onApply).toHaveBeenCalledWith({});
    });

    it("passes axe accessibility checks on FilterBottomSheet", async () => {
      const { container } = renderWithProviders(
        <FilterBottomSheet
          isOpen={true}
          onClose={vi.fn()}
          filters={{}}
          onApplyFilters={vi.fn()}
          mode="creators"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("DiscoveryFeed", () => {
    it("renders search input, filter trigger and search state", () => {
      fetchMock.mockJson(/\/api\/campaigns/, {
        campaigns: [
          {
            id: "camp-001",
            title: "Summer Fitness Launch 2026",
            description: "Test description",
            totalBudgetPaise: 20000000,
            status: "ACTIVE",
            category: "FITNESS",
            brand: { companyName: "NutriPro" },
            deliverables: ["INSTAGRAM_REEL"],
          },
        ],
        nextCursor: null,
        hasMore: false,
      });

      renderWithProviders(<DiscoveryFeed mode="campaigns" />);

      expect(screen.getByPlaceholderText(/Search briefs, brands, or niches/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Open filter options|Filters/i })).toBeInTheDocument();
    });

    it("passes axe accessibility checks on DiscoveryFeed", async () => {
      fetchMock.mockJson(/\/api\/creators|\/api\/influencers/, {
        influencers: [],
        nextCursor: null,
        hasMore: false,
      });

      const { container } = renderWithProviders(<DiscoveryFeed mode="creators" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("AdminAnalyticsView", () => {
    const mockAdminData = {
      realTime: {
        totalUsers: 1420,
        totalInfluencers: 1100,
        totalBrands: 320,
        activeUsers7d: 840,
        activeDeals: 42,
        completedDealsToday: 6,
        revenueToday: 1250000,
        disputesOpen: 1,
      },
      growth: [
        { date: "2026-03-01", total: 1200, influencer: 950, brand: 250 },
        { date: "2026-03-15", total: 1420, influencer: 1100, brand: 320 },
      ],
      financials: {
        totalRevenue: 85000000, // ₹8,50,000
        totalGMV: 850000000, // ₹85,00,000
        gmvDataQuality: "VERIFIED" as const,
        actualResolvedRevenue: 85000000,
        bookedEscrowRevenue: 25000000,
        pendingPayouts: 18000000,
        totalRefunds: 0,
        revenueToday: 1250000,
        revenueHistory: [
          { month: "Jan", revenue: 25000000, gmv: 250000000 },
          { month: "Feb", revenue: 30000000, gmv: 300000000 },
          { month: "Mar", revenue: 30000000, gmv: 300000000 },
        ],
      },
      growthMetrics: {
        signupsLast30: 220,
        signupGrowthRate: 18.5,
        activationRate: 72.4,
        churnRate: 2.1,
        kFactor: 1.24,
        totalReferrals: 180,
        paymentSuccessRate: 99.1,
      },
      systemHealth: {
        recentErrors: 0,
        fraudAlerts: 0,
        paymentSuccessRate: 99.1,
        status: "OPERATIONAL",
      },
      activity: {
        activeDeals: 42,
        totalCompletedDeals: 480,
        disputesOpen: 1,
      },
    };

    it("renders operational and financial analytics metrics", () => {
      renderWithProviders(<AdminAnalyticsView data={mockAdminData} />);

      // Platform Real-time Metrics
      expect(screen.getByText("1.4K")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
      expect(screen.getAllByText("₹8,50,000").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("₹85,00,000").length).toBeGreaterThanOrEqual(1);
    });

    it("renders navigation tabs for Overview, Funnel, and Crons", () => {
      renderWithProviders(<AdminAnalyticsView data={mockAdminData} />);

      expect(screen.getByRole("tab", { name: /Overview/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Funnel/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Cron Health/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Traffic/i })).toBeInTheDocument();
    });

    it("passes axe accessibility checks on AdminAnalyticsView", async () => {
      const { container } = renderWithProviders(<AdminAnalyticsView data={mockAdminData} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
