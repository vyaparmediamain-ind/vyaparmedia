"use client";

import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { InfluencerAnalyticsData } from "@/components/analytics/InfluencerDashboard";
import type { BrandAnalyticsData } from "@/components/analytics/BrandDashboard";
import WeeklyChallenges from "@/components/dashboard/challenges/WeeklyChallenges";

const InfluencerDashboard = dynamic(
  () => import("@/components/analytics/InfluencerDashboard"),
  {
    loading: () => <div className="card p-8 h-96 skeleton animate-pulse rounded-xl bg-tertiary" />,
    ssr: false,
  }
);

const BrandDashboard = dynamic(
  () => import("@/components/analytics/BrandDashboard"),
  {
    loading: () => <div className="card p-8 h-96 skeleton animate-pulse rounded-xl bg-tertiary" />,
    ssr: false,
  }
);
import { Select } from "@/components/ui";

interface AnalyticsPageClientProps {
readonly userType: "INFLUENCER" | "BRAND";
readonly initialData: InfluencerAnalyticsData | BrandAnalyticsData;
readonly currentFY?: string | undefined;
}

export default function AnalyticsPageClient({
userType,
initialData,
currentFY,
}: AnalyticsPageClientProps) {
const router = useRouter();
const searchParams = useSearchParams();

// Generate available FYs (current FY and previous 3)
const generateAvailableFYs = (): string[] => {
const fys: string[] = [];
const now = new Date();
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istNow = new Date(now.getTime() + IST_OFFSET_MS);
const currentFYStart = istNow.getUTCMonth() >= 3
? istNow.getUTCFullYear()
: istNow.getUTCFullYear() - 1;

for (let i = 0; i < 4; i++) {
const yr = currentFYStart - i;
fys.push(`${yr}-${String(yr + 1).slice(-2)}`);
}
return fys;
};

const availableFYs = generateAvailableFYs();
const selectedFY = currentFY || "";

const handleFYChange = (fy: string) => {
const params = new URLSearchParams(searchParams.toString());
if (fy) {
params.set("fy", fy);
} else {
params.delete("fy");
}
router.push(`/dashboard?${params.toString()}`);
};

return (
<div className="max-w-1280 mx-auto">
<div
className="mb-8 flex justify-between items-center flex-wrap gap-4"
>
<div>
<h1 className="font-extrabold text-3xl">
{userType === "INFLUENCER" ? "Performance Analytics" : "Campaign Analytics"}
</h1>
<p className="text-secondary">
{userType === "INFLUENCER"
? "Track your earnings, reach, and impact"
: "Monitor your spend, ROI, and campaign success"}
</p>
</div>

<div className="flex items-center gap-3">
<Select
id="analytics-fy-select"
label="Financial Year:"
value={selectedFY}
onChange={(e) => handleFYChange(e.target.value)}
className="min-w-200"
>
<option value="">Rolling 12 Months</option>
{availableFYs.map((fy) => (
<option key={fy} value={fy}>
FY {fy}
</option>
))}
</Select>
</div>
</div>

<div className="mb-8">
<WeeklyChallenges />
</div>

{userType === "INFLUENCER" ? (
<InfluencerDashboard data={initialData as InfluencerAnalyticsData} />
) : (
<BrandDashboard data={initialData as BrandAnalyticsData} />
)}
</div>
);
}
