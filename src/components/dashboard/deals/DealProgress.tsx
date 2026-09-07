"use client";

import { Card } from "@/components/ui";

interface DealProgressProps {
readonly status: string;
}

export function DealProgress({ status }: Readonly<DealProgressProps>) {
const steps = [
{ s: "PENDING_SIGNATURE", label: "Contract Signing" },
{ s: "ACTIVE", label: "Content Creation" },
{ s: "CONTENT_SUBMITTED", label: "Brand Review" },
{ s: "CONTENT_APPROVED", label: "Approved & Posting" },
{ s: "VERIFIED", label: "Verified & Payment" },
{ s: "COMPLETED", label: "Completed" },
];

let lookupStatus = status;
if (status === "REVISION_REQUESTED") {
  lookupStatus = "CONTENT_SUBMITTED";
} else if (status === "POSTED" || status === "VERIFICATION_PENDING" || status === "PAYMENT_HELD" || status === "DISPUTED") {
  lookupStatus = "VERIFIED";
}

const stepsMap = steps.map((a) => a.s);
let currentIndex = stepsMap.indexOf(lookupStatus);
if (currentIndex === -1) {
  currentIndex = 1; // Default fallback to first step in progress
}
const isCancelled = status === "CANCELLED";

return (
<Card className="deal-progress-card mb-6">
<h2 className="section-title text-lg font-bold mb-4">
Deal Progress
</h2>

<ul
aria-label="Deal progress stages"
className="deal-progress-list flex flex-col gap-6"
>
{steps.map((step, idx) => {
const isCompleted = currentIndex > idx;
const isCurrent = currentIndex === idx;

let circleStatus = "pending";
if (isCompleted) {
  circleStatus = "completed";
} else if (isCurrent && !isCancelled) {
  circleStatus = "current";
}

let labelStatusSuffix = "Pending";
if (isCompleted) {
  labelStatusSuffix = "Completed";
} else if (isCurrent) {
  labelStatusSuffix = "Current step";
}

const labelStatus = isCompleted || isCurrent ? "current" : "pending";
const liOpacity = isCancelled ? "opacity-50" : "";

return (
<li
key={step.s}
aria-current={isCurrent ? "step" : undefined}
aria-label={`${idx + 1}. ${step.label} ${labelStatusSuffix}`}
className={`flex items-center gap-4 ${liOpacity}`}
>
<div
className={`deal-progress-step-circle flex items-center justify-center font-bold text-sm rounded-full ${circleStatus}`}
>
{isCompleted ? (
<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
<polyline points="20 6 9 17 4 12" />
</svg>
) : idx + 1}
</div>
<div>
<div
className={`deal-progress-step-label ${isCurrent ? "font-bold text-primary" : "font-semibold text-muted"} ${labelStatus}`}
>
{step.label}
</div>
{isCurrent && !isCancelled && (
<div className="text-xs text-primary">In Progress</div>
)}
</div>
</li>
);
})}
{isCancelled && (
<li
className="p-3 font-semibold text-center rounded-md text-rose bg-rose-subtle"
>
Deal Cancelled
</li>
)}
</ul>
</Card>
);
}
