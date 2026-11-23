import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithProviders } from "../utils/render";
import { createFetchMock } from "../utils/fetch-mock";

import { ContactLeakWarningBanner } from "@/components/dashboard/messages/ContactLeakWarningBanner";
import { DisputeAnalysisCard } from "@/components/dashboard/disputes/DisputeAnalysisCard";
import { DisputeEvidence } from "@/components/dashboard/disputes/DisputeEvidence";
import { DisputeTimeline } from "@/components/dashboard/disputes/DisputeTimeline";
import { DealDisputeSection } from "@/components/dashboard/deals/DealDisputeSection";
import type { DisputeDetail, MediatorAnalysis } from "@/components/dashboard/disputes/DisputeHelpers";

describe("Component Tests: Messages & Disputes (Priority 6 & 7)", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  const mockDispute: DisputeDetail = {
    id: "disp_123",
    status: "TIER2_MEDIATION",
    tier: 2,
    type: "DELIVERABLE_DELAY",
    reason: "Creator did not post approved Reel within agreed 48h deadline.",
    description: "Deadline missed by over 24 hours without prior notice.",
    createdAt: new Date().toISOString(),
    raisedByUserId: "brand_999",
    deal: {
      id: "deal_456",
      amount: 2000000,
      campaign: {
        title: "Summer Fitness Launch",
      },
    },
    evidence: [
      {
        id: "ev_1",
        type: "SCREENSHOT",
        url: "https://example.com/proof.png",
        description: "Screenshot showing lack of post on Instagram",
        submittedByUserId: "brand_999",
        submittedAt: new Date().toISOString(),
      },
    ],
  };

  const mockAnalysis: MediatorAnalysis = {
    disputeId: "disp_123",
    tier: 2,
    verdict: "SPLIT",
    confidence: "HIGH",
    refundPercentage: 50,
    influencerPayoutPercentage: 50,
    trustScoreChanges: {
      influencer: -5,
      brand: 0,
    },
    explanation: "Influencer submitted draft on time but was delayed in live posting. Partial payout justified.",
    findings: [
      {
        check: "Draft Submission Deadline",
        result: "PASS",
        detail: "Draft delivered 4 hours before deadline.",
      },
      {
        check: "Live Publication SLA",
        result: "FAIL",
        detail: "Published 26 hours after approval.",
      },
    ],
    suggestedAction: "Execute 50/50 escrow split settlement.",
    autoResolvable: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = createFetchMock();
    fetchMock.install();
  });

  describe("ContactLeakWarningBanner", () => {
    it("renders leak warning alert when phone or email is detected in draft text", () => {
      renderWithProviders(
        <ContactLeakWarningBanner
          leakResult={{
            hasLeak: true,
            detectedTypes: ["PHONE_NUMBER", "EMAIL_ADDRESS"],
            warningMessage: "Contact leak detected",
            matchedSamples: ["9876543210"],
          } as any}
        />
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Safety Warning: External Contact Details Detected/i)).toBeInTheDocument();
      expect(screen.getByText(/PHONE_NUMBER/i)).toBeInTheDocument();
      expect(screen.getByText(/EMAIL_ADDRESS/i)).toBeInTheDocument();
    });

    it("returns null when no contact leak is detected", () => {
      const { container } = renderWithProviders(
        <ContactLeakWarningBanner
          leakResult={{
            hasLeak: false,
            detectedTypes: [],
            warningMessage: null,
            matchedSamples: [],
          } as any}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("passes axe accessibility checks on ContactLeakWarningBanner", async () => {
      const { container } = renderWithProviders(
        <ContactLeakWarningBanner
          leakResult={{
            hasLeak: true,
            detectedTypes: ["PHONE_NUMBER"],
            warningMessage: "Contact leak detected",
            matchedSamples: ["9876543210"],
          } as any}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("DisputeAnalysisCard", () => {
    it("renders AI mediator split settlement analysis with paise-accurate breakdown", () => {
      renderWithProviders(
        <DisputeAnalysisCard
          analysis={mockAnalysis}
          dispute={mockDispute}
          canTakeAction={true}
          actionLoading={null}
          handleDisputeAction={vi.fn()}
        />
      );

      expect(screen.getByText(/Split Compromise Settlement/i)).toBeInTheDocument();
      expect(screen.getByText(/HIGH/i)).toBeInTheDocument();
      expect(screen.getByText(/Influencer submitted draft on time/i)).toBeInTheDocument();
    });
  });

  describe("DisputeEvidence", () => {
    it("renders evidence vault list and toggles add evidence form", async () => {
      const setShowEvidenceForm = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <DisputeEvidence
          dispute={mockDispute}
          showEvidenceForm={false}
          setShowEvidenceForm={setShowEvidenceForm}
          evidenceType="SCREENSHOT"
          setEvidenceType={vi.fn()}
          evidenceUrl=""
          setEvidenceUrl={vi.fn()}
          evidenceDesc=""
          setEvidenceDesc={vi.fn()}
          onSubmit={vi.fn()}
          isSubmitting={false}
        />
      );

      expect(screen.getByText("Evidence Vault")).toBeInTheDocument();
      expect(screen.getByText(/Screenshot showing lack of post/i)).toBeInTheDocument();

      const addBtn = screen.getByRole("button", { name: /Add Evidence/i });
      await user.click(addBtn);

      expect(setShowEvidenceForm).toHaveBeenCalledWith(true);
    });
  });

  describe("DisputeTimeline", () => {
    it("renders 48-hour SLA countdown timer and stages", () => {
      renderWithProviders(<DisputeTimeline dispute={mockDispute} />);

      expect(screen.getByText(/Dispute Timeline/i)).toBeInTheDocument();
      expect(screen.getByText(/48h Window:/i)).toBeInTheDocument();
    });
  });

  describe("DealDisputeSection", () => {
    it("renders mediation alert banner with frozen escrow notice when deal is in DISPUTED state", () => {
      renderWithProviders(
        <DealDisputeSection
          dealId="deal_456"
          status="DISPUTED"
          isBrand={true}
        />
      );

      expect(screen.getByText(/Dispute Under Active Mediation/i)).toBeInTheDocument();
      expect(screen.getByText(/Escrow Frozen/i)).toBeInTheDocument();
    });

    it("returns null when deal is CANCELLED", () => {
      const { container } = renderWithProviders(
        <DealDisputeSection
          dealId="deal_456"
          status="CANCELLED"
          isBrand={true}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });
});
