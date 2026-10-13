"use client";

import React, { useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useSession } from "next-auth/react";

import {
  Trophy,
  Crown,
  Flame,
  Medal,
  Sparkles,
  MapPin,
  ShieldCheck,
  Users,
  Building2,
  ChevronRight,
} from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import DashboardShell from "@/components/dashboard/DashboardShell";
import EmptyState from "@/components/ui/EmptyState";
import { Select, PullToRefresh, PageContainer, ListItem, PageHeader } from "@/components/ui";
import { formatNumber } from "@/lib/utils-client";
import { ALL_CATEGORIES } from "@/lib/categories";

interface LeaderboardUser {
  id: string;
  name: string;
  avatar: string;
  subtitle: string;
  city?: string;
  score: number;
  level: number;
  trustScore?: number;
  deals?: number;
  isWeeklyChampion?: boolean;
}

interface HallOfFameUser {
  rank: number;
  id: string;
  name: string;
  avatar: string;
  xp: number;
  level: number;
  deals: number;
}

const CITIES = [
  "Mumbai",
  "Delhi",
  "Bangalore",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Pune",
  "Jaipur",
];

export default function LeaderboardPage() {
  const shouldReduceMotion = useReducedMotion();
  const { data: session } = useSession();
  const [tab, setTab] = useState<"influencers" | "brands">("influencers");
  const [filter, setFilter] = useState<"all-time" | "weekly">("all-time");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");

  const params = new URLSearchParams({ filter });
  if (city) params.set("city", city);
  if (category) params.set("category", category);

  const {
    data: leaderboardData,
    isLoading: loading,
    error: fetchErr,
    mutate,
  } = useSWR<{
    influencers?: LeaderboardUser[];
    brands?: LeaderboardUser[];
    hallOfFame?: HallOfFameUser[];
  }>(`/api/gamification/leaderboard?${params.toString()}`, fetcher);

  const influencers: LeaderboardUser[] = leaderboardData?.influencers || [];
  const brands: LeaderboardUser[] = leaderboardData?.brands || [];
  const hallOfFame: HallOfFameUser[] = leaderboardData?.hallOfFame || [];
  const error = fetchErr
    ? "Failed to load leaderboard. Please check your network and refresh."
    : null;

  const activeList = tab === "influencers" ? influencers : brands;
  const scoreLabel =
    tab === "influencers"
      ? filter === "weekly"
        ? "Deals This Week"
        : "Total XP"
      : filter === "weekly"
      ? "Deals This Week"
      : "Trust Score";

  const first = hallOfFame[0];
  const second = hallOfFame[1];
  const third = hallOfFame[2];
  const weeklyChampion = influencers[0]?.isWeeklyChampion ? influencers[0] : null;

  if (!session) {
    return (
      <DashboardShell user={null}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={session.user}>
      <PullToRefresh onRefresh={async () => { await mutate(); }}>
        <PageContainer maxWidth="5xl" className="space-y-8 py-8">
        {/* Page Header */}
        <PageHeader
          title="Top Performers & Leaderboard"
          badge={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Trophy className="w-3.5 h-3.5" />
              Bharat Hall of Fame
            </span>
          }
          subtitle="Recognizing India's most active creators and trusted brands based on completed escrow contracts, verified reviews, and DRS trust scores."
        />

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-card border border-border shadow-xs">
          {/* Persona & Period Toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Influencer / Brand Toggle */}
            <div className="flex items-center bg-muted p-1 rounded-2xl border border-border">
              <button
                type="button"
                onClick={() => setTab("influencers")}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                  tab === "influencers"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Creators
              </button>
              <button
                type="button"
                onClick={() => setTab("brands")}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                  tab === "brands"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Brands
              </button>
            </div>

            {/* Timeframe Toggle */}
            <div className="flex items-center bg-muted p-1 rounded-2xl border border-border">
              <button
                type="button"
                onClick={() => setFilter("all-time")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filter === "all-time"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All-Time
              </button>
              <button
                type="button"
                onClick={() => setFilter("weekly")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 ${
                  filter === "weekly"
                    ? "bg-amber-500 text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Flame className="w-3 h-3" />
                This Week
              </button>
            </div>
          </div>

          {/* Location & Niche Selectors */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="text-xs py-1.5 px-3 rounded-xl bg-background border-border text-foreground w-auto min-w-[130px]"
            >
              <option value="">All Cities</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>

            {tab === "influencers" && (
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="text-xs py-1.5 px-3 rounded-xl bg-background border-border text-foreground w-auto min-w-[140px]"
              >
                <option value="">All Categories</option>
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>

        {/* Weekly Hot Creator Banner */}
        {filter === "weekly" &&
          weeklyChampion &&
          tab === "influencers" && (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
              className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 flex-shrink-0">
                  <Flame className="w-8 h-8 fill-current" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 text-2xs font-extrabold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full mb-1">
                    <Sparkles className="w-3 h-3" />
                    Hot Creator of the Week
                  </div>
                  <h2 className="text-xl font-black text-foreground">
                    {weeklyChampion.name}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Completed <strong>{weeklyChampion.score} escrow deals</strong> in the last 7 days.
                  </p>
                </div>
              </div>

              <Link
                href={`/dashboard/influencers/${weeklyChampion.id}`}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-primary-foreground hover:bg-amber-600 transition-colors shadow-xs inline-flex items-center gap-1.5"
              >
                View Profile
                <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>
          )}

        {/* Top-3 Visual Podium (Duolingo / Strava Pattern) */}
        {filter === "all-time" &&
          tab === "influencers" &&
          first &&
          second &&
          third && (
            <div className="py-6 px-4 sm:px-8 bg-card border border-border rounded-3xl shadow-xs">
              <div className="text-center mb-6">
                <span className="text-2xs font-bold text-muted-foreground uppercase tracking-widest block">
                  All-Time Hall of Fame
                </span>
                <h2 className="text-lg font-extrabold text-foreground">
                  India&apos;s Top 3 Creators
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-6 items-end justify-center max-w-2xl mx-auto pt-6">
                {/* 2nd Place (Silver) */}
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.1 }}
                  className="flex flex-col items-center text-center space-y-2 order-1"
                >
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-border overflow-hidden relative shadow-sm">
                      {second.avatar ? (
                        <Image
                          src={second.avatar}
                          alt={second.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center font-bold text-sm text-foreground">
                          {second.name?.slice(0, 2).toUpperCase() || "?"}
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-muted text-foreground border border-border flex items-center justify-center font-black text-xs shadow-xs">
                      2
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="font-bold text-xs sm:text-sm text-foreground block truncate max-w-[100px] sm:max-w-[140px]">
                      {second.name}
                    </span>
                    <span className="text-2xs text-muted-foreground font-semibold tabular-nums">
                      {formatNumber(second.xp)} XP
                    </span>
                  </div>

                  {/* Silver Pedestal */}
                  <div className="w-full h-24 sm:h-28 rounded-t-2xl bg-muted/60 border-t-2 border-x-2 border-border flex flex-col items-center justify-center p-2">
                    <Medal className="w-6 h-6 text-muted-foreground mb-1" />
                    <span className="text-2xs font-extrabold text-muted-foreground uppercase">
                      Silver
                    </span>
                  </div>
                </motion.div>

                {/* 1st Place (Gold) */}
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { delay: 0 }}
                  className="flex flex-col items-center text-center space-y-2 order-2"
                >
                  <Crown className={`w-7 h-7 text-amber-500 ${shouldReduceMotion ? "" : "animate-bounce"}`} />
                  <div className="relative">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-amber-500 overflow-hidden relative shadow-md">
                      {first.avatar ? (
                        <Image
                          src={first.avatar}
                          alt={first.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center font-bold text-lg text-foreground">
                          {first.name?.slice(0, 2).toUpperCase() || "?"}
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-amber-500 text-primary-foreground flex items-center justify-center font-black text-sm shadow-xs">
                      1
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="font-extrabold text-sm sm:text-base text-foreground block truncate max-w-[110px] sm:max-w-[160px]">
                      {first.name}
                    </span>
                    <span className="text-xs text-amber-500 font-bold tabular-nums">
                      {formatNumber(first.xp)} XP
                    </span>
                  </div>

                  {/* Gold Pedestal */}
                  <div className="w-full h-32 sm:h-36 rounded-t-2xl bg-amber-500/10 border-t-2 border-x-2 border-amber-500/50 flex flex-col items-center justify-center p-2">
                    <Trophy className="w-7 h-7 text-amber-500 mb-1" />
                    <span className="text-2xs font-extrabold text-amber-500 uppercase">
                      Champion
                    </span>
                  </div>
                </motion.div>

                {/* 3rd Place (Bronze) */}
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.2 }}
                  className="flex flex-col items-center text-center space-y-2 order-3"
                >
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-amber-700/60 overflow-hidden relative shadow-sm">
                      {third.avatar ? (
                        <Image
                          src={third.avatar}
                          alt={third.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center font-bold text-sm text-foreground">
                          {third.name?.slice(0, 2).toUpperCase() || "?"}
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-amber-700 text-primary-foreground flex items-center justify-center font-black text-xs shadow-xs">
                      3
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="font-bold text-xs sm:text-sm text-foreground block truncate max-w-[100px] sm:max-w-[140px]">
                      {third.name}
                    </span>
                    <span className="text-2xs text-muted-foreground font-semibold tabular-nums">
                      {formatNumber(third.xp)} XP
                    </span>
                  </div>

                  {/* Bronze Pedestal */}
                  <div className="w-full h-20 sm:h-22 rounded-t-2xl bg-muted/40 border-t-2 border-x-2 border-amber-700/40 flex flex-col items-center justify-center p-2">
                    <Medal className="w-5 h-5 text-amber-700 mb-1" />
                    <span className="text-2xs font-extrabold text-muted-foreground uppercase">
                      Bronze
                    </span>
                  </div>
                </motion.div>
              </div>
            </div>
          )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-disputed-muted border border-disputed-border text-disputed text-sm font-medium text-center">
            {error}
          </div>
        )}

        {/* Leaderboard Table / Cards */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
          {/* Header Row (Desktop/Tablet) */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-6 py-3.5 bg-muted/40 border-b border-border text-2xs font-bold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-1 text-center">Rank</div>
            <div className="col-span-7">Member & Profile</div>
            <div className="col-span-2 text-right">{scoreLabel}</div>
            <div className="col-span-2 text-right">Badge Level</div>
          </div>

          {/* List Content */}
          {loading ? (
            <div className="divide-y divide-border/60">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="p-4 sm:p-5 flex items-center gap-4 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-muted" />
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-40 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                  <div className="h-4 w-16 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : activeList.length === 0 ? (
            <div className="p-12 text-center">
              <EmptyState
                emoji=""
                title="No Rankings Found"
                description="No users match the selected city or category criteria. Try broadening your filter selection."
                compact
              />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              <AnimatePresence>
                {activeList.map((user, index) => {
                  const rankNumber = index + 1;
                  const isTop3 = rankNumber <= 3;

                  return (
                    <motion.div
                      key={user.id}
                      initial={shouldReduceMotion ? false : { opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { delay: index * 0.02 }}
                    >
                      <ListItem
                        variant="flush"
                        className={`hover:bg-muted/40 transition-colors ${
                          isTop3 ? "bg-muted/10 font-semibold" : ""
                        }`}
                        leading={
                          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${
                                rankNumber === 1
                                  ? "bg-amber-500 text-primary-foreground shadow-xs"
                                  : rankNumber === 2
                                  ? "bg-muted text-foreground border border-border"
                                  : rankNumber === 3
                                  ? "bg-amber-700 text-primary-foreground"
                                  : "text-muted-foreground font-semibold"
                              }`}
                            >
                              {rankNumber}
                            </span>
                            <div className="w-11 h-11 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-xs text-foreground overflow-hidden relative shrink-0">
                              {user.avatar ? (
                                <Image
                                  src={user.avatar}
                                  alt={user.name}
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              ) : (
                                user.name?.slice(0, 2).toUpperCase() || "?"
                              )}
                            </div>
                          </div>
                        }
                        title={user.name || "Anonymous Member"}
                        titleBadge={
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {user.isWeeklyChampion && (
                              <span className="inline-flex items-center gap-1 text-2xs font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <Flame className="w-2.5 h-2.5 fill-current" />
                                Hot
                              </span>
                            )}
                            {user.trustScore ? (
                              <span className="hidden sm:inline-flex items-center gap-1 text-2xs font-bold text-verified">
                                <ShieldCheck className="w-3 h-3" />
                                {user.trustScore}
                              </span>
                            ) : null}
                          </div>
                        }
                        subtitle={
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                            <span className="truncate">{user.subtitle}</span>
                            {user.city && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-0.5 shrink-0">
                                  <MapPin className="w-2.5 h-2.5" />
                                  {user.city}
                                </span>
                              </>
                            )}
                          </span>
                        }
                        trailing={
                          <div className="text-right">
                            <span className="font-extrabold text-sm sm:text-base text-primary tabular-nums block">
                              {typeof user.score === "number"
                                ? formatNumber(user.score)
                                : user.score}
                            </span>
                            <span className="text-2xs text-muted-foreground block font-medium">
                              {scoreLabel}
                            </span>
                          </div>
                        }
                        trailingSecondary={
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-2xs font-bold bg-muted text-foreground border border-border">
                            Lv.{user.level}
                          </span>
                        }
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Instagram Benchmark: Sticky "Your Rank" Floating Dock */}
        {session?.user && (
          <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+1.5rem))] left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-lg">
            <div className="flex items-center justify-between gap-3 p-3 px-4 rounded-2xl bg-card/95 backdrop-blur-md border border-primary/40 shadow-xl text-foreground">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 text-primary font-black text-xs flex items-center justify-center shrink-0">
                  {activeList.findIndex((u) => u.id === session.user?.id) >= 0
                    ? `#${activeList.findIndex((u) => u.id === session.user?.id) + 1}`
                    : "—"}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold truncate">
                    <span>{session.user.name || "Your Ranking"}</span>
                    <span className="text-2xs text-muted-foreground font-normal">
                      {activeList.findIndex((u) => u.id === session.user?.id) >= 0
                        ? `(Top ${Math.max(1, Math.round(((activeList.findIndex((u) => u.id === session.user?.id) + 1) / Math.max(activeList.length, 1)) * 100))}%)`
                        : "(Unranked this period)"}
                    </span>
                  </div>
                  <div className="text-2xs text-muted-foreground truncate">
                    {activeList.find((u) => u.id === session.user?.id) ? (
                      <span>
                        {formatNumber(activeList.find((u) => u.id === session.user?.id)!.score)} {scoreLabel} · Lv.{activeList.find((u) => u.id === session.user?.id)!.level}
                      </span>
                    ) : (
                      <span>Complete escrow deals to climb the leaderboard</span>
                    )}
                  </div>
                </div>
              </div>

              <Link
                href="/dashboard/deals"
                className="shrink-0 px-3.5 py-2.5 min-h-[44px] inline-flex items-center justify-center rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Climb Rank
              </Link>
            </div>
          </div>
        )}
        </PageContainer>
      </PullToRefresh>
    </DashboardShell>
  );
}
