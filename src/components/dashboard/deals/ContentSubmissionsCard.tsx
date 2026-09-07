import EmptyState from "@/components/ui/EmptyState";
import { Card } from "@/components/ui";
import { formatContractDate, ContentSubmission, ContentUrlEntry } from "./DealDetailHelpers";

interface ContentSubmissionsCardProps {
readonly submissions?: ContentSubmission[] | undefined;
}

export function ContentSubmissionsCard({ submissions }: Readonly<ContentSubmissionsCardProps>) {
if (!submissions || submissions.length === 0) {
return (
<EmptyState
emoji=""
title="No Submissions Yet"
description="No content has been submitted for this deal."
compact
/>
);
}

const latestSub = submissions[0];
if (!latestSub) return null;
const notes = latestSub.notes || "";
const subUrls: ContentUrlEntry[] = Array.isArray(latestSub.contentUrls) ? latestSub.contentUrls : [];

return (
<Card className="card p-6">
<h3 className="font-bold text-lg mb-4">Submissions History</h3>
<div className="flex flex-col gap-4">
{subUrls.map((urlObj: ContentUrlEntry) => {
let statusClass = "bg-color-primary-subtle text-color-primary";
if (urlObj.status === "APPROVED") {
statusClass = "bg-success-subtle text-success";
} else if (urlObj.status === "REVISION_REQUESTED") {
statusClass = "bg-rose-subtle text-rose";
}

return (
<div key={urlObj.type} className="flex justify-between items-center p-3 bg-secondary rounded-md border-card">
<div>
<div className="font-semibold text-sm">
{urlObj.type.replace(/_\d+$/, '').replaceAll('_', ' ')}
</div>
<div className="text-xs text-secondary mt-0.5">
Submitted on {formatContractDate(latestSub.createdAt)}
</div>
</div>
<div className="flex items-center gap-3">
<span className={`text-xs px-2 py-1 rounded-full font-bold ${statusClass}`}>
{urlObj.status || "PENDING"}
</span>
<a
href={urlObj.url}
target="_blank"
rel="noopener noreferrer"
className="text-xs font-bold text-primary hover:underline"
>
View File ↗
</a>
</div>
</div>
);
})}
{notes.trim() && (
<div className="p-3 bg-tertiary rounded-md text-sm text-secondary">
<strong>Notes:</strong> {notes}
</div>
)}
</div>
</Card>
);
}
