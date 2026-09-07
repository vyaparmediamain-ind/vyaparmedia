"use client";


import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { BadgeDefinition } from "@/lib/badges";
import EmptyState from "@/components/ui/EmptyState";
import { Button } from "@/components/ui";

interface BadgeWithStatus extends BadgeDefinition {
earned: boolean;
earnedAt?: string;
hasProgress?: boolean;
currentProgress?: number;
targetProgress?: number;
}

interface GamificationStats {
xp: number;
level: number;
totalBadges: number;
availableBadges: number;
}

interface BadgesResponse {
badges?: BadgeWithStatus[];
stats?: GamificationStats;
}

const CATEGORY_ITEMS = [
  { id: "ALL", label: "All Badges", icon: "🎯" },
  { id: "MILESTONE", label: "Milestone", icon: "🏆" },
  { id: "ACHIEVEMENT", label: "Achievement", icon: "⭐" },
  { id: "COMMUNITY", label: "Community", icon: "👥" },
  { id: "SPECIAL", label: "Special", icon: "✨" },
  { id: "VERIFICATION", label: "Verification", icon: "🛡️" },
];

const RARITY_ITEMS = [
  { id: "ALL", label: "All Rarities", dot: "" },
  { id: "COMMON", label: "Common", dot: "⚪" },
  { id: "RARE", label: "Rare", dot: "🔵" },
  { id: "EPIC", label: "Epic", dot: "🟣" },
  { id: "LEGENDARY", label: "Legendary", dot: "🟡" },
];

export default function BadgesPage() {
  const { data: session } = useSession();
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [activeRarity, setActiveRarity] = useState<string>("ALL");

  const { data, isLoading: loading, error: fetchErr } = useSWR<BadgesResponse>(
    "/api/gamification/badges",
    fetcher
  );

  const badges = data?.badges || [];
  const stats = data?.stats || null;
  const error = fetchErr ? "Failed to load your achievements. Please refresh the page." : "";

  const filteredBadges = badges.filter((b) => {
    const categoryMatch = activeCategory === "ALL" || b.category === activeCategory;
    const rarityMatch = activeRarity === "ALL" || b.rarity === activeRarity;
    return categoryMatch && rarityMatch;
  });

  if (!session)
    return <div className="p-8 text-center text-muted">Loading...</div>;

  return (
    <DashboardShell user={session.user}>
      <div className="mx-auto max-w-1000">
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className="badges-title font-extrabold mb-2 text-3xl bg-gradient-amber-rose"
          >
            Badges & Achievements
          </h1>
          <p className="text-secondary text-base">
            Collect badges, earn XP, and level up your profile!
          </p>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
              icon="⭐"
              label="Current Level"
              value={stats.level.toString()}
              tone="blue"
              delay={0}
            />
            <StatCard
              icon="⚡"
              label="Total XP"
              value={stats.xp.toLocaleString()}
              tone="amber"
              delay={0.1}
            />
            <StatCard
              icon="🏆"
              label="Badges Earned"
              value={`${stats.totalBadges} / ${stats.availableBadges}`}
              tone="emerald"
              delay={0.2}
            />
          </div>
        )}

        {/* Category Segmented Tabs */}
        <div className="badges-tabs-container">
          {CATEGORY_ITEMS.map((cat) => {
            const count = cat.id === "ALL"
              ? badges.length
              : badges.filter(b => b.category === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className="badges-tab-button"
                data-active={activeCategory === cat.id}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                {count > 0 && (
                  <span className="text-2xs opacity-75 font-mono">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sub-toolbar: Rarity Filters & Badges Count */}
        <div className="badges-toolbar">
          <div className="badges-rarity-group">
            <span className="text-xs font-bold text-muted uppercase tracking-wider mr-1">
              Rarity:
            </span>
            {RARITY_ITEMS.map((rarity) => (
              <button
                key={rarity.id}
                type="button"
                onClick={() => setActiveRarity(rarity.id)}
                className="badges-rarity-pill"
                data-active={activeRarity === rarity.id}
              >
                {rarity.dot && <span className="text-2xs">{rarity.dot}</span>}
                <span>{rarity.label}</span>
              </button>
            ))}
          </div>

          <div className="text-xs font-semibold text-secondary">
            Showing <strong className="text-white">{filteredBadges.length}</strong> of {badges.length} badges
          </div>
        </div>

    {/* Loading / Error States */}
    {loading && (
      <div className="text-center p-10">
        <div className="loading mx-auto w-40 h-40" />
      </div>
    )}

    {error && (
      <div className="text-center p-10 text-rose">
        {error}
        <Button
          onClick={() => globalThis.location.reload()}
          variant="secondary"
          className="mt-4"
        >
          Try Again
        </Button>
      </div>
    )}

    {/* Badges Grid */}
    {!loading && !error && (
      <div className="grid gap-5 grid-auto-280">
        <AnimatePresence mode="popLayout">
          {filteredBadges.length === 0 ? (
            <EmptyState
              emoji=""
              title="No Badges Found"
              description="No achievements found matching the selected category."
              compact
              className="grid-full"
            />
          ) : (
            filteredBadges.map((badge, index) => (
              <motion.div
                key={badge.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.04 }}
                className="badge-card card hover-lift p-6 flex flex-col items-center text-center relative rounded-xl"
                data-earned={badge.earned}
              >
                <div
                  className="badge-card-icon mb-4 text-3xl"
                  data-earned={badge.earned}
                >
                  {badge.icon}
                </div>

                {badge.earned && (
                  <span className="badge-unlocked absolute font-extrabold rounded-2xl text-2xs px-2 py-1 text-white">
                    UNLOCKED
                  </span>
                )}

                <h3
                  className="badge-card-name text-lg font-bold mb-2"
                  data-earned={badge.earned}
                >
                  {badge.name}
                </h3>

                <p
                  className="badge-card-description text-sm text-secondary flex-1 leading-normal mb-4"
                  data-has-progress={Boolean(badge.hasProgress && !badge.earned)}
                >
                  {badge.description}
                </p>

                {!badge.earned && badge.hasProgress && (
                  <div className="w-full mb-4">
                    <div className="flex justify-between font-bold text-secondary text-xs mb-1">
                      <span>Progress</span>
                      <span className="font-mono">
                        {badge.id.startsWith("earn_") ? `${(badge.currentProgress || 0).toLocaleString()}` : (badge.currentProgress || 0)} / {badge.id.startsWith("earn_") ? `${(badge.targetProgress || 1).toLocaleString()}` : (badge.targetProgress || 1)}
                      </span>
                    </div>
                    <progress
                      className="badge-progress w-full"
                      value={Math.min(100, Math.max(0, ((badge.currentProgress || 0) / (badge.targetProgress || 1)) * 100))}
                      max={100}
                      aria-label={`${badge.name} progress`}
                    />
                  </div>
                )}

                <div className="w-full flex justify-between items-center text-xs pt-3 mt-auto">
                  <span className="font-semibold text-muted text-2xs uppercase tracking-wider">
                    {badge.category}
                  </span>
                  <span className="font-bold text-primary bg-indigo-subtle px-2 py-0.5 rounded-md">
                    +{badge.xpReward} XP
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    )}
  </div>
</DashboardShell>
);
}

function StatCard({
  icon,
  label,
  value,
  tone,
  delay,
}: {
  readonly icon: string;
  readonly label: string;
  readonly value: string;
  readonly tone: "blue" | "amber" | "emerald" | "purple";
  readonly delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="badge-stat-card flex flex-col items-center justify-center p-5 text-center rounded-xl"
      data-tone={tone}
    >
      <span className="text-2xl mb-1">{icon}</span>
      <div className="badge-stat-value font-extrabold mb-1 text-3xl leading-tight">
        {value}
      </div>
      <div className="text-xs font-bold text-secondary uppercase tracking-wider">
        {label}
      </div>
    </motion.div>
  );
}
