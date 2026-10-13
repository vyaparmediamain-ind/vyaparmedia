"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { ALL_CATEGORIES } from "@/lib/categories";
import { Select } from "@/components/ui";

interface CampaignFiltersBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  isBrand?: boolean;
  selectedStatus?: string;
  setSelectedStatus?: (status: string) => void;
}

const categories = ["All", ...ALL_CATEGORIES];

export function CampaignFiltersBar({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  sortBy,
  setSortBy,
  isBrand = false,
  selectedStatus = "ALL",
  setSelectedStatus,
}: Readonly<CampaignFiltersBarProps>) {
  return (
    <div className="space-y-4 mb-6">
      {/* Search Input & Sort Selector */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="search-campaigns-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns by brand, title, or keywords..."
            className="w-full pl-10 pr-10 min-h-[44px] py-2.5 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            aria-label="Search campaigns"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear campaign search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div className="sm:w-56 shrink-0">
          <Select
            id="sort-campaigns-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort campaigns"
            className="text-xs sm:text-sm font-medium"
            options={[
              { value: "newest", label: "Newest First" },
              { value: "budget_high", label: "Budget: High to Low" },
              { value: "budget_low", label: "Budget: Low to High" },
              { value: "deadline", label: "Deadline: Ending Soon" },
            ]}
          />
        </div>
      </div>

      {/* Brand Lifecycle Status Filter Tabs */}
      {isBrand && setSelectedStatus && (
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border overflow-x-auto scrollbar-none w-fit">
          {[
            { key: "ALL", label: "All Briefs" },
            { key: "ACTIVE", label: "Active" },
            { key: "DRAFT", label: "Drafts" },
            { key: "COMPLETED", label: "Completed" },
            { key: "CANCELLED", label: "Cancelled" },
          ].map((tab) => {
            const isActive = (selectedStatus || "ALL") === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedStatus(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Horizontally Scrollable Category Chips Carousel (Instagram Explore Style) */}
      <nav
        aria-label="Campaign category filters"
        className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none -mx-1 px-1"
      >
        {categories.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`shrink-0 whitespace-nowrap px-3.5 py-2 min-h-[44px] inline-flex items-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-muted-foreground hover:text-foreground border border-border hover:border-border/80"
              }`}
            >
              {category}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
