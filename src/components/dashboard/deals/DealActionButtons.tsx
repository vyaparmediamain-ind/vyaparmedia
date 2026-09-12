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
  const contractSignature = (deal?.contractSignature && typeof deal.contractSignature === "object" ? deal.contractSignature : {}) as Record<string, unknown>;
  const brandSigned = Boolean(deal?.brandSignedAt || contractSignature?.brandSignature);
  const influencerSigned = Boolean(deal?.influencerSignedAt || contractSignature?.influencerSignature);
  const userHasSigned = isClient ? brandSigned : influencerSigned;
  const counterpartySigned = isClient ? influencerSigned : brandSigned;

  return (
    <div className="deal-detail-actions flex gap-3 mb-6 flex-wrap items-center" aria-label="Deal actions">
      {dealStatus === "PENDING_SIGNATURE" && (
        <>
          {userHasSigned ? (
            <div className="flex items-center gap-2 text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-4 py-2.5 rounded-lg font-medium">
              <span className="text-base">✓</span>
              <span>You have signed this contract. Waiting for {isClient ? "Influencer" : "Brand"} to sign.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              {counterpartySigned && (
                <div className="flex items-center gap-2 text-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-4 py-2 rounded-lg font-medium">
                  <span className="text-base">🔔</span>
                  <span>{isClient ? "Influencer" : "Brand"} has already signed! Please sign below to activate the deal.</span>
                </div>
              )}
              <div className="flex gap-3 items-center flex-wrap">
                <Button
                  variant="primary"
                  onClick={handleSignContract}
                  disabled={isSubmitting}
                >
                  ✍️ Sign Contract
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
              </div>
            </div>
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

      {isClient && ["ACTIVE", "PAYMENT_HELD"].includes(dealStatus) && (
        <div className="flex items-center gap-2 text-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-4 py-2.5 rounded-lg font-medium">
          <span className="text-base">🔒</span>
          <span>Escrow secured. Influencer is creating deliverables.</span>
        </div>
      )}

      {isInfluencer && dealStatus === "CONTENT_SUBMITTED" && (
        <div className="flex items-center gap-2 text-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-4 py-2.5 rounded-lg font-medium">
          <span className="text-base">⏳</span>
          <span>Content draft submitted! Brand is currently reviewing your submission.</span>
        </div>
      )}

      {isClient && dealStatus === "REVISION_REQUESTED" && (
        <div className="flex items-center gap-2 text-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-4 py-2.5 rounded-lg font-medium">
          <span className="text-base">✏️</span>
          <span>Revision requested. Waiting for Influencer to submit updated content.</span>
        </div>
      )}

      {isInfluencer && dealStatus === "CONTENT_APPROVED" && (
        <Button
          variant="primary"
          onClick={() => setShowVerifyModal(true)}
        >
          Submit Post URL
        </Button>
      )}

      {isClient && dealStatus === "CONTENT_APPROVED" && (
        <div className="flex items-center gap-2 text-sm bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 px-4 py-2.5 rounded-lg font-medium">
          <span className="text-base">✓</span>
          <span>Content approved! Waiting for Influencer to publish live and submit post URL.</span>
        </div>
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

      {isClient && ["POSTED", "VERIFICATION_PENDING", "VERIFIED"].includes(dealStatus) && (
        <Button
          variant="primary"
          onClick={() => {
            if (!confirm("Release payment to the influencer? This will mark the deal as complete and transfer funds. This cannot be undone.")) return;
            handleAction("complete_deal");
          }}
          disabled={isSubmitting}
        >
          💰 Release Payment
        </Button>
      )}

      {isInfluencer && ["POSTED", "VERIFICATION_PENDING", "VERIFIED"].includes(dealStatus) && (
        <div className="flex items-center gap-2 text-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-4 py-2.5 rounded-lg font-medium">
          <span className="text-base">⏳</span>
          <span>Live post submitted! Waiting for verification and escrow payment release.</span>
        </div>
      )}

      {dealStatus === "COMPLETED" && (
        <div className="flex items-center gap-2 text-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-4 py-2.5 rounded-lg font-medium">
          <span className="text-base">🎉</span>
          <span>Deal completed and payment settled successfully!</span>
        </div>
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
