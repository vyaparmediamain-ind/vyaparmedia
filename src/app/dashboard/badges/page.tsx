"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useSession } from "next-auth/react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { BadgeDefinition } from "@/lib/badges";
import EmptyState from "@/components/ui/EmptyState";
import { Button, PageContainer, PageHeader } from "@/components/ui";
import { formatNumber } from "@/lib/utils-client";
import {
  Trophy,
  Star,
  Zap,
  Lock,
  CheckCircle2,
  TrendingUp,
  Filter,
} from "lucide-react";
import {
  type BadgesResponse,
} from "@/lib/schemas";

interface BadgeWithStatus extends BadgeDefinition {
  earned: boolean;
  earnedAt?: string;
  hasProgress?: boolean;
  currentProgress?: number;
  targetProgress?: number;
}

const CATEGORY_ITEMS = [
  { id: "ALL",          label: "All Badges",    icon: <Trophy className="w-3.5 h-3.5" /> },
  { id: "MILESTONE",    label: "Milestone",     icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { id: "ACHIEVEMENT",  label: "Achievement",   icon: <Star className="w-3.5 h-3.5" /> },
  { id: "COMMUNITY",    label: "Community",     icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { id: "SPECIAL",      label: "Special",       icon: <Zap className="w-3.5 h-3.5" /> },
  { id: "VERIFICATION", label: "Verification",  icon: <Lock className="w-3.5 h-3.5" /> },
] as const;

const RARITY_ITEMS = [
  { id: "ALL",       label: "All Rarities", accent: "bg-muted text-muted-foreground border-border" },
  { id: "COMMON",    label: "Common",       accent: "bg-muted text-muted-foreground border-border" },
  { id: "RARE",      label: "Rare",         accent: "bg-escrow-muted text-escrow border-escrow-border" },
  { id: "EPIC",      label: "Epic",         accent: "bg-pending-muted text-pending border-pending-border" },
  { id: "LEGENDARY", label: "Legendary",    accent: "bg-verified-muted text-verified border-verified-border" },
] as const;

/** Map rarity → visual accent tokens */
function rarityAccent(rarity: string): { border: string; glow: string; badge: string } {
  switch (rarity) {
    case "LEGENDARY":
      return {
        border: "border-verified-border",
        glow: "shadow-verified/20",
        badge: "bg-verified-muted text-verified border border-verified-border",
      };
    case "EPIC":
      return {
        border: "border-pending-border",
        glow: "shadow-pending/20",
        badge: "bg-pending-muted text-pending border border-pending-border",
      };
    case "RARE":
      return {
        border: "border-escrow-border",
        glow: "shadow-escrow/20",
        badge: "bg-escrow-muted text-escrow border border-escrow-border",
      };
    default:
      return {
        border: "border-border",
        glow: "",
        badge: "bg-muted text-muted-foreground border border-border",
      };
  }
}

export default function BadgesPage() {
  const { data: session } = useSession();
  const shouldReduceMotion = useReducedMotion();
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [activeRarity, setActiveRarity] = useState<string>("ALL");

  const { data, isLoading: loading, error: fetchErr, mutate } = useSWR<BadgesResponse>(
    "/api/gamification/badges",
    fetcher
  );

  const badges: BadgeWithStatus[] = (data?.badges || []) as unknown as BadgeWithStatus[];
  const stats = data?.stats || null;
  const hasError = Boolean(fetchErr);

  const filteredBadges = badges.filter((b) => {
    const categoryMatch = activeCategory === "ALL" || b.category === activeCategory;
    const rarityMatch = activeRarity === "ALL" || b.rarity === activeRarity;
    return categoryMatch && rarityMatch;
  });

  const earnedCount = badges.filter((b) => b.earned).length;

  if (!session) {
    return (
      <DashboardShell user={undefined}>
        <PageContainer maxWidth="5xl" className="flex items-center justify-center h-48 py-4 sm:py-6">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </PageContainer>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={session.user}>
      <PageContainer maxWidth="5xl" className="space-y-6 pb-12 py-4 sm:py-6">

        {/* ── Page Header ── */}
        <PageHeader
          title="Badges & Achievements"
          icon={
            <div className="w-10 h-10 rounded-xl bg-pending/10 border border-pending-border flex items-center justify-center">
              <Trophy className="w-5 h-5 text-pending" />
            </div>
          }
          subtitle="Collect badges, earn XP, and level up your creator trust profile"
          actions={
            stats ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-verified-muted border border-verified-border text-verified text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {earnedCount} / {badges.length} Earned
                </span>
              </div>
            ) : undefined
          }
          border={false}
        />

        {/* ── Stats KPI Strip ── */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: <Star className="w-5 h-5 text-pending" />,
                label: "Current Level",
                value: `Lv. ${stats.level}`,
                bg: "bg-pending/10 border-pending-border",
              },
              {
                icon: <Zap className="w-5 h-5 text-escrow" />,
                label: "Total XP Earned",
                value: formatNumber(stats.xp),
                bg: "bg-escrow/10 border-escrow-border",
              },
              {
                icon: <Trophy className="w-5 h-5 text-verified" />,
                label: "Badges Earned",
                value: `${stats.totalBadges} / ${stats.availableBadges}`,
                bg: "bg-verified/10 border-verified-border",
              },
            ].map((kpi, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { delay: i * 0.08 }}
                className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border shadow-sm"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${kpi.bg}`}>
                  {kpi.icon}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                  <p className="text-2xl font-extrabold text-foreground tabular-nums leading-tight">
                    {kpi.value}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Next Badges to Unlock (CRED Style Milestone Track) ── */}
        {!loading && badges.filter((b) => !b.earned).length > 0 && (
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                <h2 className="text-sm font-extrabold text-foreground">Nearest Milestones to Unlock</h2>
              </div>
              <span className="text-xs text-muted-foreground">Level up by completing these actions</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {badges
                .filter((b) => !b.earned)
                .sort((a, b) => {
                  const progA = a.hasProgress ? (a.currentProgress || 0) / (a.targetProgress || 1) : 0;
                  const progB = b.hasProgress ? (b.currentProgress || 0) / (b.targetProgress || 1) : 0;
                  return progB - progA;
                })
                .slice(0, 3)
                .map((nextBadge) => {
                  const pct = nextBadge.hasProgress
                    ? Math.min(100, Math.round(((nextBadge.currentProgress || 0) / (nextBadge.targetProgress || 1)) * 100))
                    : 0;

                  return (
                    <div
                      key={nextBadge.id}
                      className="p-3.5 rounded-xl bg-muted/40 border border-border flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0 p-1.5 rounded-lg bg-card border border-border">
                          {nextBadge.icon}
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-foreground truncate">{nextBadge.name}</h3>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{nextBadge.description}</p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                          <span className="font-semibold">Next unlock progress</span>
                          <span className="font-bold text-foreground tabular-nums">
                            {nextBadge.hasProgress ? `${pct}%` : "In Progress"}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-700"
                            style={{ width: `${Math.max(5, pct)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px]">
                        <span className="font-bold uppercase tracking-wider text-muted-foreground">
                          {nextBadge.category}
                        </span>
                        <span className="font-bold text-primary tabular-nums">+{nextBadge.xpReward} XP</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ── Category Filter Tabs ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORY_ITEMS.map((cat) => {
            const count =
              cat.id === "ALL"
                ? badges.length
                : badges.filter((b) => b.category === cat.id).length;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {cat.icon}
                {cat.label}
                {count > 0 && (
                  <span className="tabular-nums opacity-70">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Rarity Sub-filter Row ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            Rarity:
          </span>
          {RARITY_ITEMS.map((r) => {
            const isActive = activeRarity === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveRarity(r.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                  isActive
                    ? r.accent + " shadow-sm ring-1 ring-inset ring-current/20"
                    : "bg-card text-muted-foreground border-border hover:bg-muted/50"
                }`}
              >
                {r.label}
              </button>
            );
          })}
          <span className="ml-auto text-xs text-muted-foreground font-medium tabular-nums">
            {filteredBadges.length} of {badges.length} badges
          </span>
        </div>

        {/* ── Loading State ── */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-52 rounded-2xl bg-muted/40 border border-border animate-pulse"
              />
            ))}
          </div>
        )}

        {/* ── Error State ── */}
        {hasError && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-disputed-muted border border-disputed-border flex items-center justify-center">
              <Trophy className="w-6 h-6 text-disputed" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Failed to load achievements
            </p>
            <p className="text-xs text-muted-foreground">
              Please check your connection and try again.
            </p>
            <Button variant="secondary" size="sm" onClick={() => mutate()}>
              Retry
            </Button>
          </div>
        )}

        {/* ── Badge Grid ── */}
        {!loading && !hasError && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredBadges.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    emoji=""
                    title="No Badges Found"
                    description="No achievements match the selected filters. Try adjusting the category or rarity."
                    compact
                  />
                </div>
              ) : (
                filteredBadges.map((badge, index) => {
                  const accent = rarityAccent(badge.rarity ?? "COMMON");
                  const progressPct = badge.hasProgress && !badge.earned
                    ? Math.min(100, Math.max(0,
                        ((badge.currentProgress || 0) / (badge.targetProgress || 1)) * 100
                      ))
                    : 0;

                  return (
                    <motion.div
                      key={badge.id}
                      layout={!shouldReduceMotion}
                      initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.88 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { delay: index * 0.04 }}
                      className={`relative flex flex-col items-center text-center p-6 rounded-2xl bg-card border shadow-sm transition-all hover:shadow-md ${
                        badge.earned
                          ? `${accent.border} ${accent.glow}`
                          : "border-border opacity-75"
                      }`}
                    >
                      {/* Earned crown badge */}
                      {badge.earned && (
                        <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-verified-muted text-verified border border-verified-border text-[10px] font-extrabold uppercase tracking-wider">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Earned
                        </span>
                      )}

                      {/* Locked overlay for unearned */}
                      {!badge.earned && !badge.hasProgress && (
                        <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border text-[10px] font-bold uppercase tracking-wider">
                          <Lock className="w-2.5 h-2.5" />
                          Locked
                        </span>
                      )}

                      {/* Badge icon */}
                      <div
                        className={`text-4xl mb-4 transition-all ${
                          badge.earned ? "" : "grayscale opacity-40"
                        }`}
                      >
                        {badge.icon}
                      </div>

                      {/* Badge name */}
                      <h3
                        className={`text-base font-bold mb-1.5 tracking-tight ${
                          badge.earned ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {badge.name}
                      </h3>

                      {/* Description */}
                      <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">
                        {badge.description}
                      </p>

                      {/* Progress bar for in-progress badges */}
                      {!badge.earned && badge.hasProgress && (
                        <div className="w-full mb-4">
                          <div className="flex justify-between items-center text-xs mb-1.5">
                            <span className="font-semibold text-muted-foreground">Progress</span>
                            <span className="font-bold text-foreground tabular-nums">
                              {badge.id.startsWith("earn_")
                                ? `${formatNumber(badge.currentProgress || 0)} / ${formatNumber(badge.targetProgress || 1)}`
                                : `${badge.currentProgress || 0} / ${badge.targetProgress || 1}`}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: shouldReduceMotion ? `${progressPct}%` : 0 }}
                              animate={{ width: `${progressPct}%` }}
                              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.8, ease: "easeOut" }}
                              className="h-full bg-primary rounded-full"
                              aria-label={`${badge.name} progress: ${progressPct.toFixed(0)}%`}
                            />
                          </div>
                        </div>
                      )}

                      {/* Footer: category + XP */}
                      <div className="w-full flex items-center justify-between pt-3 border-t border-border/60 mt-auto">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${accent.badge}`}>
                          {badge.rarity ?? "COMMON"}
                        </span>
                        <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full tabular-nums">
                          +{badge.xpReward} XP
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        )}
      </PageContainer>
    </DashboardShell>
  );
}
