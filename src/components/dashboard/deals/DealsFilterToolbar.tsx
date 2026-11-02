"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { Select, HorizontalScrollArea } from "@/components/ui";

export interface FilterTabOption {
  key: string;
  label: string;
  count?: number;
}

interface DealsFilterToolbarProps {
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy?: string;
  setSortBy?: (sort: string) => void;
  tabCounts?: Record<string, number>;
}

export const DEAL_STATUS_TABS: FilterTabOption[] = [
  { key: "all", label: "All Deals" },
  { key: "PENDING_SIGNATURE", label: "Awaiting Signature" },
  { key: "ACTIVE", label: "Active" },
  { key: "PAYMENT_HELD", label: "Secured" },
  { key: "CONTENT_SUBMITTED", label: "Awaiting Review" },
  { key: "REVISION_REQUESTED", label: "Revision Needed" },
  { key: "CONTENT_APPROVED", label: "Ready to Post" },
  { key: "POSTED", label: "Post Submitted" },
  { key: "VERIFIED", label: "Verified" },
  { key: "COMPLETED", label: "Completed" },
  { key: "DISPUTED", label: "Disputed" },
  { key: "CANCELLED", label: "Cancelled" },
];

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "deadline", label: "Posting Deadline (Soonest)" },
  { value: "amount_desc", label: "Contract Value (High to Low)" },
  { value: "amount_asc", label: "Contract Value (Low to High)" },
];

export function DealsFilterToolbar({
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  sortBy = "newest",
  setSortBy,
  tabCounts = {},
}: Readonly<DealsFilterToolbarProps>) {
  return (
    <div className="space-y-4 mb-6">
      {/* 1. Search Bar, Sort Toggle & Status Dropdown */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            id="deals-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by campaign, brand name, or deliverable..."
            aria-label="Search by campaign, brand name, or deliverable"
            className="w-full pl-11 pr-11 min-h-[44px] rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort By selector */}
        {setSortBy && (
          <div className="sm:w-56 shrink-0">
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort deals"
              className="text-xs sm:text-sm font-medium"
              options={SORT_OPTIONS.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
            />
          </div>
        )}

        {/* Status Dropdown (on mobile/small screens for rapid selection) */}
        <div className="sm:w-52 shrink-0">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter deals by status"
            className="text-xs sm:text-sm font-medium"
            options={DEAL_STATUS_TABS.map((tab) => ({
              value: tab.key,
              label: `${tab.label} ${tabCounts?.[tab.key] !== undefined ? `(${tabCounts[tab.key]})` : ""}`.trim(),
            }))}
          />
        </div>
      </div>

      {/* 2. Horizontally Scrollable Stage Tabs */}
      <HorizontalScrollArea aria-label="Deal status filters" showScrollIndicator={true}>
        <nav
          aria-label="Deal status filters"
          className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/50 min-w-max shrink-0"
        >
          {DEAL_STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.key;
            const count = tabCounts?.[tab.key];

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 min-h-[38px] rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-card text-foreground shadow-xs border border-border/80 font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                }`}
              >
                <span>{tab.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono tabular-nums font-bold shrink-0 whitespace-nowrap ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </HorizontalScrollArea>
    </div>
  );
}
