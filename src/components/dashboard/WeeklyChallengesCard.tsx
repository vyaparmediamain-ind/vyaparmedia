"use client";

import React, { useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  Flame,
  CheckCircle2,
  Trophy,
  Zap,
  Clock,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface WeeklyChallengeItem {
  id: string;
  weekId: string;
  challengeId: string;
  title: string;
  description: string;
  icon: string;
  type: string;
  target: string;
  goal: number;
  xpReward: number;
  bonusPerk?: string | null;
  badgeId?: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  progress: number;
  completed: boolean;
  completedAt?: string | null;
}

interface ChallengesApiResponse {
  success: boolean;
  data?: WeeklyChallengeItem[];
}

interface WeeklyChallengesCardProps {
  compact?: boolean;
}

export default function WeeklyChallengesCard({ compact = false }: Readonly<WeeklyChallengesCardProps>) {
  const { data, isLoading } = useSWR<ChallengesApiResponse>(
    "/api/gamification/challenges",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const challenges = useMemo(() => {
    return Array.isArray(data?.data) ? data.data : [];
  }, [data]);

  // Calculate days remaining in ISO week (Sunday is end of week)
  const daysRemaining = useMemo(() => {
    const today = new Date().getDay(); // 0 is Sunday, 1 is Monday
    return today === 0 ? 1 : 7 - today;
  }, []);

  const completedCount = useMemo(() => {
    return challenges.filter((c) => c.completed).length;
  }, [challenges]);

  if (isLoading) {
    return (
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-44 bg-muted rounded-md" />
          <div className="h-4 w-20 bg-muted rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-muted/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (challenges.length === 0) {
    return null;
  }

  const displayedChallenges = compact ? challenges.slice(0, 3) : challenges;

  return (
    <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-foreground tracking-tight">
                Weekly Quests &amp; Challenges
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground border border-border">
                <Clock className="w-3 h-3 text-muted-foreground" />
                {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Complete quests this week to earn XP bonuses, trust score boosts, and featured badges.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-verified-muted text-verified border border-verified-border">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {completedCount} / {challenges.length} Finished
          </span>
          {compact && (
            <Link
              href="/dashboard/badges"
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
            >
              All Quests <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* ── Challenges Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {displayedChallenges.map((challenge) => {
          const current = challenge.progress || 0;
          const goal = challenge.goal || 1;
          const progressPercent = Math.min(100, Math.round((current / goal) * 100));

          return (
            <div
              key={challenge.id || challenge.challengeId}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                challenge.completed
                  ? "bg-verified-muted/30 border-verified-border/60"
                  : "bg-muted/30 border-border hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              {/* Card Top */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="text-xl select-none shrink-0" aria-hidden="true">
                    {challenge.icon || "🎯"}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground truncate">
                      {challenge.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                      {challenge.description}
                    </p>
                  </div>
                </div>

                {/* Difficulty / Completed Badge */}
                {challenge.completed ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-verified-muted text-verified border border-verified-border shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> Done
                  </span>
                ) : (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                      challenge.difficulty === "HARD"
                        ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        : challenge.difficulty === "MEDIUM"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    }`}
                  >
                    {challenge.difficulty}
                  </span>
                )}
              </div>

              {/* Progress & Rewards */}
              <div className="space-y-2 pt-1 border-t border-border/40">
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-mono font-bold text-foreground">
                    {current} / {goal}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({progressPercent}%)
                    </span>
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden border border-border/40">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      challenge.completed
                        ? "bg-verified"
                        : "bg-primary"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Rewards Strip */}
                <div className="flex items-center justify-between gap-1 text-[11px] pt-1">
                  <span className="inline-flex items-center gap-1 text-pending font-bold font-mono">
                    <Zap className="w-3 h-3" />
                    +{challenge.xpReward} XP
                  </span>

                  {challenge.bonusPerk && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground truncate font-medium">
                      <Sparkles className="w-3 h-3 text-primary shrink-0" />
                      <span className="truncate">{challenge.bonusPerk}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
