"use client";

import { useRef } from "react";
import {
BarChart,
Bar,
XAxis,
YAxis,
CartesianGrid,
Tooltip,
} from "recharts";
import Link from "next/link";
import { ToastContainer, useToasts } from "@/components/ui/toast";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button } from "@/components/ui";
import { useChartWidth } from "@/hooks/useChartWidth";
import { getTrustTierLabel } from "@/lib/utils-client";
import { copyToClipboard } from "@/lib/clipboard";

export interface BrandAnalyticsData {
overview: {
totalSpent: number;
activeCampaigns: number;
totalCampaigns: number;
activeDeals: number;
trustScore: number;
completedDeals: number;
avgDealCost: number;
memberSince: Date;
};
spendHistory: Array<{ month: string; amount: number }>;
recentCampaigns: Array<{
id: string;
title: string;
status: string;
budget: number;
dealsCount: number;
category: string;
completedDeals: number;
amountSpent: number;
}>;
dealStatusBreakdown: Array<{
status: string;
count: number;
totalAmount: number;
}>;
microVsMacro: {
micro: {
count: number;
avgCost: number;
avgRating: string;
};
macro: {
count: number;
avgCost: number;
avgRating: string;
};
};
referralStats: {
totalReferrals: number;
activeReferrals: number;
totalEarnings: number;
tier?: { label: string };
earnings?: number;
referralCode?: string;
};
error?: string;
}

interface BrandDashboardProps {
readonly data: BrandAnalyticsData;
}



export default function BrandDashboard({ data }: BrandDashboardProps) {
const { toasts, showToast, removeToast } = useToasts();
const containerRef = useRef<HTMLDivElement>(null);
const { chartsReady, chartWidth } = useChartWidth(containerRef, 300);

if (!data || data.error)
return (
<div className="dashboard-error-state">
Failed to load data
</div>
);

const { overview, spendHistory, recentCampaigns = [] } = data;

return (
<div className="dashboard-home-stack">
<ToastContainer toasts={toasts} onClose={removeToast} />
<section className="dashboard-welcome-card">
<div>
<p className="dashboard-welcome-kicker">Brand workspace</p>
<h2>Campaign command center</h2>
<p>Manage creator selection, campaign spend, secure holds, and approvals.</p>
</div>
<div className="dashboard-welcome-score" aria-label={`Trust score ${overview.trustScore || 0}`}>
<span>Trust</span>
<strong>{overview.trustScore || "--"}</strong>
<small>{overview.trustScore ? getTrustTierLabel(overview.trustScore) : "Brand"}</small>
</div>
</section>

<section className="dashboard-overview-panel">
<div className="dashboard-section-row">
<h3>Overview</h3>
<span>{overview.totalCampaigns} campaigns</span>
</div>
<div className="grid-4 stagger-children dashboard-overview-grid">
<StatCard
icon="spend"
label="Total Spent"
value={`${(overview.totalSpent / 100).toLocaleString("en-IN")}`}
tone="primary"
/>
<StatCard
icon="campaigns"
label="Active Campaigns"
value={overview.activeCampaigns}
subvalue={`${overview.totalCampaigns} total`}
tone="cyan"
/>
<StatCard
icon="deals"
label="Active Deals"
value={overview.activeDeals}
subvalue={`${overview.completedDeals} completed`}
tone="emerald"
/>
<StatCard
icon="trust"
label="Trust Score"
value={overview.trustScore ? `${overview.trustScore}/900` : "N/A"}
subvalue={overview.trustScore ? getTrustTierLabel(overview.trustScore) : "Brand"}
tone="violet"
/>
</div>
</section>

{/* Spend Chart */}
<div className="card">
<h3 className="section-title">
Monthly Spend (Last 12 Months)
</h3>
<div className="chart-wrapper" ref={containerRef}>
{chartsReady && (
<BarChart width={chartWidth} height={chartWidth < 600 ? 200 : 280} data={spendHistory} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
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
cursor={{ fill: "rgba(37, 99, 235, 0.05)" }}
formatter={(value: number | undefined) => [
`${((value ?? 0) / 100).toLocaleString("en-IN")}`,
"Spent",
]}
/>
<Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} />
</BarChart>
)}
</div>
</div>

{/* Referrals & CTA */}
<div className="grid-3">
{/* Referral Stats */}
<div className="card">
<h3 className="section-title">
Referral Program
</h3>
<div className="referral-stat-row">
<div className="referral-stat">
<span className="referral-stat-label">Tier</span>
<Badge variant="success">
{data.referralStats?.tier?.label || "Novice"}
</Badge>
</div>
<div className="referral-stat">
<span className="referral-stat-label">Active Referrals</span>
<span className="referral-stat-value">
{data.referralStats?.activeReferrals || 0}
</span>
</div>
<div className="referral-stat">
<span className="referral-stat-label">Total Earnings</span>
<span className="referral-stat-value text-emerald">
Rs {((data.referralStats?.earnings || 0) / 100).toLocaleString()}
</span>
</div>

<div className="divider brand-referral-divider" />

<div>
  <div className="text-muted mb-2 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
    <span>Share Your Code</span>
    <span className="text-primary-light text-xs font-normal">Earn up to 2% GMV</span>
  </div>
  <div className="flex gap-2 items-center bg-tertiary p-1.5 rounded-lg border border-card">
    <div className="flex-1 px-3 py-1 flex items-center gap-2 min-w-0">
      <span className="text-sm">🎁</span>
      <code className="text-sm font-extrabold font-mono tracking-wider text-white truncate">
        {data.referralStats?.referralCode || "Loading..."}
      </code>
    </div>
    <Button
      variant="primary"
      size="sm"
      className="flex items-center gap-1 font-bold flex-shrink-0 text-xs px-3 py-1.5"
      onClick={() => {
        const code = data.referralStats?.referralCode || "";
        copyToClipboard(code);
        showToast("success", "Referral code copied!");
      }}
    >
      📋 Copy
    </Button>
  </div>
</div>
</div>
</div>

{/* CTA Card */}
<div className="card col-span-2 flex flex-col justify-center brand-referral-cta">
<h3
className="text-xl font-extrabold mb-2"
>
Invite Brands & Influencers
</h3>
<p
className="text-secondary mb-5 text-sm leading-relaxed"
>
Level up your tier to unlock up to 2% lifetime GMV revenue share and
exclusive platform fee discounts for every deal completed by your
referrals!
</p>
<div>
<Button href="/dashboard/referrals" variant="primary">
View Details
</Button>
</div>
</div>
</div>

      {/* Recent Campaigns Table */}
      <div className="card">
        <div className="section-header-row flex justify-between items-center mb-4">
          <h3 className="section-title text-base font-bold mb-0">
            Recent Campaigns
          </h3>
          <Button
            href="/dashboard/campaigns"
            variant="secondary"
            size="sm"
            className="text-xs font-semibold py-1 px-3"
          >
            View All →
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="text-2xs text-muted font-bold uppercase px-4 py-3 tracking-wider">
                  Campaign
                </th>
                <th className="text-2xs text-muted font-bold uppercase px-4 py-3 tracking-wider">
                  Status
                </th>
                <th className="text-2xs text-muted font-bold uppercase px-4 py-3 tracking-wider">
                  Budget
                </th>
                <th className="text-2xs text-muted font-bold uppercase px-4 py-3 tracking-wider">
                  Deals
                </th>
              </tr>
            </thead>
            <tbody>
              {recentCampaigns.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="text-sm font-semibold text-white px-4 py-3.5 align-middle">
                    <Link
                      href={`/dashboard/campaigns/${c.id}`}
                      className="hover:text-primary-light transition-colors"
                    >
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    {renderStatusBadge(c.status)}
                  </td>
                  <td className="text-sm text-secondary font-medium px-4 py-3.5 align-middle">
                    Rs {(c.budget / 100).toLocaleString()}
                  </td>
                  <td className="text-sm text-secondary px-4 py-3.5 align-middle">
                    {c.dealsCount || 0} deals
                  </td>
                </tr>
              ))}
              {recentCampaigns.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6">
                    <EmptyState
                      emoji=""
                      title="No Recent Campaigns"
                      description="Your most recent campaigns will appear here."
                      compact
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
readonly icon: "spend" | "campaigns" | "deals" | "trust";
readonly label: string;
readonly value: string | number;
readonly subvalue?: string;
readonly tone: "primary" | "cyan" | "emerald" | "violet";
}

const BRAND_STAT_ICONS: Record<StatCardProps["icon"], React.ReactNode> = {
spend: (
<svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<rect width="20" height="14" x="2" y="5" rx="2" />
<line x1="2" y1="10" x2="22" y2="10" />
</svg>
),
campaigns: (
<svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M4 6h16" />
<path d="M4 12h10" />
<path d="M4 18h7" />
<path d="m17 14 3 3-3 3" />
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
};

function StatCard({
icon,
label,
value,
subvalue,
tone,
}: StatCardProps) {
return (
<div className="card hover-lift brand-stat-card" data-tone={tone}>
<div className="flex items-center gap-2.5 mb-3 brand-stat-heading">
{BRAND_STAT_ICONS[icon]}
<span
className="text-secondary text-sm font-medium"
>
{label}
</span>
</div>
<div className="font-extrabold text-3xl brand-stat-value">
{value}
</div>
<div className="text-xs text-muted mt-1">
  {subvalue || <span className="opacity-0" aria-hidden="true">-</span>}
</div>
</div>
);
}

function renderStatusBadge(status: string) {
  const s = status?.toUpperCase();
  let colorClasses = "bg-slate-500/20 text-slate-400 border-slate-500/30";
  if (s === "ACTIVE") colorClasses = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (s === "CANCELLED") colorClasses = "bg-rose-500/20 text-rose-400 border-rose-500/30";
  if (s === "COMPLETED") colorClasses = "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (s === "DRAFT") colorClasses = "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (s === "PAUSED") colorClasses = "bg-slate-500/20 text-slate-400 border-slate-500/30";

  return (
    <span className={`text-2xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border inline-flex items-center ${colorClasses}`}>
      {status}
    </span>
  );
}
