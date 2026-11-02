"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  CheckCircle2,
  Clock,
  Sparkles,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  Search,
  Layers,
  Briefcase,
  TrendingUp,
  Send,
  FileText,
  ChevronRight,
  X,
  LayoutGrid,
  List,
} from "lucide-react";
import { createSchemaFetcher } from "@/lib/fetcher";
import {
  type ApplicationsResponse,
  type ApplicationItem,
  applicationsResponseSchema,
} from "@/lib/schemas";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { formatCurrency, formatDate } from "@/lib/utils-client";
import EmptyState from "@/components/ui/EmptyState";
import { Button, Skeleton, PullToRefresh, PageContainer, ListItem, PageHeader, HorizontalScrollArea } from "@/components/ui";
import { MatchScoreBadge } from "@/components/dashboard/campaigns/MatchScoreBadge";

type FilterTab = "ALL" | "REVIEW" | "OFFERS" | "ARCHIVED";
type ViewMode = "cards" | "table";

/** Maps application status to UI labels, semantic token styles, and Lucide icons */
function getStatusMeta(
  status: string,
  dealStatus?: string | null,
  campaignStatus?: string | null
) {
  const dStatus = dealStatus?.toUpperCase();
  const cStatus = campaignStatus?.toUpperCase();

  if (dStatus === "CANCELLED" || cStatus === "CANCELLED") {
    return {
      label: dStatus === "CANCELLED" ? "Deal Cancelled" : "Campaign Cancelled",
      badgeClass: "bg-disputed-muted text-disputed border-disputed-border",
      icon: XCircle,
      stageIndex: -1,
      isCancelled: true,
    };
  }

  const s = status.toUpperCase();
  switch (s) {
    case "SELECTED":
    case "ACCEPTED":
      return {
        label: "Offer Accepted",
        badgeClass: "bg-verified-muted text-verified border-verified-border",
        icon: CheckCircle2,
        stageIndex: 3,
        isCancelled: false,
      };
    case "SHORTLISTED":
      return {
        label: "Shortlisted",
        badgeClass: "bg-pending-muted text-pending border-pending-border",
        icon: Sparkles,
        stageIndex: 2,
        isCancelled: false,
      };
    case "REJECTED":
      return {
        label: "Not Selected",
        badgeClass: "bg-disputed-muted text-disputed border-disputed-border",
        icon: XCircle,
        stageIndex: -1,
        isCancelled: false,
      };
    case "WITHDRAWN":
      return {
        label: "Withdrawn",
        badgeClass: "bg-muted text-muted-foreground border-border",
        icon: XCircle,
        stageIndex: -1,
        isCancelled: false,
      };
    case "PENDING":
    default:
      return {
        label: "Under Review",
        badgeClass: "bg-muted text-foreground border-border",
        icon: Clock,
        stageIndex: 1,
        isCancelled: false,
      };
  }
}

/** Skeleton placeholder matching proposal cards & table view */
function ApplicationsSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading proposals" aria-busy="true">
      {/* Metric strip skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border p-4 rounded-2xl animate-pulse space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-7 w-28 bg-muted rounded-md" />
            <div className="h-3 w-36 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border p-5 rounded-2xl animate-pulse space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-muted rounded-xl" />
                <div className="space-y-1.5">
                  <div className="h-4 w-40 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
              </div>
              <div className="h-6 w-24 bg-muted rounded-full" />
            </div>
            <div className="h-10 bg-muted/60 rounded-xl" />
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="h-8 bg-muted rounded" />
              <div className="h-8 bg-muted rounded" />
              <div className="h-8 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ApplicationsPage() {
  const { data: session } = useSession();
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const limit = 10;

  const applicationsFetcher = createSchemaFetcher(applicationsResponseSchema);
  const {
    data: payload,
    isLoading: loading,
    error: fetchErr,
    mutate,
  } = useSWR<ApplicationsResponse>(
    session?.user ? `/api/applications?page=${page}&limit=${limit}` : null,
    applicationsFetcher
  );

  const applications = useMemo(() => {
    const raw = payload?.data?.applications || payload?.applications;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(payload?.data)) return payload.data as ApplicationItem[];
    return [];
  }, [payload]);
  const totalPages = payload?.data?.totalPages || payload?.totalPages || 1;

  const isAppCancelled = (app: ApplicationItem) => {
    return (
      app.dealStatus?.toUpperCase() === "CANCELLED" ||
      app.campaign?.status?.toUpperCase() === "CANCELLED"
    );
  };

  // Compute KPI summary figures
  const kpis = useMemo(() => {
    let underReviewCount = 0;
    let approvedOffersCount = 0;
    let totalProposedPaise = 0;

    applications.forEach((app) => {
      const s = app.status.toUpperCase();
      const cancelled = isAppCancelled(app);
      if (cancelled) {
        // Cancelled proposals do not count in active review or offers
      } else if (s === "PENDING" || s === "SHORTLISTED") {
        underReviewCount++;
      } else if (s === "SELECTED" || s === "ACCEPTED") {
        approvedOffersCount++;
      }
      totalProposedPaise += app.proposedRate || 0;
    });

    return {
      total: applications.length,
      underReview: underReviewCount,
      offers: approvedOffersCount,
      totalPitchValue: totalProposedPaise,
    };
  }, [applications]);

  // Client-side filtering by tab and search
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const s = app.status.toUpperCase();
      const cancelled = isAppCancelled(app);
      const isReview = !cancelled && (s === "PENDING" || s === "SHORTLISTED");
      const isOffer = !cancelled && (s === "SELECTED" || s === "ACCEPTED");
      const isArchived = cancelled || s === "REJECTED" || s === "WITHDRAWN";

      // Tab filter
      if (activeTab === "REVIEW" && !isReview) return false;
      if (activeTab === "OFFERS" && !isOffer) return false;
      if (activeTab === "ARCHIVED" && !isArchived) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = app.campaign?.title?.toLowerCase().includes(query);
        const brandMatch = app.campaign?.brand?.companyName?.toLowerCase().includes(query);
        if (!titleMatch && !brandMatch) return false;
      }

      return true;
    });
  }, [applications, activeTab, searchQuery]);

  let error = "";
  if (fetchErr) {
    error = "Failed to fetch applications. Please check your network connection.";
  } else if (payload && !payload.success) {
    error = payload.message || "Failed to load applications.";
  }

  if (!session) {
    return (
      <PageContainer maxWidth="7xl" className="space-y-6 py-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </PageContainer>
    );
  }

  // Brands don't submit applications — they receive them on their campaign pages
  if (session.user?.userType === "BRAND") {
    return (
      <DashboardShell user={session.user}>
        <PageContainer maxWidth="7xl" className="py-8 space-y-8">
          <PageHeader
            title="Campaign Submissions & Pitches"
            subtitle="As a brand, creators apply directly to your campaigns. Review, shortlist, and approve pitches from your campaign dashboard."
            actions={
              <Button href="/dashboard/campaigns/create" variant="primary">
                Create New Campaign
              </Button>
            }
          />
          <div className="py-12 text-center flex flex-col items-center border border-border rounded-2xl bg-card p-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              Review Pitches in Campaign Dashboard
            </h2>
            <p className="text-muted-foreground max-w-md text-sm leading-relaxed mb-6">
              Creator proposals are submitted directly to specific campaigns. Access your campaign details to negotiate terms, hire creators, and fund escrow milestones.
            </p>
            <Button href="/dashboard/campaigns" variant="primary">
              Go to Campaign Management
            </Button>
          </div>
        </PageContainer>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={session.user}>
      <PullToRefresh onRefresh={async () => { await mutate(); }}>
        <PageContainer maxWidth="7xl" className="space-y-8 py-8">
          {/* Page Header */}
          <PageHeader
            title="My Applications & Proposals"
            badge={
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Briefcase className="w-3.5 h-3.5" />
                Creator Pitches
              </span>
            }
            subtitle="Track your pitch statuses, negotiate terms, sign escrow contracts, and unlock deal rooms."
            actions={
              <Button
                href="/dashboard/campaigns"
                variant="primary"
                className="inline-flex items-center gap-2 shadow-xs font-medium"
              >
                <Search className="w-4 h-4" />
                Discover Campaigns
              </Button>
            }
          />

          {/* Error Alert */}
          {error && (
            <div className="p-4 rounded-xl border border-disputed-border bg-disputed-muted text-disputed flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Pitches</span>
                <Send className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-extrabold text-foreground tabular-nums">
                {kpis.total}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Proposals submitted</p>
            </div>

            <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider">Under Review</span>
                <Clock className="w-4 h-4 text-pending" />
              </div>
              <div className="text-2xl font-extrabold text-pending tabular-nums">
                {kpis.underReview}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Pending or shortlisted</p>
            </div>

            <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider">Contract Offers</span>
                <CheckCircle2 className="w-4 h-4 text-verified" />
              </div>
              <div className="text-2xl font-extrabold text-verified tabular-nums">
                {kpis.offers}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Ready for contract signing</p>
            </div>

            <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider">Pitched Value</span>
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-extrabold text-foreground tabular-nums">
                {formatCurrency(kpis.totalPitchValue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total prospective pipeline</p>
            </div>
          </div>

          {/* Filter Bar & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-3 sm:p-4 rounded-2xl shadow-xs">
            {/* Filter Tabs */}
            <HorizontalScrollArea aria-label="Application proposal filter tabs" containerClassName="flex-1 min-w-0" showScrollIndicator={true}>
              <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/50 min-w-max shrink-0">
                {(
                  [
                    { id: "ALL", label: "All Proposals", count: applications.length },
                    { id: "REVIEW", label: "Under Review", count: kpis.underReview },
                    { id: "OFFERS", label: "Offers", count: kpis.offers },
                    {
                      id: "ARCHIVED",
                      label: "Archived",
                      count: applications.filter(
                        (a) =>
                          isAppCancelled(a) ||
                          a.status.toUpperCase() === "REJECTED" ||
                          a.status.toUpperCase() === "WITHDRAWN"
                      ).length,
                    },
                  ] as const
                ).map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${isActive
                          ? "bg-card text-foreground shadow-xs border border-border/80"
                          : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                        }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums font-bold ${isActive
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                          }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </HorizontalScrollArea>

            {/* Search & View Mode Toggle */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="applications-search"
                  type="text"
                  placeholder="Search campaign or brand..."
                  aria-label="Search campaign or brand"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl pl-11 pr-9 py-2 min-h-[40px] text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* View Mode Switcher */}
              <div className="hidden md:flex items-center bg-muted p-1 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  aria-label="Card grid view"
                  className={`p-1.5 rounded-lg transition-all ${viewMode === "cards"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  aria-label="Table pipeline view"
                  className={`p-1.5 rounded-lg transition-all ${viewMode === "table"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Content Section */}
          {loading ? (
            <ApplicationsSkeleton />
          ) : applications.length === 0 ? (
            <EmptyState
              emoji=""
              title="No Applications Submitted Yet"
              description="You haven't pitched to any campaigns yet. Browse live verified campaigns and submit your proposal to earn escrow-guaranteed payouts."
              actionLabel="Discover Verified Campaigns"
              actionHref="/dashboard/campaigns"
            />
          ) : filteredApplications.length === 0 ? (
            <div className="bg-card border border-border p-12 text-center rounded-2xl">
              <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-60" />
              <h3 className="text-lg font-bold text-foreground">No matching proposals found</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                No applications match the current tab filter or search query. Try clearing your filters to see more.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setActiveTab("ALL");
                  setSearchQuery("");
                }}
                className="mt-4"
              >
                Reset Filters
              </Button>
            </div>
          ) : viewMode === "cards" ? (
            /* Card Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredApplications.map((app) => {
                const meta = getStatusMeta(app.status, app.dealStatus, app.campaign?.status);
                const StatusIcon = meta.icon;
                const isCancelled = meta.isCancelled;
                const isApproved =
                  (app.status.toUpperCase() === "SELECTED" ||
                    app.status.toUpperCase() === "ACCEPTED") &&
                  !isCancelled;
                const isRejected = app.status.toUpperCase() === "REJECTED" || isCancelled;

                let displayRate = "—";
                if (app.finalRate) {
                  displayRate = formatCurrency(app.finalRate);
                } else if (isApproved) {
                  displayRate = formatCurrency(app.proposedRate);
                }

                return (
                  <ListItem
                    key={app.id}
                    as="article"
                    variant="card"
                    className="flex flex-col justify-between group"
                    leading={
                      <div className="w-11 h-11 rounded-xl bg-muted border border-border flex items-center justify-center font-bold text-sm text-foreground overflow-hidden relative shrink-0">
                        {app.campaign.brand?.logo ? (
                          <Image
                            src={app.campaign.brand.logo}
                            alt={app.campaign.brand?.companyName ?? "Brand logo"}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        ) : app.campaign.brand?.companyName ? (
                          app.campaign.brand.companyName.slice(0, 2).toUpperCase()
                        ) : (
                          <Image
                            src="/logo-vm.png"
                            alt="VyaparMedia"
                            fill
                            unoptimized
                            className="object-contain p-1"
                          />
                        )}
                      </div>
                    }
                    title={
                      <Link
                        href={`/dashboard/campaigns/${app.campaign.id}`}
                        className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-1 inline-flex items-center gap-1"
                      >
                        {app.campaign.title}
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    }
                    titleBadge={
                      app.matchScore !== undefined ? (
                        <MatchScoreBadge
                          score={app.matchScore}
                          breakdown={app.matchBreakdown}
                        />
                      ) : undefined
                    }
                    subtitle={
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span>{app.campaign.brand?.companyName || "Verified Brand"}</span>
                        <span>•</span>
                        <span>Pitched {formatDate(app.createdAt)}</span>
                      </span>
                    }
                    meta={
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${meta.badgeClass}`}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {meta.label}
                        </span>
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-verified-muted text-verified border border-verified-border shrink-0">
                            <Sparkles className="w-3 h-3" />
                            Escrow Funded
                          </span>
                        )}
                      </div>
                    }
                    trailing={
                      <div className="text-right">
                        <div className={`text-base sm:text-lg font-extrabold font-mono tabular-nums ${isCancelled ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {displayRate !== "—" ? displayRate : formatCurrency(app.proposedRate)}
                        </div>
                        <div className="text-2xs text-muted-foreground font-medium">
                          {isCancelled ? "Cancelled" : displayRate !== "—" ? "Agreed Rate" : "Proposed Pitch"}
                        </div>
                      </div>
                    }
                  >

                    {/* Application Pipeline Stepper */}
                    <div className="bg-muted/40 border border-border/80 rounded-xl p-3 mb-4">
                      <div className="flex items-center justify-between text-2xs font-semibold text-muted-foreground mb-2">
                        <span>PIPELINE PROGRESS</span>
                        <span className="tabular-nums">
                          Submitted on {formatDate(app.createdAt)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {/* Step 1: Pitch */}
                        <div className="flex flex-col gap-1">
                          <div className="h-1.5 rounded-full bg-verified" />
                          <span className="text-2xs font-semibold text-verified truncate">
                            1. Pitch Sent
                          </span>
                        </div>

                        {/* Step 2: Review/Shortlist */}
                        <div className="flex flex-col gap-1">
                          <div
                            className={`h-1.5 rounded-full ${isRejected
                                ? "bg-disputed"
                                : meta.stageIndex >= 2
                                  ? "bg-verified"
                                  : "bg-border"
                              }`}
                          />
                          <span
                            className={`text-2xs font-semibold truncate ${isRejected
                                ? "text-disputed"
                                : meta.stageIndex >= 2
                                  ? "text-verified"
                                  : "text-muted-foreground"
                              }`}
                          >
                            {isRejected ? "Not Selected" : "2. Shortlist"}
                          </span>
                        </div>

                        {/* Step 3: Deal Contract */}
                        <div className="flex flex-col gap-1">
                          <div
                            className={`h-1.5 rounded-full ${isCancelled
                                ? "bg-disputed"
                                : isApproved
                                  ? "bg-verified"
                                  : "bg-border"
                              }`}
                          />
                          <span
                            className={`text-2xs font-semibold truncate ${isCancelled
                                ? "text-disputed"
                                : isApproved
                                  ? "text-verified"
                                  : "text-muted-foreground"
                              }`}
                          >
                            {isCancelled ? "3. Cancelled" : "3. Escrow Deal"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Cancellation or Rejection Feedback */}
                    {(isCancelled || app.rejectionReason) && (
                      <div className="mb-4 p-3 rounded-xl bg-disputed-muted border border-disputed-border text-disputed text-xs flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block mb-0.5">
                            {isCancelled
                              ? app.dealStatus === "CANCELLED"
                                ? "Deal Cancelled"
                                : "Campaign Cancelled"
                              : "Brand Feedback:"}
                          </span>
                          <span>
                            {app.rejectionReason || "This deal was cancelled. Any locked escrow funds have been refunded."}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Financial Terms Grid */}
                    <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-muted/60 border border-border text-xs mb-4">
                      <div>
                        <span className="text-2xs text-muted-foreground block font-medium mb-0.5">
                          YOUR PITCH
                        </span>
                        <span className="font-extrabold text-foreground tabular-nums">
                          {formatCurrency(app.proposedRate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-2xs text-muted-foreground block font-medium mb-0.5">
                          BUDGET CAP
                        </span>
                        <span className="font-medium text-muted-foreground tabular-nums">
                          {app.campaign.perInfluencerBudget > 0
                            ? formatCurrency(app.campaign.perInfluencerBudget)
                            : "Open"}
                        </span>
                      </div>
                      <div>
                        <span className="text-2xs text-muted-foreground block font-medium mb-0.5">
                          FINAL RATE
                        </span>
                        <span
                          className={`font-extrabold tabular-nums ${isCancelled
                              ? "text-muted-foreground line-through"
                              : isApproved
                                ? "text-verified"
                                : "text-foreground"
                            }`}
                        >
                          {displayRate}
                        </span>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                      <Link
                        href={`/dashboard/campaigns/${app.campaign.id}`}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 py-2.5 px-3 min-h-[44px] rounded-lg hover:bg-muted transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View Campaign Brief
                      </Link>

                      <div className="flex items-center gap-2">
                        {isCancelled && app.dealId ? (
                          <Button
                            href={`/dashboard/deals/${app.dealId}`}
                            variant="secondary"
                            size="sm"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 font-semibold border border-border"
                          >
                            View Deal Room
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        ) : isApproved && app.dealId ? (
                          <Button
                            href={`/dashboard/deals/${app.dealId}`}
                            variant="primary"
                            size="sm"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 font-bold shadow-sm"
                          >
                            ✍️ Sign Contract & Deal Room
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            href={`/dashboard/campaigns/${app.campaign.id}`}
                            variant="secondary"
                            size="sm"
                            className="w-full sm:w-auto"
                          >
                            Details
                          </Button>
                        )}
                      </div>
                    </div>
                  </ListItem>
                );
              })}
            </div>
          ) : (
            /* Pipeline List View using shared ListItem primitive */
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs divide-y divide-border">
              {filteredApplications.map((app) => {
                const meta = getStatusMeta(app.status, app.dealStatus, app.campaign?.status);
                const StatusIcon = meta.icon;
                const isCancelled = meta.isCancelled;
                const isApproved =
                  (app.status.toUpperCase() === "SELECTED" ||
                    app.status.toUpperCase() === "ACCEPTED") &&
                  !isCancelled;

                let displayRate = "—";
                if (app.finalRate) {
                  displayRate = formatCurrency(app.finalRate);
                } else if (isApproved) {
                  displayRate = formatCurrency(app.proposedRate);
                }

                return (
                  <ListItem
                    key={app.id}
                    variant="flush"
                    leading={
                      <div className="w-11 h-11 rounded-xl bg-muted border border-border flex items-center justify-center font-bold text-xs text-foreground overflow-hidden relative shrink-0">
                        {app.campaign.brand?.logo ? (
                          <Image
                            src={app.campaign.brand.logo}
                            alt={app.campaign.brand?.companyName ?? "Brand logo"}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        ) : app.campaign.brand?.companyName ? (
                          app.campaign.brand.companyName.slice(0, 2).toUpperCase()
                        ) : (
                          <Image
                            src="/logo-vm.png"
                            alt="VyaparMedia"
                            fill
                            unoptimized
                            className="object-contain p-1"
                          />
                        )}
                      </div>
                    }
                    title={
                      <Link
                        href={`/dashboard/campaigns/${app.campaign.id}`}
                        className="font-bold text-sm text-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                      >
                        {app.campaign.title}
                      </Link>
                    }
                    titleBadge={
                      app.matchScore !== undefined ? (
                        <MatchScoreBadge
                          score={app.matchScore}
                          breakdown={app.matchBreakdown}
                        />
                      ) : undefined
                    }
                    subtitle={
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span>{app.campaign.brand?.companyName || "Verified Brand"}</span>
                        <span>•</span>
                        <span>Pitched {formatDate(app.createdAt)}</span>
                      </span>
                    }
                    meta={
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${meta.badgeClass}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {meta.label}
                        </span>
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-verified-muted text-verified border border-verified-border">
                            <Sparkles className="w-3 h-3" />
                            Escrow Funded
                          </span>
                        )}
                        <span className="text-xs font-semibold text-muted-foreground">
                          Pitch: {formatCurrency(app.proposedRate)}
                        </span>
                      </div>
                    }
                    trailing={
                      <div className="text-right">
                        <div className={`text-sm sm:text-base font-extrabold font-mono tabular-nums ${isCancelled ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {displayRate !== "—" ? displayRate : formatCurrency(app.proposedRate)}
                        </div>
                        <div className="text-2xs text-muted-foreground font-medium">
                          {isCancelled ? "Cancelled" : displayRate !== "—" ? "Final Rate" : "Proposed Pitch"}
                        </div>
                      </div>
                    }
                    trailingSecondary={
                      <div className="flex items-center gap-2">
                        {isCancelled && app.dealId ? (
                          <Button
                            href={`/dashboard/deals/${app.dealId}`}
                            variant="secondary"
                            size="sm"
                            className="font-medium text-xs py-1.5 px-3 min-h-[36px] border border-border"
                          >
                            Deal Room
                          </Button>
                        ) : isApproved && app.dealId ? (
                          <Button
                            href={`/dashboard/deals/${app.dealId}`}
                            variant="primary"
                            size="sm"
                            className="font-bold shadow-xs text-xs py-1.5 px-3 min-h-[36px]"
                          >
                            ✍️ Deal Room
                          </Button>
                        ) : (
                          <Button
                            href={`/dashboard/campaigns/${app.campaign.id}`}
                            variant="secondary"
                            size="sm"
                            className="text-xs py-1.5 px-3 min-h-[36px]"
                          >
                            Brief
                          </Button>
                        )}
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-6">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="font-medium"
              >
                Previous Page
              </Button>
              <span className="text-xs font-semibold text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="font-medium"
              >
                Next Page
              </Button>
            </div>
          )}
        </PageContainer>
      </PullToRefresh>
    </DashboardShell>
  );
}
