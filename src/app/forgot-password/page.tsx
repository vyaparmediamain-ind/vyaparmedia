"use client";

import { logger } from "@/lib/logger-client";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { Button, Input } from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ArrowLeft, Mail, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
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
      const data = await apiClient.auth.requestPasswordReset(email.trim());
      setStatus("success");
      setMessage(
        data.message || "If an account exists, a password reset link has been dispatched."
      );
      if (data.resetLink) {
        setResetLink(data.resetLink);
      }
    } catch (err: unknown) {
      logger.error("[forgot-password] reset request error:", err);
      setStatus("error");
      setMessage(formatUserError(err, "Unable to process password reset request. Please check your email and try again."));
    }
  };

  return (
    <AuthLayout
      pageTitle="Forgot Password?"
      pageSubtitle="Enter your registered email address and we'll send you secure instructions to reset your account password."
    >
      <div className="mb-5">
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
          className={`flex items-start gap-3 p-4 rounded-xl mb-6 text-xs leading-relaxed border ${
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

      {resetLink && (
        <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-foreground mb-6 space-y-1">
          <div className="font-bold text-primary flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" />
            Development Testing Link
          </div>
          <div className="font-mono text-[11px] break-all text-muted-foreground">
            <a href={resetLink} className="text-primary hover:underline">
              {resetLink}
            </a>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <Input
            id="email"
            type="email"
            label="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            autoComplete="email"
            fullWidth
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={status === "loading"}
          loading={status === "loading"}
          fullWidth
          className="font-bold justify-center gap-2 shadow-sm"
        >
          <Mail className="w-4 h-4" />
          Send Reset Link
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-border/80 text-center">
        <p className="text-xs text-muted-foreground">
          Remember your password?{" "}
          <Link href="/login" className="font-bold text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
