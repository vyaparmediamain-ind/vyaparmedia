import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import {
approveUser,
rejectUser,
approveDocument,
rejectDocument,
} from "../../actions";
import { getSignedUrl } from "@/lib/storage";
import EmptyState from "@/components/ui/EmptyState";
import { Button, Input } from "@/components/ui";
import { z } from "zod";

const verificationRejectSchema = z.object({
reason: z.string().min(5, "Reason must be at least 5 characters").max(100),
});

export const dynamic = "force-dynamic";

function getDocBadgeClass(status: string): string {
if (status === "VERIFIED") return "badge-success";
if (status === "REJECTED") return "badge-danger";
return "badge-warning";
}

export default async function VerificationDetailPage({
params,
}: {
readonly params: Promise<{ readonly id: string }>;
}) {
const { id } = await params;
const user = await prisma.user.findUnique({
where: { id },
include: {
influencerProfile: true,
brandProfile: true,
taxCompliance: true,
verificationDocs: true,
badges: { include: { badge: true } },
},
});

if (!user) notFound();

// Regenerate presigned URLs for all KYC documents on load
// documentUrl stores either a full URL (already public/CDN) or an S3 key.
// For keys (no http prefix), we generate a fresh 1-hour presigned URL.
const docsWithRefreshedUrls = await Promise.all(
user.verificationDocs.map(async (doc: typeof user.verificationDocs[number]) => {
if (!doc.documentUrl) return doc;
// If it's already a full URL (CDN / local path), use as-is
if (doc.documentUrl.startsWith("http") || doc.documentUrl.startsWith("/")) {
return doc;
}
// Otherwise treat as S3 key and generate fresh presigned URL (1h)
const signedUrl = await getSignedUrl(doc.documentUrl, 3600);
return { ...doc, documentUrl: signedUrl || doc.documentUrl };
}),
);

const name =
user.influencerProfile?.displayName ||
user.brandProfile?.companyName ||
"Unknown";
const activeSince = new Date(user.createdAt).toLocaleDateString();

return (
<div className="admin-page admin-page-narrow">
<header className="mb-8">
<h1 className="gradient-text mb-2 text-3xl font-extrabold">
Review: {name}
</h1>
<p className="text-secondary text-sm">
Critical KYC and Trust Verification Review Process
</p>
</header>

<div className="grid-2 gap-6 items-start">
{/* Profile Info */}
<section className="card">
<h2 className="text-lg font-bold mb-5 flex items-center gap-2">
Profile Detail
</h2>
<div className="flex flex-col gap-3">
{[
{ label: "Internal ID", value: user.id, colorClass: "" },
{ label: "Email Address", value: user.email, colorClass: "" },
{ label: "Phone Contact", value: user.phone || "Not provided", colorClass: "" },
{ label: "Account Type", value: user.userType, colorClass: "" },
{ label: "Registration", value: activeSince, colorClass: "" },
{ label: "Trust Score", value: user.trustScore, colorClass: user.trustScore >= 50 ? "text-emerald" : "text-amber" },
].map((item) => (
<div key={item.label} className="flex justify-between items-center p-3 bg-tertiary rounded-md border-card">
<span className="text-xs text-secondary font-semibold uppercase">
{item.label}
</span>
<span className={`text-sm font-bold ${item.colorClass}`}>
{item.value}
</span>
</div>
))}
</div>
</section>

<section className="card">
<h2 className="text-lg font-bold mb-5 flex items-center gap-2">
India Tax Readiness
</h2>
<div className="flex flex-col gap-3">
{[
{
label: "PAN",
value: user.taxCompliance?.panLast4
? `****${user.taxCompliance.panLast4}`
: "Missing",
},
{
label: "GSTIN",
value: user.taxCompliance?.gstinLast4
? `****${user.taxCompliance.gstinLast4}`
: user.taxCompliance?.gstRegistrationType || "Not declared",
},
{
label: "ITR acknowledgement",
value: user.taxCompliance?.itrAcknowledgementLast4
? `****${user.taxCompliance.itrAcknowledgementLast4}`
: "Not provided",
},
{
label: "Assessment year",
value: user.taxCompliance?.itrAssessmentYear || "Not provided",
},
{
label: "E-invoice",
value: user.taxCompliance?.eInvoiceApplicable ? "Applicable" : "Not marked",
},
{
label: "Tax status",
value: user.taxCompliance?.status || "ACTION_REQUIRED",
},
].map((item) => (
<div key={item.label} className="flex justify-between items-center p-3 bg-tertiary rounded-md border-card">
<span className="text-xs text-secondary font-semibold uppercase">
{item.label}
</span>
<span className="text-sm font-bold">
{item.value}
</span>
</div>
))}
</div>
</section>

{/* Docs */}
<section className="card">
<h2 className="text-lg font-bold mb-5 flex items-center gap-2">
Proof Documents
</h2>
{docsWithRefreshedUrls.length === 0 ? (
<EmptyState
emoji=""
title="No Documents Uploaded"
description="No verification documents have been submitted by this user."
compact
/>
) : (
<div className="flex flex-col gap-4">
{docsWithRefreshedUrls.map((doc) => (
<div
key={doc.id}
className="p-4 bg-tertiary rounded-lg border-card"
>
<div className="flex justify-between items-start mb-3">
<div>
<div className="font-extrabold text-sm flex items-center gap-2 uppercase text-primary">
{doc.type.replaceAll("_", " ")}
<span className={`badge ${getDocBadgeClass(doc.status)}`}>
{doc.status}
</span>
</div>
<div className="text-muted mt-1 text-xs">
ID: {doc.id.slice(0, 8)}... {new Date(doc.createdAt).toLocaleDateString()}
</div>
</div>
{doc.documentUrl && (
<a
href={doc.documentUrl}
target="_blank"
rel="noopener noreferrer"
className="btn btn-sm btn-secondary px-3-py-1"
>
Review Attachment
</a>
)}
</div>

{doc.status === "PENDING" && (
<div className="flex mt-4 border-t border-card gap-2.5 pt-4">
<form action={approveDocument.bind(null, doc.id, user.id)} className="flex-1">
<Button variant="success" size="sm" className="w-full">
Approve
</Button>
</form>
<form
action={async (formData) => {
"use server";
const rawReason = formData.get("reason") as string;
const { reason } = verificationRejectSchema.parse({ reason: rawReason });
await rejectDocument(doc.id, user.id, reason);
}}
className="flex gap-2 flex-2"
>
<Input
name="reason"
placeholder="Reason..."
required
className="flex-1 text-xs px-3 py-2"
/>
<Button type="submit" variant="danger" size="sm">
Reject
</Button>
</form>
</div>
)}
</div>
))}
</div>
)}
</section>
</div>

{/* Global Actions Bar */}
<footer className="flex flex-col gap-6 p-8 bg-secondary rounded-xl border-card mt-10">
<div>
<h3 className="text-base font-bold mb-1">Decision Engine</h3>
<p className="text-secondary text-sm">Finalize user status. This will trigger system-wide webhooks and emails.</p>
</div>

<div className="flex gap-4 flex-wrap items-center">
<form action={approveUser.bind(null, user.id)}>
<Button variant="success" size="lg" className="min-w-220">
Full Verification Pass
</Button>
</form>

<div className="vertical-separator" />

<form
action={async (formData) => {
"use server";
const rawReason = formData.get("reason") as string;
const { reason } = verificationRejectSchema.parse({ reason: rawReason });
await rejectUser(user.id, reason);
}}
className="flex gap-3 flex-wrap flex-basis-300"
>
<Input
name="reason"
placeholder="Final rejection context..."
required
className="h-13 flex-basis-200"
/>
<Button type="submit" variant="danger" size="lg" className="min-w-180">
Hard Reject
</Button>
</form>
</div>
</footer>
</div>
);
}
