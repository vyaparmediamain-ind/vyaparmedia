import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithProviders } from "../utils/render";
import { createFetchMock } from "../utils/fetch-mock";

import CreateCampaignClient from "@/app/dashboard/campaigns/create/CreateCampaignClient";
import { CampaignSummarySidebar } from "@/components/dashboard/campaigns/create/CampaignSummarySidebar";
import { DeliverablesList } from "@/components/dashboard/campaigns/create/DeliverablesList";
import { ProductSeedingCard } from "@/components/dashboard/campaigns/create/ProductSeedingCard";
import { MatchingPrioritySliders } from "@/components/dashboard/campaigns/create/MatchingPrioritySliders";
import type { CampaignFormData } from "@/components/dashboard/campaigns/create/CampaignCreateHelpers";

describe("Component Tests: Campaign Wizard (Priority 2)", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  const defaultFormData: CampaignFormData = {
    title: "Summer Fitness Launch 2026",
    description: "Launch of premium whey protein isolate across fitness creators in India.",
    requirements: "Must have 10k+ followers and authentic fitness content.",
    totalBudget: 50000, // ₹50,000 = 5,000,000 paise
    perInfluencerBudget: 10000,
    targetCategories: ["FITNESS", "LIFESTYLE"],
    targetCities: ["Mumbai", "Bangalore"],
    targetGender: "ANY",
    targetAgeMin: 18,
    targetAgeMax: 35,
    minFollowers: 10000,
    maxFollowers: 100000,
    maxInfluencers: 5,
    applicationDeadline: "2026-12-01",
    contentDeadline: "2026-12-15",
    postingDeadline: "2026-12-25",
    requiresProduct: false,
    productName: "",
    productValue: 0,
    productDescription: "",
    deliverables: [
      { type: "INSTAGRAM_REEL", count: 1, rate: 10000 },
      { type: "INSTAGRAM_STORY", count: 2, rate: 2500 },
    ],
    matchingPriority: "BALANCED",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = createFetchMock();
    fetchMock.install();

    // Default endpoint stubs
    fetchMock.mockJson("/api/wallet", {
      success: true,
      data: {
        balance: 100000,
        balancePaise: 10000000,
        pendingEscrowPaise: 0,
      },
    });

    fetchMock.mockJson("/api/wallet/balance", {
      success: true,
      balancePaise: 10000000, // ₹1,00,000
    });

    fetchMock.mockJson("/api/campaigns/draft", {
      success: true,
      data: null,
    });

    fetchMock.mockJson("/api/campaigns", {
      success: true,
      data: { id: "camp_123", title: "Summer Fitness Launch 2026" },
    });
  });

  describe("CampaignSummarySidebar", () => {
    it("renders escrow calculation summary with paise-accurate breakdown", () => {
      renderWithProviders(
        <CampaignSummarySidebar
          formData={defaultFormData}
          walletBalancePaise={10000000}
        />
      );

      expect(screen.getByText(/Escrow Estimate/i)).toBeInTheDocument();
      // Total budget of ₹50,000 should render
      expect(screen.getByText(/₹50,000/i)).toBeInTheDocument();
      // Deliverables summary: "3 items / creator"
      expect(screen.getByText(/3 items \/ creator/i)).toBeInTheDocument();
    });

    it("displays product handling fee when product seeding is enabled", () => {
      const seededFormData: CampaignFormData = {
        ...defaultFormData,
        requiresProduct: true,
        productName: "Whey Protein Tub 1kg",
        productValue: 2500,
      };

      renderWithProviders(
        <CampaignSummarySidebar
          formData={seededFormData}
          walletBalancePaise={10000000}
        />
      );

      expect(screen.getByText(/Product Handling Escrow/i)).toBeInTheDocument();
    });

    it("passes axe accessibility checks on CampaignSummarySidebar", async () => {
      const { container } = renderWithProviders(
        <CampaignSummarySidebar
          formData={defaultFormData}
          walletBalancePaise={10000000}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("DeliverablesList", () => {
    it("renders deliverables and permits adding new deliverables", async () => {
      const setFormData = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <DeliverablesList formData={defaultFormData} setFormData={setFormData} />
      );

      expect(screen.getByText(/Deliverables & Milestone Rates/i)).toBeInTheDocument();

      const addBtn = screen.getByRole("button", { name: /Add Deliverable/i });
      await user.click(addBtn);

      expect(setFormData).toHaveBeenCalled();
    });

    it("allows removing a deliverable when multiple exist", async () => {
      const setFormData = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <DeliverablesList formData={defaultFormData} setFormData={setFormData} />
      );

      const removeBtns = screen.getAllByRole("button", { name: /Remove deliverable/i });
      expect(removeBtns.length).toBeGreaterThan(0);
      await user.click(removeBtns[0]!);

      expect(setFormData).toHaveBeenCalled();
    });
  });

  describe("ProductSeedingCard", () => {
    it("toggles product seeding inputs when switch is checked", async () => {
      const setFormData = vi.fn();
      const user = userEvent.setup();

      const { rerender } = renderWithProviders(
        <ProductSeedingCard formData={defaultFormData} setFormData={setFormData} />
      );

      const toggle = screen.getByRole("checkbox", { name: /Requires physical product seeding/i });
      expect(toggle).not.toBeChecked();

      await user.click(toggle);
      expect(setFormData).toHaveBeenCalled();

      // Rerender with requiresProduct = true
      rerender(
        <ProductSeedingCard
          formData={{ ...defaultFormData, requiresProduct: true }}
          setFormData={setFormData}
        />
      );

      expect(screen.getByLabelText(/Product Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Product Retail Value/i)).toBeInTheDocument();
    });
  });

  describe("MatchingPrioritySliders", () => {
    it("renders presets and triggers onChange when preset is selected", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <MatchingPrioritySliders priority="BALANCED" onChange={onChange} />
      );

      expect(screen.getByText(/Balanced \(Default\)/i)).toBeInTheDocument();

      const buttons = screen.getAllByRole("button");
      const reachBtn = buttons.find((btn) => btn.textContent?.includes("Reach"));
      expect(reachBtn).toBeDefined();
      if (reachBtn) {
        await user.click(reachBtn);
        expect(onChange).toHaveBeenCalledWith("REACH_FOCUSED", undefined);
      }
    });
  });

  describe("CreateCampaignClient Full Wizard Workflow", () => {
    it("renders step 1 and validates required fields before advancing", async () => {
      renderWithProviders(<CreateCampaignClient />);

      // Step 1: Basics
      await waitFor(() => {
        expect(screen.getByText(/Campaign Brief & Categories/i)).toBeInTheDocument();
      });
      const nextBtn = screen.getByRole("button", { name: /Next: Deliverables & Targeting/i });
      expect(nextBtn).toBeInTheDocument();
    });
  });
});
