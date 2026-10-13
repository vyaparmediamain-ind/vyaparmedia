"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Lock, Sparkles, TrendingUp, Plus, Compass } from "lucide-react";
import { formatCurrency } from "@/lib/utils-client";

interface DashboardStoriesBarProps {
  isBrand: boolean;
  activeDealsCount: number;
  escrowBalancePaise: number;
  trustScore: number;
  level: number;
}

export function DashboardStoriesBar({
  isBrand,
  activeDealsCount,
  escrowBalancePaise,
  trustScore,
  level,
}: Readonly<DashboardStoriesBarProps>) {
  const stories = [
    {
      id: "action-deals",
      label: activeDealsCount > 0 ? `${activeDealsCount} Active Deals` : "Collaborations",
      subtext: activeDealsCount > 0 ? "In Pipeline" : "Start New",
      icon: <Sparkles className="w-5 h-5 text-primary" />,
      href: "/dashboard/deals",
      hasPulse: activeDealsCount > 0,
      isAction: false,
    },
    {
      id: "escrow-vault",
      label: "Escrow Vault",
      subtext: escrowBalancePaise > 0 ? formatCurrency(escrowBalancePaise) : "Protected",
      icon: <Lock className="w-5 h-5 text-escrow" />,
      href: "/dashboard/wallet",
      hasPulse: escrowBalancePaise > 0,
      isAction: false,
    },
    {
      id: "trust-drs",
      label: `DRS ${trustScore}`,
      subtext: `Level ${level} Elite`,
      icon: <ShieldCheck className="w-5 h-5 text-verified" />,
      href: "/dashboard/leaderboard",
      hasPulse: false,
      isAction: false,
    },
    {
      id: "explore-collabs",
      label: isBrand ? "Discover Creators" : "Find Campaigns",
      subtext: "Live Market",
      icon: isBrand ? (
        <Compass className="w-5 h-5 text-primary" />
      ) : (
        <TrendingUp className="w-5 h-5 text-primary" />
      ),
      href: isBrand ? "/dashboard/influencers" : "/dashboard/campaigns",
      hasPulse: false,
      isAction: false,
    },
    {
      id: "quick-create",
      label: isBrand ? "New Campaign" : "Media Kit",
      subtext: isBrand ? "Launch 1-Click" : "Update Rates",
      icon: <Plus className="w-5 h-5 text-primary" />,
      href: isBrand ? "/dashboard/campaigns/create" : "/dashboard/creator-profile",
      hasPulse: false,
      isAction: true,
    },
  ];

  return (
    <nav
      aria-label="Dashboard highlight stories"
      className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-2 pt-1 scrollbar-none -mx-1 px-1 touch-pan-x"
    >
      {stories.map((story) => (
        <Link
          key={story.id}
          href={story.href}
          className="group flex flex-col items-center gap-1.5 shrink-0 min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl p-1 transition-all"
        >
          <div className="relative">
            {story.isAction ? (
              /* Instagram Add-to-Story style dashed action ring */
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-primary/50 group-hover:border-primary p-0.5 transition-all duration-200 group-hover:scale-105 active:scale-95 flex items-center justify-center bg-card shadow-xs">
                <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/15 transition-colors">
                  {story.icon}
                </div>
              </div>
            ) : story.hasPulse ? (
              /* Instagram active unread story: rich multi-color gradient ring */
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full p-[2.5px] transition-transform duration-200 group-hover:scale-105 active:scale-95 flex items-center justify-center shadow-xs bg-gradient-to-tr from-amber-500 via-rose-500 to-primary">
                <div className="w-full h-full rounded-full p-[2px] bg-card flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-muted/60 flex items-center justify-center transition-colors group-hover:bg-muted">
                    {story.icon}
                  </div>
                </div>
              </div>
            ) : (
              /* Viewed story ring */
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full p-[2px] ring-2 ring-border/80 group-hover:ring-primary/60 transition-all duration-200 group-hover:scale-105 active:scale-95 flex items-center justify-center bg-card shadow-xs">
                <div className="w-full h-full rounded-full bg-muted/50 flex items-center justify-center transition-colors group-hover:bg-muted">
                  {story.icon}
                </div>
              </div>
            )}

            {/* Unread badge dot */}
            {story.hasPulse && (
              <span
                className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-primary border-2 border-card shadow-xs"
                aria-hidden="true"
              />
            )}
          </div>

          <div className="text-center">
            <span className="block text-[11px] sm:text-xs font-bold text-foreground group-hover:text-primary transition-colors max-w-[84px] sm:max-w-[92px] truncate">
              {story.label}
            </span>
            <span className="block text-[10px] text-muted-foreground font-medium max-w-[84px] sm:max-w-[92px] truncate">
              {story.subtext}
            </span>
          </div>
        </Link>
      ))}
    </nav>
  );
}
