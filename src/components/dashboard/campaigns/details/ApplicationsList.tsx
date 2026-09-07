"use client";

import { Badge, Button, Spinner } from "@/components/ui";
import EmptyState from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils-client";
import { CampaignApplication } from "./CampaignDetailHelpers";

interface ApplicationsListProps {
readonly loading: boolean;
readonly applications: readonly CampaignApplication[];
readonly actionId: string | null;
readonly onAction: (id: string, action: "accept" | "reject") => void;
}

export function ApplicationsList({
loading,
applications,
actionId,
onAction,
}: ApplicationsListProps) {
if (loading) {
return (
<div className="flex justify-center p-6">
<Spinner size="md" />
</div>
);
}
if (applications.length === 0) {
return (
<EmptyState
emoji=""
title="No Applications Yet"
description="No creators have applied to this campaign yet."
compact
/>
);
}

return (
<div className="grid gap-3">
{applications.map((application) => {
const canAct = ["PENDING", "SHORTLISTED"].includes(application.status);
const matchScore = application.matchScore;

    let matchVariant: "danger" | "success" | "warning" = "danger";
    if (matchScore !== undefined) {
      if (matchScore >= 80) {
        matchVariant = "success";
      } else if (matchScore >= 50) {
        matchVariant = "warning";
      }
    }

return (
<article
key={application.id}
className="grid gap-4 p-4 bg-tertiary rounded-md border-card application-item-grid"
>
<div className="min-w-0">
<div
className="flex items-center flex-wrap mb-2 gap-2.5"
>
<strong>{application.influencer.displayName}</strong>
<Badge variant="ghost">{application.status}</Badge>
<Badge variant="ghost">Trust {application.influencer.user?.trustScore ?? 0}</Badge>
<Badge variant="ghost">{formatCurrency(application.proposedRate)}</Badge>
{matchScore !== undefined && (
<span title={`Match Score Details:\n- Niche Fit: ${application.matchBreakdown?.categoryScore}%\n- Engagement Fit: ${application.matchBreakdown?.engagementScore}%\n- Authenticity Fit: ${application.matchBreakdown?.authenticityScore}%\n- Reputation Fit: ${application.matchBreakdown?.qualityScore}%\n- ROI/CPV Fit (Projected): ${application.matchBreakdown?.roiScore}%\n- Est. Views (Modelled): ${application.matchBreakdown?.estimatedViews}\n- Est. CPV (Modelled): \u20b9${((application.matchBreakdown?.estimatedCpvPaise || 0) / 100).toFixed(2)}`}>
<Badge variant={matchVariant} className="flex items-center gap-1">
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-orange-500 fill-current">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
  {matchScore}% Match
</Badge>
</span>
)}
</div>
<p
className="text-secondary text-sm leading-normal mb-2"
>
{application.proposal}
</p>
<div
className="flex flex-wrap text-muted text-xs gap-2.5"
>
<span>
Followers:{" "}
{(application.influencer.instagramFollowers || 0).toLocaleString("en-IN")}
</span>
<span>
Deals: {application.influencer.completedDeals || 0}
</span>
<span>
Category: {application.influencer.categories?.split(",")[0] || "Other"}
</span>
{application.matchBreakdown && (
<span className="text-emerald font-semibold" title="This is a modelled projection based on follower stats and campaign budget, not verified API statistics.">
Projected CPV: ₹{((application.matchBreakdown.estimatedCpvPaise || 0) / 100).toFixed(2)} / view (Est.)
</span>
)}
</div>
</div>

<div
className="flex items-start gap-2 flex-wrap justify-end"
>
<Button
href={`/dashboard/influencers/${application.influencer.id}`}
variant="secondary"
size="sm"
aria-label={`View profile of ${application.influencer.displayName}`}
>
Profile
</Button>
{canAct && (
<>
<Button
type="button"
variant="primary"
disabled={actionId === application.id}
onClick={() => onAction(application.id, "accept")}
>
Accept
</Button>
<Button
type="button"
variant="danger"
disabled={actionId === application.id}
onClick={() => onAction(application.id, "reject")}
>
Reject
</Button>
</>
)}
</div>
</article>
);
})}
</div>
);
}
