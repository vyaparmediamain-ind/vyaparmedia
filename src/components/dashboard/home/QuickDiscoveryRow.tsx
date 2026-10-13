"use client";

import React from "react";
import Link from "next/link";
import useSWR from "swr";
import { formatCurrency } from "@/lib/utils-client";
import { ShieldCheck, Compass, Users, ChevronRight } from "lucide-react";
import { Button, Badge } from "@/components/ui";

interface QuickDiscoveryRowProps {
  isBrand: boolean;
  isInfluencer: boolean;
}

interface CampaignItem {
  id: string;
  title: string;
  brand?: { companyName?: string };
  perInfluencerBudget?: number;
  targetCategories?: string[];
}

interface InfluencerItem {
  id: string;
  displayName?: string;
  primaryNiche?: string;
  startingRatePaise?: number;
  trustScore?: number;
}

export function QuickDiscoveryRow({ isBrand, isInfluencer }: Readonly<QuickDiscoveryRowProps>) {
  // If user is Influencer: fetch recent active campaigns to apply to
  const { data: campaignsData } = useSWR(
    isInfluencer ? "/api/campaigns?limit=3&status=ACTIVE" : null,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  // If user is Brand: fetch top verified influencers to invite
  const { data: influencersData } = useSWR(
    isBrand ? "/api/influencers?limit=3" : null,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const rawCampaigns: CampaignItem[] =
    campaignsData?.data?.campaigns || campaignsData?.campaigns || [];
  const rawInfluencers: InfluencerItem[] =
    influencersData?.data?.influencers || influencersData?.influencers || [];

  return (
    <section aria-label="Discovery recommendations" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isBrand ? (
            <Users className="w-4 h-4 text-primary" />
          ) : (
            <Compass className="w-4 h-4 text-primary" />
          )}
          <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
            {isBrand ? "Featured Creators Available for Collabs" : "Recommended Campaigns For You"}
          </h2>
        </div>
        <Link
          href={isBrand ? "/dashboard/influencers" : "/dashboard/campaigns"}
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
        >
          {isBrand ? "Explore Creators" : "Explore All Campaigns"} <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {isInfluencer && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rawCampaigns.length > 0 ? (
            rawCampaigns.slice(0, 3).map((camp) => (
              <article
                key={camp.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {camp.brand?.companyName || "Verified Brand"}
                    </span>
                    <Badge variant="primary" className="text-[10px] py-0 px-1.5 font-bold">
                      Open Brief
                    </Badge>
                  </div>
                  <h3 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {camp.title}
                  </h3>
                  <div className="text-base font-extrabold font-mono tabular-nums text-foreground">
                    {formatCurrency(camp.perInfluencerBudget || 250000)}
                    <span className="text-[11px] font-normal text-muted-foreground ml-1">/ creator</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border mt-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-verified flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Escrow Backed
                  </span>
                  <Button
                    href={`/dashboard/campaigns/${camp.id}`}
                    variant="ghost"
                    size="sm"
                    className="text-xs font-bold text-primary p-0 h-auto hover:underline"
                  >
                    View Brief →
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <div className="col-span-3 rounded-2xl border border-border bg-card p-5 text-center text-xs text-muted-foreground">
              Browse the discovery marketplace to find live brand campaigns matching your audience.
            </div>
          )}
        </div>
      )}

      {isBrand && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rawInfluencers.length > 0 ? (
            rawInfluencers.slice(0, 3).map((inf) => (
              <article
                key={inf.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {inf.primaryNiche || "Creator"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" /> DRS {inf.trustScore || 800}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {inf.displayName || "Verified Creator"}
                  </h3>
                  <div className="text-sm font-semibold text-muted-foreground">
                    Starting at{" "}
                    <span className="font-mono tabular-nums text-foreground font-extrabold">
                      {formatCurrency(inf.startingRatePaise || 300000)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border mt-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-verified flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> KYC Verified
                  </span>
                  <Button
                    href={`/dashboard/influencers/${inf.id}`}
                    variant="ghost"
                    size="sm"
                    className="text-xs font-bold text-primary p-0 h-auto hover:underline"
                  >
                    View Media Kit →
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <div className="col-span-3 rounded-2xl border border-border bg-card p-5 text-center text-xs text-muted-foreground">
              Browse verified creators across fashion, tech, lifestyle, and fitness categories.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
