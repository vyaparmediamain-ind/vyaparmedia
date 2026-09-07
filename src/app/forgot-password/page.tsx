"use client";


import { logger } from "@/lib/logger-client";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function ForgotPasswordPage() {
const [email, setEmail] = useState("");
const [status, setStatus] = useState<
"idle" | "loading" | "success" | "error"
>("idle");
const [message, setMessage] = useState("");
const [resetLink, setResetLink] = useState("");

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setMessage("");
setResetLink("");

const validation = z.string().email("Please enter a valid email address").safeParse(email.trim());
if (!validation.success) {
setStatus("error");
setMessage(validation.error.issues[0]?.message || "Invalid email address");
return;
}

setStatus("loading");
setMessage("");
setResetLink("");

try {
const res = await fetch("/api/auth/reset-password", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ action: "request", email }),
});

const data = await res.json();

if (!res.ok) {
setStatus("error");
setMessage(data.error || "Something went wrong");
} else {
setStatus("success");
setMessage(
data.message || "If an account exists, a reset link has been sent.",
);
if (data.resetLink) {
setResetLink(data.resetLink);
}
}
} catch (err: unknown) {
logger.error("[forgot-password] reset request error:", err);
setStatus("error");
setMessage("Network error. Please try again.");
}
};

return (
<div
className="flex items-center justify-center p-6 relative overflow-hidden min-h-screen"
>
{/* Background Effects (Same as Login) */}
<div className="absolute rounded-full forgot-password-glow forgot-password-glow-primary" />
<div className="absolute rounded-full forgot-password-glow forgot-password-glow-secondary" />

<div className="card w-full relative p-10 z-1 forgot-password-card">
<Link
href="/login"
className="text-sm text-secondary mb-6 flex"
>
 Back to Login
</Link>

<h1 className="text-xl font-extrabold mb-2">
Forgot Password?
</h1>
<p className="text-secondary text-sm mb-6">
Enter your email to receive a reset link
</p>

{message && (
<output
  role={status === "error" ? "alert" : "status"}
  aria-live={status === "error" ? "assertive" : "polite"}
  aria-atomic="true"
  className="text-sm mb-6 rounded-md px-4 py-3 forgot-password-message block"
  data-status={status === "success" ? "success" : "error"}
>
  {message}
</output>
)}

{resetLink && (
<div className="mb-6 p-3 text-xs rounded-md break-all forgot-password-dev-link">
<strong>DEV LINK:</strong>{" "}
<a
href={resetLink}
className="forgot-password-dev-anchor"
>
{resetLink}
</a>
</div>
)}

<form onSubmit={handleSubmit}>
<div className="mb-6">
<Input
id="email"
type="email"
label="Email Address"
value={email}
onChange={(e) => setEmail(e.target.value)}
required
placeholder="you@example.com"
fullWidth
/>
</div>

<Button
type="submit"
variant="primary"
disabled={status === "loading"}
loading={status === "loading"}
fullWidth
>
Send Reset Link
</Button>
</form>
</div>
</div>
);
}
