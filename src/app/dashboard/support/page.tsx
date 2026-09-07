"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { createSupportSchema } from "@/lib/validations/campaign";

export default function SupportPage() {
const { data: session } = useSession();
const [type, setType] = useState<"BUG" | "FEEDBACK">("FEEDBACK");
const [title, setTitle] = useState("");
const [description, setDescription] = useState("");
const [screenshotUrl, setScreenshotUrl] = useState("");
const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
const [loading, setLoading] = useState(false);
const [statusMsg, setStatusMsg] = useState("");
const [errorMsg, setErrorMsg] = useState("");
const [badgeAwarded, setBadgeAwarded] = useState<string | null>(null);
const fileInputRef = useRef<HTMLInputElement>(null);

const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
const file = e.target.files?.[0];
if (!file) return;

setUploadingScreenshot(true);
setErrorMsg("");
setStatusMsg("");

const formData = new FormData();
formData.append("file", file);
formData.append("folder", "feedback");

try {
const res = await fetch("/api/upload", {
method: "POST",
body: formData,
});
const data = await res.json();
if (!res.ok) {
throw new Error(data.error || "Failed to upload screenshot.");
}
setScreenshotUrl(data.data.url);
} catch (err: unknown) {
setErrorMsg(err instanceof Error ? err.message : "Screenshot upload failed.");
} finally {
setUploadingScreenshot(false);
}
};

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setStatusMsg("");
setErrorMsg("");
setBadgeAwarded(null);

const validation = createSupportSchema.safeParse({
type,
title: title.trim(),
description: description.trim(),
screenshotUrl: screenshotUrl || undefined,
});

if (!validation.success) {
setErrorMsg(validation.error.issues[0]?.message || "Invalid input details.");
return;
}

setLoading(true);
try {
const res = await fetch("/api/users/feedback", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ type, title, description, screenshotUrl }),
});
const data = await res.json();
if (!res.ok) {
throw new Error(data.error || "Failed to submit request.");
}
setStatusMsg(data.message);
setTitle("");
setDescription("");
setScreenshotUrl("");
if (data.data?.badgeAwarded) {
setBadgeAwarded(data.data.badgeAwarded);
}
} catch (err: unknown) {
setErrorMsg(err instanceof Error ? err.message : "An error occurred.");
} finally {
setLoading(false);
}
};

return (
<DashboardShell user={session?.user}>
<div className="max-w-680 mx-auto p-24-16">
<header className="mb-8 text-center">
<h1 className="font-extrabold mb-2 gradient-text text-3xl">
Support & Feedback Hub
</h1>
<p className="text-secondary text-base">
Submit bug reports or platform feedback. Verified submissions will be rewarded with badges by the admin!
</p>
</header>

<form onSubmit={handleSubmit} className="card grid gap-5 p-8">
<div>
<Select
id="type"
label="Submission Type"
value={type}
onChange={(e) => setType(e.target.value as "BUG" | "FEEDBACK")}
fullWidth
>
<option value="FEEDBACK">Give Platform Feedback</option>
<option value="BUG">Report a Bug</option>
</Select>
</div>

<div>
<Input
type="text"
id="title"
label="Title"
value={title}
onChange={(e) => setTitle(e.target.value)}
placeholder={type === "BUG" ? "e.g., OTP login verification fails on step 2" : "e.g., Feature request for YouTube analytics graphs"}
required
fullWidth
/>
</div>

<div>
<Textarea
id="description"
label="Description"
value={description}
onChange={(e) => setDescription(e.target.value)}
placeholder={
type === "BUG"
? "Describe the issue, steps to reproduce, and what you expected to happen..."
: "Share your ideas, suggestions, or comments about the platform experience..."
}
required
rows={5}
fullWidth
/>
</div>

<div>
<label htmlFor="screenshot-file-input" className="block font-semibold mb-2 text-sm">
Screenshot (Optional)
</label>
{screenshotUrl ? (
<div className="flex items-center gap-3 p-3 bg-tertiary rounded-md border-card">
<Image src={screenshotUrl} alt="Uploaded screenshot" width={48} height={48} unoptimized className="object-cover rounded-sm" />
<div className="flex-1 overflow-hidden text-sm whitespace-nowrap text-ellipsis">
Screenshot uploaded successfully
</div>
<Button
type="button"
aria-label="Remove uploaded screenshot"
onClick={() => setScreenshotUrl("")}
variant="ghost"
className="font-semibold text-rose"
>
Remove
</Button>
</div>
) : (
<div>
<Button
type="button"
aria-label="Upload screenshot for your report"
disabled={uploadingScreenshot}
onClick={() => fileInputRef.current?.click()}
variant="ghost"
className="w-full p-3 text-secondary text-center font-semibold border-dashed flex items-center justify-center"
>
{uploadingScreenshot ? (
"Uploading screenshot..."
) : (
<span className="flex items-center justify-center gap-2">
<svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
<circle cx="12" cy="13" r="3" />
</svg>
Upload Screenshot (Max 5MB)
</span>
)}
</Button>
<Input
type="file"
id="screenshot-file-input"
ref={fileInputRef}
onChange={handleScreenshotUpload}
accept="image/png, image/jpeg, image/webp, image/gif"
className="hidden"
/>
</div>
)}
</div>

{errorMsg && (
<div role="alert" aria-live="assertive" className="p-3 text-sm rounded-sm text-rose bg-rose-subtle">
{errorMsg}
</div>
)}

{statusMsg && (
<div role="status" aria-live="polite" className="p-3 text-sm rounded-sm text-emerald bg-emerald-subtle">
{statusMsg}
</div>
)}

{badgeAwarded && (
<div className="flex items-center gap-4 p-4 rounded-md badge-earning-panel">
<svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9 text-amber flex-shrink-0">
<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
<path d="M4 22h16" />
<path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
<path d="M12 2a5 5 0 0 1 5 5v3.5a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
</svg>
<div>
<h4 className="font-extrabold text-amber">New Badge Earned!</h4>
<p className="text-sm text-primary mt-1">
You earned the <strong>{badgeAwarded === "bug_reporter" ? "Bug Reporter" : "Feedback Giver"}</strong> badge! Check it in your Badges tab.
</p>
</div>
</div>
)}

<Button
type="submit"
disabled={loading || uploadingScreenshot}
variant="primary"
className="justify-center font-bold p-3.5"
>
{loading ? "Submitting..." : "Submit to Support"}
</Button>
</form>
</div>
</DashboardShell>
);
}
