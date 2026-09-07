"use client";


import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import EmptyState from "@/components/ui/EmptyState";
import { Button, Select } from "@/components/ui";
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

export default function LeaderboardPage() {
const { data: session } = useSession();
const [tab, setTab] = useState<"influencers" | "brands">("influencers");
const [filter, setFilter] = useState<"all-time" | "weekly">("all-time");
const [city, setCity] = useState("");
const [category, setCategory] = useState("");

const categories = ALL_CATEGORIES;
const cities = [
"Mumbai",
"Delhi",
"Bangalore",
"Hyderabad",
"Chennai",
"Kolkata",
"Pune",
"Jaipur",
];

const params = new URLSearchParams({ filter });
if (city) params.set("city", city);
if (category) params.set("category", category);

const { data: leaderboardData, isLoading: loading, error: fetchErr } = useSWR<{ influencers?: LeaderboardUser[]; brands?: LeaderboardUser[]; hallOfFame?: HallOfFameUser[] }>(
`/api/gamification/leaderboard?${params.toString()}`,
fetcher
);

const influencers: LeaderboardUser[] = leaderboardData?.influencers || [];
const brands: LeaderboardUser[] = leaderboardData?.brands || [];
const hallOfFame: HallOfFameUser[] = leaderboardData?.hallOfFame || [];
const error = fetchErr ? "Failed to load leaderboard. Please try again later." : null;

const activeList = tab === "influencers" ? influencers : brands;
let scoreLabel = "";
if (tab === "influencers") {
scoreLabel = filter === "weekly" ? "Deals This Week" : "XP";
} else {
scoreLabel = filter === "weekly" ? "Deals This Week" : "Trust Score";
}

let leaderboardContent;
if (loading) {
leaderboardContent = Array.from({ length: 5 }).map((_, idx) => (
<div
key={"skeleton-" + idx}
className="leaderboard-skeleton rounded-lg bg-secondary opacity-50"
/>
));
} else if (error) {
leaderboardContent = (
<div
className="text-center p-10 text-rose"
>
{error}
<Button
onClick={() => globalThis.location.reload()}
variant="primary"
className="mt-4 px-4-py-2"
>
Retry
</Button>
</div>
);
} else if (activeList.length === 0) {
leaderboardContent = (
<EmptyState
emoji=""
title="No Rankings Found"
description="No users match the selected leaderboard filters at the moment."
compact
/>
);
} else {
leaderboardContent = activeList.map((user, index) => (
<motion.div
key={user.id}
initial={{ opacity: 0, x: -20 }}
animate={{ opacity: 1, x: 0 }}
transition={{ delay: index * 0.03 }}
className="leaderboard-row grid items-center cursor-pointer rounded-lg px-4 py-3"
data-rank={index < 3 ? index + 1 : "default"}
whileHover={{ x: 4 }}
>
            {/* Rank */}
            <span
              className="leaderboard-rank font-extrabold"
              data-rank={index < 3 ? index + 1 : "default"}
            >
              {index + 1}
            </span>

{/* User Info */}
<div
className="flex items-center gap-3"
>
                <div
                  className="leaderboard-avatar relative flex items-center justify-center text-base font-bold overflow-hidden rounded-full text-white flex-shrink-0"
                  data-tone={index % 6}
                >
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.name + " avatar"}
                      fill
                      unoptimized
                      className="object-cover rounded-full"
                    />
                  ) : (
                    user.name?.charAt(0)?.toUpperCase() || "?"
                  )}
                </div>
<div>
<div
className="font-semibold text-sm flex items-center gap-1.5"
>
{user.name || "Anonymous"}
{user.isWeeklyChampion && (
<span
className="leaderboard-hot-badge font-bold text-amber text-2xs px-2 py-0.5 rounded-md"
>
HOT
</span>
)}
</div>
<div
className="text-xs text-secondary"
>
{user.subtitle}
{user.city ? ` ${user.city}` : ""}
</div>
</div>
</div>

{/* Score */}
<div
className="text-right font-bold text-sm text-primary"
>
{typeof user.score === "number"
? user.score.toLocaleString()
: user.score}
</div>

{/* Level */}
<div className="text-right">
<span
className="leaderboard-level text-xs font-bold rounded-md px-2 py-1"
>
Lv.{user.level}
</span>
</div>
</motion.div>
));
}

if (!session) {
return (
<DashboardShell user={null}>
<div className="flex items-center justify-center min-h-60vh">
<span className="loading" />
</div>
</DashboardShell>
);
}

return (
<DashboardShell user={session.user}>
<div className="max-w-900 mx-auto">
{/* Header */}
<div className="text-center mb-8">
<h1
className="leaderboard-title font-extrabold text-3xl bg-gradient-amber-rose"
>
Leaderboard
</h1>
<p className="text-secondary mt-2">
Top performers on VyaparMedia
</p>
</div>

{/* Filter Controls */}
<div
className="scrollable-tabs flex gap-3 mb-6 items-center pb-2"
>
{/* Influencer/Brand Toggle */}
<div
className="flex bg-secondary rounded-lg p-1"
>
{(["influencers", "brands"] as const).map((t) => (
<Button
key={t}
onClick={() => setTab(t)}
variant={tab === t ? "primary" : "ghost"}
className="leaderboard-toggle font-semibold text-sm px-4-py-2 rounded-lg"
data-active={tab === t}
>
{t === "influencers" ? " Creators" : " Brands"}
</Button>
))}
</div>

{/* Weekly/All-time Toggle */}
<div
className="flex bg-secondary rounded-lg p-1"
>
      {(["all-time", "weekly"] as const).map((f) => {
        let btnVariant: "warning" | "primary" | "ghost" = "ghost";
        if (filter === f) {
          btnVariant = f === "weekly" ? "warning" : "primary";
        }
        return (
<Button
key={f}
onClick={() => setFilter(f)}
variant={btnVariant}
className="leaderboard-toggle font-semibold text-sm px-4-py-2 rounded-lg"
data-active={filter === f}
>
{f === "weekly" ? " This Week" : " All-Time"}
</Button>
);
})}
</div>

{/* City Filter */}
<Select
value={city}
onChange={(e) => setCity(e.target.value)}
className="leaderboard-select px-2 py-1"
>
<option value=""> All Cities</option>
{cities.map((c) => (
<option key={c} value={c}>
{c}
</option>
))}
</Select>

{/* Category Filter */}
{tab === "influencers" && (
<Select
value={category}
onChange={(e) => setCategory(e.target.value)}
className="px-2 py-1 w-180"
>
<option value=""> All Categories</option>
{categories.map((c) => (
<option key={c} value={c}>
{c}
</option>
))}
</Select>
)}
</div>

{/* Hall of Fame Section (all-time only) */}
{filter === "all-time" &&
tab === "influencers" &&
hallOfFame.length > 0 && (
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
className="leaderboard-podium flex justify-center items-end gap-4 flex-wrap mb-10 rounded-xl"
>
{/* 2nd place */}
{hallOfFame[1] && (
<PodiumUser
user={hallOfFame[1]}
rank={2}
color="#c0c0c0"
height={100}
delay={0.1}
unit="XP"
/>
)}
{/* 1st place */}
{hallOfFame[0] && (
<PodiumUser
user={hallOfFame[0]}
rank={1}
color="#ffd700"
height={130}
delay={0}
isFirst
unit="XP"
/>
)}
{/* 3rd place */}
{hallOfFame[2] && (
<PodiumUser
user={hallOfFame[2]}
rank={3}
color="#cd7f32"
height={80}
delay={0.2}
unit="XP"
/>
)}
</motion.div>
)}

{/* Weekly Champion Banner */}
{filter === "weekly" &&
influencers[0]?.isWeeklyChampion &&
tab === "influencers" && (
<motion.div
initial={{ opacity: 0, scale: 0.95 }}
animate={{ opacity: 1, scale: 1 }}
className="leaderboard-weekly-banner flex items-center gap-4 mb-6 flex-wrap p-5 rounded-xl"
>
<div className="text-3xl flex items-center">
  <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 fill-amber-400/20">
    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
    <path d="M5 20h14" />
  </svg>
</div>
<div>
<div
className="font-bold text-xs text-amber uppercase tracking-wider"
>
HOT CREATOR OF THE WEEK
</div>
<div
className="text-xl font-extrabold mt-1 text-primary"
>
{influencers[0].name}
</div>
<div
className="text-sm text-secondary"
>
{influencers[0].score} deals completed this week
</div>
</div>
</motion.div>
)}

{/* Leaderboard List */}
<div className="flex flex-col gap-2">
        {/* Header Row */}
        <div
          className="leaderboard-header-row grid font-bold text-secondary text-xs uppercase px-4 py-2.5 items-center tracking-wider"
        >
          <span>#</span>
          <span>Name</span>
          <span className="text-right">{scoreLabel}</span>
          <span className="text-right">Level</span>
        </div>

<AnimatePresence>
{leaderboardContent}
</AnimatePresence>
</div>
</div>
</DashboardShell>
);
}

interface PodiumUserProps {
readonly user: HallOfFameUser;
readonly rank: number;
readonly color: string;
readonly height: number;
readonly delay: number;
readonly isFirst?: boolean;
readonly unit: string;
}

function PodiumUser({
user,
rank,
color: _color,
height: _height,
delay,
isFirst,
unit,
}: PodiumUserProps) {
return (
<motion.div
initial={{ opacity: 0, y: 30 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay, duration: 0.5 }}
className="flex flex-col items-center gap-2"
>
{isFirst && <div className="text-3xl flex justify-center">
  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 fill-amber-400/20">
    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
    <path d="M5 20h14" />
  </svg>
</div>}
      <div
        className="podium-avatar relative flex items-center justify-center font-bold overflow-hidden rounded-full text-white flex-shrink-0"
        data-rank={rank}
        data-first={Boolean(isFirst)}
      >
        {user.avatar ? (
          <Image
            src={user.avatar}
            alt={user.name || "avatar"}
            fill
            unoptimized
            className="object-cover rounded-full"
          />
        ) : (
          user.name?.charAt(0)?.toUpperCase() || "?"
        )}
      </div>
<div
className="podium-name font-bold text-center"
data-first={Boolean(isFirst)}
>
{user.name || "Anonymous"}
</div>
<div
className="podium-base flex items-center justify-center flex-col gap-1"
data-rank={rank}
data-first={Boolean(isFirst)}
>
<div
className="podium-rank font-extrabold"
data-rank={rank}
data-first={Boolean(isFirst)}
>
{rank}
</div>
<div className="text-secondary text-xs">
{user.xp.toLocaleString()} {unit}
</div>
</div>
</motion.div>
);
}
