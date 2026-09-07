"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

import {
DealDetail,
parseContractTerms,
formatCurrency,
formatContractDate,
getFlatDeliverablesList,
ContractTermsJson,
DeliverableItem,
normalizeTextArray,
EngagementReport,
} from "./DealDetailHelpers";
import { ToastItem, ToastType } from "@/components/ui/toast";

export function useDealDetail(
id: string,
session: ReturnType<typeof useSession>["data"],
requireFreshSession: () => Promise<boolean>
) {


const [showSubmitModal, setShowSubmitModal] = useState(false);
const [showVerifyModal, setShowVerifyModal] = useState(false);
const [showReviewModal, setShowReviewModal] = useState(false);
const [showAddressModal, setShowAddressModal] = useState(false);
const [showDispatchModal, setShowDispatchModal] = useState(false);
const [contentForm, setContentForm] = useState({ contentUrl: "", notes: "" });
const [itemizedUrls, setItemizedUrls] = useState<Record<string, string>>({});
const [itemizedReviews, setItemizedReviews] = useState<Record<string, { status: "APPROVED" | "REVISION_REQUESTED"; feedback: string }>>({});
const [uploadingField, setUploadingField] = useState<string | null>(null);
const [postUrl, setPostUrl] = useState("");

const [shippingAddress, setShippingAddress] = useState({
fullName: "",
phone: "",
line1: "",
line2: "",
city: "",
state: "",
pinCode: "",
country: "India",
});
const [dispatchForm, setDispatchForm] = useState({
trackingNumber: "",
carrier: "",
});
const [isSubmitting, setIsSubmitting] = useState(false);
const [isUploadingContent, setIsUploadingContent] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);
const [reviewRating, setReviewRating] = useState(0);
const [reviewComment, setReviewComment] = useState("");
const [reviewSubmitted, setReviewSubmitted] = useState(false);
const [hoverRating, setHoverRating] = useState(0);
const [toasts, setToasts] = useState<ToastItem[]>([]);

const removeToast = (toastId: string) => {
setToasts(prev => prev.filter(t => t.id !== toastId));
};

const showToast = (type: ToastType, message: string) => {
const toastId = String(Date.now());
setToasts(prev => [...prev, { id: toastId, type, message }]);
setTimeout(() => removeToast(toastId), 5000);
};

const { data: dealData, isLoading, error: fetchErr, mutate: fetchDeal } = useSWR<{ deal?: DealDetail }>(
id && session ? `/api/deals/${id}` : null,
fetcher
);

const deal: DealDetail | null = dealData?.deal || null;
const error = fetchErr ? "Failed to fetch deal" : "";

const { data: engData } = useSWR<{ report?: EngagementReport & { hasEstimatedData?: boolean } }>(
id && deal?.postUrl ? `/api/deals/${id}/engagement` : null,
fetcher
);

const engagement: EngagementReport | null = engData?.report || null;
const engagementDisclaimer = engData?.report?.hasEstimatedData
? " Some figures are rule-based estimates, not real-time API data."
: null;

const handleContentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    showToast("error", "File size exceeds the 10MB limit.");
    return;
  }

setIsUploadingContent(true);
const formData = new FormData();
formData.append("file", file);
formData.append("folder", "content");

try {
const res = await fetch("/api/upload", {
method: "POST",
body: formData,
});
const data = await res.json();
const uploadedUrl = data?.data?.url || data?.url;
if (data.success && uploadedUrl) {
if (uploadingField) {
setItemizedUrls(prev => ({ ...prev, [uploadingField]: uploadedUrl }));
} else {
setContentForm(prev => ({ ...prev, contentUrl: uploadedUrl }));
}
showToast("success", "File uploaded successfully");
} else {
showToast("error", "Upload failed: " + (data.message || data.error || "Unknown error"));
}
} catch {
showToast("error", "Network error during upload");
} finally {
setIsUploadingContent(false);
setUploadingField(null);
if (fileInputRef.current) fileInputRef.current.value = "";
}
};

const handleAction = async (action: string, payload?: Record<string, unknown>) => {
setIsSubmitting(true);
try {
const res = await fetch("/api/deals", {
// Note: POST to collection for actions
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ action, dealId: id, ...payload }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Action failed");

showToast("success", data.message || "Success!");
setShowSubmitModal(false);
setShowVerifyModal(false);
fetchDeal(); // Refresh data
return true;
} catch (err: unknown) {
showToast("error", err instanceof Error ? err.message : String(err));
return false;
} finally {
setIsSubmitting(false);
}
};

const handleProductAction = async (payload: Record<string, unknown>) => {
setIsSubmitting(true);
try {
const res = await fetch(`/api/deals/${encodeURIComponent(id)}/product`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Product update failed");

showToast("success", "Product status updated.");
setShowAddressModal(false);
setShowDispatchModal(false);
fetchDeal();
return true;
} catch (err: unknown) {
showToast("error", err instanceof Error ? err.message : String(err));
return false;
} finally {
setIsSubmitting(false);
}
};

const handleSignContract = async () => {
const fresh = await requireFreshSession();
if (!fresh) return;

const terms = parseContractTerms(deal?.contractTerms);
const payout =
typeof terms?.influencerPayout === "number"
? terms.influencerPayout
: deal?.amount || 0;
const fee = typeof terms?.platformFee === "number" ? terms.platformFee : deal?.platformFee || 0;
const gateway = typeof terms?.gatewayFee === "number" ? terms.gatewayFee : deal?.gatewayFee || 0;
const payable =
typeof terms?.totalAmount === "number" && terms.totalAmount > 0
? terms.totalAmount
: (deal?.totalAmount || 0) || (deal?.amount || 0) + fee + gateway;
  const signSummary = [
    "You are signing this VyaparMedia deal contract.",
    `Creator payout: ${formatCurrency(payout)}`,
    payout > 0 ? `Estimated TDS deduction (~10% if 194J / ~0.1% if 194-O): deducted at settlement` : "",
    `Brand payable: ${formatCurrency(payable)}`,
    `Submission deadline: ${formatContractDate(terms?.submissionDeadline)}`,
    `Posting deadline: ${formatContractDate(terms?.postingDeadline || deal?.postingDeadline)}`,
    "Only sign if deliverables, usage rights, revisions, and payment terms are correct.",
  ].filter(Boolean).join("\n");
if (!confirm(signSummary)) return;

setIsSubmitting(true);
try {
const res = await fetch(`/api/deals/${encodeURIComponent(id)}/sign`, { method: "POST" });
const data = await res.json();
if (!res.ok || !data?.success) {
throw new Error(data?.message || data?.error || "Failed to sign contract");
}

showToast("success", data.message || "Contract signed successfully.");
fetchDeal();
} catch (err: unknown) {
showToast("error", err instanceof Error ? err.message : String(err));
} finally {
setIsSubmitting(false);
}
};

const handleReviewContent = async () => {
const deliverablesList = getFlatDeliverablesList(deal);

// Construct reviews payload from itemizedReviews state
const reviewsPayload = deliverablesList.map((item) => {
const review = itemizedReviews[item.type] || { status: "REVISION_REQUESTED", feedback: "" };
return {
type: item.type,
status: review.status,
feedback: review.status === "REVISION_REQUESTED" ? review.feedback.trim() : "",
};
});

// Validate that any deliverable marked as REVISION_REQUESTED has a feedback of at least 5 chars
let hasValidationError = false;
reviewsPayload.forEach((r) => {
if (r.status === "REVISION_REQUESTED" && (!r.feedback || r.feedback.length < 5)) {
showToast("error", `Please provide at least 5 characters of feedback for ${r.type.replace(/_\d+$/, '').replaceAll('_', ' ')}`);
hasValidationError = true;
}
});

if (hasValidationError) return;

const overallApproved = reviewsPayload.every((r) => r.status === "APPROVED");

const success = await handleAction("review_content", {
approved: overallApproved,
reviews: reviewsPayload,
feedback: overallApproved ? undefined : "Revision requested on item(s)",
});

if (success) {
setShowReviewModal(false);
setItemizedReviews({});
}
};

const handleRejectInvite = async () => {
if (confirm("Are you sure you want to reject this invite? Direct-invite campaign funds will be refunded to the brand.")) {
setIsSubmitting(true);
try {
const res = await fetch(`/api/deals/${encodeURIComponent(id)}/reject`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
reason: "Influencer rejected the invite before signing.",
}),
});
const data = await res.json();
if (!res.ok) throw new Error(data.message || data.error || "Failed to reject invite");

showToast("success", "Invite successfully rejected.");
fetchDeal();
} catch (err: unknown) {
showToast("error", err instanceof Error ? err.message : String(err));
} finally {
setIsSubmitting(false);
}
}
};

const handleCancelDeal = async () => {
if (!confirm("Are you sure you want to cancel this deal? This action cannot be undone. Depending on the payment state, cancellation policies apply.")) return;
setIsSubmitting(true);
try {
const res = await fetch(`/api/deals/${encodeURIComponent(id)}/cancel`, {
method: "POST",
});
const data = await res.json();
if (!res.ok) throw new Error(data.message || data.error || "Failed to cancel deal");
showToast("success", data.message || "Deal cancelled successfully.");
fetchDeal();
} catch (err: unknown) {
showToast("error", err instanceof Error ? err.message : String(err));
} finally {
setIsSubmitting(false);
}
};

return {
deal,
fetchDeal,
isLoading,
error,
showSubmitModal,
setShowSubmitModal,
showVerifyModal,
setShowVerifyModal,
showReviewModal,
setShowReviewModal,
showAddressModal,
setShowAddressModal,
showDispatchModal,
setShowDispatchModal,
contentForm,
setContentForm,
itemizedUrls,
setItemizedUrls,
itemizedReviews,
setItemizedReviews,
uploadingField,
setUploadingField,
postUrl,
setPostUrl,
shippingAddress,
setShippingAddress,
dispatchForm,
setDispatchForm,
isSubmitting,
isUploadingContent,
fileInputRef,
reviewRating,
setReviewRating,
reviewComment,
setReviewComment,
reviewSubmitted,
setReviewSubmitted,
hoverRating,
setHoverRating,
toasts,
removeToast,
showToast,
handleContentUpload,
handleAction,
handleProductAction,
handleSignContract,
handleReviewContent,
handleRejectInvite,
handleCancelDeal,
setIsSubmitting,
engagement,
engagementDisclaimer,
};
}

// ---------------------------------------------------------------------------
// Derived-value helper absorbs all if/else-if and ternary chains so that
// DealDetailPage does not accumulate CC from them.
// ---------------------------------------------------------------------------
export function computeDealDisplay(
deal: DealDetail,
contractTerms: ContractTermsJson,
) {
let mandatoryElements: string[] = [];
if (Array.isArray(contractTerms?.mandatoryElements)) {
mandatoryElements = contractTerms.mandatoryElements;
} else if (Array.isArray(contractTerms?.mandatoryTags)) {
mandatoryElements = contractTerms.mandatoryTags;
}
const contractDeliverables = Array.isArray(contractTerms?.deliverables)
? (contractTerms.deliverables as DeliverableItem[])
: [];
const creatorPayout =
typeof contractTerms?.influencerPayout === "number"
? contractTerms.influencerPayout
: deal.amount;
const platformFee =
typeof contractTerms?.platformFee === "number"
? contractTerms.platformFee
: deal.platformFee || 0;
const gatewayFee =
typeof contractTerms?.gatewayFee === "number"
? contractTerms.gatewayFee
: deal.gatewayFee || 0;
const brandPayable =
typeof contractTerms?.totalAmount === "number" && (contractTerms.totalAmount as number) > 0
? (contractTerms.totalAmount as number)
: deal.totalAmount || deal.amount + platformFee + gatewayFee;
const productValue =
typeof contractTerms?.productValue === "number"
? (contractTerms.productValue as number)
: deal.productValue || 0;
const productHandlingFee =
typeof contractTerms?.productHandlingFee === "number"
? (contractTerms.productHandlingFee as number)
: deal.productHandlingFee || 0;
const requiresProduct = Boolean(deal.requiresProduct || contractTerms?.requiresProduct);
  const canSubmitContent =
    (!requiresProduct ||
      deal.productFulfillmentStatus === "RECEIVED" ||
      deal.status === "REVISION_REQUESTED");
const contractSignature = deal.contractSignature as Record<string, unknown>;
const brandSigned = Boolean(contractSignature?.brandSignature);
const influencerSigned = Boolean(contractSignature?.influencerSignature);
const influencerObligations = normalizeTextArray(contractTerms?.influencerObligations);
const brandObligations = normalizeTextArray(contractTerms?.brandObligations);
return {
mandatoryElements,
contractDeliverables,
creatorPayout,
platformFee,
gatewayFee,
brandPayable,
productValue,
productHandlingFee,
requiresProduct,
canSubmitContent,
brandSigned,
influencerSigned,
influencerObligations,
brandObligations,
};
}

// ---------------------------------------------------------------------------
// DealActionButtons conditional action buttons from the sticky header
// ---------------------------------------------------------------------------
