"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  Star,
  Calendar,
  Lock,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Sparkles,
  Download,
  Rocket,
  Check,
  TrendingUp,
  Tag,
  MapPin,
  Globe,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils-client";
import { Button, Input, Textarea, BottomSheet, Spinner, PageHeader } from "@/components/ui";
import { ApplicationsList } from "@/components/dashboard/campaigns/details/ApplicationsList";
import { useCampaignDetail } from "@/components/dashboard/campaigns/details/useCampaignDetail";
import { checkCampaignCancelEligibility, checkCampaignApplicationEligibility, checkCampaignActivationEligibility } from "@/lib/action-eligibility";
import { useWallet } from "@/hooks/api/useWallet";

interface CampaignDetailClientProps {
  readonly user: { readonly id: string; readonly userType?: string; readonly verificationLevel?: string };
  readonly influencerProfile?: {
    readonly id: string;
    readonly instagramFollowers: number | null;
    readonly instagramEngagementRate: number | null;
    readonly youtubeSubscribers: number | null;
    readonly youtubeEngagementRate: number | null;
  } | null;
  readonly kycTier?: number;
}

export default function CampaignDetailClient({
  user,
  influencerProfile = null,
  kycTier = 0,
}: CampaignDetailClientProps) {
  const { id: campaignId } = useParams() as { id: string };
  const router = useRouter();

  const {
    loading,
    error,
    campaign,
    showApplyModal,
    setShowApplyModal,
    proposal,
    setProposal,
    proposedRate,
    setProposedRate,
    isSubmitting,
    applications,
    applicationsLoading,
    applicationActionId,
    notice,
    setNotice,
    hasApplied,
    applicationStatus,
    dealId,
    recommendedPayout,
    isOwner,
    canApply: _canApply,
    handleApplicationAction,
    handleApply,
    handleCampaignAction,
  } = useCampaignDetail({
    campaignId,
    user,
    influencerProfile,
    router,
  });

  const cancelEligibility = React.useMemo(() => {
    if (!campaign) return { allowed: false, reason: "Campaign details not loaded" };

    let openDeals = campaign.openDealCount;
    let disputedDeals = campaign.disputedDealCount;
    if (openDeals === undefined && applications && applications.length > 0) {
      openDeals = applications.filter(
        (app) => app.dealId && app.dealStatus && app.dealStatus !== "CANCELLED" && app.dealStatus !== "COMPLETED"
      ).length;
      disputedDeals = applications.filter(
        (app) => app.dealId && app.dealStatus === "DISPUTED"
      ).length;
    }

    return checkCampaignCancelEligibility(
      {
        status: campaign.status,
        openDealCount: openDeals ?? 0,
        disputedDealCount: disputedDeals ?? 0,
      },
      isOwner,
      undefined,
      campaign.id
    );
  }, [campaign, isOwner, applications]);

  const { walletData } = useWallet();

  const activateEligibility = React.useMemo(() => {
    if (!campaign) return { allowed: false, reason: "Campaign details not loaded" };
    return checkCampaignActivationEligibility(
      {
        status: campaign.status,
        totalBudget: campaign.totalBudget,
        perInfluencerBudget: campaign.perInfluencerBudget,
        maxInfluencers: campaign.maxInfluencers,
        productValue: campaign.productValue,
        requiresProduct: campaign.requiresProduct,
      },
      isOwner,
      walletData ? { balance: walletData.balance, isFrozen: walletData.isFrozen } : undefined,
    );
  }, [campaign, isOwner, walletData]);

  if (loading) {
    return (
      <div className="space-y-6" aria-label="Loading campaign details" aria-busy="true">
        {/* Header Skeleton */}
        <div className="bg-card border border-border p-6 rounded-2xl animate-pulse space-y-4">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-muted rounded-2xl" />
            <div className="space-y-2 flex-1">
              <div className="h-7 w-64 bg-muted rounded" />
              <div className="h-4 w-40 bg-muted rounded" />
            </div>
          </div>
        </div>

        {/* 2-Column Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-card border border-border p-6 rounded-2xl h-48 bg-muted/40 animate-pulse" />
            <div className="bg-card border border-border p-6 rounded-2xl h-48 bg-muted/40 animate-pulse" />
          </div>
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-card border border-border p-6 rounded-2xl h-64 bg-muted/40 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="p-12 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-disputed-muted text-disputed border border-disputed-border flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="font-extrabold text-2xl text-foreground mb-2">Campaign Not Found</h2>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          {error || "The requested campaign could not be found or has expired."}
        </p>
        <Button href="/dashboard/campaigns" variant="primary" className="font-semibold">
          ← Back to Discovery Feed
        </Button>
      </div>
    );
  }

  // Calculate capacity percentage
  const capacityPercent =
    campaign.maxInfluencers && campaign.maxInfluencers > 0
      ? Math.min(100, Math.round((campaign.acceptedCount / campaign.maxInfluencers) * 100))
      : 0;

  const applyEligibility = checkCampaignApplicationEligibility(
    campaign,
    {
      id: influencerProfile?.id,
      userId: user?.id,
      userType: user?.userType,
      hasApplied,
      applicationStatus,
      kycTier,
      verificationLevel: user?.verificationLevel,
      followerCount: influencerProfile
        ? Math.max(influencerProfile.instagramFollowers || 0, influencerProfile.youtubeSubscribers || 0)
        : 0,
    }
  );

  const brandIdentifier =
    campaign.brand?.id ||
    campaign.brand?.userId ||
    encodeURIComponent(campaign.brand?.companyName || "");
  const brandProfileHref = `/brand/${brandIdentifier}`;

  return (
    <div className="space-y-8">
      {/* Top Navigation Bar & Owner Actions */}
      <PageHeader
        backHref="/dashboard/campaigns"
        backLabel="Back to Live Campaigns"
        title={campaign.title}
        subtitle={`Organized by ${campaign.brand?.companyName || "Verified Brand"}`}
        badge={
          <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-muted text-foreground border border-border">
            {campaign.status}
          </span>
        }
        actions={
          isOwner ? (
            <div className="flex items-center gap-2.5 flex-wrap">
              {campaign.status === "DRAFT" && (
                <>
                  <Button
                    href={`/dashboard/campaigns/create?edit=${campaign.id}`}
                    variant="secondary"
                    size="sm"
                  >
                    Edit Draft
                  </Button>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={!activateEligibility.allowed}
                      title={activateEligibility.reason}
                      onClick={() => {
                        if (!activateEligibility.allowed) {
                          setNotice({
                            type: "error",
                            message: activateEligibility.reason || "Cannot launch campaign",
                          });
                          return;
                        }
                        handleCampaignAction("ACTIVATE");
                      }}
                      className="inline-flex items-center gap-1.5 font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Rocket className="w-4 h-4" />
                      Launch Campaign
                    </Button>
                    {!activateEligibility.allowed && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        <span>{activateEligibility.reason}</span>
                        {activateEligibility.ctaText && activateEligibility.ctaHref && (
                          <Link
                            href={activateEligibility.ctaHref}
                            className="underline font-bold text-primary hover:text-primary/80"
                          >
                            {activateEligibility.ctaText} →
                          </Link>
                        )}
                      </span>
                    )}
                  </div>
                </>
              )}
              {campaign.status === "PAUSED" && (
                <Button
                  href={`/dashboard/campaigns/create?edit=${campaign.id}`}
                  variant="secondary"
                  size="sm"
                  className="inline-flex items-center gap-1.5"
                >
                  Edit &amp; Extend Deadline
                </Button>
              )}
              {(campaign.status === "ACTIVE" || campaign.status === "PAUSED") && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (!cancelEligibility.allowed) {
                        setNotice({ type: "error", message: cancelEligibility.reason || "Cannot cancel campaign" });
                        return;
                      }
                      handleCampaignAction("CANCEL");
                    }}
                    disabled={!cancelEligibility.allowed}
                    title={cancelEligibility.reason}
                    className="font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel Campaign
                  </Button>
                  {!cancelEligibility.allowed && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      <span>{cancelEligibility.reason}</span>
                      {cancelEligibility.ctaText && (
                        <Link
                          href={cancelEligibility.ctaHref || `/dashboard/deals?campaignId=${campaign.id}`}
                          className="underline font-bold text-primary hover:text-primary/80"
                        >
                          {cancelEligibility.ctaText} →
                        </Link>
                      )}
                    </span>
                  )}
                </div>
              )}
              {(campaign.status === "ACTIVE" || campaign.status === "COMPLETED") && (
                <>
                  <Button
                    href={`/dashboard/campaigns/${campaign.id}/roi`}
                    variant="primary"
                    size="sm"
                    className="inline-flex items-center gap-1.5 font-bold cursor-pointer shadow-xs"
                  >
                    <BarChart3 className="w-4 h-4" />
                    ROI Report
                  </Button>
                  <Button
                    href={`/api/reports/brand/campaign/${campaign.id}/roi?format=csv`}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="secondary"
                    size="sm"
                    className="inline-flex items-center gap-1.5 font-medium cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                </>
              )}
            </div>
          ) : undefined
        }
        border={false}
      />

      {/* Campaign Hero Card */}
      <div className="bg-card border border-border p-6 sm:p-8 rounded-3xl shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4 sm:gap-5">
            {/* Brand Logo Avatar */}
            <Link
              href={brandProfileHref}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-muted border border-border flex items-center justify-center font-bold text-xl text-foreground overflow-hidden relative flex-shrink-0 shadow-xs hover:ring-2 hover:ring-primary/40 hover:border-primary/50 transition-all cursor-pointer"
              title={`View ${campaign.brand?.companyName || "Brand"} Public Profile`}
            >
              {campaign.brand?.logo ? (
                <Image
                  src={campaign.brand.logo}
                  alt={campaign.brand.companyName || "Brand Logo"}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                (campaign.brand?.companyName || campaign.title || "B").slice(0, 2).toUpperCase()
              )}
            </Link>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <Link
                  href={brandProfileHref}
                  className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider inline-flex items-center gap-1 group"
                  title={`View ${campaign.brand?.companyName || "Brand"} Public Profile`}
                >
                  <span>{campaign.brand?.companyName || "Verified Brand"}</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>

                {campaign.brand?.isGstVerified && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap"
                    title="GST Details legally verified for tax compliance"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    GST Verified
                  </span>
                )}

                {campaign.brand?.averageRating && campaign.brand.averageRating > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-pending">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {campaign.brand.averageRating.toFixed(1)}
                  </span>
                ) : null}

                <Link
                  href={brandProfileHref}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors shrink-0"
                  title="View complete public profile, active campaigns, and creator reviews"
                >
                  <span>View Brand Profile</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </Link>
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight leading-tight">
                {campaign.title}
              </h2>

              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-1">
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  {campaign.totalApplications} Applicants
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  Created on {formatDate(campaign.createdAt || campaign.contentDeadline)}
                </span>
              </div>
            </div>
          </div>

          {/* Campaign Status & Action Badges */}
          <div className="flex items-center gap-2 self-start flex-wrap">
            {isOwner && (
              <Link
                href={`/dashboard/campaigns/${campaign.id}/roi`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-bold text-foreground hover:bg-muted transition-colors shadow-xs"
              >
                <BarChart3 className="w-3.5 h-3.5 text-primary" />
                <span>ROI Analytics Report</span>
              </Link>
            )}
            {(() => {
              const s = campaign.status?.toUpperCase();
              let badgeStyle = "bg-muted text-foreground border-border";
              let StatusIcon = Clock;
              if (s === "ACTIVE") {
                badgeStyle = "bg-verified-muted text-verified border-verified-border";
                StatusIcon = CheckCircle2;
              } else if (s === "PAUSED") {
                badgeStyle = "bg-pending-muted text-pending border-pending-border";
                StatusIcon = Clock;
              } else if (s === "COMPLETED") {
                badgeStyle = "bg-escrow-muted text-escrow border-escrow-border";
                StatusIcon = CheckCircle2;
              } else if (s === "CANCELLED") {
                badgeStyle = "bg-disputed-muted text-disputed border-disputed-border";
                StatusIcon = AlertCircle;
              } else if (s === "DRAFT") {
                badgeStyle = "bg-pending-muted text-pending border-pending-border";
                StatusIcon = Clock;
              }

              return (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider shrink-0 whitespace-nowrap ${badgeStyle}`}
                >
                  <StatusIcon className="w-3.5 h-3.5" />
                  {campaign.status}
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Paused Campaign Info Banner */}
      {isOwner && campaign.status === "PAUSED" && (
        <div className="p-4 rounded-2xl bg-pending-muted border border-pending-border flex items-start gap-3 text-xs text-foreground">
          <Clock className="w-4 h-4 text-pending shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-pending">Campaign Paused (Applications Closed)</p>
            <p className="text-muted-foreground leading-relaxed">
              Application deadline has passed so new creators cannot submit proposals. You can review received creator pitches below to accept deals, click <strong>Edit &amp; Extend Deadline</strong> to reopen applications, or <strong>Cancel Campaign</strong> to unfreeze and refund unspent escrow funds to your wallet.
            </p>
          </div>
        </div>
      )}

      {/* Global Notification Banner */}
      {notice && (
        <div
          className={`p-4 rounded-2xl border text-sm font-medium flex items-center gap-3 ${
            notice.type === "success"
              ? "bg-verified-muted text-verified border-verified-border"
              : "bg-disputed-muted text-disputed border-disputed-border"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* 2-Column Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Scope, Guidelines, Audience & Applications Roster (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Campaign Overview */}
          <section className="bg-card border border-border p-6 rounded-3xl shadow-xs space-y-3">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Campaign Overview & Brief
            </h2>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {campaign.description}
            </p>
          </section>

          {/* Requirements & Guidelines */}
          <section className="bg-card border border-border p-6 rounded-3xl shadow-xs space-y-3">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-verified" />
              Requirements & Editorial Guidelines
            </h2>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {campaign.requirements}
            </p>
          </section>

          {/* Target Audience & Niches */}
          {(campaign.targetCategories.length > 0 ||
            campaign.targetCities.length > 0 ||
            campaign.targetLanguages.length > 0) && (
            <section className="bg-card border border-border p-6 rounded-3xl shadow-xs space-y-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pending" />
                Target Audience & Niches
              </h2>

              <div className="space-y-3">
                {campaign.targetCategories.length > 0 && (
                  <div>
                    <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      Content Niches
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {campaign.targetCategories.map((c) => (
                        <span
                          key={c}
                          className="px-3 py-1 rounded-xl text-xs font-semibold bg-muted text-foreground border border-border"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {campaign.targetCities.length > 0 && (
                  <div>
                    <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Target Cities / Regions
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {campaign.targetCities.map((city) => (
                        <span
                          key={city}
                          className="px-3 py-1 rounded-xl text-xs font-semibold bg-muted text-foreground border border-border"
                        >
                          {city}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {campaign.targetLanguages.length > 0 && (
                  <div>
                    <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      Content Languages
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {campaign.targetLanguages.map((lang) => (
                        <span
                          key={lang}
                          className="px-3 py-1 rounded-xl text-xs font-semibold bg-muted text-foreground border border-border"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Campaign Performance & Escrow Health Snapshot */}
          {isOwner && (
            <section className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Campaign Aggregate Performance &amp; Delivery Health
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-verified-muted text-verified font-bold shrink-0 whitespace-nowrap">
                  Escrow Protected
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/40">
                  <span className="text-[11px] text-muted-foreground block">Slots Filled</span>
                  <span className="text-base font-bold text-foreground tabular-nums">
                    {campaign.acceptedCount} / {campaign.maxInfluencers || "Open"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-muted/40">
                  <span className="text-[11px] text-muted-foreground block">Active Applications</span>
                  <span className="text-base font-bold text-foreground tabular-nums">
                    {campaign.totalApplications}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-muted/40">
                  <span className="text-[11px] text-muted-foreground block">Committed Escrow</span>
                  <span className="text-base font-bold text-primary tabular-nums">
                    {formatCurrency(campaign.perInfluencerBudget ? campaign.perInfluencerBudget * campaign.acceptedCount : campaign.totalBudget)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-muted/40">
                  <span className="text-[11px] text-muted-foreground block">Deliverables / Creator</span>
                  <span className="text-base font-bold text-foreground tabular-nums">
                    {campaign.deliverables.length} Deliverables
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-2xs text-muted-foreground">
                  Realized views, CPV, and engagements aggregated from deliverable snapshots.
                </span>
                <Link
                  href={`/dashboard/campaigns/${campaign.id}/roi`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>View Full Campaign ROI Report →</span>
                </Link>
              </div>
            </section>
          )}

          {/* Applications Roster for Campaign Owner (Brand) */}
          {isOwner && (
            <section className="bg-card border border-border p-6 rounded-3xl shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Applicant Review Pipeline ({campaign.totalApplications})
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Review incoming creator proposals, evaluate match scores, and fund deals into escrow.
                  </p>
                </div>
              </div>

              <ApplicationsList
                loading={applicationsLoading}
                applications={applications}
                actionId={applicationActionId}
                onAction={handleApplicationAction}
                campaign={campaign}
              />
            </section>
          )}
        </div>

        {/* Right Column: Sticky Budget, Timeline, Deliverables & Apply Card (4 cols) */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
          {/* Escrow Financial Safeguard Card */}
          <div className="bg-card border border-border p-6 rounded-3xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Financial Safeguard
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-escrow-muted text-escrow border border-escrow-border shrink-0 whitespace-nowrap">
                <Lock className="w-3 h-3" />
                RBI Escrow
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-2xs text-muted-foreground uppercase tracking-wider block font-semibold mb-1">
                  Total Campaign Escrow Budget
                </span>
                <div className="text-3xl font-black text-foreground tabular-nums tracking-tight">
                  {formatCurrency(campaign.totalBudget)}
                </div>
              </div>

              {campaign.perInfluencerBudget !== null && (
                <div className="pt-2 border-t border-border">
                  <span className="text-2xs text-muted-foreground uppercase tracking-wider block font-semibold mb-1">
                    Per Creator Payout
                  </span>
                  <div className="text-xl font-bold text-verified tabular-nums">
                    {formatCurrency(campaign.perInfluencerBudget)}
                  </div>
                </div>
              )}
            </div>

            <p className="text-2xs text-muted-foreground leading-relaxed pt-2 border-t border-border">
              🛡️ 100% Escrow Guarantee. Funds are held in a secure trust account and released only upon your milestone approval.
            </p>
          </div>

          {/* Slots & Capacity Meter */}
          {campaign.maxInfluencers && campaign.maxInfluencers > 0 ? (
            <div className="bg-card border border-border p-5 rounded-2xl shadow-xs space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Creator Slots Filled</span>
                <span className="text-foreground tabular-nums">
                  {campaign.acceptedCount} of {campaign.maxInfluencers} Selected
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Timeline & Deadlines */}
          <div className="bg-card border border-border p-6 rounded-3xl shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Campaign Timeline
            </h3>

            {campaign.status === "CANCELLED" && (
              <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Campaign cancelled — timeline and deadlines closed.</span>
              </div>
            )}
            {campaign.status === "COMPLETED" && (
              <div className="p-2.5 rounded-xl bg-verified-muted border border-verified-border text-verified text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Campaign completed — deliverables concluded.</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              {campaign.applicationDeadline && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Applications Close</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold tabular-nums ${campaign.status === "CANCELLED" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {formatDate(campaign.applicationDeadline)}
                    </span>
                    {campaign.status === "CANCELLED" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive">
                        Closed
                      </span>
                    )}
                    {campaign.status === "COMPLETED" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-verified-muted text-verified">
                        Concluded
                      </span>
                    )}
                  </div>
                </div>
              )}
              {campaign.contentDeadline && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Draft Submission Due</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold tabular-nums ${campaign.status === "CANCELLED" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {formatDate(campaign.contentDeadline)}
                    </span>
                    {campaign.status === "CANCELLED" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive">
                        Closed
                      </span>
                    )}
                    {campaign.status === "COMPLETED" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-verified-muted text-verified">
                        Concluded
                      </span>
                    )}
                  </div>
                </div>
              )}
              {campaign.postingDeadline && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Go-Live Posting Target</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold tabular-nums ${campaign.status === "CANCELLED" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {formatDate(campaign.postingDeadline)}
                    </span>
                    {campaign.status === "CANCELLED" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive">
                        Closed
                      </span>
                    )}
                    {campaign.status === "COMPLETED" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-verified-muted text-verified">
                        Concluded
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-muted-foreground">Audience Requirement</span>
                <span className="font-bold text-foreground tabular-nums">
                  {formatNumber(campaign.minFollowers)}+ Followers
                </span>
              </div>
            </div>
          </div>

          {/* Deliverables Checklist Card */}
          <div className="bg-card border border-border p-6 rounded-3xl shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-verified" />
              Required Deliverables
            </h3>

            <ul className="space-y-2.5 list-none">
              {campaign.deliverables.map((item, idx) => (
                <li
                  key={`${item.type}-${idx}`}
                  className="flex items-start gap-2.5 text-xs text-foreground bg-muted/40 p-2.5 rounded-xl border border-border"
                >
                  <div className="w-4 h-4 rounded-full bg-verified-muted text-verified flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold block">
                      {item.count}x {item.type.replaceAll("_", " ").toLowerCase()}
                    </span>
                    {item.specs && (
                      <span className="text-2xs text-muted-foreground block mt-0.5">
                        {item.specs}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Creator Application Trigger */}
          {!isOwner && !hasApplied && (
            <div className={`p-6 rounded-3xl shadow-sm space-y-4 border ${
              campaign.status === "CANCELLED"
                ? "bg-card border-destructive/30"
                : campaign.status === "COMPLETED"
                ? "bg-card border-verified/30"
                : "bg-card border-primary/30"
            }`}>
              <div>
                <span className={`text-xs font-bold block uppercase tracking-wider mb-1 ${
                  campaign.status === "CANCELLED"
                    ? "text-destructive"
                    : campaign.status === "COMPLETED"
                    ? "text-verified"
                    : "text-primary"
                }`}>
                  {campaign.status === "CANCELLED"
                    ? "Campaign Cancelled"
                    : campaign.status === "COMPLETED"
                    ? "Campaign Completed"
                    : "Ready to Pitch?"}
                </span>
                <p className="text-xs text-muted-foreground">
                  {campaign.status === "CANCELLED"
                    ? "This campaign has been cancelled and is no longer accepting proposals or applications."
                    : campaign.status === "COMPLETED"
                    ? "This campaign has reached completion and is no longer accepting new proposals."
                    : `Submit your custom pitch and proposed rate to work with ${campaign.brand?.companyName || "this brand"}.`}
                </p>
              </div>

              {campaign.status === "ACTIVE" && recommendedPayout > 0 && (
                <div className="p-3 rounded-xl bg-verified-muted border border-verified-border text-verified text-xs flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Stats match: Recommended payout is <strong>{formatCurrency(recommendedPayout)}</strong>
                  </span>
                </div>
              )}

              {!applyEligibility.allowed && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{applyEligibility.reason}</span>
                  </div>
                  {applyEligibility.ctaText && applyEligibility.ctaHref && (
                    <Link
                      href={applyEligibility.ctaHref}
                      className="inline-flex items-center gap-1 font-bold text-primary underline text-xs pt-0.5"
                    >
                      <span>{applyEligibility.ctaText}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              )}

              <Button
                type="button"
                variant="primary"
                disabled={!applyEligibility.allowed}
                title={applyEligibility.reason}
                onClick={() => {
                  if (!applyEligibility.allowed) return;
                  setNotice(null);
                  if (proposedRate <= 0) {
                    if (campaign.perInfluencerBudget) {
                      setProposedRate(Math.round(campaign.perInfluencerBudget / 100));
                    } else if (recommendedPayout > 0) {
                      setProposedRate(Math.round(recommendedPayout / 100));
                    }
                  }
                  setShowApplyModal(true);
                }}
                className="w-full py-2.5 font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply to Campaign
              </Button>
            </div>
          )}

          {/* Existing Application Status Card */}
          {hasApplied && (
            <div className="bg-card border border-border p-6 rounded-3xl shadow-xs text-center space-y-4">
              <div>
                <span className="text-xs text-muted-foreground block mb-1">
                  Your Pitch Status
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    applicationStatus === "SELECTED" || applicationStatus === "ACCEPTED"
                      ? "bg-verified-muted text-verified border-verified-border"
                      : "bg-pending-muted text-pending border-pending-border"
                  }`}
                >
                  {applicationStatus === "SELECTED" || applicationStatus === "ACCEPTED"
                    ? "Offer Accepted 🎉"
                    : applicationStatus || "Pitch Submitted"}
                </span>
              </div>

              {dealId && (
                <Button
                  href={`/dashboard/deals/${dealId}`}
                  variant="primary"
                  className="w-full font-bold shadow-sm"
                >
                  ✍️ Sign Contract & Deal Room
                </Button>
              )}
            </div>
          )}

          {/* Campaign Cancelled / Concluded notices */}
          {!isOwner && campaign.status === "CANCELLED" && (
            <div className="p-4 rounded-2xl bg-disputed-muted border border-disputed-border text-center space-y-1">
              <span className="text-xs font-bold text-disputed block">Campaign Cancelled</span>
              <span className="text-2xs text-muted-foreground">
                This campaign was cancelled by the brand.
              </span>
            </div>
          )}

          {!isOwner && campaign.status === "COMPLETED" && (
            <div className="p-4 rounded-2xl bg-muted border border-border text-center space-y-1">
              <span className="text-xs font-bold text-muted-foreground block">Campaign Concluded</span>
              <span className="text-2xs text-muted-foreground">
                All deliverables for this campaign have been completed.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Apply Modal */}
      <BottomSheet
        open={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        title="Apply to Campaign"
        maxWidth="500px"
      >
        <div className="space-y-4">
          <Textarea
            label="Proposal Pitch (Why is your audience the best fit?)"
            id="proposal"
            placeholder="Write a clear proposal explaining your content strategy, format ideas, and turnaround time (Minimum 50 characters)..."
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
            required
            className="h-32 text-sm"
          />

          <div>
            <Input
              label="Your Proposed Payout (₹ INR)"
              id="proposed-rate"
              type="number"
              placeholder="Rate in ₹"
              value={proposedRate || ""}
              onChange={(e) => setProposedRate(Number(e.target.value))}
              required
            />
            {recommendedPayout > 0 && (
              <span className="text-muted-foreground text-2xs mt-1.5 block">
                Suggested rate based on your verified audience metrics:{" "}
                <strong className="text-foreground">{formatCurrency(recommendedPayout)}</strong>
              </span>
            )}
          </div>

          {/* Inline KYC Tier check for proposed rate in modal */}
          {(() => {
            const modalRateEligibility = checkCampaignApplicationEligibility(
              campaign,
              {
                id: influencerProfile?.id,
                userId: user?.id,
                userType: user?.userType,
                hasApplied: false,
                kycTier,
                verificationLevel: user?.verificationLevel,
                proposedRate,
              }
            );

            if (!modalRateEligibility.allowed && modalRateEligibility.reason) {
              return (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{modalRateEligibility.reason}</span>
                  </div>
                  {modalRateEligibility.ctaText && modalRateEligibility.ctaHref && (
                    <Link
                      href={modalRateEligibility.ctaHref}
                      className="inline-flex items-center gap-1 font-bold text-primary underline text-xs pt-0.5"
                    >
                      <span>{modalRateEligibility.ctaText}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              );
            }
            return null;
          })()}

          <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowApplyModal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleApply}
              disabled={
                isSubmitting ||
                proposedRate <= 0 ||
                !checkCampaignApplicationEligibility(campaign, {
                  id: influencerProfile?.id,
                  userId: user?.id,
                  userType: user?.userType,
                  hasApplied: false,
                  kycTier,
                  verificationLevel: user?.verificationLevel,
                  proposedRate,
                }).allowed
              }
              className="font-bold"
            >
              {isSubmitting ? <Spinner size="sm" /> : "Submit Proposal"}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
