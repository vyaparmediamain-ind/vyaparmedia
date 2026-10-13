"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BottomSheet, Button, Input, Textarea, type ToastType } from "@/components/ui";
import { DealDetail, getFlatDeliverablesList, ContentUrlEntry } from "./DealDetailHelpers";
import { checkRevisionRequestEligibility } from "@/lib/action-eligibility";
import { ShipmentTrackingModal } from "./ShipmentTrackingModal";
import { Truck, Package, Sparkles, ShieldCheck } from "lucide-react";

interface DealModalsProps {
  readonly showAddressModal: boolean;
  readonly setShowAddressModal: (open: boolean) => void;
  readonly showReviewModal: boolean;
  readonly setShowReviewModal: (open: boolean) => void;
  readonly showVerifyModal: boolean;
  readonly setShowVerifyModal: (open: boolean) => void;
  readonly showDispatchModal?: boolean;
  readonly setShowDispatchModal?: (open: boolean) => void;
  readonly showTrackingModal?: boolean;
  readonly setShowTrackingModal?: (open: boolean) => void;
  readonly deal: DealDetail | null;
  readonly shippingForm: { fullName: string; phone: string; line1: string; line2: string; city: string; state: string; pinCode: string; country: string };
  readonly setShippingForm: React.Dispatch<React.SetStateAction<{ fullName: string; phone: string; line1: string; line2: string; city: string; state: string; pinCode: string; country: string }>>;
  readonly dispatchForm?: { trackingNumber: string; carrier: string };
  readonly setDispatchForm?: React.Dispatch<React.SetStateAction<{ trackingNumber: string; carrier: string }>>;
  readonly postUrl: string;
  readonly setPostUrl: (val: string) => void;
  readonly isSubmitting: boolean;
  readonly handleAction: (action: string, payload?: Record<string, unknown>) => Promise<boolean>;
  readonly handleProductAction?: (payload: Record<string, unknown>) => Promise<boolean>;
  readonly showToast: (type: ToastType, message: string) => void;
  readonly handleReviewContent: () => Promise<void>;
  readonly itemizedReviews: Record<string, { status: "APPROVED" | "REVISION_REQUESTED"; feedback: string }>;
  readonly setItemizedReviews: React.Dispatch<React.SetStateAction<Record<string, { status: "APPROVED" | "REVISION_REQUESTED"; feedback: string }>>>;
  readonly isBrand?: boolean;
  readonly isInfluencer?: boolean;
  readonly onConfirmReceived?: () => void;
  readonly onStatusUpdated?: () => void;
}

export function DealModals({
  showAddressModal,
  setShowAddressModal,
  showReviewModal,
  setShowReviewModal,
  showVerifyModal,
  setShowVerifyModal,
  showDispatchModal = false,
  setShowDispatchModal,
  showTrackingModal = false,
  setShowTrackingModal,
  deal,
  shippingForm,
  setShippingForm,
  dispatchForm,
  setDispatchForm,
  postUrl,
  setPostUrl,
  isSubmitting,
  handleAction,
  handleProductAction,
  showToast,
  handleReviewContent,
  itemizedReviews,
  setItemizedReviews,
  isBrand = false,
  isInfluencer = false,
  onConfirmReceived,
  onStatusUpdated,
}: DealModalsProps) {
  const [dispatchMode, setDispatchMode] = useState<"shiprocket" | "manual">("shiprocket");
  const [shiprocketForm, setShiprocketForm] = useState({
    pickupLocation: "Primary",
    length: 10,
    breadth: 10,
    height: 10,
    weight: 0.5,
  });
  const revisionEligibility = React.useMemo(() => {
    return checkRevisionRequestEligibility(deal);
  }, [deal]);

  const hasRevisionRequested = React.useMemo(() => {
    return Object.values(itemizedReviews).some(
      (r) => r.status === "REVISION_REQUESTED"
    );
  }, [itemizedReviews]);

  const isPhoneValid = /^[6-9]\d{9}$/.test(shippingForm.phone?.trim() || "");
  const isPinValid = /^\d{6}$/.test(shippingForm.pinCode?.trim() || "");
  const isAddressComplete = Boolean(
    shippingForm.fullName?.trim() &&
    shippingForm.line1?.trim() &&
    shippingForm.city?.trim() &&
    shippingForm.state?.trim()
  );
  const addressValidationError = !isAddressComplete
    ? "Full name, address line 1, city, and state are required."
    : !isPhoneValid
    ? "Valid 10-digit Indian mobile number starting with 6-9 required."
    : !isPinValid
    ? "Valid 6-digit PIN code required."
    : null;

  if (!deal) return null;

  return (
<>
<BottomSheet
open={showAddressModal}
onClose={() => setShowAddressModal(false)}
title={isBrand ? "Delivery Address (Confidential)" : "Your Delivery Address"}
maxWidth="500px"
>
{isBrand ? (
  <div className="space-y-4">
    <div className="p-4 rounded-xl bg-verified-muted border border-verified-border text-foreground space-y-2">
      <div className="flex items-center gap-2 font-bold text-sm text-verified">
        <ShieldCheck className="w-5 h-5 text-verified shrink-0" />
        <span>100% Confidential Delivery Address</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        To protect creator privacy, physical street address and personal contact details are encrypted and kept confidential.
        Our automated Shiprocket integration dispatches products directly from your warehouse to the creator without exposing private data.
      </p>
    </div>
    {Boolean(deal.shippingAddress) && (
      <div className="p-3 rounded-xl bg-muted border border-border text-xs flex justify-between items-center">
        <span className="text-muted-foreground">Destination Hub:</span>
        <span className="font-semibold text-foreground">
          {(deal.shippingAddress as Record<string, unknown>).city
            ? `${String((deal.shippingAddress as Record<string, unknown>).city)}, ${String((deal.shippingAddress as Record<string, unknown>).state || "India")}`
            : "Address Verified & On File"}
        </span>
      </div>
    )}
    <Button
      variant="secondary"
      onClick={() => setShowAddressModal(false)}
      className="w-full"
    >
      Close
    </Button>
  </div>
) : (
  <div>
    <div className="p-3 rounded-xl bg-verified-muted border border-verified-border text-xs flex items-center gap-2 text-foreground mb-4">
      <ShieldCheck className="w-4 h-4 text-verified shrink-0" />
      <span className="text-muted-foreground">
        Your address is <strong className="text-foreground">strictly confidential</strong> and is never revealed to the brand.
      </span>
    </div>

    <div className="flex justify-between items-center mb-3">
      <span className="text-xs font-semibold text-foreground">Delivery Details</span>
      <button
        type="button"
        onClick={async () => {
          try {
            const res = await fetch("/api/settings");
            if (res.ok) {
              const data = await res.json();
              if (data.profile?.address) {
                setShippingForm({
                  fullName: data.profile.displayName || shippingForm.fullName,
                  phone: data.user?.phone || shippingForm.phone,
                  line1: data.profile.address,
                  line2: "",
                  city: data.profile.city || shippingForm.city,
                  state: data.profile.state || shippingForm.state,
                  pinCode: data.profile.pinCode || shippingForm.pinCode,
                  country: "India",
                });
                showToast("success", "Loaded address from your saved profile!");
                return;
              }
            }
            showToast("info", "No saved address found in profile. Please enter below.");
          } catch {
            showToast("error", "Could not load profile address.");
          }
        }}
        className="text-xs text-primary font-bold hover:underline cursor-pointer inline-flex items-center gap-1"
      >
        <span>⚡ Use Saved Profile Address</span>
      </button>
    </div>

    <div className="grid gap-3 mb-4 grid-cols-1 sm:grid-cols-2">
      {([
        ["fullName", "Full name"],
        ["phone", "Phone"],
        ["line1", "Address line 1"],
        ["line2", "Address line 2"],
        ["city", "City"],
        ["state", "State"],
        ["pinCode", "PIN code"],
      ] as const).map(([field, label]) => {
        const isFullWidth = ["line1", "line2", "fullName"].includes(field);
        const addressRecord = (typeof deal.shippingAddress === "object" && deal.shippingAddress !== null && !Array.isArray(deal.shippingAddress)) ? (deal.shippingAddress as Record<string, unknown>) : null;
        const isEditing = ["PENDING_SIGNATURE", "PAYMENT_HELD", "ACTIVE"].includes(deal.status);

        return (
          <div
            key={field}
            className={isFullWidth ? "col-span-2" : "col-span-1"}
          >
            {isEditing ? (
              <Input
                label={label}
                id={`shipping-${field}`}
                value={shippingForm[field]}
                onChange={(e) =>
                  setShippingForm({
                    ...shippingForm,
                    [field]: e.target.value,
                  })
                }
                fullWidth
              />
            ) : (
              <div>
                <div className="text-xs text-secondary">{label}</div>
                <div className="font-semibold text-sm">
                  {typeof addressRecord?.[field] === "string" && addressRecord[field] ? String(addressRecord[field]) : "Not provided"}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>

    {["PENDING_SIGNATURE", "PAYMENT_HELD", "ACTIVE"].includes(deal.status) && addressValidationError && (
      <p className="text-xs text-amber-500 mb-3 font-medium flex items-center gap-1.5">
        <span>⚠️</span>
        <span>{addressValidationError}</span>
      </p>
    )}

    <div className="flex gap-3">
      <Button
        variant="secondary"
        onClick={() => setShowAddressModal(false)}
        className="flex-1"
      >
        Close
      </Button>
      {["PENDING_SIGNATURE", "PAYMENT_HELD", "ACTIVE"].includes(deal.status) && (
        <Button
          variant="primary"
          onClick={async () => {
            if (addressValidationError) return;
            await handleAction("update_shipping", {
              shippingAddress: shippingForm,
            });
            setShowAddressModal(false);
          }}
          disabled={isSubmitting || Boolean(addressValidationError)}
          className="flex-1"
        >
          Save Address
        </Button>
      )}
    </div>
  </div>
)}
</BottomSheet>

<BottomSheet
open={showReviewModal}
onClose={() => setShowReviewModal(false)}
title="Review Content"
maxWidth="600px"
>
<div
className="mb-5 flex flex-col gap-4 overflow-y-auto deal-modal-scroll-container"
>
{getFlatDeliverablesList(deal).map((item) => {
const latestSub = deal?.contentSubmissions?.[0];
const existing = latestSub?.contentUrls && Array.isArray(latestSub.contentUrls)
? latestSub.contentUrls.find((u: ContentUrlEntry) => u.type === item.type)
: null;
const itemReview = itemizedReviews[item.type] || {
status: "APPROVED",
feedback: "",
};

return (
<div
key={item.type}
className="p-3 border-card rounded-md bg-secondary flex flex-col gap-3"
>
<div className="flex justify-between items-center">
<div className="font-semibold">{item.label}</div>
{existing ? (
<a
href={existing.url}
target="_blank"
rel="noopener noreferrer"
className="text-xs text-primary font-bold hover:underline"
>
View Submission
</a>
) : (
<span className="text-xs text-muted">No submission</span>
)}
</div>

<div className="flex justify-between items-center gap-3">
<div className="text-xs text-secondary">Decision:</div>
<div className="flex gap-2">
<Button
variant={
itemReview.status === "APPROVED"
? "primary"
: "secondary"
}
size="sm"
onClick={() =>
setItemizedReviews({
...itemizedReviews,
[item.type]: { ...itemReview, status: "APPROVED" },
})
}
className="text-xs py-1"
>
Approve
</Button>
<Button
variant={
itemReview.status === "REVISION_REQUESTED"
? "danger"
: "secondary"
}
size="sm"
disabled={!revisionEligibility.allowed && itemReview.status !== "REVISION_REQUESTED"}
title={!revisionEligibility.allowed ? revisionEligibility.reason : undefined}
onClick={() =>
setItemizedReviews({
...itemizedReviews,
[item.type]: {
...itemReview,
status: "REVISION_REQUESTED",
},
})
}
className="text-xs py-1 disabled:opacity-50 disabled:cursor-not-allowed"
>
Revision
</Button>
</div>
</div>

{itemReview.status === "REVISION_REQUESTED" && (
<div className="mt-2">
<Textarea
rows={2}
placeholder="What needs to change for this specific deliverable?"
aria-label={`Revision details for ${item.label}`}
value={itemReview.feedback}
onChange={(e) =>
setItemizedReviews({
...itemizedReviews,
[item.type]: { ...itemReview, feedback: e.target.value },
})
}
className="text-xs p-2"
/>
</div>
)}
</div>
);
})}
</div>

{hasRevisionRequested && (
  <div
    className={`p-3 rounded-xl text-xs border font-medium mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
      !revisionEligibility.allowed
        ? "bg-destructive/10 text-destructive border-destructive/20"
        : revisionEligibility.costPaise > 0
        ? "bg-pending-muted text-pending border-pending-border"
        : "bg-muted/40 text-muted-foreground border-border"
    }`}
  >
    <span>
      {revisionEligibility.reason ||
        `Revision ${Number(deal.revisionsUsed ?? 0) + 1} of ${Number(deal.maxRevisions ?? 0)} (Free)`}
    </span>
    {revisionEligibility.ctaText && revisionEligibility.ctaHref && (
      <Link
        href={revisionEligibility.ctaHref}
        className="font-bold underline text-primary text-xs whitespace-nowrap"
      >
        {revisionEligibility.ctaText} →
      </Link>
    )}
  </div>
)}

<div className="flex gap-3">
<Button
variant="secondary"
onClick={() => setShowReviewModal(false)}
className="flex-1"
>
Cancel
</Button>
<Button
variant="primary"
onClick={handleReviewContent}
disabled={isSubmitting || (hasRevisionRequested && !revisionEligibility.allowed)}
title={hasRevisionRequested && !revisionEligibility.allowed ? revisionEligibility.reason : undefined}
className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
>
{isSubmitting ? <span className="loading" /> : "Submit Review"}
</Button>
</div>
</BottomSheet>

<BottomSheet
open={showVerifyModal}
onClose={() => setShowVerifyModal(false)}
title="Verify Post"
maxWidth="500px"
>
<div className="mb-5">
<Input
label="Live Post URL *"
id="live-post-url-input"
type="url"
placeholder="https://instagram.com/p/..."
value={postUrl}
onChange={(e) => setPostUrl(e.target.value)}
fullWidth
/>
</div>
<div className="p-3 mb-5 text-sm text-secondary bg-tertiary rounded-md">
Ensure required hashtags are present.
</div>
<div className="flex gap-3">
<Button
variant="secondary"
onClick={() => setShowVerifyModal(false)}
className="flex-1"
>
Cancel
</Button>
<Button
variant="primary"
onClick={() => {
  if (!postUrl.trim()) return;
  if (!/^https?:\/\//i.test(postUrl.trim())) {
    showToast("error", "Please enter a valid URL starting with http:// or https://");
    return;
  }
  handleAction("verify_post", { postUrl: postUrl.trim() });
}}
disabled={isSubmitting || !postUrl}
className="flex-1"
>
{isSubmitting ? <span className="loading" /> : "Verify"}
</Button>
</div>
</BottomSheet>

{setShowDispatchModal && dispatchForm && setDispatchForm && handleProductAction && (
  <BottomSheet
    open={showDispatchModal}
    onClose={() => setShowDispatchModal(false)}
    title="Product Dispatch & Shipping"
    maxWidth="540px"
  >
    <div className="mb-4 space-y-4">
      {/* Dispatch Method Tabs */}
      <div className="grid grid-cols-2 p-1 bg-muted rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setDispatchMode("shiprocket")}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            dispatchMode === "shiprocket"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Shiprocket (1-Click)</span>
        </button>
        <button
          type="button"
          onClick={() => setDispatchMode("manual")}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            dispatchMode === "manual"
              ? "bg-card text-foreground shadow-xs border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Manual Courier</span>
        </button>
      </div>

      {dispatchMode === "shiprocket" ? (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-foreground space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-primary">
              <Package className="w-4 h-4" />
              <span>Automated Shiprocket Logistics</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              System creates the shipment, assigns the optimal courier partner (Delhivery, BlueDart, DTDC), generates AWB tracking code, and provides a downloadable shipping label PDF.
            </p>
          </div>

          <div>
            <Input
              label="Pickup Warehouse / Location Name"
              id="shiprocket-pickup-location"
              type="text"
              placeholder="e.g. Primary or Main Warehouse"
              value={shiprocketForm.pickupLocation}
              onChange={(e) => setShiprocketForm({ ...shiprocketForm, pickupLocation: e.target.value })}
              fullWidth
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              🔒 Uses your profile pickup address. Neither party's personal address is revealed.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Approx Weight (kg)"
              id="shiprocket-weight"
              type="number"
              step="0.1"
              min="0.1"
              value={String(shiprocketForm.weight)}
              onChange={(e) => setShiprocketForm({ ...shiprocketForm, weight: parseFloat(e.target.value) || 0.5 })}
              fullWidth
            />
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground block">Box Dimensions (L x B x H cm)</label>
              <div className="grid grid-cols-3 gap-1">
                <input
                  type="number"
                  placeholder="L"
                  value={shiprocketForm.length}
                  onChange={(e) => setShiprocketForm({ ...shiprocketForm, length: parseInt(e.target.value, 10) || 10 })}
                  className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground text-center"
                />
                <input
                  type="number"
                  placeholder="B"
                  value={shiprocketForm.breadth}
                  onChange={(e) => setShiprocketForm({ ...shiprocketForm, breadth: parseInt(e.target.value, 10) || 10 })}
                  className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground text-center"
                />
                <input
                  type="number"
                  placeholder="H"
                  value={shiprocketForm.height}
                  onChange={(e) => setShiprocketForm({ ...shiprocketForm, height: parseInt(e.target.value, 10) || 10 })}
                  className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground text-center"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Enter the courier tracking details after manually dispatching the product to the creator.
          </p>
          <Input
            label="Tracking / AWB Number *"
            id="dispatch-tracking-input"
            type="text"
            placeholder="e.g. 1234567890"
            value={dispatchForm.trackingNumber}
            onChange={(e) => setDispatchForm({ ...dispatchForm, trackingNumber: e.target.value })}
            fullWidth
          />
          <Input
            label="Courier / Carrier Partner"
            id="dispatch-carrier-input"
            type="text"
            placeholder="e.g. BlueDart, Delhivery, DTDC, India Post"
            value={dispatchForm.carrier}
            onChange={(e) => setDispatchForm({ ...dispatchForm, carrier: e.target.value })}
            fullWidth
          />
          {!dispatchForm.trackingNumber.trim() && (
            <p className="text-xs text-amber-500 font-medium">
              ⚠️ Courier AWB / Tracking number is required to confirm dispatch.
            </p>
          )}
        </div>
      )}
    </div>
    <div className="flex gap-3">
      <Button
        variant="secondary"
        onClick={() => setShowDispatchModal(false)}
        className="flex-1"
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        onClick={() => {
          if (dispatchMode === "shiprocket") {
            handleProductAction({
              action: "create_shiprocket_shipment",
              pickupLocation: shiprocketForm.pickupLocation.trim() || undefined,
              length: shiprocketForm.length,
              breadth: shiprocketForm.breadth,
              height: shiprocketForm.height,
              weight: shiprocketForm.weight,
            });
          } else {
            if (!dispatchForm.trackingNumber.trim()) {
              showToast("error", "Please enter a valid tracking number");
              return;
            }
            handleProductAction({
              action: "confirm_dispatch",
              trackingNumber: dispatchForm.trackingNumber.trim(),
              carrier: dispatchForm.carrier.trim() || undefined,
            });
          }
        }}
        disabled={isSubmitting || (dispatchMode === "manual" && !dispatchForm.trackingNumber.trim())}
        className="flex-1 min-h-[44px]"
      >
        {isSubmitting ? (
          <span className="loading" />
        ) : dispatchMode === "shiprocket" ? (
          "Generate AWB & Ship via Shiprocket"
        ) : (
          "Confirm Manual Dispatch"
        )}
      </Button>
    </div>
  </BottomSheet>
)}

{/* ── Tracking Modal ────────────────────────────────────── */}
{setShowTrackingModal && (
  <ShipmentTrackingModal
    open={showTrackingModal}
    onClose={() => setShowTrackingModal(false)}
    deal={deal}
    isBrand={isBrand}
    isInfluencer={isInfluencer}
    onConfirmReceived={onConfirmReceived}
    onStatusUpdated={onStatusUpdated}
  />
)}
</>
);
}
