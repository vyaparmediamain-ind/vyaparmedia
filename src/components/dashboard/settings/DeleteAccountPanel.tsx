"use client";


import { logger } from "@/lib/logger-client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button, Input } from "@/components/ui";
import { z } from "zod";

export const deleteAccountSchema = z.object({
confirmText: z.literal("DELETE", {
message: "Please type DELETE to confirm",
}),
password: z.string().min(1, "Password is required to delete your account"),
reason: z.string().max(500, "Reason cannot exceed 500 characters").optional(),
});

interface DeleteAccountPanelProps {
isSaving: boolean;
setIsSaving: (val: boolean) => void;
showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export default function DeleteAccountPanel({
isSaving,
setIsSaving,
showToast,
}: Readonly<DeleteAccountPanelProps>) {
const [isConfirming, setIsConfirming] = useState(false);
const [password, setPassword] = useState("");
const [reason, setReason] = useState("");
const [confirmText, setConfirmText] = useState("");
const [error, setError] = useState("");

const handleDelete = async (e: React.FormEvent) => {
e.preventDefault();
setError("");

const validation = deleteAccountSchema.safeParse({
confirmText,
password,
reason: reason || undefined,
});

if (!validation.success) {
setError(validation.error.issues[0]?.message || "Invalid input details.");
return;
}

setIsSaving(true);
try {
const res = await fetch("/api/user/delete-account", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ password, reason }),
});
const data = await res.json();
if (res.ok) {
showToast("Account deleted successfully. Logging you out...", "success");
// Wait briefly for the toast to display then sign out and redirect to home
setTimeout(() => {
signOut({ callbackUrl: "/" });
}, 1500);
} else {
setError(data.error || "Failed to delete account");
setIsSaving(false);
}
} catch (err: unknown) {
logger.error("[delete-account] error:", err);
setError("An error occurred during account deletion");
setIsSaving(false);
}
};

return (
<div className="card border-rose-subtle">
<h2 className="text-xl font-bold mb-3 text-rose flex items-center gap-2">
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-rose">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
  Danger Zone: Delete Account
</h2>
<p
className="text-sm text-secondary mb-5 leading-normal"
>
Permanently delete your account. This action is irreversible. All your personal data will be anonymized in compliance with DPDP Act 2023. Financial transactions and tax records will be retained for audit compliance.
</p>

{error && (
<div
role="alert"
aria-live="assertive"
className="p-3 mb-4 rounded-sm text-rose bg-rose-subtle border-rose-subtle"
>
{error}
</div>
)}

{!isConfirming ? (
<Button
type="button"
variant="danger"
onClick={() => setIsConfirming(true)}
className="w-full"
>
Delete My Account
</Button>
) : (
<form onSubmit={handleDelete} className="flex flex-col gap-4">
<Input
label="Enter Password"
id="delete-password-input"
type="password"
placeholder="Enter your current password"
value={password}
onChange={(e) => setPassword(e.target.value)}
required
disabled={isSaving}
fullWidth
/>

<Input
label="Reason for Deletion (Optional)"
id="delete-reason-input"
type="text"
placeholder="e.g. No longer using the service"
value={reason}
onChange={(e) => setReason(e.target.value)}
disabled={isSaving}
fullWidth
/>

<div>
<label className="label" htmlFor="delete-confirm-input">
Type <strong className="text-rose">DELETE</strong> to confirm
</label>
<Input
id="delete-confirm-input"
type="text"
placeholder="Type DELETE"
value={confirmText}
onChange={(e) => setConfirmText(e.target.value)}
required
disabled={isSaving}
fullWidth
/>
</div>

<div className="flex flex-col sm:flex-row gap-3 mt-2">
<Button
type="submit"
variant="danger"
className="flex-1"
disabled={isSaving || confirmText !== "DELETE"}
>
{isSaving ? <span className="loading" /> : "Permanently Delete Account"}
</Button>
<Button
type="button"
variant="secondary"
className="flex-1"
onClick={() => {
setIsConfirming(false);
setPassword("");
setReason("");
setConfirmText("");
setError("");
}}
disabled={isSaving}
>
Cancel
</Button>
</div>
</form>
)}
</div>
);
}
