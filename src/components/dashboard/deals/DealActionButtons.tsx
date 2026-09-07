import React from "react";
import { Button } from "@/components/ui";
import { DealDetail, getFlatDeliverablesList, ContentUrlEntry } from "./DealDetailHelpers";

interface DealActionButtonsProps {
readonly dealStatus: string;
readonly dealId: string;
readonly isInfluencer: boolean;
readonly isClient: boolean;
readonly isSubmitting: boolean;
readonly canSubmitContent: boolean;
readonly deal: DealDetail;
readonly handleSignContract: () => void;
readonly handleRejectInvite: () => void;
readonly handleCancelDeal: () => void;
readonly handleAction: (action: string, payload?: Record<string, unknown>) => Promise<boolean>;
readonly setItemizedUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>;
readonly setContentForm: React.Dispatch<React.SetStateAction<{ contentUrl: string; notes: string }>>;
readonly setShowSubmitModal: (v: boolean) => void;
readonly setShowVerifyModal: (v: boolean) => void;
readonly setItemizedReviews: React.Dispatch<React.SetStateAction<Record<string, { status: "APPROVED" | "REVISION_REQUESTED"; feedback: string }>>>;
readonly setShowReviewModal: (v: boolean) => void;
}

export function DealActionButtons({
dealStatus,
dealId,
isInfluencer,
isClient,
isSubmitting,
canSubmitContent,
deal,
handleSignContract,
handleRejectInvite,
handleCancelDeal,
handleAction,
setItemizedUrls,
setContentForm,
setShowSubmitModal,
setShowVerifyModal,
setItemizedReviews,
setShowReviewModal,
}: Readonly<DealActionButtonsProps>) {
return (
<div className="deal-detail-actions flex gap-3 mb-6 flex-wrap" aria-label="Deal actions">
{dealStatus === "PENDING_SIGNATURE" && (
<>
<Button
variant="primary"
onClick={handleSignContract}
disabled={isSubmitting}
>
Sign Contract
</Button>
{isInfluencer && (
<Button
variant="danger"
onClick={handleRejectInvite}
disabled={isSubmitting}
>
Reject Invite
</Button>
)}
</>
)}

{isInfluencer &&
["ACTIVE", "PAYMENT_HELD", "REVISION_REQUESTED"].includes(dealStatus) && (
<Button
variant="primary"
onClick={() => {
const latestSub = deal?.contentSubmissions?.[0];
const prevUrls: Record<string, string> = {};
if (latestSub?.contentUrls && Array.isArray(latestSub.contentUrls)) {
latestSub.contentUrls.forEach((item: ContentUrlEntry) => {
prevUrls[item.type] = item.url || "";
});
}
setItemizedUrls(prevUrls);
setContentForm({ contentUrl: latestSub?.contentUrl || "", notes: latestSub?.notes || "" });
setShowSubmitModal(true);
}}
disabled={!canSubmitContent}
>
Submit Content
</Button>
)}

{isInfluencer && dealStatus === "CONTENT_APPROVED" && (
<Button
variant="primary"
onClick={() => setShowVerifyModal(true)}
>
Submit Post URL
</Button>
)}

{isClient && dealStatus === "CONTENT_SUBMITTED" && (
<Button
variant="primary"
onClick={() => {
const latestSub = deal?.contentSubmissions?.[0];
const prevReviews: Record<string, { status: "APPROVED" | "REVISION_REQUESTED"; feedback: string }> = {};
const deliverablesList = getFlatDeliverablesList(deal);
deliverablesList.forEach((item) => {
const existing = latestSub?.contentUrls && Array.isArray(latestSub.contentUrls)
? latestSub.contentUrls.find((urlObj: ContentUrlEntry) => urlObj.type === item.type)
: null;
prevReviews[item.type] = {
status: existing?.status === "APPROVED" ? "APPROVED" : "REVISION_REQUESTED",
feedback: existing?.feedback || "",
};
});
setItemizedReviews(prevReviews);
setShowReviewModal(true);
}}
>
Review Content
</Button>
)}

{isClient && dealStatus === "POSTED" && (
<Button
variant="primary"
onClick={() => {
if (!confirm("Release payment to the influencer? This will mark the deal as complete and transfer funds. This cannot be undone.")) return;
handleAction("complete_deal");
}}
disabled={isSubmitting}
>
Release Payment
</Button>
)}

{isClient && !['COMPLETED', 'CANCELLED', 'DISPUTED'].includes(dealStatus) && (
<Button
variant="danger"
size="sm"
onClick={handleCancelDeal}
disabled={isSubmitting}
>
Cancel Deal
</Button>
)}

<Button
href={`/dashboard/messages?deal=${dealId}`}
variant="secondary"
>
Message
</Button>
<Button
href={`/dashboard/deals/${dealId}/dispute`}
variant="danger"
>
Resolve Issue
</Button>
</div>
);
}
