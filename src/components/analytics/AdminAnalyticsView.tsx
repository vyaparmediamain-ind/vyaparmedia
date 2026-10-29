"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, Variants } from "framer-motion";
import {
LineChart,
Line,
BarChart,
Bar,
XAxis,
YAxis,
CartesianGrid,
Tooltip,
Legend,
ResponsiveContainer,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/utils-client";

interface AdminData {
realTime: {
totalUsers: number;
totalInfluencers: number;
totalBrands: number;
activeUsers7d: number;
activeDeals: number;
completedDealsToday: number;
revenueToday: number;
disputesOpen: number;
};
growth: Array<{
date: string;
total: number;
influencer: number;
brand: number;
}>;
financials: {
totalRevenue: number;
totalGMV: number;
pendingPayouts: number;
totalRefunds: number;
revenueToday: number;
revenueHistory: Array<{ month: string; revenue: number; gmv: number }>;
};
growthMetrics: {
signupsLast30: number;
signupGrowthRate: number;
activationRate: number;
churnRate: number;
kFactor: number;
totalReferrals: number;
paymentSuccessRate: number;
};
systemHealth: {
recentErrors: number;
fraudAlerts: number;
paymentSuccessRate: number;
status: string;
};
activity: {
activeDeals: number;
totalCompletedDeals: number;
disputesOpen: number;
};
}

interface AdminAnalyticsProps {
readonly data: AdminData;
}

const getItemVariants = (shouldReduceMotion: boolean | null): Variants => ({
  hidden: { opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 24 },
  },
});

export default function AdminAnalyticsView({ data }: AdminAnalyticsProps) {
  const shouldReduceMotion = useReducedMotion();
  const [chartsReady, setChartsReady] = useState(false);
  const fmt = (v: number) => formatCurrency(v);

  const containerVariants: Variants = {
    hidden: { opacity: shouldReduceMotion ? 1 : 0 },
    show: {
      opacity: 1,
      transition: shouldReduceMotion ? { duration: 0 } : { staggerChildren: 0.08 },
    },
  };

  const itemVariants = getItemVariants(shouldReduceMotion);

useEffect(() => {
const id = window.setTimeout(() => setChartsReady(true), 50);
return () => window.clearTimeout(id);
}, []);

const getStatusColor = (status: string) => {
  switch (status) {
    case "HEALTHY": return "bg-verified shadow-verified/50";
    case "WARNING": return "bg-amber shadow-amber/50";
    default: return "bg-destructive shadow-destructive/50";
  }
};

const getStatusTextColor = (status: string) => {
  switch (status) {
    case "HEALTHY": return "text-verified";
    case "WARNING": return "text-amber";
    default: return "text-destructive";
  }
};

return (
  <motion.div
    className="flex flex-col gap-8"
    variants={containerVariants}
    initial="hidden"
    animate="show"
  >
    {/* Header / System Status */}
    <motion.div variants={itemVariants} className="flex justify-end">
      <div className="flex items-center gap-2 px-4 py-2 bg-card/60 border border-border rounded-full backdrop-blur-xl">
        <div className={`w-2.5 h-2.5 rounded-full shadow-lg animate-pulse ${getStatusColor(data.systemHealth.status)}`} />
        <span className={`text-sm font-semibold tracking-wide ${getStatusTextColor(data.systemHealth.status)}`}>
          System Status: {data.systemHealth.status}
        </span>
      </div>
    </motion.div>

    {/* Real-Time Metrics Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        icon="US"
        label="Total Users"
        value={formatNumber(data.realTime.totalUsers)}
        gradient="from-primary/20 to-accent/20"
        textColor="text-primary"
      />
      <MetricCard
        icon="AU"
        label="Active (7d)"
        value={formatNumber(data.realTime.activeUsers7d)}
        gradient="from-amber/20 to-amber/10"
        textColor="text-amber"
      />
      <MetricCard
        icon="DL"
        label="Active Deals"
        value={formatNumber(data.realTime.activeDeals)}
        gradient="from-escrow/20 to-verified/20"
        textColor="text-escrow"
      />
      <MetricCard
        icon="RV"
        label="Revenue Today"
        value={fmt(data.realTime.revenueToday)}
        gradient="from-verified/20 to-escrow/20"
        textColor="text-verified"
      />
    </div>

{/* Financial Overview */}
<motion.div variants={itemVariants} className="card relative overflow-hidden group border border-border glass">
<div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-verified/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
<div className="relative z-10 p-6 sm:p-8">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-6">
<h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
Financial Performance
</h2>
<div className="flex flex-wrap gap-8">
<div className="flex flex-col">
<span className="text-sm text-muted-foreground font-medium">Total GMV</span>
<span className="text-2xl font-bold tracking-tight text-foreground">{fmt(data.financials.totalGMV)}</span>
</div>
<div className="flex flex-col">
<span className="text-sm text-muted-foreground font-medium">Total Revenue</span>
<span className="text-2xl font-bold tracking-tight text-emerald">
{fmt(data.financials.totalRevenue)}
</span>
</div>
</div>
</div>

<div className="w-full mt-4 h-[350px]">
{chartsReady ? (
<ResponsiveContainer width="100%" height={350} minWidth={100}>
<BarChart data={data.financials.revenueHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
<CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
<XAxis dataKey="month" stroke="currentColor" className="text-muted-foreground text-xs" tickFormatter={(str) => str.slice(0, 3)} axisLine={false} tickLine={false} dy={10} />
<YAxis yAxisId="left" stroke="currentColor" className="text-muted-foreground text-xs" tickFormatter={(val) => `Rs ${val / 1000}k`} axisLine={false} tickLine={false} dx={-10} />
<YAxis yAxisId="right" orientation="right" stroke="currentColor" className="text-muted-foreground text-xs" tickFormatter={(val) => `Rs ${val / 1000}k`} axisLine={false} tickLine={false} dx={10} />
<Tooltip
cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
formatter={(value) => [fmt(typeof value === "number" ? value : Number(value) || 0), ""]}
/>
<Legend />
<Bar yAxisId="right" dataKey="gmv" fill="url(#gmvGrad)" name="GMV" radius={[6, 6, 0, 0]} />
<Bar yAxisId="left" dataKey="revenue" fill="url(#revGrad)" name="Net Revenue" radius={[6, 6, 0, 0]} />
<defs>
<linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
<stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
</linearGradient>
<linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stopColor="hsl(var(--escrow))" stopOpacity={0.8} />
<stop offset="100%" stopColor="hsl(var(--escrow))" stopOpacity={0.2} />
</linearGradient>
</defs>
</BarChart>
</ResponsiveContainer>
) : (
<div className="w-full h-full rounded-2xl bg-muted/10 animate-pulse" />
)}
</div>
</div>
</motion.div>

{/* Growth & Health Grid */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

{/* User Growth Chart */}
<motion.div variants={itemVariants} className="card lg:col-span-2 relative overflow-hidden group border border-border glass p-6 sm:p-8">
<div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
<div className="relative z-10">
<h3 className="text-lg font-bold mb-6 text-foreground tracking-tight">User Growth (30 Days)</h3>
<div className="w-full h-[280px]">
{chartsReady ? (
<ResponsiveContainer width="100%" height={280} minWidth={100}>
<LineChart data={data.growth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
<defs>
<linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
<stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
<stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
</linearGradient>
</defs>
<CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
<XAxis dataKey="date" stroke="currentColor" className="text-muted-foreground text-xs" tickFormatter={(str) => str.slice(5)} axisLine={false} tickLine={false} dy={10} />
<YAxis stroke="currentColor" className="text-muted-foreground text-xs" axisLine={false} tickLine={false} dx={-10} />
<Tooltip />
<Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }} name="New Users" />
<Line type="monotone" dataKey="brand" stroke="hsl(var(--accent))" strokeWidth={3} dot={false} name="Brands" />
<Line type="monotone" dataKey="influencer" stroke="hsl(var(--verified))" strokeWidth={3} dot={false} name="Influencers" />
</LineChart>
</ResponsiveContainer>
) : (
<div className="w-full h-full rounded-2xl bg-muted/10 animate-pulse" />
)}
</div>
</div>
</motion.div>

{/* System Health */}
<motion.div variants={itemVariants} className="card relative overflow-hidden group border border-border glass p-6 sm:p-8">
<div className="absolute inset-0 bg-gradient-to-br from-verified/5 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
<div className="relative z-10 flex flex-col h-full">
<h3 className="text-lg font-bold mb-6 text-foreground tracking-tight flex items-center gap-2">
Health & Risk
</h3>
<div className="flex flex-col gap-4 flex-grow justify-center">
<HealthRow
label="Payment Success"
value={`${data.systemHealth.paymentSuccessRate}%`}
color={data.systemHealth.paymentSuccessRate > 95 ? "text-emerald" : "text-amber"}
/>
<HealthRow
label="Recent Errors"
value={data.systemHealth.recentErrors}
color={data.systemHealth.recentErrors > 10 ? "text-rose" : "text-emerald"}
/>
<HealthRow
label="Fraud Alerts"
value={data.systemHealth.fraudAlerts}
color={data.systemHealth.fraudAlerts > 5 ? "text-rose" : "text-emerald"}
/>
<HealthRow
label="Open Disputes"
value={data.activity.disputesOpen}
color={data.activity.disputesOpen > 5 ? "text-rose" : "text-emerald"}
/>
<div className="h-px w-full bg-border my-2" />
<HealthRow
label="K-Factor"
value={data.growthMetrics.kFactor.toFixed(2)}
color={data.growthMetrics.kFactor >= 1 ? "text-emerald" : "text-amber"}
/>
</div>
</div>
</motion.div>
</div>
</motion.div>
);
}

interface MetricCardProps {
readonly icon: string;
readonly label: string;
readonly value: string | number;
readonly gradient: string;
readonly textColor: string;
}

function MetricCard({ icon, label, value, gradient, textColor }: MetricCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const itemVariants = getItemVariants(shouldReduceMotion);
  return (
    <motion.div variants={itemVariants} className="relative group">

<div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-500`} />
<div className="relative bg-card card glass border border-border rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-300">
<div className="flex justify-between items-start">
<div className="flex flex-col">
<span className="text-sm font-medium text-muted-foreground mb-1">{label}</span>
<span className={`text-3xl font-bold tracking-tight ${textColor}`}>{value}</span>
</div>
<div className="text-3xl filter drop-shadow-md">{icon}</div>
</div>
</div>
</motion.div>
);
}

function HealthRow({ label, value, color }: Readonly<{ label: string; value: string | number; color: string }>) {
return (
<div className="flex justify-between items-center bg-muted/60 rounded-lg p-3 border border-border transition-colors hover:bg-muted">
<span className="text-sm font-medium text-muted-foreground">{label}</span>
<span className={`text-base font-bold drop-shadow-sm ${color}`}>{value}</span>
</div>
);
}
