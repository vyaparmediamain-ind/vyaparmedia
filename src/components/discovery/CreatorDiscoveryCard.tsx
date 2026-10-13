"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatCurrency } from "@/lib/utils-client";
import { CreatorDiscoveryItem } from "./types";
import { apiClient } from "@/lib/api-client";
import { Card } from "@/components/ui";
import {
  ShieldCheck,
  Bookmark,
  Share2,
  Users,
  Flame,
  ArrowUpRight,
  Sparkles,
  Send,
} from "lucide-react";

interface CreatorDiscoveryCardProps {
  creator: CreatorDiscoveryItem;
  onToggleBookmark?: (id: string, nextState: boolean) => Promise<void>;
  showInviteButton?: boolean;
}

function getNicheGradient(niche?: string): string {
  const n = (niche || "").toLowerCase();
  if (n.includes("fashion") || n.includes("beauty") || n.includes("lifestyle")) {
    return "from-pink-500 via-rose-500 to-purple-600";
  }
  if (n.includes("tech") || n.includes("gadget") || n.includes("crypto") || n.includes("dev")) {
    return "from-blue-600 via-indigo-600 to-cyan-500";
  }
  if (n.includes("fitness") || n.includes("gym") || n.includes("health") || n.includes("sport")) {
    return "from-orange-500 via-amber-500 to-red-600";
  }
  if (n.includes("food") || n.includes("cook") || n.includes("travel")) {
    return "from-amber-400 via-orange-500 to-rose-500";
  }
  if (n.includes("finance") || n.includes("business") || n.includes("marketing")) {
    return "from-emerald-500 via-teal-600 to-cyan-700";
  }
  if (n.includes("gaming") || n.includes("esport")) {
    return "from-violet-600 via-purple-600 to-fuchsia-600";
  }
  return "from-primary via-verified/70 to-escrow";
}

export default function CreatorDiscoveryCard({
  creator,
  onToggleBookmark,
  showInviteButton = false,
}: Readonly<CreatorDiscoveryCardProps>) {
  const [isSaved, setIsSaved] = useState(Boolean(creator.isSaved));
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleBookmarkClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const nextState = !isSaved;
    setIsSaved(nextState);
    setIsSaving(true);

    try {
      if (onToggleBookmark) {
        await onToggleBookmark(creator.id, nextState);
      } else {
        await apiClient.users.toggleBookmark({
          targetId: creator.id,
          targetType: "creator",
          isSaved: nextState,
        });
      }
    } catch {
      setIsSaved(!nextState);
      setToastMessage("Failed to save creator. Reverted.");
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: creator.name,
          text: `Check out ${creator.name} (@${creator.handle}) on VyaparMedia`,
          url: window.location.origin + `/dashboard/influencers/${creator.id}`,
        });
      } catch {
        // Cancelled
      }
    } else {
      navigator.clipboard?.writeText(window.location.origin + `/dashboard/influencers/${creator.id}`);
      setToastMessage("Creator profile link copied!");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const formatFollowers = (count: number) => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return count.toString();
  };

  const startingRate = formatCurrency(creator.startingRatePaise);

  return (
    <Card as="article" className="relative w-full overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col mb-4 group">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="alert"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-foreground text-background text-xs font-semibold shadow-lg animate-in fade-in duration-200"
        >
          {toastMessage}
        </div>
      )}

      {/* Creator Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0 border border-border flex items-center justify-center">
            {creator.avatar ? (
              <Image
                src={creator.avatar}
                alt={creator.name}
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold text-foreground">
                {creator.name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-heading font-bold text-foreground truncate group-hover:text-primary transition-colors">
                {creator.name}
              </h4>
              {creator.isKycVerified && (
                <span title="KYC Verified Creator" className="text-verified">
                  <ShieldCheck className="w-4 h-4 fill-verified/15" aria-label="KYC Verified Creator" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              @{creator.handle} • {creator.city || "India"}
            </p>
          </div>
        </div>

        {/* KYC Badge Pill */}
        {creator.isKycVerified && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-verified-muted text-verified border-verified-border shrink-0 whitespace-nowrap">
            <ShieldCheck className="w-3 h-3" />
            <span>KYC Verified</span>
          </span>
        )}
      </div>

      {/* Image-First Showcase Container */}
      <div className="relative aspect-[16/10] w-full bg-muted overflow-hidden">
        {creator.coverImage ? (
          <Image
            src={creator.coverImage}
            alt={`${creator.name}'s top content`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div
            className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br ${getNicheGradient(
              creator.niche
            )} p-6 text-center relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-500`}
          >
            {/* Ambient pattern glow */}
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-card/10 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-background/20 blur-2xl pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-card/20 backdrop-blur-md border border-border/40 flex items-center justify-center text-primary-foreground text-xl font-black font-heading shadow-lg mb-2.5">
                {creator.name.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-sm font-bold text-primary-foreground tracking-wide drop-shadow-xs">
                {creator.niche} Creator
              </span>
              <span className="text-[11px] text-primary-foreground/80 font-medium mt-0.5">
                @{creator.handle}
              </span>
            </div>
          </div>
        )}

        {/* Upfront Trust Score Chip (Top Left) */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md bg-card/90 text-foreground border-border shadow-md shrink-0 whitespace-nowrap" title="Dynamic Reliability Score (CIBIL-standard 300-900)">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>DRS {creator.trustScore}</span>
        </div>

        {/* Niche Badge (Top Right) */}
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md bg-card/90 text-foreground border border-border shadow-sm shrink-0 whitespace-nowrap">
            {creator.niche}
          </span>
        </div>
      </div>

      {/* Card Content & Metrics Row */}
      <div className="p-4 md:p-5 flex-1 flex flex-col justify-between space-y-4">
        {/* Metric Badges */}
        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-muted border border-border text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground font-medium">
              <Users className="w-3 h-3" />
              <span>Followers</span>
            </div>
            <span className="text-sm font-bold text-foreground tabular-nums font-mono">
              {formatFollowers(creator.followers)}
            </span>
          </div>
          <div className="border-x border-border">
            <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground font-medium">
              <Flame className="w-3 h-3 text-pending" />
              <span>Eng. Rate</span>
            </div>
            <span className="text-sm font-bold text-foreground tabular-nums font-mono">
              {creator.engagementRate}%
            </span>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">
              Starting At
            </div>
            <span className="text-sm font-bold text-foreground tabular-nums font-mono">
              {startingRate}
            </span>
          </div>
        </div>

        {/* Action Row */}
        <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground font-medium">
            Verified Escrow Payouts
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={handleShareClick}
              title="Share profile"
              aria-label="Share creator profile"
              className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleBookmarkClick}
              disabled={isSaving}
              title={isSaved ? "Remove from saved" : "Save creator"}
              aria-label={isSaved ? "Remove from saved" : "Save creator"}
              className={`w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                isSaved
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
            </button>

            {showInviteButton && (
              <Link
                href={`/dashboard/campaigns/create?invite=${creator.id}`}
                className="inline-flex items-center justify-center gap-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-verified text-primary-foreground text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-sm flex-1 sm:flex-initial"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Invite</span>
              </Link>
            )}

            <Link
              href={`/dashboard/influencers/${creator.id}`}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:opacity-90 transition-all flex-1 sm:flex-initial"
            >
              <span>View Profile</span>
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
