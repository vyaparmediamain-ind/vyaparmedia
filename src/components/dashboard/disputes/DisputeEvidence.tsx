"use client";

import React from "react";
import { Card, Button, Select, Input, Textarea } from "@/components/ui";
import { DisputeDetail } from "./DisputeHelpers";

interface DisputeEvidenceProps {
readonly dispute: DisputeDetail;
readonly showEvidenceForm: boolean;
readonly setShowEvidenceForm: (show: boolean) => void;
readonly evidenceType: string;
readonly setEvidenceType: (type: string) => void;
readonly evidenceUrl: string;
readonly setEvidenceUrl: (url: string) => void;
readonly evidenceDesc: string;
readonly setEvidenceDesc: (desc: string) => void;
readonly onSubmit: (e: React.FormEvent) => void;
readonly isSubmitting: boolean;
}

export function DisputeEvidence({
dispute,
showEvidenceForm,
setShowEvidenceForm,
evidenceType,
setEvidenceType,
evidenceUrl,
setEvidenceUrl,
evidenceDesc,
setEvidenceDesc,
onSubmit,
isSubmitting,
}: Readonly<DisputeEvidenceProps>) {
return (
<Card>
<div className="section-header-row mb-4 flex justify-between items-center">
<h2 className="section-title text-lg font-bold mb-0 flex items-center gap-2">
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5 text-blue-500">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
  Evidence
</h2>
{["OPEN", "TIER1_AUTO", "TIER2_MEDIATION"].includes(
dispute.status,
) && (
<Button
variant="secondary"
size="sm"
onClick={() => setShowEvidenceForm(!showEvidenceForm)}
>
{showEvidenceForm ? "Cancel" : "+ Add Evidence"}
</Button>
)}
</div>

{showEvidenceForm && (
<form
onSubmit={onSubmit}
className="card mb-6 p-4 bg-tertiary"
>
<Select
  label="Type"
  id="evidence-type-select"
  value={evidenceType}
  onChange={(e) => setEvidenceType(e.target.value)}
  className="mb-3"
  fullWidth
>
  <option value="CONTRACT">Contract / Agreement</option>
  <option value="DELIVERABLE">Deliverable / Content File</option>
  <option value="CHAT_LOG">Chat Log / Messages</option>
  <option value="PAYMENT_PROOF">Payment Proof</option>
  <option value="OTHER">Other</option>
</Select>

<Input
label="URL"
id="evidence-url-input"
type="url"
placeholder="https://drive.google.com/..."
value={evidenceUrl}
onChange={(e) => setEvidenceUrl(e.target.value)}
className="mb-3"
fullWidth
required
/>

<Textarea
label="Description"
id="evidence-desc-textarea"
rows={2}
placeholder="What does this evidence show?"
value={evidenceDesc}
onChange={(e) => setEvidenceDesc(e.target.value)}
className="mb-4"
fullWidth
required
/>

<Button
variant="primary"
type="submit"
disabled={isSubmitting}
fullWidth
>
{isSubmitting ? "Submitting..." : "Submit Evidence"}
</Button>
</form>
)}

{dispute.evidence.length === 0 ? (
<p
className="text-secondary text-sm"
>
No evidence submitted yet.
</p>
) : (
<div
className="flex flex-col gap-3"
>
{dispute.evidence.map((ev) => (
<div
key={ev.id}
className="p-3 border-card rounded-sm"
>
<div
className="flex justify-between mb-1"
>
<span className="badge">{ev.type}</span>
<span
className="text-secondary text-xs"
>
{ev.submittedAt ? new Date(ev.submittedAt).toLocaleDateString() : ""}
</span>
</div>
<p className="text-sm mb-2">
{ev.description}
</p>
{ev.url && (
  <a
    href={ev.url}
    target="_blank"
    rel="noopener noreferrer"
    className="text-sm text-primary flex items-center gap-1"
  >
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
    View File
  </a>
)}
</div>
))}
</div>
)}
</Card>
);
}
