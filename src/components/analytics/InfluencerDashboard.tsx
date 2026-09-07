"use client";

import React, { useRef, useState } from "react";
import { calculateLevel } from "@/lib/drs-score";
import {
AreaChart,
Area,
XAxis,
YAxis,
CartesianGrid,
Tooltip,
} from "recharts";

import { ToastContainer, useToasts } from "@/components/ui/toast";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button } from "@/components/ui";
import { useChartWidth } from "@/hooks/useChartWidth";
import { getTrustTierLabel } from "@/lib/utils-client";
import { copyToClipboard } from "@/lib/clipboard";

export interface InfluencerAnalyticsData {
overview: {
totalEarnings: number;
completedDeals: number;
activeDeals: number;
averageRating: number;
trustScore: number;
level: number;
xp: number;
successRate: number;
memberSince: Date;
};
earningsHistory: Array<{ date?: Date; month: string; amount: number }>;
performance: {
deliveryRate: number;
engagementRate: number;
successRate: number;
};
topContent: Array<{
id: string;
campaignTitle: string;
amount: number;
completedAt: Date | null;
postUrl: string | null;
}>;
categoryBreakdown: Array<{
category: string;
count: number;
percentage: number;
}>;
recentActivity: Array<{
action: string;
createdAt: Date;
metadata: unknown;
}>;
gamification: {
recentBadges: Array<{
id: string;
name: string;
description: string;
icon: string;
earnedAt: Date;
xpReward?: number;
}>;
referralStats: {
totalReferrals: number;
activeReferrals: number;
totalEarnings: number;
tier?: { label: string };
earnings?: number;
referralCode?: string;
};
};
error?: string;
}

interface InfluencerDashboardProps {
readonly data: InfluencerAnalyticsData;
readonly userName?: string | null | undefined;
}



export default function InfluencerDashboard({
data,
userName,
}: InfluencerDashboardProps) {
const { toasts, showToast, removeToast } = useToasts();
const containerRef = useRef<HTMLDivElement>(null);
const { chartsReady, chartWidth } = useChartWidth(containerRef, 300);
const [showAllActivity, setShowAllActivity] = useState(false);

if (!data || data.error)
return (
<div className="dashboard-error-state">
Failed to load data
</div>
);

const {
overview,
earningsHistory = [],
performance,
recentActivity = [],
} = data;

const allBadges = data.gamification?.recentBadges || [];
const displayedBadges = allBadges.slice(0, 3);
const displayedActivity = showAllActivity ? recentActivity : recentActivity.slice(0, 4);

let trustScoreColorClass = "text-[var(--color-accent-rose)]";
if (overview.trustScore >= 850) {
trustScoreColorClass = "text-[var(--color-accent-emerald)]";
} else if (overview.trustScore >= 750) {
trustScoreColorClass = "text-[var(--color-primary-light)]";
} else if (overview.trustScore >= 600) {
trustScoreColorClass = "text-[var(--color-accent-amber)]";
}

if (!overview || !performance) {
return (
<div className="dashboard-error-state">
Incomplete data received
</div>
);
}

return (
<div className="dashboard-home-stack">
<ToastContainer toasts={toasts} onClose={removeToast} />
<section className="dashboard-welcome-card">
<div>
<p className="dashboard-welcome-kicker">Creator workspace</p>
<h2>Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}!</h2>
<p>Track active deals, content tasks, badges, referrals, and payouts.</p>
</div>
<div className="dashboard-welcome-score" aria-label={`Trust score ${overview.trustScore}`}>
<span>Trust Score</span>
<strong
className={trustScoreColorClass}
>
{overview.trustScore}
</strong>
<small>{getTrustTierLabel(overview.trustScore)}</small>
</div>
</section>

<section className="dashboard-overview-panel">
<div className="dashboard-section-row">
<h3>Overview</h3>
<span>Level {overview.level}</span>
</div>
<div className="grid-4 stagger-children dashboard-overview-grid">
<StatCard
icon="earnings"
label="Earnings"
value={`${(overview.totalEarnings / 100).toLocaleString("en-IN")}`}
subvalue="Lifetime"
accentColorClass="text-[var(--color-accent-emerald)]"
/>
<StatCard
icon="deals"
label="Completed"
value={overview.completedDeals}
subvalue={`${overview.activeDeals} active`}
accentColorClass="text-[var(--color-accent-cyan)]"
/>
<StatCard
icon="trust"
label="Trust Score"
value={`${overview.trustScore}/900`}
subvalue={getTrustTierLabel(overview.trustScore)}
accentColorClass="text-[var(--color-primary-light)]"
/>
<StatCard
icon="delivery"
label="On-time"
value={`${performance.deliveryRate}%`}
subvalue="Delivery Rate"
accentColorClass="text-[var(--color-accent-amber)]"
/>
</div>
</section>

<section className="level-perks-section">
<div className="level-perks-card">
<div className="level-perks-body">
<div className="level-perks-text">
<div className="level-perks-title-row">
<h3 className="level-perks-title">
Level {overview.level} Perks & Benefits
</h3>
<Badge variant="primary" className="text-xs font-bold uppercase">
{calculateLevel(overview.xp).name}
</Badge>
</div>
<p className="level-perks-desc">
Your Creator Level is determined by your total XP. Complete campaigns, refer other creators, and maintain a high trust score to level up and unlock better platform terms and enhanced search ranking.
</p>
</div>
<div className="level-perks-stats">
            <div className="stat-chip">
              <div className="stat-chip-label">Platform Fee</div>
              <div className="stat-chip-value-lg text-emerald">0%</div>
              <div className="stat-chip-sub">Always free for creators</div>
            </div>
<div className="stat-chip">
<div className="stat-chip-label">Search Boost</div>
<div className="stat-chip-value-lg text-amber">
+{Math.min(overview.level * 2, 20)} pts
</div>
<div className="stat-chip-sub">
Discovery ranking weight
</div>
</div>
</div>
</div>
</div>
</section>

{/* Charts Section */}
<div className="grid-2">
<div className="card">
<h3 className="section-title">
Earnings History (12 Months)
</h3>
<div className="chart-wrapper" ref={containerRef}>
{chartsReady && (
<AreaChart width={chartWidth} height={chartWidth < 600 ? 200 : 280} data={earningsHistory} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
<defs>
<linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
<stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
<stop offset="95%" stopColor="#10b981" stopOpacity={0} />
</linearGradient>
</defs>
<CartesianGrid
strokeDasharray="3 3"
stroke="var(--color-border)"
/>
<XAxis
dataKey="month"
stroke="var(--color-text-muted)"
fontSize={12}
/>
<YAxis
stroke="var(--color-text-muted)"
fontSize={12}
tickFormatter={(val) => {
  const rs = val / 100;
  if (rs >= 100000) return `₹${(rs / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  if (rs >= 1000) return `₹${(rs / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `₹${rs}`;
}}
/>
<Tooltip
formatter={(value: number | undefined) => [
`${((value ?? 0) / 100).toLocaleString("en-IN")}`,
"Earnings",
]}
/>
<Area
type="monotone"
dataKey="amount"
stroke="#10b981"
strokeWidth={2}
fillOpacity={1}
fill="url(#colorIncome)"
/>
</AreaChart>
)}
</div>
</div>

<div className="card">
<h3 className="section-title">
Performance Metrics
</h3>
<div className="metric-list">
<MetricBar
label="Reputation (DRS)"
value={overview.trustScore}
max={900}
color="var(--color-accent-emerald)"
displayValue={`${overview.trustScore}/900`}
/>
<MetricBar
label="Detailed Rating"
value={overview.averageRating * 20}
max={100}
color="var(--color-primary-light)"
displayValue={overview.averageRating.toFixed(1)}
/>
<MetricBar
label="On-Time Delivery"
value={performance.deliveryRate}
max={100}
color="#60a5fa"
/>
<MetricBar
label="Engagement Rate"
value={Math.min(performance.engagementRate * 10, 100)}
max={100}
color="var(--color-secondary)"
displayValue={`${performance.engagementRate}%`}
/>
</div>
</div>
</div>

{/* Gamification & Referrals */}
<div className="grid-2">
        {/* Recent Badges */}
        <div className="card">
          <div className="section-header-row flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold mb-0">Recent Achievements</h3>
              <Badge variant="primary">
                {allBadges.length} Badges
              </Badge>
            </div>
            <Button
              href="/dashboard/badges"
              variant="secondary"
              size="sm"
              className="text-xs font-semibold py-1 px-3"
            >
              View All →
            </Button>
          </div>
          <div className="badge-list">
            {displayedBadges.map((badge: { id: string; name: string; description: string; icon: string; earnedAt: Date; xpReward?: number }) => (
              <div key={badge.id} className="badge-item">
                <span className="badge-item-icon">{badge.icon}</span>
                <div className="flex-1">
                  <div className="badge-item-name">{badge.name}</div>
                  <div className="badge-item-desc">{badge.description}</div>
                </div>
                <Badge variant="success" className="text-xs">
                  +{badge.xpReward} XP
                </Badge>
              </div>
            ))}
            {allBadges.length === 0 && (
              <EmptyState
                emoji=""
                title="No Badges Yet"
                description="Complete challenges to earn your first badge!"
                compact
              />
            )}
          </div>
        </div>

        {/* Referral Stats */}
        <div className="card">
          <div className="section-header-row">
            <h3 className="text-base font-bold">
              Referral Rewards
            </h3>
            <Badge variant="primary">
              {data.gamification?.referralStats?.tier?.label || "Novice"} Tier
            </Badge>
          </div>

          <div className="grid-2 gap-3 mb-5">
            <div className="p-4 rounded-md bg-tertiary">
              <div className="text-xs text-muted mb-1">
                Active Referrals
              </div>
              <div className="text-2xl font-extrabold">
                {data.gamification?.referralStats?.activeReferrals || 0}
              </div>
            </div>
            <div className="p-4 rounded-md bg-tertiary">
              <div className="text-xs text-muted mb-1">
                Total Earnings
              </div>
              <div className="text-2xl font-extrabold text-emerald">
                Rs{" "}
                {(
                  (data.gamification?.referralStats?.earnings || 0) / 100
                ).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="referral-code-banner p-4 flex items-center justify-between rounded-md">
            <div>
              <div className="text-muted mb-1 text-xs uppercase tracking-normal">
                Your Referral Code
              </div>
              <code className="text-lg font-extrabold font-mono tracking-normal">
                {data.gamification?.referralStats?.referralCode || "..."}
              </code>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                copyToClipboard(
                  data.gamification?.referralStats?.referralCode || "",
                );
                showToast("success", "Referral code copied!");
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="section-header-row flex justify-between items-center mb-3">
          <h3 className="section-title text-base font-bold mb-0">
            Recent Activity
          </h3>
          {recentActivity.length > 4 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowAllActivity(!showAllActivity)}
              className="text-xs font-semibold py-1 px-3"
            >
              {showAllActivity ? "Show Less ↑" : `View All (${recentActivity.length}) ↓`}
            </Button>
          )}
        </div>
        <div className="badge-list">
          {displayedActivity.map((log: { action: string; createdAt: Date }) => (
            <div
              key={`${log.action}-${new Date(log.createdAt).getTime()}`}
              className="badge-item justify-between"
            >
              <div>
                <div className="text-sm font-medium">
                  {formatAction(log.action)}
                </div>
                <div className="text-xs text-muted">
                  {new Date(log.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <EmptyState
              emoji=""
              title="No Recent Activity"
              description="Your recent activity will appear here."
              compact
            />
          )}
        </div>
      </div>
</div>
);
}

interface StatCardProps {
readonly icon: "earnings" | "deals" | "trust" | "delivery";
readonly label: string;
readonly value: string | number;
readonly subvalue?: string;
readonly accentColorClass: string;
}

const STAT_ICONS: Record<StatCardProps["icon"], React.ReactNode> = {
earnings: (
<svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
</svg>
),
deals: (
<svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M8 11 4 15a3 3 0 0 0 4 4l2-2" />
<path d="m14 7 2-2a3 3 0 0 1 4 4l-4 4" />
<path d="m8 16 8-8" />
</svg>
),
trust: (
<svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M12 3 3 7v6c0 5 4 8 9 8s9-3 9-8V7l-9-4Z" />
<path d="m9 12 2 2 4-4" />
</svg>
),
delivery: (
<svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<circle cx="12" cy="12" r="10" />
<polyline points="12 6 12 12 16 14" />
</svg>
),
};

function StatCard({
icon,
label,
value,
subvalue,
accentColorClass,
}: StatCardProps) {
return (
<div className="card hover-lift">
<div
className={`flex items-center gap-2.5 mb-3 ${accentColorClass}`}
>
{STAT_ICONS[icon]}
<span
className="text-secondary text-sm font-medium"
>
{label}
</span>
</div>
<div
className={`font-extrabold text-3xl leading-[1.2] ${accentColorClass}`}
>
{value}
</div>
<div
className="text-xs text-muted mt-1"
>
{subvalue}
</div>
</div>
);
}

interface MetricBarProps {
readonly label: string;
readonly value: number;
readonly max: number;
readonly color: string;
readonly displayValue?: string;
}

function MetricBar({ label, value, max, color, displayValue }: MetricBarProps) {
  const progressPercent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm text-secondary">{label}</span>
        <span className="text-sm font-semibold">{displayValue || `${value}%`}</span>
      </div>
      <div className="trust-meter">
        <div
          className="trust-meter-fill transition-all duration-300"
          style={{ width: `${progressPercent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function formatAction(action: string) {
return action
.split("_")
.map((w) => w.charAt(0) + w.slice(1).toLowerCase())
.join(" ");
}
