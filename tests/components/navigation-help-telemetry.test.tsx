import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithProviders } from "../utils/render";
import { createFetchMock } from "../utils/fetch-mock";

// Components under test
import DesktopSidebar from "@/components/navigation/DesktopSidebar";
import MobileBottomBar from "@/components/navigation/MobileBottomBar";
import RoleGuard from "@/components/navigation/RoleGuard";
import BetaModeBanner from "@/components/navigation/BetaModeBanner";
import HelpCenterClient from "@/components/help/HelpCenterClient";
import { TelemetryConsentBanner } from "@/components/telemetry/TelemetryConsentBanner";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";

describe("Navigation, Help, Consent & Telemetry Component Suite (Priority 13-16)", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = createFetchMock();
    fetchMock.install();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("DesktopSidebar & MobileBottomBar (Role-based Navigation)", () => {
    it("renders influencer navigation items for INFLUENCER role", () => {
      renderWithProviders(
        <DesktopSidebar
          userType="INFLUENCER"
          user={{ name: "Pooja Roy", userType: "INFLUENCER" }}
          unreadCount={3}
          activeDealsCount={2}
        />
      );

      // Influencer Nav tabs: Home, Discover, Deals, Messages, Profile
      expect(screen.getByRole("tab", { name: /Home/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Discover/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Deals/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Messages/i })).toBeInTheDocument();

      // Quick links
      expect(screen.getByRole("link", { name: /Escrow Wallet/i })).toBeInTheDocument();

      // Should show badges
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("renders brand navigation items including Creators for BRAND role", () => {
      renderWithProviders(
        <DesktopSidebar
          userType="BRAND"
          user={{ name: "Acme Corp", userType: "BRAND" }}
        />
      );

      // Brand Nav has Creators Directory & Campaigns
      expect(screen.getByRole("tab", { name: /Discover.*Creator/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Manage.*Campaign/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Create a new influencer marketing campaign/i })).toBeInTheDocument();
    });

    it("renders bottom bar navigation on mobile", () => {
      renderWithProviders(
        <MobileBottomBar
          userType="INFLUENCER"
          unreadCount={1}
          activeDealsCount={0}
        />
      );

      expect(screen.getByRole("navigation")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Home/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Deals/i })).toBeInTheDocument();
    });

    it("passes axe accessibility checks on DesktopSidebar", async () => {
      const { container } = renderWithProviders(
        <DesktopSidebar
          userType="BRAND"
          user={{ name: "Test Brand", userType: "BRAND" }}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("passes axe accessibility checks on MobileBottomBar", async () => {
      const { container } = renderWithProviders(
        <MobileBottomBar userType="INFLUENCER" />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("RoleGuard", () => {
    it("renders children when user role is permitted for the path", () => {
      renderWithProviders(
        <RoleGuard userType="BRAND">
          <div data-testid="protected-content">Authorized Brand Content</div>
        </RoleGuard>
      );

      expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    });
  });

  describe("BetaModeBanner", () => {
    it("renders invite-only beta banner when enabled", async () => {
      fetchMock.mockJson(/\/api\/auth\/registration-config/, {
        success: true,
        requireReferral: true,
        inviteOnly: true,
      });

      renderWithProviders(<BetaModeBanner />);

      await waitFor(() => {
        expect(screen.getByText(/VyaparMedia Private Beta Testing/i)).toBeInTheDocument();
      });
    });

    it("allows dismissing banner into sessionStorage", async () => {
      const user = userEvent.setup();
      fetchMock.mockJson(/\/api\/auth\/registration-config/, {
        success: true,
        requireReferral: true,
        inviteOnly: true,
      });

      renderWithProviders(<BetaModeBanner />);

      await waitFor(() => {
        expect(screen.getByText(/VyaparMedia Private Beta Testing/i)).toBeInTheDocument();
      });

      const dismissButton = screen.getByRole("button", { name: /Minimize beta banner/i });
      await user.click(dismissButton);

      expect(sessionStorage.getItem("vm_beta_banner_dismissed")).toBe("true");
    });

    it("passes axe accessibility checks on BetaModeBanner", async () => {
      fetchMock.mockJson(/\/api\/auth\/registration-config/, {
        success: true,
        requireReferral: true,
        inviteOnly: true,
      });

      const { container } = renderWithProviders(<BetaModeBanner />);

      await waitFor(() => {
        expect(screen.getByText(/VyaparMedia Private Beta Testing/i)).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("HelpCenterClient", () => {
    it("renders FAQ categories and toggles question answers", async () => {
      const user = userEvent.setup();
      renderWithProviders(<HelpCenterClient />);

      // Verify category buttons
      expect(screen.getByRole("button", { name: /All Topics/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Getting Started/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Payments & Escrow/i })).toBeInTheDocument();

      // Find an accordion question that starts collapsed
      const question = screen.getByRole("button", {
        name: /Can I use VyaparMedia as both a Creator and a Brand/i,
      });
      expect(question).toHaveAttribute("aria-expanded", "false");

      // Click to toggle accordion open
      await user.click(question);

      expect(
        screen.getByText(/During registration, you select your primary role/i)
      ).toBeInTheDocument();
      expect(question).toHaveAttribute("aria-expanded", "true");
    });

    it("filters questions based on search query", async () => {
      const user = userEvent.setup();
      renderWithProviders(<HelpCenterClient />);

      const searchInput = screen.getByRole("textbox", {
        name: /Search help articles by keyword/i,
      });
      await user.type(searchInput, "TDS");

      expect(screen.getByText(/What are the TDS \(Tax Deducted at Source\) deduction rates\?/i)).toBeInTheDocument();
    });

    it("passes axe accessibility checks on HelpCenterClient", async () => {
      const { container } = renderWithProviders(<HelpCenterClient />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("TelemetryConsentBanner", () => {
    it("renders DPDP consent banner when not previously dismissed", () => {
      renderWithProviders(<TelemetryConsentBanner />);

      expect(screen.getByText("Privacy & Analytics Notice")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Accept Identified Analytics/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Anonymous Only/i })).toBeInTheDocument();
    });

    it("dismisses banner and calls API when user accepts", async () => {
      const user = userEvent.setup();
      fetchMock.mockJson(/\/api\/settings\/telemetry-consent/, { success: true });

      renderWithProviders(<TelemetryConsentBanner />);

      const acceptButton = screen.getByRole("button", { name: /Accept Identified Analytics/i });
      await user.click(acceptButton);

      expect(localStorage.getItem("vm_telemetry_banner_dismissed_v1")).toBe("true");
      expect(screen.queryByText("Privacy & Analytics Notice")).not.toBeInTheDocument();
    });

    it("passes axe accessibility checks on TelemetryConsentBanner", async () => {
      const { container } = renderWithProviders(<TelemetryConsentBanner />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("PageViewTracker", () => {
    let originalSendBeacon: typeof navigator.sendBeacon;
    let beaconCalls: Array<{ url: string; data: string }> = [];

    beforeEach(() => {
      beaconCalls = [];
      originalSendBeacon = navigator.sendBeacon;
      navigator.sendBeacon = vi.fn().mockImplementation((url: string | URL, data?: BodyInit | null) => {
        let text = "";
        if (data instanceof Blob) {
          text = "BLOB";
        } else if (typeof data === "string") {
          text = data;
        }
        beaconCalls.push({ url: url.toString(), data: text });
        return true;
      });
    });

    afterEach(() => {
      navigator.sendBeacon = originalSendBeacon;
    });

    it("renders without DOM output and tracks active dwell time on visibility change", () => {
      let mockTime = 1000;
      vi.spyOn(performance, "now").mockImplementation(() => mockTime);

      const { container } = renderWithProviders(<PageViewTracker />);
      expect(container.firstChild).toBeNull();

      mockTime += 3000;

      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });

      document.dispatchEvent(new Event("visibilitychange"));

      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        "/api/telemetry/track",
        expect.any(Blob)
      );
    });

    it("ignores dwell time < 1000ms (debounces brief tab flashes)", () => {
      let mockTime = 1000;
      vi.spyOn(performance, "now").mockImplementation(() => mockTime);

      renderWithProviders(<PageViewTracker />);

      mockTime += 400;

      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });

      document.dispatchEvent(new Event("visibilitychange"));

      expect(navigator.sendBeacon).not.toHaveBeenCalled();
    });
  });
});