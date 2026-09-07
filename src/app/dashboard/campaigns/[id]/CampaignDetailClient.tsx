"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils-client";
import { Button, Input, Textarea } from "@/components/ui";
import { ApplicationsList } from "@/components/dashboard/campaigns/details/ApplicationsList";
import { useCampaignDetail } from "@/components/dashboard/campaigns/details/useCampaignDetail";

interface CampaignDetailClientProps {
readonly user: { readonly id: string; readonly userType?: string };
readonly influencerProfile?: {
readonly id: string;
readonly instagramFollowers: number | null;
readonly instagramEngagementRate: number | null;
readonly youtubeSubscribers: number | null;
readonly youtubeEngagementRate: number | null;
} | null;
}

export default function CampaignDetailClient({
user,
influencerProfile = null,
}: CampaignDetailClientProps) {
const { id: campaignId } = useParams() as { id: string };
const router = useRouter();

const {
loading,
error,
campaign,
showApplyModal,
setShowApplyModal,
proposal,
setProposal,
proposedRate,
setProposedRate,
isSubmitting,
applications,
applicationsLoading,
applicationActionId,
notice,
setNotice,
hasApplied,
applicationStatus,
recommendedPayout,
isOwner,
canApply,
handleApplicationAction,
handleApply,
handleCampaignAction,
} = useCampaignDetail({
campaignId,
user,
influencerProfile,
router,
});

if (loading) {
return (
<div className="flex justify-center p-12">
<span className="loading w-32 h-32" />
</div>
);
}

if (error || !campaign) {
return (
<div className="p-6 text-center max-w-500 mx-auto">
<div className="text-3xl mb-4 flex justify-center text-rose">
  <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
</div>
<h2 className="font-bold text-xl mb-2 text-primary">Error Loading Campaign</h2>
<p className="text-secondary mb-6">{error || "Campaign not found"}</p>
<Link href="/dashboard/campaigns" className="btn btn-primary">
Back to Campaigns
</Link>
</div>
);
}

return (
<div className="grid gap-6 max-w-1000 mx-auto pb-16">
{/* Header section */}
      {/* Campaign Hero Card */}
      <div className="card p-6 border border-card rounded-2xl bg-secondary shadow-lg">
        {/* Top bar: Breadcrumb & Actions */}
        <div className="flex justify-between items-center flex-wrap gap-3 mb-4">
          <Link
            href="/dashboard/campaigns"
            className="text-xs font-semibold text-muted hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <span>←</span>
            <span>Back to Campaigns</span>
          </Link>

          <div className="flex gap-2 flex-wrap items-center">
            {isOwner && campaign.status === "DRAFT" && (
              <>
                <Link href={`/dashboard/campaigns/create?edit=${campaign.id}`} className="btn btn-secondary btn-sm text-xs">
                  Edit Draft
                </Link>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => handleCampaignAction("ACTIVATE")}
                >
                  Launch Campaign
                </Button>
              </>
            )}
            {isOwner && campaign.status === "ACTIVE" && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => handleCampaignAction("CANCEL")}
              >
                Cancel Campaign
              </Button>
            )}
            {isOwner && (campaign.status === "ACTIVE" || campaign.status === "COMPLETED") && (
              <a
                href={`/api/reports/brand/campaign/${campaign.id}/roi?format=csv`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" size="sm" className="cursor-pointer text-xs">
                  ROI Report (CSV)
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Main Title & Brand Info */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Brand Logo Avatar */}
          <div className="relative flex-shrink-0">
            <div className="conversation-avatar" style={{ width: 54, height: 54, fontSize: 18 }}>
              {campaign.brand?.logo ? (
                <Image
                  src={campaign.brand.logo}
                  alt={campaign.brand.companyName || "Brand Logo"}
                  fill
                  unoptimized
                  className="object-cover rounded-full"
                />
              ) : (
                (campaign.brand?.companyName || campaign.title || "B").charAt(0).toUpperCase()
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
              <h1 className="font-extrabold text-2xl md:text-3xl tracking-tight text-white mb-0 leading-tight">
                {campaign.title}
              </h1>
              {(() => {
                const s = campaign.status?.toUpperCase();
                let colorClasses = "bg-slate-500/20 text-slate-400 border-slate-500/30";
                if (s === "ACTIVE") colorClasses = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
                if (s === "CANCELLED") colorClasses = "bg-rose-500/20 text-rose-400 border-rose-500/30";
                if (s === "COMPLETED") colorClasses = "bg-blue-500/20 text-blue-400 border-blue-500/30";
                if (s === "DRAFT") colorClasses = "bg-amber-500/20 text-amber-400 border-amber-500/30";

                return (
                  <span className={`text-2xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${colorClasses}`}>
                    {campaign.status}
                  </span>
                );
              })()}
            </div>

            {campaign.brand && (
              <div className="flex items-center gap-3 text-xs text-secondary flex-wrap">
                <span className="font-semibold text-white">{campaign.brand.companyName}</span>
                {campaign.brand.averageRating > 0 && (
                  <span className="flex items-center gap-1 text-amber-400 font-semibold">
                    <span>★</span>
                    <span>{(campaign.brand.averageRating).toFixed(1)}</span>
                  </span>
                )}
                {campaign.brand.isGstVerified && (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20" title="GST details verified for legal compliance">
                    <span>🛡️</span>
                    <span>GST Verified</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

{notice && (
<div className={`p-4 rounded-md border-card text-sm text-center ${notice.type === "success" ? "bg-emerald-subtle text-emerald border-emerald" : "bg-rose-subtle text-rose border-rose"}`}>
{notice.message}
</div>
)}

{/* Grid container */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
{/* Left main info */}
<div className="md:col-span-2 grid gap-6">
<section className="card p-6">
<h3 className="text-lg font-bold mb-3 text-primary">Campaign Details</h3>
<p className="text-secondary text-sm leading-relaxed whitespace-pre-wrap">
{campaign.description}
</p>
</section>

<section className="card p-6">
<h3 className="text-lg font-bold mb-3 text-primary">Requirements & Guidelines</h3>
<p className="text-secondary text-sm leading-relaxed whitespace-pre-wrap">
{campaign.requirements}
</p>
</section>

{/* Applications list for campaign owner */}
{isOwner && (
<section className="card p-6">
<h3 className="text-lg font-bold mb-4 text-primary">
Applications ({campaign.totalApplications})
</h3>
<ApplicationsList
loading={applicationsLoading}
applications={applications}
actionId={applicationActionId}
onAction={handleApplicationAction}
/>
</section>
)}
</div>

{/* Right sidebar */}
<div className="grid gap-6 h-fit">
<section className="card p-6">
<h3 className="text-base font-bold mb-4 text-primary">Key Metrics</h3>
<div className="grid gap-4">
<div>
<span className="text-xs text-muted block uppercase tracking-wider">Total Escrow Budget</span>
<strong className="text-xl font-extrabold text-primary">
{formatCurrency(campaign.totalBudget)}
</strong>
</div>

{campaign.perInfluencerBudget !== null && (
<div>
<span className="text-xs text-muted block uppercase tracking-wider">Per Creator Payout</span>
<strong className="text-base font-bold text-primary">
{formatCurrency(campaign.perInfluencerBudget)}
</strong>
</div>
)}

<div>
<span className="text-xs text-muted block uppercase tracking-wider">Target Followers</span>
<strong className="text-sm font-semibold text-primary">
{campaign.minFollowers.toLocaleString()}
{campaign.maxFollowers ? ` - ${campaign.maxFollowers.toLocaleString()}` : "+"}
</strong>
</div>

{campaign.maxInfluencers && (
<div>
<span className="text-xs text-muted block uppercase tracking-wider">Slots Filled</span>
<strong className="text-sm font-semibold text-primary">
{campaign.acceptedCount} / {campaign.maxInfluencers}
</strong>
</div>
)}

{campaign.applicationDeadline && (
<div>
<span className="text-xs text-muted block uppercase tracking-wider">Application Deadline</span>
<strong className="text-sm font-semibold text-primary">
{formatDate(campaign.applicationDeadline)}
</strong>
</div>
)}

<div>
<span className="text-xs text-muted block uppercase tracking-wider">Posting Target Date</span>
<strong className="text-sm font-semibold text-primary">
{formatDate(campaign.postingDeadline)}
</strong>
</div>
</div>

{/* Application button for influencer */}
{canApply && (
<Button
type="button"
variant="primary"
onClick={() => {
setNotice(null);
setShowApplyModal(true);
}}
className="w-full mt-6"
>
Apply to Campaign
</Button>
)}

            {hasApplied && (
              <div className="mt-6 p-3 bg-secondary rounded-md text-center border border-card">
                <span className="text-xs text-muted block mb-1">Your Application Status</span>
                <strong className="text-sm font-bold uppercase text-primary">
                  {applicationStatus || "SUBMITTED"}
                </strong>
              </div>
            )}

            {!isOwner && campaign.status === "CANCELLED" && (
              <div className="mt-6 p-3.5 bg-rose-500/10 rounded-xl text-center border border-rose-500/25">
                <span className="text-xs font-bold text-rose-400 block mb-0.5">Campaign Cancelled</span>
                <span className="text-2xs text-secondary">This campaign has been cancelled by the brand.</span>
              </div>
            )}

            {!isOwner && campaign.status === "COMPLETED" && (
              <div className="mt-6 p-3.5 bg-secondary rounded-xl text-center border border-card">
                <span className="text-xs font-bold text-muted block mb-0.5">Campaign Concluded</span>
                <span className="text-2xs text-secondary">This campaign is now completed.</span>
              </div>
            )}
          </section>

{/* Deliverables card */}
<section className="card p-6">
<h3 className="text-base font-bold mb-3 text-primary">Deliverables Checklist</h3>
<ul className="grid gap-2.5 list-none">
{campaign.deliverables.map((item, idx) => (
<li key={`${item.type}-${idx}`} className="flex items-start gap-2.5 text-sm text-secondary">
<span className="flex-shrink-0 text-emerald"></span>
<div>
<span className="font-semibold text-primary">
{item.count}x {item.type.replaceAll("_", " ").toLowerCase()}
</span>
{item.specs && (
<p className="text-muted text-xs mt-0.5 leading-relaxed">{item.specs}</p>
)}
</div>
</li>
))}
</ul>
</section>

{/* Target Niches */}
{campaign.targetCategories.length > 0 && (
<section className="card p-6">
<h3 className="text-base font-bold mb-3 text-primary">Target Niches</h3>
<div className="flex flex-wrap gap-1.5">
{campaign.targetCategories.map((c) => (
<span key={c} className="badge bg-tertiary">
{c}
</span>
))}
</div>
</section>
)}
</div>
</div>

{/* Apply Modal */}
{showApplyModal && (
<div className="modal-overlay">
<div className="modal-content max-w-500 card p-6">
<h3 className="font-bold text-lg mb-4 text-primary">Apply to Campaign</h3>

<div className="grid gap-4">
<Textarea
label="Proposal Description (Why should the brand hire you?)"
id="proposal"
placeholder="Write a professional proposal explaining your content ideas and fit for this campaign (Minimum 50 characters)..."
value={proposal}
onChange={(e) => setProposal(e.target.value)}
required
className="h-160"
/>

<div>
<Input
label="Your Proposed Payout (Rs)"
id="proposed-rate"
type="number"
placeholder="Rate in Rs"
value={proposedRate || ""}
onChange={(e) => setProposedRate(Number(e.target.value))}
required
/>
{recommendedPayout > 0 && (
<span className="text-muted text-2xs mt-1 block">
Recommended for your stats: {(recommendedPayout / 100).toLocaleString()}
</span>
)}
</div>

<div className="flex justify-end gap-2 mt-4">
<Button
type="button"
variant="secondary"
onClick={() => setShowApplyModal(false)}
disabled={isSubmitting}
>
Cancel
</Button>
<Button
type="button"
variant="primary"
onClick={handleApply}
disabled={isSubmitting || proposedRate <= 0}
>
{isSubmitting ? "..." : "Submit"}
</Button>
</div>
</div>
</div>
</div>
)}
</div>
);
}
