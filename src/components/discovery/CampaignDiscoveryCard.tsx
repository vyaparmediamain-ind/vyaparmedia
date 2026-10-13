"use client";

import React from "react";
import { CampaignDiscoveryCard as BaseCampaignDiscoveryCard } from "@/components/dashboard/campaigns/CampaignDiscoveryCard";
import type { CampaignDiscoveryItem } from "./types";
import type { DashboardCampaign } from "@/lib/schemas";

export interface CampaignDiscoveryCardProps {
  readonly campaign: CampaignDiscoveryItem;
  readonly onToggleBookmark?: (id: string, nextState: boolean) => Promise<void>;
  readonly isBrand?: boolean;
}

/**
 * Discovery Feed Campaign Card.
 * Consolidates into canonical CampaignDiscoveryCard base component.
 */
export default function CampaignDiscoveryCard({
  campaign,
  isBrand = false,
}: Readonly<CampaignDiscoveryCardProps>) {
  // Adapt CampaignDiscoveryItem into canonical DashboardCampaign interface
  const adaptedCampaign: DashboardCampaign = {
    id: campaign.id,
    title: campaign.title,
    status: "ACTIVE",
    description: campaign.description || "",
    createdAt: new Date().toISOString(),
    perInfluencerBudget: campaign.perInfluencerBudgetPaise || campaign.budgetPaise || 0,
    minFollowers: 0,
    postingDeadline: campaign.deadline || "",
    targetCategories: campaign.niche ? [campaign.niche] : ["General"],
    totalApplications: 0,
    brandId: campaign.brandId || null,
    brand: {
      id: campaign.brandId || null,
      companyName: campaign.brandName || "Brand Partner",
      logo: campaign.brandAvatar ?? null,
      avgRating: 4.8,
    },
    deliverables: Array.isArray(campaign.deliverables)
      ? campaign.deliverables.map((d) => ({ type: d, count: 1 }))
      : [{ type: "INSTAGRAM_POST", count: 1 }],
    maxInfluencers: null,
    acceptedCount: 0,
  };

  return (
    <div className="mb-4">
      <BaseCampaignDiscoveryCard
        campaign={adaptedCampaign}
        isBrand={isBrand}
        isApplied={false}
      />
    </div>
  );
}
