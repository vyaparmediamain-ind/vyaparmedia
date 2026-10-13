"use client";

import React, { useRef } from "react";
import Link from "next/link";
import useSWR from "swr";
import { createSchemaFetcher } from "@/lib/fetcher";
import {
  type StoryDeal,
  dealsListResponseSchema,
  type DealsListResponse,
} from "@/lib/schemas";
import { calculateDealProgress, getCreateActionConfig } from "@/config/navigation";
import { Plus, ChevronLeft, ChevronRight, ShieldCheck, Lock, AlertTriangle, AlertCircle } from "lucide-react";
import { Avatar } from "@/components/ui";

export type { StoryDeal };

interface EscrowStoriesBarProps {
  userType?: string | null | undefined;
  initialDeals?: StoryDeal[];
}

const dealsFetcher = createSchemaFetcher(dealsListResponseSchema);

export default function EscrowStoriesBar({
  userType,
  initialDeals = [],
}: Readonly<EscrowStoriesBarProps>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch real user deals with runtime schema validation
  const { data } = useSWR<DealsListResponse>(
    "/api/deals?limit=10&status=active",
    dealsFetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  const isBrand = (userType || "").toUpperCase() === "BRAND";
  const dealsSource = data?.data?.deals ?? data?.deals;
  const rawDeals: StoryDeal[] = dealsSource
    ? dealsSource.map((d) => ({
        id: d.id,
        title: d.title ?? d.campaign?.title ?? "Campaign Deal",
        state: d.state ?? d.status ?? "ACTIVE",
        counterpartyName:
          d.counterpartyName ??
          (isBrand
            ? d.influencer?.displayName ?? d.influencer?.user?.name ?? "Creator"
            : d.brand?.companyName ?? d.brand?.user?.name ?? "Brand"),
        counterpartyAvatar:
          d.counterpartyAvatar ??
          (isBrand
            ? d.influencer?.avatar ?? d.influencer?.user?.image ?? null
            : d.brand?.logo ?? d.brand?.user?.image ?? null),
        amount: d.amount ?? d.totalAmount,
      }))
    : initialDeals;
  const createAction = getCreateActionConfig(userType);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === "left" ? -240 : 240;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // SVG ring constants
  const size = 68;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <nav
      aria-label="Active Escrow Deals Stories"
      className="relative w-full bg-card/60 backdrop-blur-sm border-b border-border/60 py-3.5 px-4 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] transition-colors"
    >
      <div className="max-w-7xl mx-auto relative group">
        {/* Left Scroll Button (Desktop) */}
        <button
          type="button"
          onClick={() => scroll("left")}
          className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-card border border-border shadow-md items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 hover:bg-muted"
          aria-label="Scroll stories left"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>

        {/* Stories Horizontal Container */}
        <div
          ref={scrollContainerRef}
          tabIndex={0}
          aria-label="Scrollable list of active escrow deals"
          className="flex items-center gap-4 md:gap-5 overflow-x-auto scrollbar-none py-1 px-1 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-xl"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {/* Story Item 0: Context-Aware Create Story */}
          <Link
            href={createAction.href}
            className="flex flex-col items-center gap-1.5 shrink-0 group/item focus:outline-none"
            aria-label={createAction.ariaLabel}
          >
            <div className="relative w-[68px] h-[68px] flex items-center justify-center">
              <div className="w-14 h-14 rounded-full border-2 border-dashed border-primary/50 group-hover/item:border-primary group-hover/item:scale-105 transition-all flex items-center justify-center bg-primary/5 text-primary">
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </div>
              {/* Badge dot */}
              <span className="absolute bottom-1 right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[10px] font-bold shadow">
                +
              </span>
            </div>
            <span className="text-[11px] font-medium text-foreground text-center max-w-[72px] truncate">
              {isBrand ? "New Brief" : "Submit"}
            </span>
            <span className="text-[10px] font-semibold text-primary">
              Action
            </span>
          </Link>

          {/* Active Deals Stories */}
          {rawDeals.map((deal) => {
            const progress = calculateDealProgress(deal.state);
            const strokeDashoffset =
              circumference - (progress.percentage / 100) * circumference;

            return (
              <Link
                key={deal.id}
                href={`/dashboard/deals/${deal.id}`}
                className="flex flex-col items-center gap-1.5 shrink-0 group/deal focus:outline-none"
                aria-label={`Deal: ${deal.title}. Progress: ${progress.percentage}% ${progress.stageName}`}
              >
                {/* Avatar with Circular SVG Progress Ring */}
                <div className="relative w-[68px] h-[68px] flex items-center justify-center">
                  <svg
                    width={size}
                    height={size}
                    className="absolute inset-0 -rotate-90 pointer-events-none"
                    aria-hidden="true"
                  >
                    {/* Background track circle */}
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth={strokeWidth}
                      className="text-muted/60"
                    />
                    {/* Animated Progress Ring */}
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="transparent"
                      stroke={progress.strokeHex}
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                      style={{
                        strokeDashoffset,
                      }}
                    />
                  </svg>

                  {/* Inner Circular Avatar */}
                  <div className="w-13 h-13 rounded-full overflow-hidden p-0.5 bg-card relative z-1 group-hover/deal:scale-95 transition-transform flex items-center justify-center">
                    <Avatar
                      src={deal.counterpartyAvatar}
                      name={deal.counterpartyName || deal.title || "VM"}
                      size="md"
                      className="w-full h-full rounded-full"
                    />
                  </div>

                  {/* Tiny Status Icon Indicator badge */}
                  <span
                    className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border border-card flex items-center justify-center shadow text-white ${
                      progress.isDisputed
                        ? "bg-disputed"
                        : progress.percentage >= 90
                        ? "bg-verified"
                        : progress.percentage >= 50
                        ? "bg-escrow"
                        : "bg-pending"
                    }`}
                    aria-hidden="true"
                  >
                    {progress.isDisputed ? (
                      <AlertCircle className="w-2.5 h-2.5" />
                    ) : progress.percentage >= 90 ? (
                      <ShieldCheck className="w-2.5 h-2.5" />
                    ) : progress.percentage >= 50 ? (
                      <Lock className="w-2.5 h-2.5" />
                    ) : (
                      <AlertTriangle className="w-2.5 h-2.5" />
                    )}
                  </span>
                </div>

                {/* Deal / Counterparty Label */}
                <span className="text-[11px] font-medium text-foreground text-center max-w-[72px] truncate group-hover/deal:text-primary transition-colors">
                  {deal.counterpartyName || deal.title}
                </span>

                {/* Escrow Progress Percentage Badge */}
                <span
                  className={`text-[10px] font-bold tabular-nums px-1.5 py-0.2 rounded-full border shrink-0 whitespace-nowrap ${
                    progress.isDisputed
                      ? "bg-disputed-muted text-disputed border-disputed-border"
                      : progress.percentage >= 90
                      ? "bg-verified-muted text-verified border-verified-border"
                      : progress.percentage >= 50
                      ? "bg-escrow-muted text-escrow border-escrow-border"
                      : "bg-pending-muted text-pending border-pending-border"
                  }`}
                >
                  {progress.percentage}%
                </span>
              </Link>
            );
          })}

          {rawDeals.length === 0 && (
            <div className="flex items-center text-xs text-muted-foreground py-2 px-3 italic">
              No active escrow deals yet. Tap &quot;+&quot; to begin.
            </div>
          )}
        </div>

        {/* Right Scroll Button (Desktop) */}
        <button
          type="button"
          onClick={() => scroll("right")}
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-card border border-border shadow-md items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 hover:bg-muted"
          aria-label="Scroll stories right"
        >
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      </div>
    </nav>
  );
}
