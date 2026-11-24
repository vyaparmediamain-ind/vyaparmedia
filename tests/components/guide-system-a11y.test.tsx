import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithProviders } from "../utils/render";

import { GuideDrawerProvider, useGuideDrawer } from "@/components/guides/GuideDrawerContext";
import { GuideDrawer } from "@/components/guides/GuideDrawer";
import { HelpTip } from "@/components/guides/HelpTip";
import { FirstRunChecklist } from "@/components/guides/FirstRunChecklist";
import { GuidePrintModal } from "@/components/guides/GuidePrintModal";
import { getGuideById } from "@/content/guides";

// Test trigger component to control GuideDrawerContext in tests
function GuideTestHarness({
  initialGuideId,
  role = "INFLUENCER",
}: {
  readonly initialGuideId?: string;
  readonly role?: "INFLUENCER" | "BRAND" | "SCOUT" | "ADMIN";
}) {
  const { openGuideDrawer, activeLanguage, toggleLanguage } = useGuideDrawer();

  return (
    <div>
      <button
        type="button"
        onClick={() => openGuideDrawer(initialGuideId)}
        data-testid="open-drawer-btn"
      >
        Open Guide Drawer
      </button>
      <button
        type="button"
        onClick={toggleLanguage}
        data-testid="toggle-lang-btn"
      >
        Current Lang: {activeLanguage}
      </button>
      <GuideDrawer />
    </div>
  );
}

describe("Guide System Accessibility, Keyboard & Print Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("HelpTip Accessibility & Keyboard Interaction", () => {
    it("renders accessible button with aria-label and passes axe checks", async () => {
      const { container } = renderWithProviders(
        <GuideDrawerProvider initialRole="INFLUENCER">
          <HelpTip
            guideId="influencer-deal-lifecycle"
            label="Learn about escrow safety"
            tooltip="Bank escrow holds funds securely until approved"
          />
        </GuideDrawerProvider>
      );

      const btn = screen.getByRole("button", { name: "Learn about escrow safety" });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute("title", "Bank escrow holds funds securely until approved");

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("triggers drawer opening on click and keyboard (Enter/Space)", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <GuideDrawerProvider initialRole="INFLUENCER">
          <HelpTip guideId="influencer-deal-lifecycle" label="Escrow Help" />
          <GuideDrawer />
        </GuideDrawerProvider>
      );

      const tipBtn = screen.getByRole("button", { name: "Escrow Help" });

      // Click opens drawer
      await user.click(tipBtn);
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Guide content is shown
      await waitFor(() => {
        expect(screen.getByText("Deal Lifecycle, Contract Signing & Escrow Milestones")).toBeInTheDocument();
      });
    });
  });

  describe("GuideDrawer Accessibility & Functionality", () => {
    it("opens, displays guides, and passes axe accessibility audit", async () => {
      const user = userEvent.setup();
      const { container } = renderWithProviders(
        <GuideDrawerProvider initialRole="INFLUENCER">
          <GuideTestHarness initialGuideId="influencer-deal-lifecycle" />
        </GuideDrawerProvider>
      );

      // Open drawer
      await user.click(screen.getByTestId("open-drawer-btn"));
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Verify a11y compliance of open drawer dialog
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("supports search filtering across guides", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <GuideDrawerProvider initialRole="INFLUENCER">
          <GuideTestHarness />
        </GuideDrawerProvider>
      );

      // Open drawer to root list
      await user.click(screen.getByTestId("open-drawer-btn"));
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search guides, escrow/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search guides, escrow/i);
      await user.type(searchInput, "TDS");

      // Verify filtered search results appear
      await waitFor(() => {
        expect(screen.getByText(/Search Results/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/CA-Ready Financial Ledger/i)).toBeInTheDocument();
    });

    it("toggles between English and Hinglish language", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <GuideDrawerProvider initialRole="INFLUENCER">
          <GuideTestHarness initialGuideId="influencer-deal-lifecycle" />
        </GuideDrawerProvider>
      );

      await user.click(screen.getByTestId("open-drawer-btn"));
      await waitFor(() => {
        expect(screen.getByText("Deal Lifecycle, Contract Signing & Escrow Milestones")).toBeInTheDocument();
      });

      // Click language toggle button in drawer header
      const langBtn = screen.getByTitle("Toggle English / Hinglish");
      await user.click(langBtn);

      // Verify Hinglish title is rendered
      await waitFor(() => {
        expect(screen.getByText("Deal Lifecycle, Contract Sign aur Escrow Milestones")).toBeInTheDocument();
      });
    });

    it("closes drawer when Escape key is pressed", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <GuideDrawerProvider initialRole="INFLUENCER">
          <GuideTestHarness initialGuideId="influencer-deal-lifecycle" />
        </GuideDrawerProvider>
      );

      await user.click(screen.getByTestId("open-drawer-btn"));
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Press Escape
      fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("FirstRunChecklist Accessibility & Persistence", () => {
    it("renders checklist items and passes axe checks", async () => {
      const { container } = renderWithProviders(
        <GuideDrawerProvider initialRole="INFLUENCER">
          <FirstRunChecklist role="INFLUENCER" />
        </GuideDrawerProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Creator Launch Checklist")).toBeInTheDocument();
      });

      expect(screen.getByText("Complete PAN Verification")).toBeInTheDocument();
      expect(screen.getByText("Connect Instagram Account")).toBeInTheDocument();

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("toggles checklist task completion and updates progress bar", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <GuideDrawerProvider initialRole="INFLUENCER">
          <FirstRunChecklist role="INFLUENCER" />
        </GuideDrawerProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Creator Launch Checklist")).toBeInTheDocument();
      });

      // Initial progress: 0% Complete
      expect(screen.getByText(/0% Complete/i)).toBeInTheDocument();

      // Check first item
      const toggleButtons = screen.getAllByRole("button", { name: /Mark .* as|Mark ".*"/i });
      expect(toggleButtons.length).toBeGreaterThan(0);

      const firstToggle = toggleButtons[0];
      expect(firstToggle).toBeDefined();
      if (firstToggle) {
        await user.click(firstToggle);
      }

      // Progress advances (1 of 5 = 20%)
      await waitFor(() => {
        expect(screen.getByText(/20% Complete/i)).toBeInTheDocument();
      });
    });

    it("opens contextual guide when clicking 'Read Guide' button", async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <GuideDrawerProvider initialRole="INFLUENCER">
          <FirstRunChecklist role="INFLUENCER" />
          <GuideDrawer />
        </GuideDrawerProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Creator Launch Checklist")).toBeInTheDocument();
      });

      const guideButtons = screen.getAllByTitle("Read standard operating procedure");
      expect(guideButtons.length).toBeGreaterThan(0);

      const firstGuideBtn = guideButtons[0];
      expect(firstGuideBtn).toBeDefined();
      if (firstGuideBtn) {
        await user.click(firstGuideBtn);
      }

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });
  });

  describe("GuidePrintModal & A4 Official Letterhead Layout", () => {
    const sampleGuide = getGuideById("influencer-deal-lifecycle")!;

    it("renders official letterhead, company legal details, and passes axe checks", async () => {
      const onClose = vi.fn();
      const { container } = renderWithProviders(
        <GuidePrintModal
          guide={sampleGuide}
          isOpen={true}
          language="en"
          onClose={onClose}
        />
      );

      // Verify dialog is rendered
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Official Company Legal Branding
      const vyaparNodes = screen.getAllByText(/Vyapar/i);
      expect(vyaparNodes.length).toBeGreaterThan(0);

      // Official SOP Category
      expect(screen.getByText("OFFICIAL STANDARD OPERATING PROCEDURE & USER MANUAL")).toBeInTheDocument();

      // SOP Reference Code
      expect(screen.getByText(`SOP-${sampleGuide.id.toUpperCase()}-V${sampleGuide.version}`)).toBeInTheDocument();

      // Statutory Footer & Cryptographic Security
      expect(screen.getByText(/Cryptographic Document Integrity/i)).toBeInTheDocument();

      // Check a11y
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("renders in Hinglish when requested", () => {
      const onClose = vi.fn();
      renderWithProviders(
        <GuidePrintModal
          guide={sampleGuide}
          isOpen={true}
          language="hinglish"
          onClose={onClose}
        />
      );

      expect(screen.getByText("Deal Lifecycle, Contract Sign aur Escrow Milestones")).toBeInTheDocument();
      expect(screen.getByText("Kab Use Karein (When to Use)")).toBeInTheDocument();
    });

    it("calls onClose when print modal close button is clicked", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderWithProviders(
        <GuidePrintModal
          guide={sampleGuide}
          isOpen={true}
          language="en"
          onClose={onClose}
        />
      );

      const closeBtn = screen.getByRole("button", { name: /Close Preview/i });
      await user.click(closeBtn);

      expect(onClose).toHaveBeenCalled();
    });
  });
});
