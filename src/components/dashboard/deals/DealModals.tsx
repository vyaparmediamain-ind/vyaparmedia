"use client";

import React from "react";
import { Modal, Button, Input, Textarea } from "@/components/ui";
import { DealDetail, getFlatDeliverablesList, ContentUrlEntry } from "./DealDetailHelpers";
import { ToastType } from "@/components/ui/toast";

interface DealModalsProps {
readonly showAddressModal: boolean;
readonly setShowAddressModal: (open: boolean) => void;
readonly showReviewModal: boolean;
readonly setShowReviewModal: (open: boolean) => void;
readonly showSubmitModal: boolean;
readonly setShowSubmitModal: (open: boolean) => void;
readonly showVerifyModal: boolean;
readonly setShowVerifyModal: (open: boolean) => void;
readonly deal: DealDetail | null;
readonly shippingForm: { fullName: string; phone: string; line1: string; line2: string; city: string; state: string; pinCode: string; country: string };
readonly setShippingForm: React.Dispatch<React.SetStateAction<{ fullName: string; phone: string; line1: string; line2: string; city: string; state: string; pinCode: string; country: string }>>;
readonly itemizedUrls: Record<string, string>;
readonly setItemizedUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>;
readonly contentForm: { contentUrl: string; notes: string };
readonly setContentForm: React.Dispatch<React.SetStateAction<{ contentUrl: string; notes: string }>>;
readonly postUrl: string;
readonly setPostUrl: (val: string) => void;
readonly isSubmitting: boolean;
readonly handleAction: (action: string, payload?: Record<string, unknown>) => Promise<boolean>;
readonly showToast: (type: ToastType, message: string) => void;
readonly handleReviewContent: () => Promise<void>;
readonly itemizedReviews: Record<string, { status: "APPROVED" | "REVISION_REQUESTED"; feedback: string }>;
readonly setItemizedReviews: React.Dispatch<React.SetStateAction<Record<string, { status: "APPROVED" | "REVISION_REQUESTED"; feedback: string }>>>;
readonly isUploadingContent: boolean;
readonly uploadingField: string | null;
readonly setUploadingField: (field: string | null) => void;
readonly fileInputRef: React.RefObject<HTMLInputElement | null>;
readonly handleContentUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function DealModals({
showAddressModal,
setShowAddressModal,
showReviewModal,
setShowReviewModal,
showSubmitModal,
setShowSubmitModal,
showVerifyModal,
setShowVerifyModal,
deal,
shippingForm,
setShippingForm,
itemizedUrls,
setItemizedUrls,
contentForm,
setContentForm,
postUrl,
setPostUrl,
isSubmitting,
handleAction,
showToast,
handleReviewContent,
itemizedReviews,
setItemizedReviews,
isUploadingContent,
uploadingField,
setUploadingField,
fileInputRef,
handleContentUpload,
}: DealModalsProps) {
if (!deal) return null;

return (
<>
<Modal
open={showAddressModal}
onClose={() => setShowAddressModal(false)}
title="Shipping Address"
maxWidth="500px"
>
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
const isEditing = deal.status === "PENDING_SIGNATURE";

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

<div className="flex gap-3">
<Button
variant="secondary"
onClick={() => setShowAddressModal(false)}
className="flex-1"
>
Close
</Button>
{deal.status === "PENDING_SIGNATURE" && (
<Button
variant="primary"
onClick={async () => {
await handleAction("update_shipping", {
shippingAddress: shippingForm,
});
setShowAddressModal(false);
}}
disabled={isSubmitting}
className="flex-1"
>
Save Address
</Button>
)}
</div>
</Modal>

<Modal
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
onClick={() =>
setItemizedReviews({
...itemizedReviews,
[item.type]: {
...itemReview,
status: "REVISION_REQUESTED",
},
})
}
className="text-xs py-1"
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
disabled={isSubmitting}
className="flex-1"
>
{isSubmitting ? <span className="loading" /> : "Submit Review"}
</Button>
</div>
</Modal>

<Modal
open={showSubmitModal}
onClose={() => setShowSubmitModal(false)}
title="Submit Content"
maxWidth="550px"
>
<div
className="mb-5 flex flex-col gap-4 overflow-y-auto deal-modal-scroll-container"
>
{getFlatDeliverablesList(deal).map((item) => {
const latestSub = deal?.contentSubmissions?.[0];
const existing = latestSub?.contentUrls && Array.isArray(latestSub.contentUrls)
? latestSub.contentUrls.find((u: ContentUrlEntry) => u.type === item.type)
: null;
const isApproved = existing?.status === "APPROVED";
const inputId = `input-${item.type}`;

return (
<div key={item.type} className="flex flex-col gap-2">
<div className="flex justify-between items-center">
<label className="label font-semibold mb-0" htmlFor={inputId}>
{item.label} *
</label>
{isApproved && (
<span className="text-xs font-semibold text-success">
Approved (Locked)
</span>
)}
</div>

<div className="flex gap-2">
<Input
id={inputId}
type="url"
placeholder="https://drive.google.com/..."
value={
isApproved
? existing?.url || ""
: itemizedUrls[item.type] || ""
}
onChange={(e) =>
setItemizedUrls({
...itemizedUrls,
[item.type]: e.target.value,
})
}
disabled={isApproved}
className="flex-1"
/>
{!isApproved && (
<Button
variant="secondary"
aria-label={`Upload file for ${item.label}`}
aria-busy={isUploadingContent && uploadingField === item.type}
onClick={() => {
setUploadingField(item.type);
setTimeout(() => fileInputRef.current?.click(), 50);
}}
disabled={isUploadingContent}
className="whitespace-nowrap"
>
{isUploadingContent && uploadingField === item.type
? "Uploading..."
: "Upload"}
</Button>
)}
</div>
</div>
);
})}

<input
type="file"
ref={fileInputRef}
aria-label="Upload deliverable content file"
aria-hidden="true"
tabIndex={-1}
className="hidden"
onChange={handleContentUpload}
accept="image/*,video/*,.pdf"
/>
</div>

<div className="mb-5">
<Textarea
label="Notes (Optional)"
id="submit-notes-textarea"
rows={3}
placeholder="Any message for the brand..."
value={contentForm.notes}
onChange={(e) =>
setContentForm({ ...contentForm, notes: e.target.value })
}
fullWidth
/>
</div>

<div className="flex gap-3">
<Button
variant="secondary"
onClick={() => setShowSubmitModal(false)}
className="flex-1"
>
Cancel
</Button>
<Button
variant="primary"
onClick={async () => {
const deliverablesList = getFlatDeliverablesList(deal);
const submissionUrls = deliverablesList.map((item) => {
const latestSub = deal?.contentSubmissions?.[0];
const existing = latestSub?.contentUrls && Array.isArray(latestSub.contentUrls)
? latestSub.contentUrls.find((u: ContentUrlEntry) => u.type === item.type)
: null;

if (existing?.status === "APPROVED") {
return {
type: item.type,
url: existing.url,
status: "APPROVED",
};
}

return {
type: item.type,
url: itemizedUrls[item.type] || "",
};
});

const missingUrls = submissionUrls.filter((item) => !item.url);
if (missingUrls.length > 0) {
showToast(
"error",
"Please provide submission links for all deliverables."
);
return;
}

// Validate URL format for non-approved items
const invalidUrls = submissionUrls.filter(
(item) =>
item.status !== "APPROVED" &&
item.url &&
!item.url.startsWith("http://") &&
!item.url.startsWith("https://")
);
if (invalidUrls.length > 0) {
showToast("error", "Please enter valid URLs starting with http:// or https://");
return;
}

await handleAction("submit_content", {
contentUrls: submissionUrls,
notes: contentForm.notes,
contentUrl: submissionUrls[0]?.url || "",
});
}}
disabled={isSubmitting}
className="flex-1"
>
{isSubmitting ? <span className="loading" /> : "Submit"}
</Button>
</div>
</Modal>

<Modal
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
</Modal>
</>
);
}
