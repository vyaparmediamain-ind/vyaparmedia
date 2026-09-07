"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import Image from "next/image";
import { useSession } from "next-auth/react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { formatCurrency } from "@/lib/utils-client";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button, Skeleton, Spinner } from "@/components/ui";

interface Application {
id: string;
status: string;
proposedRate: number;
finalRate?: number | null;
createdAt: string;
campaign: {
id: string;
title: string;
perInfluencerBudget: number;
brand: {
companyName: string;
logo: string | null;
} | null;
};
}

interface ApplicationsResponse {
success?: boolean;
message?: string;
data?: { applications?: Application[]; totalPages?: number };
applications?: Application[];
totalPages?: number;
}

function getStatusVariant(status: string): "success" | "danger" | "warning" {
  switch (status.toUpperCase()) {
    case "SELECTED":
    case "ACCEPTED":
      return "success";
    case "REJECTED":
      return "danger";
    case "PENDING":
    default:
      return "warning";
  }
}

function getApplicationStatusLabel(status: string): string {
  if (status === "SELECTED" || status === "ACCEPTED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  if (status === "PENDING") return "Pending";
  return status;
}

/** Skeleton placeholder matching the 6-column applications table layout. */
function ApplicationsTableSkeleton() {
return (
<>
<div className="hidden sm:block card overflow-hidden p-0" aria-hidden="true">
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="border-b border-card bg-tertiary">
{["CAMPAIGN", "PROPOSED RATE", "FINAL RATE", "SUBMITTED ON", "STATUS", "ACTION"].map((col) => (
<th key={col} scope="col" className="p-4">
<Skeleton height={10} width={col === "CAMPAIGN" ? 72 : 56} borderRadius={4} />
</th>
))}
</tr>
</thead>
<tbody>
{[1, 2, 3, 4, 5, 6].map((i) => (
<tr key={i} className="border-b border-card">
<td className="p-4">
<div className="flex items-center gap-3">
<Skeleton width={36} height={36} borderRadius={4} />
<div>
<Skeleton height={14} width={160} borderRadius={4} className="mb-1-5" />
<Skeleton height={11} width={100} borderRadius={4} />
</div>
</div>
</td>
<td className="p-4"><Skeleton height={14} width={72} borderRadius={4} /></td>
<td className="p-4"><Skeleton height={14} width={72} borderRadius={4} /></td>
<td className="p-4"><Skeleton height={14} width={80} borderRadius={4} /></td>
<td className="p-4"><Skeleton height={24} width={72} borderRadius={6} /></td>
<td className="p-4 text-right"><Skeleton height={32} width={108} borderRadius={6} className="ml-auto" /></td>
</tr>
))}
</tbody>
</table>
</div>
</div>

<div className="block sm:hidden space-y-3" aria-hidden="true">
  {[1, 2, 3, 4].map((i) => (
    <div key={i} className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton width={36} height={36} borderRadius={4} />
          <div>
            <Skeleton height={14} width={120} borderRadius={4} className="mb-1-5" />
            <Skeleton height={10} width={80} borderRadius={4} />
          </div>
        </div>
        <Skeleton height={20} width={60} borderRadius={6} />
      </div>
      <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-card-light">
        {[1, 2, 3].map((j) => (
          <div key={j} className="flex flex-col gap-1">
            <Skeleton height={8} width={40} borderRadius={3} />
            <Skeleton height={12} width={50} borderRadius={3} />
          </div>
        ))}
      </div>
      <Skeleton height={32} width="100%" borderRadius={6} />
    </div>
  ))}
</div>
</>
);
}

export default function ApplicationsPage() {
const { data: session } = useSession();
const [page, setPage] = useState(1);
const limit = 10;

const { data: payload, isLoading: loading, error: fetchErr } = useSWR<ApplicationsResponse>(
session?.user ? `/api/applications?page=${page}&limit=${limit}` : null,
fetcher
);

const applications = payload?.data?.applications || payload?.applications || [];
const totalPages = payload?.data?.totalPages || payload?.totalPages || 1;
let error = "";
if (fetchErr) {
error = "Failed to fetch applications";
} else if (payload && !payload.success) {
error = payload.message || "Failed to load applications";
}

if (!session) {
return (
<div className="flex items-center justify-center min-h-screen">
<Spinner size="lg" />
</div>
);
}

// Brands don't submit applications — they receive them on their campaign pages
if (session.user?.userType === "BRAND") {
return (
<DashboardShell user={session.user}>
<div className="mx-auto max-w-1000 p-40-20 text-center flex flex-col items-center gap-4 py-20">
<svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-muted opacity-60">
<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
<polyline points="14 2 14 8 20 8" />
<line x1="16" x2="8" y1="13" y2="13" />
<line x1="16" x2="8" y1="17" y2="17" />
</svg>
<h1 className="text-2xl font-extrabold">Influencer Applications</h1>
<p className="text-secondary max-w-md">
As a brand, influencers apply to your campaigns. View and manage applications from your campaign detail pages.
</p>
<Button href="/dashboard/campaigns" variant="primary">Go to My Campaigns</Button>
</div>
</DashboardShell>
);
}

let applicationsList;
if (loading) {
applicationsList = <ApplicationsTableSkeleton />;
} else if (error) {
applicationsList = (
<div className="text-center text-rose p-10">
{error}
</div>
);
} else if (applications.length === 0) {
applicationsList = (
<EmptyState
emoji=""
title="No Applications Found"
description="You haven't submitted any campaign applications yet."
actionLabel="Discover Campaigns"
actionHref="/dashboard/campaigns"
/>
);
} else {
applicationsList = (
<>
{/* Desktop View */}
<div className="hidden sm:block card overflow-hidden p-0">
<div className="overflow-x-auto w-full">
<table className="w-full text-left border-collapse min-w-600" style={{ minWidth: "600px" }} aria-label="My campaign applications">
<thead>
<tr className="border-b border-card bg-tertiary">
<th scope="col" className="p-4 text-xs font-bold text-secondary">CAMPAIGN</th>
<th scope="col" className="p-4 text-xs font-bold text-secondary">PROPOSED RATE</th>
<th scope="col" className="p-4 text-xs font-bold text-secondary">FINAL RATE</th>
<th scope="col" className="p-4 text-xs font-bold text-secondary">SUBMITTED ON</th>
<th scope="col" className="p-4 text-xs font-bold text-secondary">STATUS</th>
<th scope="col" className="p-4 text-xs font-bold text-secondary text-right">ACTION</th>
</tr>
</thead>
<tbody>
          {applications.map((app) => {
            let displayRate = "—";
            if (app.finalRate) {
              displayRate = formatCurrency(app.finalRate);
            } else if (app.status === "SELECTED") {
              displayRate = formatCurrency(app.proposedRate);
            }

            return (
              <tr key={app.id} className="border-b border-card">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden relative rounded-sm text-white w-36 h-36 bg-gradient-card"
                    >
                      {app.campaign.brand?.logo ? (
                        <Image
                          src={app.campaign.brand.logo}
                          alt={app.campaign.brand?.companyName ?? "Brand logo"}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        (app.campaign.brand?.companyName || "DC").slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm">
                        {app.campaign.title}
                      </div>
                      <div className="text-secondary text-xs">
                        by {app.campaign.brand?.companyName || "Unknown Brand"}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-4 font-bold">{formatCurrency(app.proposedRate)}</td>
                <td className="p-4 font-bold text-indigo-light">
                  {displayRate}
                </td>
                <td className="p-4 text-secondary text-sm">
                  {new Date(app.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="p-4">
                  <Badge variant={getStatusVariant(app.status)} className="text-xs font-extrabold">
                    {getApplicationStatusLabel(app.status)}
                  </Badge>
                </td>
                <td className="p-4 text-right">
                  <Button
                    href={`/dashboard/campaigns/${app.campaign.id}`}
                    variant="ghost"
                    size="sm"
                    aria-label={`View campaign: ${app.campaign.title}`}
                  >
                    View Campaign
                  </Button>
                </td>
              </tr>
            );
          })}
</tbody>
</table>
</div>
</div>

{/* Mobile View */}
<div className="block sm:hidden space-y-3">
  {applications.map((app) => {
    let displayRate = "—";
    if (app.finalRate) {
      displayRate = formatCurrency(app.finalRate);
    } else if (app.status === "SELECTED") {
      displayRate = formatCurrency(app.proposedRate);
    }

    return (
      <div key={app.id} className="card p-4 flex flex-col gap-3">
        {/* Brand & Campaign Title */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden relative rounded-sm text-white w-9 h-9 bg-gradient-card">
              {app.campaign.brand?.logo ? (
                <Image
                  src={app.campaign.brand.logo}
                  alt={app.campaign.brand?.companyName ?? "Brand logo"}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                (app.campaign.brand?.companyName || "DC").slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <div className="font-bold text-sm line-clamp-1">
                {app.campaign.title}
              </div>
              <div className="text-secondary text-xs">
                by {app.campaign.brand?.companyName || "Unknown Brand"}
              </div>
            </div>
          </div>
          <Badge variant={getStatusVariant(app.status)} className="text-2xs font-extrabold px-2.5 py-0.5 flex-shrink-0">
            {getApplicationStatusLabel(app.status)}
          </Badge>
        </div>

        {/* Rates and Dates grid */}
        <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-card-light text-xs">
          <div>
            <div className="text-secondary text-2xs mb-0.5">PROPOSED</div>
            <div className="font-bold text-white">{formatCurrency(app.proposedRate)}</div>
          </div>
          <div>
            <div className="text-secondary text-2xs mb-0.5">FINAL RATE</div>
            <div className="font-bold text-indigo-light">{displayRate}</div>
          </div>
          <div>
            <div className="text-secondary text-2xs mb-0.5">SUBMITTED ON</div>
            <div className="font-medium text-secondary">
              {new Date(app.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-1">
          <Button
            href={`/dashboard/campaigns/${app.campaign.id}`}
            variant="secondary"
            size="sm"
            className="w-full text-center py-1.5"
            aria-label={`View campaign: ${app.campaign.title}`}
          >
            View Campaign
          </Button>
        </div>
      </div>
    );
  })}
</div>
</>
);
}

return (
<DashboardShell user={session.user}>
<div className="mx-auto max-w-1000 p-40-20">
{/* Header */}
<div className="mb-8">
<h1 className="font-extrabold text-3xl">My Applications</h1>
<p className="text-secondary text-sm mt-1">
Track the status of your pitches and proposals submitted to campaigns.
</p>
</div>

{error && (
<div
className="card p-4 mb-6 rounded-md text-rose bg-rose-subtle border-rose-subtle"
>
{error}
</div>
)}

{applicationsList}

{totalPages > 1 && (
  <div className="deals-pagination flex justify-center items-center gap-4 mt-6">
    <Button
      variant="secondary"
      disabled={page <= 1}
      onClick={() => setPage((p) => Math.max(1, p - 1))}
      className="min-w-100"
    >
      Previous
    </Button>
    <span className="text-sm text-secondary">
      Page {page} of {totalPages}
    </span>
    <Button
      variant="secondary"
      disabled={page >= totalPages}
      onClick={() => setPage((p) => p + 1)}
      className="min-w-100"
    >
      Next
    </Button>
  </div>
)}
</div>
</DashboardShell>
);
}
