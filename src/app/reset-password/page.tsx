"use client";


import { logger } from "@/lib/logger-client";
import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import { z } from "zod";

export const resetPasswordSchema = z.object({
password: z
.string()
.min(8, "Password must be at least 8 characters")
.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
.regex(/[a-z]/, "Password must contain at least one lowercase letter")
.regex(/\d/, "Password must contain at least one number")
.regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
message: "Passwords do not match",
path: ["confirmPassword"],
});

function ResetPasswordForm() {
const router = useRouter();
const searchParams = useSearchParams();
const token = searchParams?.get("token") ?? null;

const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [status, setStatus] = useState<
"idle" | "loading" | "success" | "error"
>("idle");
const [message, setMessage] = useState("");

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setMessage("");

const validation = resetPasswordSchema.safeParse({
password,
confirmPassword,
});

if (!validation.success) {
setStatus("error");
setMessage(validation.error.issues[0]?.message || "Invalid password details");
return;
}

setStatus("loading");
setMessage("");

try {
const res = await fetch("/api/auth/reset-password", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ action: "reset", token, newPassword: password }),
});

const data = await res.json();

if (!res.ok) {
setStatus("error");
setMessage(data.error || "Failed to reset password");
} else {
setStatus("success");
setMessage("Password reset successful! Redirecting to login...");
setTimeout(() => router.push("/login"), 2000);
}
} catch (err: unknown) {
logger.error("[reset-password] submission error:", err);
setStatus("error");
setMessage("Network error. Please try again.");
}
};

if (!token) {
return (
<div className="text-center">
<h1 className="text-xl font-bold mb-4">Invalid Link</h1>
<p className="mb-4 text-secondary text-sm">
This password reset link is invalid or missing a token.
</p>
<Link
href="/forgot-password"
className="font-semibold auth-link"
>
Request a new link
</Link>
</div>
);
}

return (
<div className="w-full">
<h1 className="text-xl font-extrabold mb-2">
Set New Password
</h1>
<p className="text-secondary text-sm mb-8">
Enter a strong password for your account
</p>

{message && (
<output
role={status === "error" ? "alert" : "status"}
aria-live={status === "error" ? "assertive" : "polite"}
aria-atomic="true"
className={`text-sm mb-6 block ${status === "success" ? "auth-banner" : "auth-error-banner"}`}
>
{message}
</output>
)}

<form onSubmit={handleSubmit}>
<div className="mb-4">
<Input
id="password"
type="password"
label="New Password"
value={password}
onChange={(e) => setPassword(e.target.value)}
required
placeholder="Min 8 chars, mixed case & symbols"
fullWidth
/>
</div>

<div className="mb-6">
<Input
id="confirmPassword"
type="password"
label="Confirm Password"
value={confirmPassword}
onChange={(e) => setConfirmPassword(e.target.value)}
required
placeholder="Re-enter password"
fullWidth
/>
</div>

<Button
type="submit"
variant="primary"
disabled={status === "loading" || status === "success"}
loading={status === "loading"}
fullWidth
>
Reset Password
</Button>
</form>
</div>
);
}

export default function ResetPasswordPage() {
return (
<div className="flex items-center justify-center p-6 auth-wrapper">
{/* Background Effects */}
<div className="reset-bg-glow" />
<div className="card login-card">
<Suspense fallback={<div>Loading...</div>}>
<ResetPasswordForm />
</Suspense>
</div>
</div>
);
}

