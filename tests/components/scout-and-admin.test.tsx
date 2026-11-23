import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithProviders } from "../utils/render";
import { createFetchMock } from "../utils/fetch-mock";

// Components under test
import ScoutDashboardClient from "@/components/scout/ScoutDashboardClient";
import ScoutVerificationGate from "@/components/scout/ScoutVerificationGate";
import FeatureFlagManager from "@/components/admin/system/FeatureFlagManager";
import ReportConfigManager from "@/components/admin/system/ReportConfigManager";
import CronHeartbeatsCard from "@/components/admin/system/CronHeartbeatsCard";
import InstagramInsightsCard from "@/components/admin/system/InstagramInsightsCard";

// Mock QRCode library to avoid canvas issues in jsdom
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mockqr"),
  },
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mockqr"),
}));

describe("Scout & Admin Consoles Component Suite (Priority 11 & 12)", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = createFetchMock();
    fetchMock.install();
  });

  const mockScoutDashboardData = {
    isRegistered: true,
    verificationStatus: "APPROVED" as const,
    scoutCode: "SCOUT-MUM-42",
    scoutProfile: {
      fullName: "Rohan Verma",
      city: "Mumbai",
      college: "IIT Bombay",
      royaltyPercent: 5.0,
      isRoyaltyPaused: false,
      streakMonths: 4,
      totalRoyaltyEarnedPaise: 4500000, // ₹45,000
    },
    monthlyQuota: {
      isMet: true,
      reason: "Quota requirement fulfilled",
      targetCount: 5,
      currentMonthNewVerified: 6,
      currentMonthDeals: 12,
      isExempt: false,
      exemptUntil: null,
      daysRemaining: 14,
    },
    networkStats: {
      totalOnboarded: 24,
      verifiedCreators: 18,
      pendingCreators: 3,
      verifiedBrands: 3,
      pendingBrands: 0,
    },
    financials: {
      lifetimeRoyaltyPaise: 4500000,
      thisMonthRoyaltyPaise: 1250000,
    },
    shareableLinks: {
      creatorInviteLink: "https://vyaparmedia.in/join?scout=SCOUT-MUM-42&role=creator",
      brandInviteLink: "https://vyaparmedia.in/join?scout=SCOUT-MUM-42&role=brand",
      generalInviteLink: "https://vyaparmedia.in/join?scout=SCOUT-MUM-42",
    },
  };

  const mockScoutNetwork = [
    {
      id: "net-001",
      name: "Sneha Kapur",
      handle: "snehacreates",
      userType: "CREATOR" as const,
      joinedAt: "2026-02-10T12:00:00Z",
      isVerified: true,
      status: "VERIFIED" as const,
      dealsCompleted: 3,
      totalVolumePaise: 7500000,
      nudgeUrl: "/api/scout/nudge/net-001",
    },
  ];

  describe("ScoutDashboardClient", () => {
    it("renders scout code, royalty metrics and quota progress", async () => {
      fetchMock.mockJson(/\/api\/scout\/dashboard/, {
        success: true,
        data: mockScoutDashboardData,
      });
      fetchMock.mockJson(/\/api\/scout\/network/, {
        success: true,
        network: mockScoutNetwork,
      });

      renderWithProviders(<ScoutDashboardClient />);

      await waitFor(() => {
        expect(screen.getAllByText(/SCOUT-MUM-42/).length).toBeGreaterThanOrEqual(1);
      });

      expect(screen.getByText(/Rohan Verma/)).toBeInTheDocument();
      expect(screen.getByText("₹45,000")).toBeInTheDocument();
      expect(screen.getByText("Sneha Kapur")).toBeInTheDocument();
      expect(screen.getByText("snehacreates")).toBeInTheDocument();
    });

    it("passes axe accessibility checks on ScoutDashboardClient", async () => {
      fetchMock.mockJson(/\/api\/scout\/dashboard/, {
        success: true,
        data: mockScoutDashboardData,
      });
      fetchMock.mockJson(/\/api\/scout\/network/, {
        success: true,
        network: mockScoutNetwork,
      });

      const { container } = renderWithProviders(<ScoutDashboardClient />);

      await waitFor(() => {
        expect(screen.getAllByText(/SCOUT-MUM-42/).length).toBeGreaterThanOrEqual(1);
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("ScoutVerificationGate", () => {
    it("renders registration onboarding form when user is NOT_REGISTERED", async () => {
      fetchMock.mockJson(/\/api\/scout\/verification/, {
        success: true,
        isRegistered: false,
        verificationStatus: "NOT_REGISTERED",
        rejectionReason: null,
        scoutCode: null,
        scoutProfile: null,
      });

      renderWithProviders(<ScoutVerificationGate />);

      await waitFor(() => {
        expect(screen.getByText(/Vyapar Scout|Identity Verification/i)).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText(/Rahul Sharma/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/MNIT Jaipur/i)).toBeInTheDocument();
    });

    it("renders review in progress banner when status is PENDING", async () => {
      fetchMock.mockJson(/\/api\/scout\/verification/, {
        success: true,
        isRegistered: true,
        verificationStatus: "PENDING",
        rejectionReason: null,
        scoutCode: null,
        scoutProfile: {
          fullName: "Rohan Verma",
          city: "Mumbai",
          college: "IIT Bombay",
        },
      });

      renderWithProviders(<ScoutVerificationGate />);

      await waitFor(() => {
        expect(screen.getByText("Scout Verification Under Review")).toBeInTheDocument();
      });
    });

    it("renders rejection notice with reason when status is REJECTED", async () => {
      fetchMock.mockJson(/\/api\/scout\/verification/, {
        success: true,
        isRegistered: true,
        verificationStatus: "REJECTED",
        rejectionReason: "College ID proof was blurry or expired.",
        scoutCode: null,
        scoutProfile: {
          fullName: "Rohan Verma",
          city: "Mumbai",
          college: "IIT Bombay",
        },
      });

      renderWithProviders(<ScoutVerificationGate />);

      await waitFor(() => {
        expect(screen.getByText(/College ID proof was blurry or expired/i)).toBeInTheDocument();
      });
    });

    it("calls onApproved callback when status is APPROVED", async () => {
      const onApproved = vi.fn();
      fetchMock.mockJson(/\/api\/scout\/verification/, {
        success: true,
        isRegistered: true,
        verificationStatus: "APPROVED",
        rejectionReason: null,
        scoutCode: "SCOUT-123",
        scoutProfile: {
          fullName: "Rohan Verma",
          city: "Mumbai",
          college: "IIT Bombay",
        },
      });

      renderWithProviders(<ScoutVerificationGate onApproved={onApproved} />);

      await waitFor(() => {
        expect(onApproved).toHaveBeenCalled();
      });
    });

    it("passes axe accessibility checks on ScoutVerificationGate", async () => {
      fetchMock.mockJson(/\/api\/scout\/verification/, {
        success: true,
        isRegistered: false,
        verificationStatus: "NOT_REGISTERED",
        rejectionReason: null,
        scoutCode: null,
        scoutProfile: null,
      });

      const { container } = renderWithProviders(<ScoutVerificationGate />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Rahul Sharma/i)).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("FeatureFlagManager", () => {
    const mockFlags = [
      {
        key: "ENABLE_INSTAGRAM_GRAPH_V2",
        enabled: true,
        rolloutPercentage: 100,
        allowedRoles: ["ADMIN", "BRAND", "INFLUENCER"],
        description: "Enables Graph API v2 ingestion for real-time engagement telemetry.",
        updatedAt: "2026-03-01T10:00:00Z",
      },
      {
        key: "ENABLE_ESCROW_INSTANT_SETTLE",
        enabled: false,
        rolloutPercentage: 0,
        allowedRoles: ["ADMIN"],
        description: "Zero-latency escrow release following automated brand confirmation.",
        updatedAt: "2026-03-01T10:00:00Z",
      },
    ];

    it("renders feature flags list and filters by search query", async () => {
      const user = userEvent.setup();
      fetchMock.mockJson(/\/api\/admin\/system\/feature-flags/, {
        success: true,
        data: mockFlags,
      });

      renderWithProviders(<FeatureFlagManager onShowToast={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("ENABLE_INSTAGRAM_GRAPH_V2")).toBeInTheDocument();
      });

      expect(screen.getByText("ENABLE_ESCROW_INSTANT_SETTLE")).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText(/Search flags/i);
      await user.type(searchInput, "GRAPH");

      expect(screen.getByText("ENABLE_INSTAGRAM_GRAPH_V2")).toBeInTheDocument();
      expect(screen.queryByText("ENABLE_ESCROW_INSTANT_SETTLE")).not.toBeInTheDocument();
    });

    it("passes axe accessibility checks on FeatureFlagManager", async () => {
      fetchMock.mockJson(/\/api\/admin\/system\/feature-flags/, {
        success: true,
        data: mockFlags,
      });

      const { container } = renderWithProviders(<FeatureFlagManager onShowToast={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("ENABLE_INSTAGRAM_GRAPH_V2")).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("ReportConfigManager", () => {
    it("renders statutory configuration parameters checklist", () => {
      renderWithProviders(<ReportConfigManager />);

      expect(screen.getByText(/Statutory Report Configuration/i)).toBeInTheDocument();
      expect(screen.getByText("Company Legal Name")).toBeInTheDocument();
      expect(screen.getByText("Company GSTIN")).toBeInTheDocument();
    });

    it("passes axe accessibility checks on ReportConfigManager", async () => {
      const { container } = renderWithProviders(<ReportConfigManager />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("CronHeartbeatsCard", () => {
    const mockCronHealth = {
      overallStatus: "HEALTHY" as const,
      failingJobsCount: 0,
      jobs: [
        {
          id: "job-01",
          name: "Escrow Auto-Settlement Worker",
          path: "/api/cron/escrow-settle",
          cron: "0 * * * *",
          status: "SUCCESS" as const,
          lastRunIst: "23 Nov 2026, 07:00 PM IST",
          durationMs: 420,
          error: null,
          isDelayed: false,
        },
        {
          id: "job-02",
          name: "DRS Recalculation Engine",
          path: "/api/cron/drs-recalc",
          cron: "0 2 * * *",
          status: "SUCCESS" as const,
          lastRunIst: "23 Nov 2026, 02:00 AM IST",
          durationMs: 1850,
          error: null,
          isDelayed: false,
        },
      ],
    };

    it("renders cron health status and job run details", async () => {
      fetchMock.mockJson(/\/api\/admin\/system\/cron-health/, {
        success: true,
        data: mockCronHealth,
      });

      renderWithProviders(<CronHeartbeatsCard />);

      await waitFor(() => {
        expect(screen.getByText("Escrow Auto-Settlement Worker")).toBeInTheDocument();
      });

      expect(screen.getByText("DRS Recalculation Engine")).toBeInTheDocument();
      expect(screen.getByText("420ms")).toBeInTheDocument();
      expect(screen.getAllByText("HEALTHY").length).toBeGreaterThanOrEqual(1);
    });

    it("passes axe accessibility checks on CronHeartbeatsCard", async () => {
      fetchMock.mockJson(/\/api\/admin\/system\/cron-health/, {
        success: true,
        data: mockCronHealth,
      });

      const { container } = renderWithProviders(<CronHeartbeatsCard />);

      await waitFor(() => {
        expect(screen.getByText("Escrow Auto-Settlement Worker")).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("InstagramInsightsCard", () => {
    const mockSocialInsights = {
      total: 124,
      active: 118,
      insightsActive: 104,
      insightsMissing: 14,
      unknownScope: 0,
      personalAccount: 6,
      needsReconnect: 2,
    };

    it("renders Instagram connection metrics and insights status", async () => {
      fetchMock.mockJson(/\/api\/admin\/system\/social-insights/, {
        success: true,
        data: mockSocialInsights,
      });

      renderWithProviders(<InstagramInsightsCard />);

      await waitFor(() => {
        expect(screen.getByText("Instagram Insights Scope Status")).toBeInTheDocument();
      });

      expect(screen.getByText("124")).toBeInTheDocument();
      expect(screen.getByText("104")).toBeInTheDocument();
      expect(screen.getByText("14")).toBeInTheDocument();
    });

    it("passes axe accessibility checks on InstagramInsightsCard", async () => {
      fetchMock.mockJson(/\/api\/admin\/system\/social-insights/, {
        success: true,
        data: mockSocialInsights,
      });

      const { container } = renderWithProviders(<InstagramInsightsCard />);

      await waitFor(() => {
        expect(screen.getByText("Instagram Insights Scope Status")).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
