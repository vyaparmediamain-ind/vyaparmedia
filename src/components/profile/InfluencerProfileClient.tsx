"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  InfluencerProfileData,
  CampaignProofItem,
} from "./types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils-client";
import { copyToClipboard } from "@/lib/clipboard";
import CampaignProofModal from "./CampaignProofModal";
import { BottomSheet, PageContainer } from "@/components/ui";
import {
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Zap,
  Lock,
  Star,
  Share2,
  Send,
  PlusCircle,
  Settings,
  Grid3X3,
  Tag,
  MessageSquareQuote,
  Info,
  Clock,
  Layers,
  MapPin,
  FileCheck2,
  Camera,
  Video,
  ArrowRight,
  Wallet,
  Smartphone,
} from "lucide-react";
import { useWallet } from "@/hooks/api/useWallet";
import { checkDirectMessageEligibility } from "@/lib/action-eligibility";
import StoryShareModal from "@/components/share/StoryShareModal";

interface InfluencerProfileClientProps {
  profile: InfluencerProfileData;
  viewerRole?: string | null | undefined;
  isOwnProfile?: boolean | undefined;
  canMessage?: boolean | undefined;
}

type TabKey = "portfolio" | "rate-card" | "reviews" | "about";

/**
/**
 * Trust Score Tier Determiner - CIBIL Scale Standard (300 - 900)
 */
export function getTrustScoreTier(score: number): {
  label: string;
  cibilGrade: string;
  cibilRange: string;
  colorClass: string;
  strokeColor: string;
  bgClass: string;
} {
  if (score >= 800) {
    return {
      label: "Elite Creator",
      cibilGrade: "Excellent",
      cibilRange: "750 - 900",
      colorClass: "text-verified",
      strokeColor: "var(--verified-default, #22c55e)",
      bgClass: "bg-verified-muted text-verified border-verified-border",
    };
  }
  if (score >= 700) {
    return {
      label: "High Trust",
      cibilGrade: "Good",
      cibilRange: "700 - 749",
      colorClass: "text-escrow",
      strokeColor: "var(--escrow-default, #3b82f6)",
      bgClass: "bg-escrow-muted text-escrow border-escrow-border",
    };
  }
  if (score >= 600) {
    return {
      label: "Verified Good",
      cibilGrade: "Fair",
      cibilRange: "650 - 699",
      colorClass: "text-primary",
      strokeColor: "var(--primary-default, #6366f1)",
      bgClass: "bg-primary/10 text-primary border-primary/25",
    };
  }
  if (score >= 550) {
    return {
      label: "Emerging",
      cibilGrade: "Average",
      cibilRange: "550 - 649",
      colorClass: "text-pending",
      strokeColor: "var(--pending-default, #f59e0b)",
      bgClass: "bg-pending-muted text-pending border-pending-border",
    };
  }
  return {
    label: "Needs Attention",
    cibilGrade: "Poor",
    cibilRange: "300 - 549",
    colorClass: "text-destructive",
    strokeColor: "var(--destructive, #ef4444)",
    bgClass: "bg-destructive/10 text-destructive border-destructive/20",
  };
}

export default function InfluencerProfileClient({
  profile,
  viewerRole,
  isOwnProfile = false,
  canMessage,
}: Readonly<InfluencerProfileClientProps>) {
  const [activeTab, setActiveTab] = useState<TabKey>("portfolio");
  const [selectedProof, setSelectedProof] = useState<CampaignProofItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [canMessageState, setCanMessageState] = useState<boolean>(Boolean(canMessage));
  const [showStoryModal, setShowStoryModal] = useState<boolean>(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (canMessage !== undefined) {
      setCanMessageState(canMessage);
      return;
    }

    if (profile.userId && !isOwnProfile) {
      fetch(`/api/messages/can-message?with=${encodeURIComponent(profile.userId)}`)
        .then((res) => (res.ok ? res.json() : { canMessage: false }))
        .then((data) => {
          if (typeof data.canMessage === "boolean") {
            setCanMessageState(data.canMessage);
          }
        })
        .catch(() => setCanMessageState(false));
    }
  }, [canMessage, profile.userId, isOwnProfile]);

  const messageEligibility = checkDirectMessageEligibility(canMessageState, isOwnProfile);

  // Mobile swipe navigation across tabs
  const touchStartXRef = useRef<number>(0);
  const tabList: TabKey[] = ["portfolio", "rate-card", "reviews", "about"];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]!.clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0]!.clientX;
    const deltaX = touchEndX - touchStartXRef.current;

    // Swipe threshold: 60px
    if (Math.abs(deltaX) > 60) {
      const currentIndex = tabList.indexOf(activeTab);
      if (deltaX < 0 && currentIndex < tabList.length - 1) {
        setActiveTab(tabList[currentIndex + 1]!);
      } else if (deltaX > 0 && currentIndex > 0) {
        setActiveTab(tabList[currentIndex - 1]!);
      }
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${profile.displayName} on VyaparMedia`,
          text: `Check out ${profile.displayName}'s verified creator portfolio, rates & trust score on VyaparMedia`,
          url: window.location.href,
        });
      } catch {
        // Cancelled share
      }
    } else {
      await copyToClipboard(window.location.href);
      setToastMessage("Profile link copied to clipboard!");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const isBrand = (viewerRole || "").toUpperCase() === "BRAND";
  const trustInfo = getTrustScoreTier(profile.trustScore);
  const { walletData } = useWallet();
  const walletBalancePaise = walletData?.balance ?? 0;
  const startingRatePaise = profile.minRatePaise || 2000000;
  const formattedStartingRate = formatCurrency(startingRatePaise);
  const isLowBalance = Boolean(
    isBrand && walletData && walletBalancePaise < Math.max(startingRatePaise, 50000)
  );
  // SVG Radial Gauge Calculations for DRS Trust Score (300 to 900 CIBIL Standard)
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const progressFraction = Math.min(Math.max((profile.trustScore - 300) / 600, 0), 1);
  const strokeDashoffset = circumference * (1 - progressFraction);

  return (
    <PageContainer
      maxWidth="4xl"
      className="py-4 md:py-8 space-y-6"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -20 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            role="alert"
            className="fixed top-[max(1.25rem,calc(env(safe-area-inset-top,0px)+12px))] left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-foreground text-background text-xs font-bold shadow-xl flex items-center gap-2"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-verified" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== 1. INSTAGRAM-STYLE PROFILE HEADER ==================== */}
      <header className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
          {/* Circular Avatar with Gradient Trust Ring */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-primary via-verified to-escrow shadow-md flex items-center justify-center">
              <div className="relative w-full h-full rounded-full overflow-hidden bg-muted flex items-center justify-center border-2 border-background">
                {profile.avatar ? (
                  <Image
                    src={profile.avatar}
                    alt={profile.displayName}
                    width={112}
                    height={112}
                    className="w-full h-full object-cover"
                    priority
                  />
                ) : (
                  <span className="text-2xl font-black text-foreground">
                    {profile.displayName.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Escrow Shield Overlay */}
            {profile.isKycVerified && (
              <div
                title="Aadhaar/PAN KYC Verified"
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-background border border-border shadow-md"
              >
                <ShieldCheck className="w-4 h-4 text-verified fill-verified/20" />
              </div>
            )}
          </div>

          {/* Identity & Actions Column */}
          <div className="flex-1 text-center sm:text-left space-y-3 min-w-0">
            {/* Display Name & Dual Distinct Verification Badges */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                {profile.displayName}
              </h1>

              {/* Social Verification Badge */}
              {profile.isSocialVerified && (
                <span
                  title="Social Verified: Official API Connected"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-primary/10 text-primary border-primary/25 shadow-xs shrink-0 whitespace-nowrap"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 fill-primary/20" />
                  <span>Social Verified</span>
                </span>
              )}

              {/* KYC Identity Badge */}
              {profile.isKycVerified && (
                <span
                  title="KYC Verified: Aadhaar/PAN identity verified for escrow"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-verified-muted text-verified border-verified-border shadow-xs shrink-0 whitespace-nowrap"
                >
                  <ShieldCheck className="w-3.5 h-3.5 fill-verified/20" />
                  <span>KYC Verified</span>
                </span>
              )}
            </div>

            {/* Handle, Location & Starting Price */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/80">
                @{profile.instagramHandle || profile.youtubeHandle || "creator"}
              </span>

              {profile.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <span>
                    {profile.city}
                    {profile.state ? `, ${profile.state}` : ""}
                  </span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 shrink-0 whitespace-nowrap">
                From {formattedStartingRate}
              </span>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-xs sm:text-sm text-foreground/90 max-w-xl leading-relaxed">
                {profile.bio}
              </p>
            )}

            {/* Category Niche Pills */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
              {profile.categories.map((niche, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border shrink-0 whitespace-nowrap"
                >
                  {niche}
                </span>
              ))}
            </div>

            {/* Context-Aware Action Buttons (Instagram Style) */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-2">
              {isOwnProfile ? (
                <>
                  <Link
                    href="/dashboard/settings"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-all shadow-xs"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowStoryModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all shadow-xs"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Add to Story</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-all shadow-xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Profile</span>
                  </button>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(true)}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                      <span>Invite to Campaign</span>
                    </button>
                    {isBrand && isLowBalance && (
                      <Link
                        href="/dashboard/wallet?topup=true"
                        title={`Available wallet balance: ${formatCurrency(walletBalancePaise)}. Top-up recommended for escrow.`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs hover:bg-amber-500/20 transition-colors shrink-0 whitespace-nowrap"
                      >
                        <Wallet className="w-2.5 h-2.5" />
                        <span>Low Bal — Add Funds</span>
                      </Link>
                    )}
                  </div>

                  {canMessageState ? (
                    <Link
                      href={`/dashboard/messages?with=${profile.userId}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-all shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Message</span>
                    </Link>
                  ) : (
                    <div className="relative group inline-flex items-center">
                      <button
                        type="button"
                        disabled
                        title={messageEligibility.reason || "Start a deal first to message this creator"}
                        aria-label={messageEligibility.reason || "Start a deal first to message this creator"}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-muted-foreground text-xs font-semibold cursor-not-allowed opacity-60 shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5 opacity-50" />
                        <span>Send Message</span>
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowStoryModal(true)}
                    aria-label="Share creator profile to Story"
                    title="Share to Instagram & WhatsApp Story"
                    className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-xs"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Turnaround ETA & Guarantees */}
            <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground flex-wrap justify-center sm:justify-start">
              <span className="inline-flex items-center gap-1 font-bold text-verified">
                <Clock className="w-3 h-3" />
                <span>Avg Response: &lt; 2h</span>
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <ShieldCheck className="w-3 h-3 text-escrow" />
                <span>100% Escrow Delivery Guarantee</span>
              </span>
            </div>
          </div>
        </div>

        {/* ==================== 2. STATS ROW (Instagram 3-Column Stats + DRS Gauge) ==================== */}
        <div className="grid grid-cols-3 gap-2 py-4 px-3 sm:px-6 rounded-2xl bg-card border border-border shadow-xs items-center text-center">
          {/* Stat 1: Completed Deals */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <FileCheck2 className="w-3.5 h-3.5 text-primary" />
              <span className="hidden xs:inline">Completed</span> Deals
            </div>
            <p className="text-lg sm:text-2xl font-black text-foreground tabular-nums">
              {profile.completedDealsCount}
            </p>
            <p className="text-[10px] text-muted-foreground hidden sm:block">
              100% Escrow Delivered
            </p>
          </div>

          {/* Stat 2: DRS Trust Score with Visual Radial Gauge */}
          <div className="border-x border-border/80 px-2 space-y-1">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>DRS Trust</span>
            </div>

            <div className="flex items-center justify-center gap-2">
              {/* Radial Progress Ring */}
              <div className="relative w-9 h-9 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center">
                <svg
                  className="w-full h-full -rotate-90"
                  viewBox="0 0 56 56"
                  aria-hidden="true"
                >
                  {/* Background Track */}
                  <circle
                    cx="28"
                    cy="28"
                    r={radius}
                    className="stroke-muted"
                    strokeWidth="5"
                    fill="none"
                  />
                  {/* Progress Ring */}
                  <circle
                    cx="28"
                    cy="28"
                    r={radius}
                    stroke={trustInfo.strokeColor}
                    strokeWidth="5"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="none"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-black text-foreground tabular-nums">
                  {Math.round(progressFraction * 100)}%
                </div>
              </div>

              <div className="text-left">
                <p className="text-base sm:text-xl font-black text-foreground tabular-nums leading-none">
                  {profile.trustScore}
                  <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">/900</span>
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-bold ${trustInfo.bgClass}`}>
                    {trustInfo.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-semibold hidden sm:inline" title="CIBIL-standard credit score model (300-900)">
                    ({trustInfo.cibilGrade} • 300-900)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stat 3: Response Rate & Speed */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-pending" />
              <span>Response</span>
            </div>
            <p className="text-lg sm:text-2xl font-black text-foreground tabular-nums">
              {profile.responseRatePercent}%
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              Avg {profile.avgResponseTime}
            </p>
          </div>
        </div>
      </header>

      {/* ==================== 3. SWIPEABLE TAB NAVIGATION ==================== */}
      <nav aria-label="Profile Sections" className="border-b border-border">
        <div className="flex items-center justify-start sm:justify-around overflow-x-auto no-scrollbar flex-nowrap" role="tablist">
          {[
            {
              id: "portfolio",
              label: "Campaign Proofs",
              icon: Grid3X3,
              count: profile.campaignProofs.length,
            },
            {
              id: "rate-card",
              label: "Rate Card",
              icon: Tag,
            },
            {
              id: "reviews",
              label: "Reviews",
              icon: MessageSquareQuote,
              count: profile.reviews.length,
            },
            {
              id: "about",
              label: "About",
              icon: Info,
            },
          ].map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id as TabKey)}
                className={`relative flex items-center gap-1.5 py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold transition-colors focus:outline-none shrink-0 whitespace-nowrap ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {typeof tab.count === "number" && (
                  <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                    ({tab.count})
                  </span>
                )}
                {/* Active Tab Spring Indicator */}
                {active && (
                  <motion.div
                    layoutId="profileActiveTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 500, damping: 35 }
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ==================== 4. TAB CONTENT PANELS ==================== */}
      <main>
        {/* TAB 1: INSTAGRAM-STYLE 3-COLUMN MEDIA GRID */}
        {activeTab === "portfolio" && (
          <section aria-label="Verified Campaign Proofs">
            {profile.campaignProofs.length === 0 ? (
              <div className="p-12 rounded-2xl border border-border bg-card text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Grid3X3 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-foreground">No Verified Proofs Yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Completed escrow deals with verified milestone deliverables will appear here in this portfolio grid.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
                {profile.campaignProofs.map((proof) => (
                  <button
                    key={proof.id}
                    type="button"
                    onClick={() => setSelectedProof(proof)}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-primary text-left transition-transform active:scale-[0.98]"
                  >
                    {/* Background Media Image or Fallback Escrow Card */}
                    {proof.coverImage ? (
                      <Image
                        src={proof.coverImage}
                        alt={proof.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-primary/10 via-card to-muted">
                        <Lock className="w-7 h-7 text-escrow mb-1.5" />
                        <span className="text-xs font-bold text-foreground line-clamp-2">
                          {proof.title}
                        </span>
                      </div>
                    )}

                    {/* Instagram-Style Gradient Scrim Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />

                    {/* Top Escrow Verification Shield Pill */}
                    <div className="absolute top-2.5 left-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md bg-escrow-muted/95 text-escrow border border-escrow-border shadow-xs shrink-0 whitespace-nowrap">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    </div>

                    {/* Bottom Metadata: Brand, Metric & Escrow Amount */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-1 text-white font-bold text-xs">
                        <span className="truncate">{proof.brandName}</span>
                        <span className="tabular-nums text-[11px] text-white/90 shrink-0">
                          {formatCurrency(proof.amountPaise)}
                        </span>
                      </div>
                      {proof.outcomeMetric && (
                        <p className="text-[10px] text-white/80 font-medium truncate">
                          {proof.outcomeMetric}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: TRANSPARENT RATE CARD */}
        {activeTab === "rate-card" && (
          <section aria-label="Transparent Rate Card" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  Official Rate Card & Deliverables
                </h3>
                <p className="text-xs text-muted-foreground">
                  Transparent escrow milestone rates. Funds locked until deliverables are approved.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-verified-muted text-verified border border-verified-border self-start sm:self-auto shrink-0 whitespace-nowrap">
                <Lock className="w-3.5 h-3.5" />
                <span>Escrow Protected</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profile.rateCard.map((item) => {
                const formattedPrice = formatCurrency(item.pricePaise);
                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl border border-border bg-card shadow-xs flex flex-col justify-between space-y-4 hover:border-primary/50 transition-colors group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                          {item.deliverable}
                        </h4>
                        <span className="text-base font-black text-foreground tabular-nums shrink-0">
                          {formattedPrice}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-border flex flex-col gap-2.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          <span>{item.turnaround}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{item.revisions} Revisions</span>
                        </div>
                      </div>

                      {!isOwnProfile && (
                        <Link
                          href={`/dashboard/campaigns/create?invite=${profile.id}&deliverable=${encodeURIComponent(item.deliverable)}`}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-muted hover:bg-primary hover:text-primary-foreground text-foreground text-xs font-bold transition-all border border-border"
                        >
                          <span>Select Deliverable</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 3: BRAND REVIEWS & RATINGS */}
        {activeTab === "reviews" && (
          <section aria-label="Brand Reviews" className="space-y-4">
            {profile.reviews.length === 0 ? (
              <div className="p-12 rounded-2xl border border-border bg-card text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Star className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-foreground">No Reviews Yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Verified brands will leave feedback upon deal milestone approval.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {profile.reviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex items-center justify-center text-xs font-bold text-foreground border border-border shrink-0">
                          {review.brandAvatar ? (
                            <Image
                              src={review.brandAvatar}
                              alt={review.brandName}
                              width={36}
                              height={36}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            review.brandName.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h5 className="text-xs sm:text-sm font-bold text-foreground">
                              {review.brandName}
                            </h5>
                            <ShieldCheck className="w-3.5 h-3.5 text-verified" />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDate(review.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* 5-Star Rating Indicator */}
                      <div className="flex items-center gap-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < review.rating ? "fill-amber-500" : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed pl-12">
                      &ldquo;{review.comment}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 4: ABOUT & PLATFORM DEMOGRAPHICS */}
        {activeTab === "about" && (
          <section aria-label="About Creator" className="space-y-4">
            <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-6">
              <div>
                <h4 className="text-sm sm:text-base font-bold text-foreground">
                  Audience & Connected Platforms
                </h4>
                <p className="text-xs text-muted-foreground">
                  Verified social statistics directly linked to VyaparMedia creator profile.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Instagram Channel Details */}
                {profile.instagramHandle && (
                  <div className="p-4 rounded-xl bg-muted/50 border border-border flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-pink-500/10 text-pink-600 flex items-center justify-center shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground truncate">
                          @{profile.instagramHandle}
                        </p>
                        <span className="text-[10px] font-bold text-verified bg-verified-muted px-1.5 py-0.5 rounded">
                          Connected
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatNumber(profile.instagramFollowers)} Followers • {profile.instagramEngagementRate || 4.2}% Eng.
                      </p>
                    </div>
                  </div>
                )}

                {/* YouTube Channel Details */}
                {profile.youtubeHandle && (
                  <div className="p-4 rounded-xl bg-muted/50 border border-border flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                      <Video className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground truncate">
                          {profile.youtubeHandle}
                        </p>
                        <span className="text-[10px] font-bold text-verified bg-verified-muted px-1.5 py-0.5 rounded">
                          Connected
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatNumber(profile.youtubeSubscribers)} Subscribers
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Languages Spoken */}
              {profile.languages.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                    Languages Spoken
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.languages.map((lang, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-md text-xs font-semibold bg-muted text-foreground border border-border"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CIBIL-Standard Creator Credit Rating (DRS™) Card */}
              <div className="pt-4 border-t border-border space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <div>
                      <h5 className="text-sm font-bold text-foreground">
                        Dynamic Reliability Score (DRS™)
                      </h5>
                      <p className="text-[11px] text-muted-foreground">
                        Creator Credit Rating modeled on India&apos;s CIBIL™ financial scoring standard (300 - 900)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-foreground tabular-nums">
                      {profile.trustScore}
                    </span>
                    <span className="text-xs text-muted-foreground"> / 900</span>
                    <div className="text-[10px] font-bold text-primary">
                      {trustInfo.cibilGrade} Tier ({trustInfo.cibilRange})
                    </div>
                  </div>
                </div>

                {/* Visual Scale Meter (300 to 900) */}
                <div className="space-y-1.5 bg-muted/30 p-3.5 rounded-xl border border-border">
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden flex">
                    <div className="h-full bg-destructive/60 w-[41.6%]" title="Poor / Subprime: 300 - 549" />
                    <div className="h-full bg-pending/60 w-[16.7%]" title="Below Average: 550 - 649" />
                    <div className="h-full bg-primary/60 w-[8.3%]" title="Fair / Neutral: 650 - 699" />
                    <div className="h-full bg-escrow/60 w-[8.3%]" title="Good Trust: 700 - 749" />
                    <div className="h-full bg-verified/80 w-[25.1%]" title="Prime / Elite: 750 - 900" />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>300 (Min)</span>
                    <span>550</span>
                    <span>650</span>
                    <span>750 (Prime)</span>
                    <span>900 (Max)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-2xs">
                    <div className="p-2 rounded-lg bg-card border border-border">
                      <span className="text-muted-foreground block">Current Standing</span>
                      <strong className="text-foreground">{trustInfo.label}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-card border border-border">
                      <span className="text-muted-foreground block">CIBIL Range</span>
                      <strong className="text-foreground">{trustInfo.cibilRange}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-card border border-border">
                      <span className="text-muted-foreground block">Completed Deals</span>
                      <strong className="text-foreground">{profile.completedDealsCount} Verified</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-card border border-border">
                      <span className="text-muted-foreground block">Escrow Settlement</span>
                      <strong className="text-verified">Priority / Fast-Track</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Escrow Guarantee Highlight */}
              <div className="pt-4 border-t border-border flex items-start gap-3 p-4 rounded-xl bg-escrow-muted border-escrow-border text-xs text-escrow">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-foreground">
                    100% Escrow Protection Guaranteed
                  </p>
                  <p className="text-muted-foreground">
                    When you book with {profile.displayName}, your payment is deposited into an RBI-compliant escrow account. Funds are released to the creator only after you review and approve the final content.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Campaign Proof Expanded Detail Modal */}
      <CampaignProofModal
        proof={selectedProof}
        onClose={() => setSelectedProof(null)}
      />

      {/* ==================== 5. STICKY BOTTOM COLLABORATION BAR ==================== */}
      {!isOwnProfile && (
        <aside
          aria-label="Sticky Collaboration Bar"
          className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border p-3 sm:p-4 pb-[max(0.75rem,calc(env(safe-area-inset-bottom,0px)+8px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] shadow-2xl"
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-verified" />
                <span>100% Escrow Safe</span>
              </div>
              <p className="text-sm sm:text-base font-black text-foreground tabular-nums truncate">
                From {formattedStartingRate}
                <span className="text-xs font-normal text-muted-foreground ml-1">/ deliverable</span>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isBrand ? (
                <div className="flex items-center gap-1.5">
                  {isLowBalance && (
                    <span
                      title={`Available balance: ${formatCurrency(walletBalancePaise)}`}
                      className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pending-muted text-pending border border-pending-border shrink-0 whitespace-nowrap"
                    >
                      <Wallet className="w-2.5 h-2.5" />
                      <span>Low Bal</span>
                    </span>
                  )}
                  <Link
                    href={`/dashboard/campaigns/create?invite=${profile.id}`}
                    className="inline-flex items-center gap-1.5 px-4 sm:px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold shadow-md shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95"
                  >
                    <PlusCircle className="w-4 h-4 stroke-[2.5]" />
                    <span>Book Creator</span>
                  </Link>
                </div>
              ) : (
                <Link
                  href={`/login?callbackUrl=/creator/${encodeURIComponent(profile.instagramHandle || profile.id)}`}
                  className="inline-flex items-center gap-1.5 px-4 sm:px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold shadow-md shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95"
                >
                  <span>Book Creator</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Quick Invite to Campaign Modal */}
      {showInviteModal && (
        <BottomSheet
          open={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          title={
            <span className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Collaborate with {profile.displayName}
            </span>
          }
          maxWidth="28rem"
        >
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Choose how you would like to initiate this collaboration under VyaparMedia&apos;s RBI-compliant escrow guarantee.
            </p>

            <div className="space-y-3 pt-1">
              <Link
                href={`/dashboard/campaigns/create?invite=${profile.id}`}
                className="p-3.5 rounded-2xl bg-muted/40 hover:bg-muted/80 border border-border flex items-center justify-between group transition-all"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-foreground block group-hover:text-primary transition-colors">
                      Dedicated Campaign Invite
                    </span>
                    {isBrand && isLowBalance && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-pending-muted text-pending border border-pending-border shrink-0 whitespace-nowrap">
                        Low Bal ({formatCurrency(walletBalancePaise)})
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    Customize deliverables, dates &amp; fund escrow directly
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>

              {canMessageState ? (
                <Link
                  href={`/dashboard/messages?with=${profile.userId}`}
                  className="p-3.5 rounded-2xl bg-muted/40 hover:bg-muted/80 border border-border flex items-center justify-between group transition-all"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs text-foreground block group-hover:text-primary transition-colors">
                      Direct Negotiation Chat
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Discuss brief &amp; deliverables before creating agreement
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </Link>
              ) : (
                <div
                  className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 flex items-center justify-between opacity-75 cursor-not-allowed"
                  title={messageEligibility.reason || "Start a deal first to message this creator"}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-muted-foreground block">
                        Direct Negotiation Chat
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 whitespace-nowrap">
                        Deal Required
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground block">
                      {messageEligibility.reason || "Start a deal first to message this creator."}
                    </span>
                  </div>
                  <Lock className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                </div>
              )}
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Story Share Modal (Instagram & WhatsApp Story) */}
      <StoryShareModal
        open={showStoryModal}
        onClose={() => setShowStoryModal(false)}
        defaultTab="profile"
        userType="INFLUENCER"
        profile={{
          displayName: profile.displayName,
          // Only use instagramHandle as URL slug — displayName can contain spaces causing 404
          username: profile.instagramHandle?.replace(/^@/, "").toLowerCase() || undefined,
          avatar: profile.avatar,
          trustScore: profile.trustScore,
          categories: profile.categories,
          city: profile.city,
          completedDealsCount: profile.completedDealsCount,
          isKycVerified: profile.isKycVerified,
          userType: "INFLUENCER",
        }}
      />
    </PageContainer>
  );
}
