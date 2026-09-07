"use client";


import { logger } from "@/lib/logger-client";
import { useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ToastContainer, type ToastItem, type ToastType } from "@/components/ui/toast";
import { Button, Select, Textarea } from "@/components/ui";
import { createDisputeSchema } from "@/lib/validations/campaign";

export default function DisputePage({
params,
}: Readonly<{
params: Promise<{ id: string }>;
}>) {
const { id } = use(params);
const router = useRouter();
const [issueType, setIssueType] = useState("TIMELINE");
const [description, setDescription] = useState("");
const [isSubmitting, setIsSubmitting] = useState(false);
const [toasts, setToasts] = useState<ToastItem[]>([]);

const removeToast = (toastId: string) => {
setToasts(prev => prev.filter(t => t.id !== toastId));
};

const showToast = (type: ToastType, message: string) => {
const toastId = String(Date.now());
setToasts(prev => [...prev, { id: toastId, type, message }]);
setTimeout(() => removeToast(toastId), 5000);
};

const dealId = id;

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();

const validation = createDisputeSchema.safeParse({
type: issueType,
description: description.trim(),
});

if (!validation.success) {
showToast("error", validation.error.issues[0]?.message || "Invalid dispute details.");
return;
}

setIsSubmitting(true);
try {
const res = await fetch("/api/disputes", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
action: "create",
dealId,
type: issueType,
description,
}),
});

const data = await res.json();
if (data.success) {
showToast("success", data.message);
router.push(`/dashboard/deals/${dealId}`);
} else {
showToast("error", data.error || "Failed to raise dispute");
}
} catch (error) {
logger.error("[deal-dispute] Failed to raise dispute:", error);
showToast("error", "Something went wrong");
} finally {
setIsSubmitting(false);
}
};

return (
<>
<ToastContainer toasts={toasts} onClose={removeToast} />
<div
className="flex justify-center items-center bg-secondary min-h-screen"
>
<div
className="card w-full p-8 max-w-600"
>
<div className="mb-6">
<Link
href={`/dashboard/deals/${dealId}`}
className="text-secondary text-sm"
>
 Back to Deal
</Link>
<h1 className="text-2xl font-extrabold mt-2">
Raise a Dispute
</h1>
<p className="text-secondary">
We're here to help. Select the issue type and describe the problem.
Our automated system (Tier 1) will attempt to resolve it
immediately.
</p>
</div>

<form onSubmit={handleSubmit}>
<Select
label="Issue Type"
id="issue-type-select"
value={issueType}
onChange={(e) => setIssueType(e.target.value)}
fullWidth
>
<option value="TIMELINE">
Timeline Issue (Missed Deadlines)
</option>
<option value="QUALITY">Quality / Content Mismatch</option>
<option value="PAYMENT">Payment Issue</option>
<option value="TERMS_VIOLATION">Terms Violation</option>
<option value="OTHER">Other</option>
</Select>

<div className="mb-6">
<Textarea
label="Description"
id="description-textarea"
rows={6}
placeholder="Please describe the issue in detail..."
value={description}
onChange={(e) => setDescription(e.target.value)}
required
fullWidth
/>
<p className="text-xs text-muted">
{description.trim().length}/50 minimum characters
</p>
</div>

<div className="flex gap-4">
<Link
href={`/dashboard/deals/${dealId}`}
className="btn btn-secondary flex-1 text-center"
>
Cancel
</Link>
<Button
type="submit"
variant="danger"
className="flex-1"
disabled={isSubmitting || description.trim().length < 50}
>
{isSubmitting ? "Submitting..." : "Raise Dispute"}
</Button>
</div>
</form>
</div>
</div>
</>
);
}
