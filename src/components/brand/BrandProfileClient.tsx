"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  type BrandPublicProfileData,
} from "@/lib/brand-profile";
import { formatCurrency } from "@/lib/utils-client";
import { copyToClipboard } from "@/lib/clipboard";
import {
  Building2,
  ShieldCheck,
  Star,
  ExternalLink,
  MapPin,
  Briefcase,
  Share2,
  CheckCircle2,
  Layers,
  ArrowRight,
  Lock,
  Edit3,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui";

interface BrandProfileClientProps {
  brand: BrandPublicProfileData;
  isOwnProfile?: boolean;
}

export function BrandProfileClient({
  brand,
  isOwnProfile = false,
}: Readonly<BrandProfileClientProps>) {
  const [activeTab, setActiveTab] = useState<"campaigns" | "about" | "reviews">("campaigns");
  const [copied, setCopied] = useState(false);

  const isVerified = brand.isGstVerified || brand.isPanVerified || brand.isCinVerified;

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${brand.companyName} on VyaparMedia`,
          text: `Check out ${brand.companyName}'s official brand profile and active campaigns on VyaparMedia.`,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* 1. HERO BRAND BANNER */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 rounded-full bg-verified/5 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 min-w-0">
            {/* Logo */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-muted border-2 border-border/80 shrink-0 flex items-center justify-center text-foreground font-black text-2xl shadow-sm">
              {brand.logo ? (
                <Image
                  src={brand.logo}
                  alt={brand.companyName}
                  fill
                  className="object-cover"
                />
              ) : (
                <span>{brand.companyName.slice(0, 2).toUpperCase()}</span>
              )}
            </div>

            {/* Title & Metas */}
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight break-words">
                  {brand.companyName}
                </h1>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified Brand
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                  <Lock className="w-3 h-3" /> 100% Escrow Backed
                </span>
              </div>

              {/* Tags / Subtitle */}
              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs font-medium text-muted-foreground">
                {brand.industry && (
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-foreground/70" />
                    {brand.industry}
                  </span>
                )}
                {(brand.city || brand.state) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-foreground/70" />
                    {[brand.city, brand.state].filter(Boolean).join(", ")}
                  </span>
                )}
                {brand.website && (
                  <a
                    href={brand.website.startsWith("http") ? brand.website : `https://${brand.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {brand.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5 shrink-0 pt-2 md:pt-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleShare}
              className="gap-2"
              title="Share Brand Profile"
            >
              {copied ? <Check className="w-4 h-4 text-verified" /> : <Share2 className="w-4 h-4" />}
              <span>{copied ? "Link Copied!" : "Share"}</span>
            </Button>

            {isOwnProfile && (
              <Button href="/dashboard/settings" size="sm" className="gap-2">
                <Edit3 className="w-4 h-4" />
                <span>Edit Profile</span>
              </Button>
            )}
          </div>
        </div>

        {/* 2. REPUTATION & TRUST HIGHLIGHTS */}
        <div className="mt-8 pt-6 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-muted/30 border border-border">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Marketplace Trust
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-foreground">
                {brand.trustScore}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">/ 1000</span>
            </div>
            <span className="text-[10px] font-medium text-verified flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3" /> Tier 1 Platform Standing
            </span>
          </div>

          <div className="p-4 rounded-xl bg-muted/30 border border-border">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Creator Rating
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-foreground">
                {brand.averageRating > 0 ? brand.averageRating.toFixed(1) : "5.0"}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">★</span>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground block mt-1">
              {brand.totalReviews} verified creator review{brand.totalReviews === 1 ? "" : "s"}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-muted/30 border border-border">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Active Campaigns
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-foreground">
                {brand.activeCampaignsList.length}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">live now</span>
            </div>
            <span className="text-[10px] font-medium text-primary block mt-1">
              Accepting creator proposals
            </span>
          </div>

          <div className="p-4 rounded-xl bg-muted/30 border border-border">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Escrow Protection
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-verified">
                100%
              </span>
              <span className="text-xs font-semibold text-muted-foreground">Guaranteed</span>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground block mt-1">
              Advance funds locked in escrow
            </span>
          </div>
        </div>
      </section>

      {/* 3. NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto no-scrollbar flex-nowrap">
        <button
          type="button"
          onClick={() => setActiveTab("campaigns")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all shrink-0 whitespace-nowrap cursor-pointer ${
            activeTab === "campaigns"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Active Campaigns</span>
          <span className="text-xs py-0.5 px-2 rounded-full bg-muted font-bold">
            {brand.activeCampaignsList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("about")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all shrink-0 whitespace-nowrap cursor-pointer ${
            activeTab === "about"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>About Company</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reviews")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all shrink-0 whitespace-nowrap cursor-pointer ${
            activeTab === "reviews"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Star className="w-4 h-4" />
          <span>Creator Reviews</span>
          <span className="text-xs py-0.5 px-2 rounded-full bg-muted font-bold">
            {brand.reviews.length}
          </span>
        </button>
      </div>

      {/* 4. TAB CONTENTS */}
      {/* A. ACTIVE CAMPAIGNS */}
      {activeTab === "campaigns" && (
        <section className="space-y-4">
          {brand.activeCampaignsList.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-border bg-card">
              <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="text-base font-bold text-foreground">No Active Public Campaigns</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                {brand.companyName} does not have any open public campaigns right now. Check back soon or follow their updates.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {brand.activeCampaignsList.map((campaign) => (
                <div
                  key={campaign.id}
                  className="group relative rounded-2xl border border-border bg-card p-5 hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        {campaign.targetCategories.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {campaign.targetCategories.slice(0, 2).map((cat) => (
                              <span
                                key={cat}
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}
                        <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {campaign.title}
                        </h4>
                      </div>

                      {campaign.requiresProduct && (
                        <span className="shrink-0 text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
                          Product Seeding
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {campaign.description}
                    </p>

                    {/* Deliverables tags */}
                    {campaign.deliverables.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {campaign.deliverables.map((del, i) => (
                          <span
                            key={`${del.type}-${i}`}
                            className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted/60 text-foreground border border-border"
                          >
                            {del.count}x {del.type.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bottom bar with budget and Apply link */}
                  <div className="mt-5 pt-4 border-t border-border flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Estimated Payout
                      </span>
                      <span className="text-base font-black text-foreground">
                        {campaign.perInfluencerBudget > 0
                          ? formatCurrency(campaign.perInfluencerBudget / 100)
                          : campaign.productValue
                          ? `Free Item (~₹${Math.round(campaign.productValue / 100).toLocaleString("en-IN")})`
                          : "Custom Barter"}
                      </span>
                    </div>

                    <Button
                      href={`/dashboard/campaigns/${campaign.id}`}
                      size="sm"
                      className="gap-1.5 shadow-sm"
                    >
                      <span>View &amp; Apply</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* B. ABOUT COMPANY */}
      {activeTab === "about" && (
        <section className="space-y-6">
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
            <h3 className="text-lg font-bold text-foreground">Company Overview</h3>
            {brand.description ? (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {brand.description}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {brand.companyName} has not added an extended bio description yet.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border text-xs">
              <div>
                <span className="text-muted-foreground block font-medium">Industry / Sector</span>
                <span className="font-semibold text-foreground mt-0.5 block">
                  {brand.industry || "General Commerce"}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block font-medium">Headquarters</span>
                <span className="font-semibold text-foreground mt-0.5 block">
                  {[brand.city, brand.state].filter(Boolean).join(", ") || "India"}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block font-medium">Total Campaigns Run</span>
                <span className="font-semibold text-foreground mt-0.5 block">
                  {brand.totalCampaigns}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block font-medium">Platform Member Since</span>
                <span className="font-semibold text-foreground mt-0.5 block">
                  {new Date(brand.memberSince).toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Trust and Safety commitment */}
          <div className="p-6 rounded-2xl border border-border bg-muted/20 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-verified" />
              <h4 className="text-sm font-bold text-foreground">
                VyaparMedia Escrow Protection Guarantee
              </h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every collaboration with {brand.companyName} on VyaparMedia is protected by milestone-backed escrow funds. Creator payments are deposited in trust before work begins and released immediately upon agreed deliverable completion.
            </p>
          </div>
        </section>
      )}

      {/* C. CREATOR REVIEWS */}
      {activeTab === "reviews" && (
        <section className="space-y-4">
          {brand.reviews.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-border bg-card">
              <Star className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="text-base font-bold text-foreground">No Reviews Yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Reviews from creators who collaborate with {brand.companyName} will appear here once deals are completed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {brand.reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center font-bold text-xs text-foreground shrink-0">
                        {rev.reviewer.avatar ? (
                          <Image
                            src={rev.reviewer.avatar}
                            alt={rev.reviewer.displayName}
                            width={36}
                            height={36}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <span>{rev.reviewer.displayName.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          {rev.reviewer.displayName}
                        </span>
                        {rev.reviewer.instagramHandle && (
                          <span className="text-[11px] text-muted-foreground block">
                            @{rev.reviewer.instagramHandle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-pending/10 px-2 py-0.5 rounded-md border border-pending/20">
                      <Star className="w-3 h-3 fill-pending text-pending" />
                      <span className="text-xs font-bold text-foreground">{rev.rating}.0</span>
                    </div>
                  </div>

                  {rev.comment && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      &ldquo;{rev.comment}&rdquo;
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                    <span className="inline-flex items-center gap-1 text-verified">
                      <CheckCircle2 className="w-3 h-3" /> Verified Escrow Collaboration
                    </span>
                    <span>
                      {new Date(rev.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
