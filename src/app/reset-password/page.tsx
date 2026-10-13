"use client";

import { logger } from "@/lib/logger-client";
import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { z } from "zod";
import {
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from "lucide-react";

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/\d/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? null;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
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
      await apiClient.auth.resetPassword({ token: token || "", newPassword: password });
      setStatus("success");
      setMessage("Password reset successful! Redirecting to login...");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: unknown) {
      logger.error("[reset-password] submission error:", err);
      setStatus("error");
      setMessage(
        formatUserError(
          err,
          "Failed to reset password. The link may be invalid or expired. Please request a new link."
        )
      );
    }
  };

  if (!token) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-disputed/10 border border-disputed-border flex items-center justify-center text-disputed mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Invalid Reset Link</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            This password reset link is invalid, incomplete, or has already been consumed.
          </p>
        </div>
        <Button
          href="/forgot-password"
          variant="primary"
          size="sm"
          className="font-bold gap-1.5"
        >
          <KeyRound className="w-3.5 h-3.5" />
          Request a New Link
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <div className="mb-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to Login
        </Link>
      </div>

      {message && (
        <div
          role={status === "error" ? "alert" : "status"}
          aria-live={status === "error" ? "assertive" : "polite"}
          className={`flex items-start gap-3 p-4 rounded-xl text-xs leading-relaxed border ${
            status === "success"
              ? "bg-verified/10 border-verified-border text-verified font-medium"
              : "bg-disputed/10 border-disputed-border text-disputed font-semibold"
          }`}
        >
          {status === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-verified mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-disputed mt-0.5" />
          )}
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            id="password"
            type="password"
            label="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Min 8 chars, uppercase, symbol & number"
            fullWidth
          />
        </div>

        <div>
          <Input
            id="confirmPassword"
            type="password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Re-enter your new password"
            fullWidth
          />
        </div>

        {/* Password Requirements Checklist */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1.5">
          <span className="font-bold text-foreground block text-[11px] uppercase tracking-wider">
            Password Guidelines
          </span>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
            <span className={password.length >= 8 ? "text-verified font-medium" : ""}>
              &bull; 8+ characters
            </span>
            <span className={/[A-Z]/.test(password) ? "text-verified font-medium" : ""}>
              &bull; Uppercase letter
            </span>
            <span className={/\d/.test(password) ? "text-verified font-medium" : ""}>
              &bull; Number
            </span>
            <span className={/[^A-Za-z0-9]/.test(password) ? "text-verified font-medium" : ""}>
              &bull; Special symbol
            </span>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={status === "loading" || status === "success"}
          loading={status === "loading"}
          fullWidth
          className="font-bold justify-center gap-2 shadow-sm"
        >
          <Lock className="w-4 h-4" />
          Reset & Update Password
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      pageTitle="Set New Password"
      pageSubtitle="Create a strong, unique password to secure your VyaparMedia escrow account."
    >
      <Suspense
        fallback={
          <div className="p-8 text-center text-muted-foreground text-xs animate-pulse">
            Loading secure reset form...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
