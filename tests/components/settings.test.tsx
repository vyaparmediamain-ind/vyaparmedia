import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithProviders } from "../utils/render";
import { createFetchMock } from "../utils/fetch-mock";

// Priority 1 Components
import RatesTab from "@/components/dashboard/settings/RatesTab";
import { MarketRangeCard } from "@/components/pricing/MarketRangeCard";
import { FairPriceGuidanceCard } from "@/components/dashboard/settings/FairPriceGuidanceCard";
import SocialPlatformCard from "@/components/dashboard/settings/SocialPlatformCard";
import SecurityTab from "@/components/dashboard/settings/SecurityTab";
import { TelemetryConsentPanel } from "@/components/dashboard/settings/TelemetryConsentPanel";
import AuthenticityAuditCard from "@/components/dashboard/settings/AuthenticityAuditCard";
import BlockedUsersPanel from "@/components/dashboard/settings/BlockedUsersPanel";
import AppearanceTab from "@/components/dashboard/settings/AppearanceTab";
import type { Profile, User } from "@/components/dashboard/settings/ProfileTab";

describe("Component Tests: Settings Tabs & Cards (Priority 1)", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  const mockProfile: any = {
    displayName: "Ananya Sharma",
    handle: "ananyacreates",
    bio: "Lifestyle and fashion creator",
    category: "LIFESTYLE",
    state: "Maharashtra",
    city: "Mumbai",
    minRate: 500000, // 500000 paise (₹5,000)
    maxRate: 1500000, // 1500000 paise (₹15,000)
    storyRate: 200000,
    reelRate: 500000,
    videoRate: 1000000,
    deliverables: "Reels, Stories",
    audienceAge: "18-24",
    audienceGender: "FEMALE",
    topLocations: ["Mumbai", "Delhi"],
    experience: "3+ years",
    languages: ["Hindi", "English"],
  };

  const mockUser: any = {
    id: "usr_creator_123",
    email: "creator@example.com",
    name: "Ananya Sharma",
    userType: "INFLUENCER",
    phone: "+919876543210",
    emailVerified: true,
    phoneVerified: true,
    isTwoFactorEnabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = createFetchMock();
    fetchMock.install();

    // Setup global default mocks for sub-panel endpoints in SecurityTab
    fetchMock.mockJson("/api/pricing/me", {
      success: true,
      data: {
        profile: {
          id: "inf_123",
          displayName: "Ananya Sharma",
          fairRateMinPaise: 400000,
          fairRateMaxPaise: 600000,
          confidence: "HIGH",
          dataQuality: "VERIFIED",
          computedAt: new Date().toISOString(),
          engineVersion: "2.0",
        },
        latestEvaluation: null,
      },
    });

    fetchMock.mockJson("/api/settings/telemetry-consent", {
      success: true,
      data: {
        consent: false,
        consentAt: null,
        version: "1.0",
      },
    });

    fetchMock.mockJson("/api/settings", {
      success: true,
      settings: { twoFactorEnabled: false },
    });

    fetchMock.mockJson("/api/user/activity", {
      success: true,
      data: [],
    });

    fetchMock.mockJson("/api/users/block", {
      success: true,
      data: [],
    });

    fetchMock.mockJson("/api/influencers/audit", {
      success: true,
      data: {
        id: "inf_123",
        displayName: "Ananya",
        instagramHandle: "ananya",
        instagramFollowers: 30000,
        instagramEngagementRate: 3.5,
        followerAuthenticityScore: 88,
        contentQualityScore: 92,
        authenticityTier: "EXCELLENT",
        updatedAt: new Date().toISOString(),
      },
    });
  });

  describe("RatesTab & MarketRangeCard", () => {
    it("renders RatesTab with baseline rates in Rupees converted from paise", () => {
      const setProfile = vi.fn();
      renderWithProviders(<RatesTab profile={mockProfile} setProfile={setProfile} />);

      expect(screen.getByText("Your Rate Card")).toBeInTheDocument();
      const minInput = screen.getByLabelText(/Minimum General Rate/i) as HTMLInputElement;
      const maxInput = screen.getByLabelText(/Maximum General Rate/i) as HTMLInputElement;

      // 500000 paise / 100 = 5000
      expect(minInput.value).toBe("5000");
      expect(maxInput.value).toBe("15000");
    });

    it("triggers setProfile with integer paise when rate input is modified", async () => {
      const setProfile = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<RatesTab profile={mockProfile} setProfile={setProfile} />);

      const minInput = screen.getByLabelText(/Minimum General Rate/i);
      await user.clear(minInput);
      await user.type(minInput, "6000");

      expect(setProfile).toHaveBeenCalled();
    });

    it("renders MarketRangeCard populated state with quality flag and formatted currency", () => {
      renderWithProviders(
        <MarketRangeCard
          basePaise={500000}
          minPaise={400000}
          maxPaise={600000}
          confidence="HIGH"
          dataQuality="VERIFIED"
        />
      );

      // Check ₹ and paise formatted values
      expect(screen.getByRole("heading", { name: "Estimated Market Range" })).toBeInTheDocument();
      expect(screen.getByText(/₹4,000/i)).toBeInTheDocument();
      expect(screen.getByText(/Verified API Data/i)).toBeInTheDocument();
      expect(screen.getByText(/HIGH confidence/i)).toBeInTheDocument();
    });

    it("renders MarketRangeCard loading state with accessible status", () => {
      renderWithProviders(<MarketRangeCard isLoading={true} />);
      expect(screen.getByLabelText(/Loading estimated market range/i)).toBeInTheDocument();
    });

    it("renders MarketRangeCard error state with actionable retry button", async () => {
      const onRecompute = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <MarketRangeCard
          error="Unable to calculate benchmark range"
          onRecompute={onRecompute}
        />
      );

      expect(screen.getByText(/Unable to calculate benchmark range/i)).toBeInTheDocument();
      const retryBtn = screen.getByRole("button", { name: /Retry evaluation/i });
      await user.click(retryBtn);

      expect(onRecompute).toHaveBeenCalledTimes(1);
    });

    it("renders estimated and self-reported flags accurately", () => {
      renderWithProviders(
        <MarketRangeCard
          basePaise={300000}
          minPaise={250000}
          maxPaise={350000}
          dataQuality="ESTIMATED"
          flags={["LOW_ENGAGEMENT", "ESTIMATED_VIEWS"]}
        />
      );

      expect(screen.getByText(/Estimated Views/i)).toBeInTheDocument();
      expect(screen.getByText(/Engagement below tier benchmark/i)).toBeInTheDocument();
      expect(screen.getByText(/Views projected via reach estimator/i)).toBeInTheDocument();
    });

    it("passes axe accessibility checks on MarketRangeCard", async () => {
      const { container } = renderWithProviders(
        <MarketRangeCard
          basePaise={500000}
          minPaise={400000}
          maxPaise={600000}
          confidence="HIGH"
          dataQuality="VERIFIED"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("FairPriceGuidanceCard", () => {
    it("fetches pricing metrics from /api/pricing/me and renders MarketRangeCard", async () => {
      renderWithProviders(<FairPriceGuidanceCard quotedRatePaise={500000} />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Estimated Market Range" })).toBeInTheDocument();
      });

      expect(fetchMock.getCalls("/api/pricing/me").length).toBeGreaterThan(0);
    });
  });

  describe("SocialPlatformCard & SocialTab", () => {
    it("renders SocialPlatformCard with Instagram capability chips", () => {
      const onConnect = vi.fn();
      const onSync = vi.fn();
      const onDisconnect = vi.fn();

      renderWithProviders(
        <SocialPlatformCard
          platform="instagram"
          title="Instagram"
          handle="ananyasharma"
          onHandleChange={vi.fn()}
          connected={true}
          viewsAccess="ACTIVE"
          followersOrSubscribers={25000}
          engagementRate={3.45}
          isSaving={false}
          onConnect={onConnect}
          onSync={onSync}
          onDisconnect={onDisconnect}
        />
      );

      expect(screen.getByText("Instagram")).toBeInTheDocument();
      expect(screen.getByText("Views access: Active")).toBeInTheDocument();
      expect(screen.getByText("25K")).toBeInTheDocument();
      expect(screen.getByText("3.45%")).toBeInTheDocument();
    });

    it("handles sync and disconnect actions cleanly", async () => {
      const onSync = vi.fn();
      const onDisconnect = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <SocialPlatformCard
          platform="instagram"
          title="Instagram"
          handle="ananyasharma"
          onHandleChange={vi.fn()}
          connected={true}
          viewsAccess="ACTIVE"
          followersOrSubscribers={25000}
          engagementRate={3.45}
          isSaving={false}
          onConnect={vi.fn()}
          onSync={onSync}
          onDisconnect={onDisconnect}
        />
      );

      const syncBtn = screen.getByRole("button", { name: /Sync Instagram statistics/i });
      await user.click(syncBtn);
      expect(onSync).toHaveBeenCalledTimes(1);

      const disconnectBtn = screen.getByRole("button", { name: /Disconnect Instagram account/i });
      await user.click(disconnectBtn);
      expect(onDisconnect).toHaveBeenCalledTimes(1);
    });

    it("passes axe checks on SocialPlatformCard", async () => {
      const { container } = renderWithProviders(
        <SocialPlatformCard
          platform="instagram"
          title="Instagram"
          handle="ananyasharma"
          onHandleChange={vi.fn()}
          connected={true}
          viewsAccess="ACTIVE"
          followersOrSubscribers={25000}
          engagementRate={3.45}
          isSaving={false}
          onConnect={vi.fn()}
          onSync={vi.fn()}
          onDisconnect={vi.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("TelemetryConsentPanel", () => {
    it("fetches telemetry consent status and handles toggle action via POST", async () => {
      const showToast = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(<TelemetryConsentPanel showToast={showToast} />);

      await waitFor(() => {
        expect(screen.getByText(/Identified Profile Analytics & Visit Telemetry/i)).toBeInTheDocument();
      });

      expect(screen.getByText("Anonymous Only")).toBeInTheDocument();
      const toggleBtn = screen.getByRole("button", { name: /Allow Identified Analytics/i });

      // Click to toggle
      await user.click(toggleBtn);

      await waitFor(() => {
        const calls = fetchMock.getCalls("/api/settings/telemetry-consent");
        expect(calls.some(c => c.init?.method === "POST")).toBe(true);
      });
    });
  });

  describe("AuthenticityAuditCard", () => {
    it("renders authenticity audit score and tier badge", async () => {
      renderWithProviders(
        <AuthenticityAuditCard isInstagramConnected={true} showToast={vi.fn()} />
      );

      await waitFor(() => {
        expect(screen.getByText(/Audited Authenticity & Anti-Fraud/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/88 \/ 100/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/Audited: Authentic \(CAS 85\+\)/i)).toBeInTheDocument();
    });
  });

  describe("SecurityTab & BlockedUsersPanel", () => {
    it("renders security overview score based on verification factors", async () => {
      renderWithProviders(
        <SecurityTab
          user={mockUser}
          setUser={vi.fn()}
          isSaving={false}
          setIsSaving={vi.fn()}
          showToast={vi.fn()}
        />
      );

      expect(screen.getByText(/Account Security & Access Controls/i)).toBeInTheDocument();
      // Base 15 + email 25 + phone 25 = 65%
      expect(screen.getByText("65 / 100 Health Score")).toBeInTheDocument();
    });

    it("renders BlockedUsersPanel empty state when no users are blocked", async () => {
      renderWithProviders(<BlockedUsersPanel showToast={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/You haven't blocked any accounts/i)).toBeInTheDocument();
      });
    });
  });

  describe("AppearanceTab", () => {
    it("renders theme selection options without errors", () => {
      renderWithProviders(<AppearanceTab />);
      expect(screen.getByText(/Theme & Display Preferences/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Light Mode/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Dark Mode/i })).toBeInTheDocument();
    });
  });
});
