"use client";

import React, { useState, use, useCallback, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { fetcher } from "@/lib/fetcher";
import { logger } from "@/lib/logger-client";
import { ToastContainer, type ToastItem, type ToastType } from "@/components/ui/toast";
import { Button, Textarea } from "@/components/ui";
import {
DisputeDetail,
MediatorAnalysis,
disputeEvidenceSchema,
disputeEscalationSchema,
} from "@/components/dashboard/disputes/DisputeHelpers";
import { DisputeTimeline } from "@/components/dashboard/disputes/DisputeTimeline";
import { DisputeEvidence } from "@/components/dashboard/disputes/DisputeEvidence";
import { DisputeAnalysisCard } from "@/components/dashboard/disputes/DisputeAnalysisCard";

interface DisputeDetailPageProps {
readonly params: Promise<{ readonly id: string }>;
}

export default function DisputeDetailPage({ params }: Readonly<DisputeDetailPageProps>) {
  const { id } = use(params);
  const { data: session } = useSession();
const { data: disputeData, isLoading, mutate: fetchDispute } = useSWR<{ dispute?: DisputeDetail; analysis?: MediatorAnalysis }>(
id ? `/api/disputes/${id}` : null,
fetcher
);

const dispute: DisputeDetail | null = disputeData?.dispute || null;

const getStatusBgClass = (status: string) => {
switch (status) {
case "OPEN": return "bg-[var(--color-primary)]";
case "TIER1_AUTO": return "bg-[var(--color-accent-cyan)]";
case "TIER2_MEDIATION": return "bg-[var(--color-warning)]";
case "RESOLVED": return "bg-[var(--color-success)]";
case "CLOSED": return "bg-[var(--color-text-muted)]";
default: return "bg-[var(--color-text-secondary)]";
}
};

const analysis: MediatorAnalysis | null = useMemo(() => {
if (!disputeData) return null;
if (disputeData.analysis) return disputeData.analysis;
if (disputeData.dispute?.influencerOutcome || disputeData.dispute?.brandOutcome) {
try {
const iOutcome = JSON.parse(disputeData.dispute.influencerOutcome || "{}");
const bOutcome = JSON.parse(disputeData.dispute.brandOutcome || "{}");
return {
disputeId: disputeData.dispute.id,
tier: disputeData.dispute.tier,
verdict: disputeData.dispute.status === "RESOLVED" ? "RESOLVED" : "PENDING",
confidence: iOutcome.confidence || bOutcome.confidence || "HIGH",
refundPercentage: bOutcome.refund_percentage || 0,
influencerPayoutPercentage: iOutcome.payment_percentage || 0,
trustScoreChanges: {
influencer: iOutcome.trust_score_change || 0,
brand: bOutcome.trust_score_change || 0,
},
explanation: disputeData.dispute.resolution || "Analysis pending",
findings: [],
suggestedAction: "",
autoResolvable: false,
};
} catch {
return null;
}
}
return null;
}, [disputeData]);

const [evidenceUrl, setEvidenceUrl] = useState("");
const [evidenceDesc, setEvidenceDesc] = useState("");
const [evidenceType, setEvidenceType] = useState("CONTRACT");
const [isSubmitting, setIsSubmitting] = useState(false);
const [showEvidenceForm, setShowEvidenceForm] = useState(false);
const [actionLoading, setActionLoading] = useState<string | null>(null);
const [escalateReason, setEscalateReason] = useState("");
const [showEscalateForm, setShowEscalateForm] = useState(false);
const [toasts, setToasts] = useState<ToastItem[]>([]);

const removeToast = (toastId: string) => {
setToasts((prev) => prev.filter((t) => t.id !== toastId));
};

const showToast = useCallback((type: ToastType, message: string) => {
const toastId = String(Date.now());
setToasts((prev) => [...prev, { id: toastId, type, message }]);
setTimeout(() => removeToast(toastId), 5000);
}, []);

const handleAddEvidence = async (e: React.FormEvent) => {
e.preventDefault();
if (!dispute) return;

const validation = disputeEvidenceSchema.safeParse({
type: evidenceType,
url: evidenceUrl,
description: evidenceDesc,
});

if (!validation.success) {
showToast("error", validation.error.issues[0]?.message || "Invalid evidence details");
return;
}

setIsSubmitting(true);
try {
const res = await fetch("/api/disputes", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
action: "add_evidence",
disputeId: dispute.id,
type: evidenceType,
url: evidenceUrl,
description: evidenceDesc,
}),
});

const data = await res.json();
if (data.success) {
showToast("success", "Evidence added successfully");
setShowEvidenceForm(false);
setEvidenceUrl("");
setEvidenceDesc("");
fetchDispute();
} else {
showToast("error", data.error || "Failed to add evidence");
}
} catch (error) {
logger.error("[dispute-detail] Failed to add evidence:", error);
showToast("error", "Something went wrong");
} finally {
setIsSubmitting(false);
}
};

const handleDisputeAction = async (action: string) => {
if (!dispute) return;
if (action === "escalate") {
const validation = disputeEscalationSchema.safeParse({ reason: escalateReason });
if (!validation.success) {
showToast("error", validation.error.issues[0]?.message || "Invalid escalation reason");
return;
}
}
setActionLoading(action);
try {
const res = await fetch("/api/disputes", {
method: "PATCH",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
disputeId: dispute.id,
action,
reason: action === "escalate" ? escalateReason : undefined,
}),
});
const data = await res.json();
if (data.success) {
showToast("success", data.message || "Action processed successfully.");
setShowEscalateForm(false);
fetchDispute();
} else {
showToast("error", data.error || "Action failed");
}
} catch (error) {
logger.error("[dispute-detail] Failed to perform dispute action:", error);
showToast("error", "Something went wrong");
} finally {
setActionLoading(null);
}
};

if (isLoading) {
return <div className="loading text-center p-10">Loading dispute details...</div>;
}

if (!dispute) {
return (
<div className="text-center p-10">
<p className="text-lg font-bold mb-4">Dispute not found</p>
<Link href="/dashboard/disputes" className="text-sm text-primary font-semibold">
← Back to Disputes
</Link>
</div>
);
}

const canTakeAction = ["TIER1_AUTO", "OPEN"].includes(dispute.status);
const canEscalate = ["TIER1_AUTO", "TIER2_MEDIATION"].includes(dispute.status);
const canWithdraw = dispute.status === "OPEN" && dispute.raisedByUserId === (session?.user as { id?: string } | undefined)?.id;

return (
<div className="flex flex-col min-h-screen">
<ToastContainer toasts={toasts} onClose={removeToast} />
{/* Header */}
<header className="glass border-b border-card flex items-center gap-4 flex-wrap px-6 py-4">
<Link href="/dashboard/disputes" className="text-sm text-secondary">
 Back to Disputes
</Link>
<h1 className="text-xl font-extrabold">Dispute #{dispute.id.slice(-6)}</h1>
<span
className={`badge text-xs font-semibold rounded-lg text-white px-2 py-1 ${getStatusBgClass(dispute.status)}`}
>
{dispute.status.replaceAll("_", " ")}
</span>
{dispute.tier > 1 && (
<span className="badge badge-warning text-xs rounded-lg px-2 py-1">
Tier {dispute.tier}
</span>
)}
</header>

<main className="p-6 w-full mx-auto max-w-1200">
{/* AI Mediator Analysis Card */}
<DisputeAnalysisCard
analysis={analysis}
dispute={dispute}
canTakeAction={canTakeAction}
actionLoading={actionLoading}
handleDisputeAction={handleDisputeAction}
/>

<div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
{/* Left Column: Details */}
<div>
<div className="card mb-6">
<h2 className="text-lg font-bold mb-4">Issue Details</h2>
<div className="mb-4">
<div className="text-xs text-secondary">Type</div>
<div className="font-semibold">{dispute.type}</div>
</div>
<div className="mb-4">
<div className="text-xs text-secondary">Description</div>
<p className="text-sm leading-normal">{dispute.description}</p>
</div>
<div className="mb-4">
<div className="text-xs text-secondary">Deal</div>
<Link href={`/dashboard/deals/${dispute.deal.id}`} className="text-primary font-semibold">
{dispute.deal.campaign.title} ({dispute.deal.amount / 100} INR)
</Link>
</div>
<div className="mb-4">
<div className="text-xs text-secondary">Filed on</div>
<div className="text-sm">{new Date(dispute.createdAt).toLocaleString()}</div>
</div>
</div>

{/* Resolution */}
{dispute.resolution && (
<div className="card mb-6 border border-card">
<h2 className="text-lg font-bold mb-4 text-emerald"> Resolution</h2>
<p>{dispute.resolution}</p>
{dispute.resolvedAt && (
<div className="mt-4 text-xs text-secondary">
Resolved on {new Date(dispute.resolvedAt).toLocaleDateString()}
</div>
)}
</div>
)}

        {/* Withdraw Dispute */}
        {canWithdraw && (
          <div className="card mb-6">
            <h2 className="text-base font-bold mb-3">Withdraw Dispute</h2>
            <p className="text-sm text-secondary mb-3">
              Have you resolved the issue directly? You can withdraw this dispute.
              This will close the case and restore the deal to its previous state.
            </p>
            <Button
              variant="danger"
              onClick={() => {
                if (!confirm("Withdraw this dispute? The case will be closed and no further action can be taken.")) return;
                handleDisputeAction("withdraw");
              }}
              disabled={!!actionLoading}
              className="w-full"
            >
              {actionLoading === "withdraw" ? "Withdrawing..." : "Withdraw Dispute"}
            </Button>
          </div>
        )}

        {/* Escalate Button */}
        {canEscalate && dispute.status !== "RESOLVED" && (
<div className="card mb-6">
<h2 className="text-base font-bold mb-3"> Escalate Dispute</h2>
<p className="text-sm text-secondary mb-3">
Not satisfied with the AI resolution? Escalate to{" "}
{dispute.tier === 1 ? "human mediation (Tier 2)" : "arbitration (Tier 3)"}.
</p>
{showEscalateForm ? (
<div>
<Textarea
rows={3}
placeholder="Why do you want to escalate? Provide your reasoning..."
value={escalateReason}
onChange={(e) => setEscalateReason(e.target.value)}
className="mb-3"
/>
<div className="flex gap-2">
<Button
variant="warning"
onClick={() => handleDisputeAction("escalate")}
disabled={!escalateReason || !!actionLoading}
className="flex-1"
>
{actionLoading === "escalate"
? "Escalating..."
: `Escalate to Tier ${dispute.tier + 1}`}
</Button>
<Button variant="secondary" onClick={() => setShowEscalateForm(false)}>
Cancel
</Button>
</div>
</div>
) : (
<Button variant="warning" onClick={() => setShowEscalateForm(true)} className="w-full">
Request Escalation
</Button>
)}
</div>
)}
</div>

{/* Right Column: Evidence */}
<div>
<DisputeTimeline dispute={dispute} />
<DisputeEvidence
dispute={dispute}
showEvidenceForm={showEvidenceForm}
setShowEvidenceForm={setShowEvidenceForm}
evidenceType={evidenceType}
setEvidenceType={setEvidenceType}
evidenceUrl={evidenceUrl}
setEvidenceUrl={setEvidenceUrl}
evidenceDesc={evidenceDesc}
setEvidenceDesc={setEvidenceDesc}
onSubmit={handleAddEvidence}
isSubmitting={isSubmitting}
/>
</div>
</div>
</main>
</div>
);
}
