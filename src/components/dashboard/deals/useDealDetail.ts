"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { useDeal } from "@/hooks/api/useDeal";

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
import type { ToastItem, ToastType } from "@/components/ui";
import { checkContentSubmissionEligibility } from "@/lib/action-eligibility";
import { haptic } from "@/lib/haptics";
import {
  TDS_194J_RATE_PERCENT_STRING,
  TDS_194O_RATE_PERCENT_STRING,
} from "@/constants";

function extractMessage(err: unknown): string {
  return formatUserError(err, "Failed to process deal action. Please try again.");
}

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

  const removeToast = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  }, []);

  const showToast = useCallback((type: ToastType, message: string) => {
    const toastId = String(Date.now());
    setToasts(prev => [...prev, { id: toastId, type, message }]);
    setTimeout(() => removeToast(toastId), 5000);
  }, [removeToast]);

  // Delegate data fetching and core mutations to authoritative useDeal hook
  const dealCore = useDeal(id, session?.user?.id, showToast);
  const deal: DealDetail | null = dealCore.deal;
  const isLoading = dealCore.isLoading;
  const error = dealCore.error;
  const fetchDeal = dealCore.refresh;

  const { data: engData } = useSWR<{ report?: EngagementReport & { hasEstimatedData?: boolean } }>(
    id && deal?.postUrl ? `/api/deals/${id}/engagement` : null,
    fetcher
  );

  useEffect(() => {
    if (deal?.shippingAddress && typeof deal.shippingAddress === "object") {
      const addr = deal.shippingAddress as Record<string, unknown>;
      if (!addr.isConfidential) {
        setShippingAddress({
          fullName: String(addr.fullName || ""),
          phone: String(addr.phone || ""),
          line1: String(addr.line1 || ""),
          line2: String(addr.line2 || ""),
          city: String(addr.city || ""),
          state: String(addr.state || ""),
          pinCode: String(addr.pinCode || ""),
          country: String(addr.country || "India"),
        });
      }
    }
  }, [deal?.shippingAddress]);

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
    try {
      const uploadedUrl = await dealCore.uploadContent(file, "content");
      if (uploadedUrl) {
        if (uploadingField) {
          setItemizedUrls(prev => ({ ...prev, [uploadingField]: uploadedUrl }));
        } else {
          setContentForm(prev => ({ ...prev, contentUrl: uploadedUrl }));
        }
      }
    } finally {
      setIsUploadingContent(false);
      setUploadingField(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAction = async (action: string, payload?: Record<string, unknown>) => {
    const ok = await dealCore.doAction(action, payload);
    if (ok) {
      setShowSubmitModal(false);
      setShowVerifyModal(false);
    }
    return ok;
  };

  const handleProductAction = async (payload: Record<string, unknown>) => {
    const ok = await dealCore.updateProduct(payload);
    if (ok) {
      setShowAddressModal(false);
      setShowDispatchModal(false);
    }
    return ok;
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
      payout > 0 ? `Estimated TDS deduction (~${TDS_194J_RATE_PERCENT_STRING} if 194J / ~${TDS_194O_RATE_PERCENT_STRING} if 194-O): deducted at settlement` : "",
      `Brand payable: ${formatCurrency(payable)}`,
      `Submission deadline: ${formatContractDate(terms?.submissionDeadline)}`,
      `Posting deadline: ${formatContractDate(terms?.postingDeadline || deal?.postingDeadline)}`,
      "Only sign if deliverables, usage rights, revisions, and payment terms are correct.",
    ].filter(Boolean).join("\n");
    if (!confirm(signSummary)) return;

    setIsSubmitting(true);
    try {
      const data = await apiClient.deals.sign(id) as { success?: boolean; message?: string; error?: string };
      if (!data?.success) {
        throw new Error(data?.message || data?.error || "Failed to sign contract");
      }
      haptic.success();
      showToast("success", data.message || "Contract signed successfully.");
      fetchDeal();
    } catch (err) {
      showToast("error", extractMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewContent = async () => {
    const deliverablesList = getFlatDeliverablesList(deal);

    const reviewsPayload = deliverablesList.map((item) => {
      const review = itemizedReviews[item.type] || { status: "REVISION_REQUESTED", feedback: "" };
      return {
        type: item.type,
        status: review.status,
        feedback: review.status === "REVISION_REQUESTED" ? review.feedback.trim() : "",
      };
    });

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
        await apiClient.deals.reject(id, "Influencer rejected the invite before signing.");
        haptic.success();
        showToast("success", "Invite successfully rejected.");
        fetchDeal();
      } catch (err) {
        showToast("error", extractMessage(err));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleCancelDeal = async () => {
    if (!confirm("Are you sure you want to cancel this deal? This action cannot be undone. Depending on the payment state, cancellation policies apply.")) return;
    setIsSubmitting(true);
    try {
      const data = await apiClient.deals.cancel(id) as { message?: string };
      haptic.success();
      showToast("success", data.message || "Deal cancelled successfully.");
      fetchDeal();
    } catch (err) {
      showToast("error", extractMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFundRouteEscrow = async () => {
    if (!deal) return;
    setIsSubmitting(true);
    try {
      const fundData = await apiClient.deals.fund(deal.id);

      if (fundData && fundData.orderId && typeof window !== "undefined") {
        const loadRazorpay = () => {
          return new Promise<boolean>((resolve) => {
            if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
          });
        };

        const loaded = await loadRazorpay();
        if (!loaded) {
          showToast("error", "Unable to load Razorpay payment gateway.");
          return;
        }

        const options = {
          key: (fundData as { key?: string }).key,
          amount: (fundData as { amount?: number }).amount,
          currency: (fundData as { currency?: string }).currency || "INR",
          name: "VyaparMedia Escrow",
          description: `Secured Escrow for Deal: ${deal.id}`,
          order_id: (fundData as { orderId?: string }).orderId,
          handler: function () {
            showToast("success", "Escrow deposit received! Locking funds in regulated escrow...");
            setTimeout(() => fetchDeal(), 1500);
          },
          prefill: {
            email: session?.user?.email || "",
            name: session?.user?.name || "",
          },
          theme: {
            color: "#6366f1",
          },
        };

        const RazorpayClass = (window as unknown as { Razorpay: new (opts: unknown) => { open: () => void } }).Razorpay;
        const rzp = new RazorpayClass(options);
        rzp.open();
      } else {
        showToast("success", "Deal escrow order initiated.");
        fetchDeal();
      }
    } catch (err) {
      showToast("error", extractMessage(err));
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
    handleFundRouteEscrow,
    setIsSubmitting,
    engagement,
    engagementDisclaimer,
  };
}

// Derived-value helper absorbs all if/else-if and ternary chains so that DealDetailPage does not accumulate CC
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
  const canSubmitContent = checkContentSubmissionEligibility(deal).allowed;
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
