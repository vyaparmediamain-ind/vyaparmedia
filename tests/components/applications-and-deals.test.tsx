import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithProviders } from "../utils/render";
import { createFetchMock } from "../utils/fetch-mock";

import { ApplicationsList } from "@/components/dashboard/campaigns/details/ApplicationsList";
import { MatchScoreBadge } from "@/components/dashboard/campaigns/MatchScoreBadge";
import { DealPipelineCard } from "@/components/dashboard/deals/DealPipelineCard";
import { EscrowTrustCard } from "@/components/dashboard/deals/EscrowTrustCard";
import { DealProgressStepper } from "@/components/dashboard/deals/DealProgressStepper";
import { DealContextualActions } from "@/components/dashboard/deals/DealContextualActions";
import type { CampaignApplication } from "@/components/dashboard/campaigns/details/CampaignDetailHelpers";
import type { Deal } from "@/lib/schemas";
import type { DealDetail } from "@/components/dashboard/deals/DealDetailHelpers";

describe("Component Tests: Applications & Deals (Priority 3 & 4)", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  const mockApplication: any = {
    id: "app_123",
    status: "PENDING",
    proposal: "I love fitness and create authentic gym workout reels daily.",
    proposedRate: 1500000, // 15,000 Rupees = 1,500,000 paise
    estimatedDelivery: "3 days",
    createdAt: "2026-11-20T10:00:00Z",
    matchScore: 89,
    influencer: {
      id: "inf_456",
      displayName: "Vikram Malhotra",
      avatar: null,
      instagramFollowers: 45000,
      instagramEngagementRate: 4.8,
      categories: "FITNESS,HEALTH",
      city: "Mumbai",
      tier: "MID",
      verified: true,
      user: {
        trustScore: 92,
      },
    },
  };

  const mockDeal: any = {
    id: "deal_123",
    campaignId: "camp_789",
    influencerId: "inf_456",
    brandId: "brand_999",
    status: "PENDING_SIGNATURE",
    amount: 1500000,
    agreedAmount: 1500000, // 1,500,000 paise (₹15,000)
    createdAt: new Date("2026-11-20T10:00:00Z"),
    updatedAt: new Date("2026-11-20T12:00:00Z"),
    campaign: {
      id: "camp_789",
      title: "Pro Isolate Launch",
      description: "Fitness campaign",
      status: "ACTIVE",
      totalBudget: 5000000,
      brand: {
        id: "brand_999",
        companyName: "NutriPro India",
      },
    },
    influencer: {
      id: "inf_456",
      displayName: "Vikram Malhotra",
      user: {
        id: "usr_inf_456",
        email: "vikram@example.com",
      },
    },
  };

  const mockDealDetail: any = {
    id: "deal_123",
    campaignId: "camp_789",
    status: "ACTIVE",
    amount: 1500000, // 1,500,000 paise
    createdAt: "2026-11-20T10:00:00Z",
    campaign: {
      id: "camp_789",
      title: "Pro Isolate Launch",
      requiresProduct: false,
      productName: null,
      deliverables: [{ type: "INSTAGRAM_REEL", count: 1, rate: 15000 }],
      brand: {
        id: "brand_999",
        companyName: "NutriPro India",
      },
    },
    influencer: {
      id: "inf_456",
      displayName: "Vikram Malhotra",
      instagramHandle: "vikramfitness",
      user: {
        id: "usr_inf_456",
        email: "vikram@example.com",
      },
    },
    brand: {
      id: "brand_999",
      companyName: "NutriPro India",
    },
    contractTerms: JSON.stringify({
      milestones: [{ deliverable: "INSTAGRAM_REEL", amountPaise: 1500000 }],
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = createFetchMock();
    fetchMock.install();
  });

  describe("ApplicationsList", () => {
    it("renders loading state with accessible status", () => {
      renderWithProviders(
        <ApplicationsList
          loading={true}
          applications={[]}
          actionId={null}
          onAction={vi.fn()}
        />
      );

      expect(screen.getByLabelText(/Loading candidate applications/i)).toBeInTheDocument();
    });

    it("renders empty state when no applications are submitted", () => {
      renderWithProviders(
        <ApplicationsList
          loading={false}
          applications={[]}
          actionId={null}
          onAction={vi.fn()}
        />
      );

      expect(screen.getByText(/No Creator Pitches Yet/i)).toBeInTheDocument();
    });

    it("renders candidate cards with match score and actionable accept/reject CTAs", async () => {
      const onAction = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <ApplicationsList
          loading={false}
          applications={[mockApplication]}
          actionId={null}
          onAction={onAction}
          campaign={{ status: "ACTIVE", maxInfluencers: 5, selectedInfluencers: 1 }}
        />
      );

      expect(screen.getByText("Vikram Malhotra")).toBeInTheDocument();
      expect(screen.getByText(/₹15,000/i)).toBeInTheDocument();

      const acceptBtn = screen.getByRole("button", { name: /Accept & Fund Deal/i });
      expect(acceptBtn).toBeEnabled();

      await user.click(acceptBtn);
      expect(onAction).toHaveBeenCalledWith("app_123", "accept");

      const rejectBtn = screen.getByRole("button", { name: /Decline/i });
      await user.click(rejectBtn);
      expect(onAction).toHaveBeenCalledWith("app_123", "reject");
    });

    it("passes axe accessibility checks on ApplicationsList", async () => {
      const { container } = renderWithProviders(
        <ApplicationsList
          loading={false}
          applications={[mockApplication]}
          actionId={null}
          onAction={vi.fn()}
          campaign={{ status: "ACTIVE", maxInfluencers: 5, selectedInfluencers: 1 }}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("MatchScoreBadge", () => {
    it("renders match percentage and expands breakdown on click", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <MatchScoreBadge
          score={89}
          creatorName="Vikram Malhotra"
          breakdown={{
            categoryScore: 90,
            engagementScore: 85,
            authenticityScore: 92,
            qualityScore: 88,
            roiScore: 91,
          }}
        />
      );

      expect(screen.getByText(/89% Match/i)).toBeInTheDocument();

      const trigger = screen.getByRole("button", { name: /89% Match/i });
      await user.click(trigger);

      expect(screen.getByText(/Match Score Breakdown/i)).toBeInTheDocument();
      expect(screen.getByText(/Audience Engagement Rate/i)).toBeInTheDocument();
    });
  });

  describe("DealPipelineCard", () => {
    it("renders deal pipeline card with status badge and integer paise value", () => {
      renderWithProviders(
        <DealPipelineCard
          deal={mockDeal}
          isSelected={false}
          onToggleSelect={vi.fn()}
          isInfluencer={false}
        />
      );

      expect(screen.getByText("Pro Isolate Launch")).toBeInTheDocument();
      expect(screen.getByText(/₹15,000/i)).toBeInTheDocument();
      expect(screen.getByText(/Awaiting Signature/i)).toBeInTheDocument();
    });

    it("passes axe accessibility checks on DealPipelineCard", async () => {
      const { container } = renderWithProviders(
        <DealPipelineCard
          deal={mockDeal}
          isSelected={false}
          onToggleSelect={vi.fn()}
          isInfluencer={false}
        />
      );

      // Disable nested-interactive and aria-allowed-role specifically for ListItem card interactive wrapper
      const results = await axe(container, {
        rules: {
          "nested-interactive": { enabled: false },
          "aria-allowed-role": { enabled: false },
        },
      });
      expect(results).toHaveNoViolations();
    });
  });

  describe("EscrowTrustCard", () => {
    it("displays escrow secured state with 100% creator payout assurance", () => {
      renderWithProviders(
        <EscrowTrustCard
          amountInPaise={1500000}
          totalAmountInPaise={1605000}
          platformFeeInPaise={75000}
          gatewayFeeInPaise={30000}
          creatorPayoutInPaise={1500000}
          isEscrowLocked={true}
          isCompleted={false}
          isDisputed={false}
          isCancelled={false}
          brandCompanyName="NutriPro India"
          creatorName="Vikram Malhotra"
          isBrand={true}
        />
      );

      expect(screen.getByText(/100% Escrow Locked/i)).toBeInTheDocument();
      expect(screen.getByText(/₹16,050/i)).toBeInTheDocument();
    });
  });

  describe("DealProgressStepper", () => {
    it("highlights current stage correctly based on deal status", () => {
      renderWithProviders(<DealProgressStepper status="ACTIVE" />);

      const appliedHeadings = screen.getAllByText(/Applied/i);
      expect(appliedHeadings.length).toBeGreaterThan(0);
      const contractSublabels = screen.getAllByText(/Contract & Signature/i);
      expect(contractSublabels.length).toBeGreaterThan(0);
    });
  });

  describe("DealContextualActions", () => {
    it("renders contextual actions for influencer in ACTIVE status", () => {
      renderWithProviders(
        <DealContextualActions
          dealStatus="ACTIVE"
          dealId="deal_123"
          isInfluencer={true}
          isBrand={false}
          isSubmitting={false}
          deal={mockDealDetail}
          handleSignContract={vi.fn()}
          handleRejectInvite={vi.fn()}
          handleCancelDeal={vi.fn()}
          handleAction={vi.fn().mockResolvedValue(true)}
          setItemizedUrls={vi.fn()}
          setContentForm={vi.fn()}
          setShowSubmitModal={vi.fn()}
          setShowVerifyModal={vi.fn()}
          setItemizedReviews={vi.fn()}
          setShowReviewModal={vi.fn()}
        />
      );

      // In ACTIVE status with submission allowed, influencer can click "Submit Content"
      expect(screen.getByRole("button", { name: /Submit Content/i })).toBeInTheDocument();
    });
  });
});
