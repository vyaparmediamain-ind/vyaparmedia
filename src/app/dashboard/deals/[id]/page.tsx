"use client";

import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { ToastContainer } from "@/components/ui/toast";
import { useTokenRefreshGuard } from "@/hooks/useTokenRefreshGuard";
import { useDealDetail, computeDealDisplay } from "@/components/dashboard/deals/useDealDetail";
import { parseContractTerms } from "@/components/dashboard/deals/DealDetailHelpers";
import { DealProgress } from "@/components/dashboard/deals/DealProgress";
import { DealContractCard } from "@/components/dashboard/deals/DealContractCard";
import { EngagementCard } from "@/components/dashboard/deals/EngagementCard";
import { ContentSubmissionsCard } from "@/components/dashboard/deals/ContentSubmissionsCard";
import { DealActionButtons } from "@/components/dashboard/deals/DealActionButtons";
import { DealModals } from "@/components/dashboard/deals/DealModals";
import { Button, Textarea } from "@/components/ui";

export default function DealDetailPage() {
const { id } = useParams() as { id: string };
const { data: session } = useSession();
const { requireFreshSession } = useTokenRefreshGuard();
const dealState = useDealDetail(id, session, requireFreshSession);

const {
deal,
isLoading: loading,
error,
isSubmitting,
reviewRating,
setReviewRating,
hoverRating,
setHoverRating,
reviewComment,
setReviewComment,
reviewSubmitted,
setReviewSubmitted,
showAddressModal,
setShowAddressModal,
showReviewModal,
setShowReviewModal,
showSubmitModal,
setShowSubmitModal,
showVerifyModal,
setShowVerifyModal,
shippingAddress: shippingForm,
setShippingAddress: setShippingForm,
itemizedUrls,
setItemizedUrls,
contentForm,
setContentForm,
postUrl,
setPostUrl,
itemizedReviews,
setItemizedReviews,
isUploadingContent,
uploadingField,
setUploadingField,
fileInputRef,
handleContentUpload,
handleAction,
handleReviewContent,
showToast,
setIsSubmitting,
toasts,
removeToast,
engagement,
engagementDisclaimer,
} = dealState;

const ratingLabelMap: Record<number, string> = {
1: "Poor - Disappointed",
2: "Fair - Needs improvement",
3: "Good - Satisfactory",
4: "Very Good - Great work",
5: "Excellent - Outstanding!",
};

const isClient = session?.user?.userType === "BRAND";
const isInfluencer = session?.user?.userType === "INFLUENCER";

if (loading) {
return (
<DashboardShell user={session?.user || undefined}>
<div className="flex justify-center items-center h-64">
<span className="loading" />
</div>
</DashboardShell>
);
}

if (error || !deal) {
return (
<DashboardShell user={session?.user || undefined}>
<div className="text-center p-8">
<div className="text-rose font-semibold mb-2">Failed to load deal</div>
<div className="text-sm text-secondary">{String(error || "Deal not found.")}</div>
</div>
</DashboardShell>
);
}

const terms = parseContractTerms(deal.contractTerms);
const { canSubmitContent } = computeDealDisplay(deal, terms);

return (
<DashboardShell user={session?.user || undefined}>
<ToastContainer toasts={toasts} onClose={removeToast} />

<DealActionButtons
dealStatus={deal.status}
dealId={deal.id}
isInfluencer={isInfluencer}
isClient={isClient}
isSubmitting={isSubmitting}
canSubmitContent={canSubmitContent}
deal={deal}
handleSignContract={() => dealState.handleSignContract()}
handleRejectInvite={() => dealState.handleRejectInvite()}
handleCancelDeal={() => dealState.handleCancelDeal()}
handleAction={dealState.handleAction}
setItemizedUrls={setItemizedUrls}
setContentForm={setContentForm}
setShowSubmitModal={setShowSubmitModal}
setShowVerifyModal={setShowVerifyModal}
setItemizedReviews={setItemizedReviews}
setShowReviewModal={setShowReviewModal}
/>

<div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
<div className="lg:col-span-2 flex flex-col gap-6">
<DealContractCard deal={deal} />

<ContentSubmissionsCard submissions={deal.contentSubmissions} />
</div>

<div className="flex flex-col gap-6">
<DealProgress status={deal.status} />

<EngagementCard
engagement={engagement}
disclaimer={engagementDisclaimer}
isClient={isClient}
/>
</div>
</div>

{deal.status === "COMPLETED" && !reviewSubmitted && (
<div className="card mt-6 deal-review-card">
<h3 className="deal-review-title"> Rate This Deal</h3>
<p className="deal-review-copy">How was your experience? Your review helps build trust on the platform.</p>
<div className="deal-rating-row">
{[1, 2, 3, 4, 5].map((star) => (
<Button
key={star}
type="button"
onClick={() => setReviewRating(star)}
onMouseEnter={() => setHoverRating(star)}
onMouseLeave={() => setHoverRating(0)}
aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
aria-pressed={(hoverRating || reviewRating) >= star ? "true" : "false"}
className="deal-rating-star"
data-active={(hoverRating || reviewRating) >= star ? "true" : "false"}
>
★
</Button>
))}
{reviewRating > 0 && (
<span
role="status"
aria-live="polite"
className="deal-rating-label"
>
{ratingLabelMap[reviewRating] || "Excellent"}
</span>
)}
</div>
<Textarea
placeholder="Share your experience (optional)..."
aria-label="Share your experience (optional)"
value={reviewComment}
onChange={(e) => setReviewComment(e.target.value)}
rows={3}
className="deal-review-textarea"
/>
<Button
variant="primary"
disabled={reviewRating === 0 || isSubmitting}
onClick={async () => {
setIsSubmitting(true);
try {
const res = await fetch("/api/reviews", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
dealId: id,
rating: reviewRating,
...(reviewComment.trim() ? { comment: reviewComment.trim() } : {}),
}),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Failed to submit review");
showToast("success", "Review submitted! Thank you.");
setReviewSubmitted(true);
} catch (err: unknown) {
showToast("error", err instanceof Error ? err.message : String(err));
} finally {
setIsSubmitting(false);
}
}}
className="deal-review-submit"
>
{isSubmitting ? <span className="loading" /> : "Submit Review"}
</Button>
</div>
)}
{deal.status === "COMPLETED" && reviewSubmitted && (
<div
className="card flex items-center gap-3 rounded-lg mt-6 deal-review-success"
>
<span className="text-2xl flex items-center justify-center text-emerald">
  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
</span>
<div>
<strong>Review Submitted</strong>
<p className="text-sm text-secondary m-0">
{"\u2605".repeat(Math.max(0, reviewRating))} Thank you for your feedback!
</p>
</div>
</div>
)}

<DealModals
showAddressModal={showAddressModal}
setShowAddressModal={setShowAddressModal}
showReviewModal={showReviewModal}
setShowReviewModal={setShowReviewModal}
showSubmitModal={showSubmitModal}
setShowSubmitModal={setShowSubmitModal}
showVerifyModal={showVerifyModal}
setShowVerifyModal={setShowVerifyModal}
deal={deal}
shippingForm={shippingForm}
setShippingForm={setShippingForm}
itemizedUrls={itemizedUrls}
setItemizedUrls={setItemizedUrls}
contentForm={contentForm}
setContentForm={setContentForm}
postUrl={postUrl}
setPostUrl={setPostUrl}
isSubmitting={isSubmitting}
handleAction={handleAction}
showToast={showToast}
handleReviewContent={handleReviewContent}
itemizedReviews={itemizedReviews}
setItemizedReviews={setItemizedReviews}
isUploadingContent={isUploadingContent}
uploadingField={uploadingField}
setUploadingField={setUploadingField}
fileInputRef={fileInputRef}
handleContentUpload={handleContentUpload}
/>
</DashboardShell>
);
}
