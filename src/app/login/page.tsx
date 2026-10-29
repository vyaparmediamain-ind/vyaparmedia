"use client";

import { logger } from "@/lib/logger-client";
import Link from "next/link";
import { z } from "zod";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn, type SignInResponse } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  twoFactorCode: z.string().length(6, "2FA code must be 6 digits").optional().or(z.literal("")),
});

export function resolveSafeCallbackUrl(rawCallbackUrl: string | null | undefined): string {
  if (!rawCallbackUrl || typeof rawCallbackUrl !== "string") return "/dashboard";
  let decoded = rawCallbackUrl;
  try {
    decoded = decodeURIComponent(rawCallbackUrl);
  } catch {
    return "/dashboard";
  }
  // Repeatedly decode in case of multi-layer encoding (%255c -> %5c -> \)
  try {
    const doubleDecoded = decodeURIComponent(decoded);
    if (doubleDecoded !== decoded) {
      decoded = doubleDecoded;
    }
  } catch {
    // ignore
  }

  // Reject backslashes (literal or %5c), protocol-relative slashes (// or %2f%2f), and control characters
  if (
    rawCallbackUrl.includes("\\") ||
    rawCallbackUrl.startsWith("//") ||
    decoded.includes("\\") ||
    decoded.startsWith("//") ||
    decoded.includes("/\\") ||
    decoded.includes("\\/") ||
    decoded.includes("/\t") ||
    decoded.includes("/ ")
  ) {
    return "/dashboard";
  }

  if (decoded.startsWith("/")) {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://safe.local";
      const parsed = new URL(decoded, origin);
      if (parsed.origin !== origin) return "/dashboard";
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return "/dashboard";
    }
  }
  return "/dashboard";
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <span className="loading" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

export function getSessionMessage(registered: boolean, reason: string | null, error?: string | null): string | null {
  if (registered) return "Account created successfully. Please sign in to continue.";
  if (reason === "inactivity") return "You were signed out due to inactivity.";
  if (reason === "session_revoked") return "Your session was terminated because you signed in on another device.";
  if (reason === "token_expired" || reason === "session_expired") return "Your session expired. Please sign in again.";

  if (!error) return null;

  switch (error) {
    case "OAuthAccountNotLinked":
      return "This email is already associated with another login method. Please sign in using your existing credentials.";
    case "OAuthAccountNotRegistered":
      return "No account found matching this Google profile. Please create an account first.";
    case "AccessDenied":
      return "Access was denied. You do not have permission to sign in or your account cannot be accessed.";
    case "Configuration":
      return "Unable to connect to the login service right now. Please try again or use your password to sign in.";
    case "EmailNotVerified":
      return "Your email address has not been verified yet. Please verify your email before signing in.";
    case "Verification":
      return "The verification link or code is invalid or has expired. Please request a new verification link.";
    case "CredentialsSignin":
      return "Invalid email or password. Please verify your credentials.";
    case "AuthError":
      return "Authentication service is ready. Please sign in with your email and password.";
    case "GoogleAuthUnavailable":
      return "Google sign-in is temporarily paused. Please sign in with your email and password.";
    default:
      return "Unable to sign in. Please check your credentials or try again.";
  }
}

function handleSignInResult(
  result: SignInResponse | undefined,
  attemptCount: number,
  setAttemptCount: React.Dispatch<React.SetStateAction<number>>,
  setShow2FA: (val: boolean) => void
): { error: string | null; success: boolean } {
  if (!result?.error) {
    return { error: null, success: true };
  }
  const code = (result as { code?: string })?.code || result.error;
  if (code === "2FA_REQUIRED" || result.error === "2FA_REQUIRED") {
    setShow2FA(true);
    return { error: null, success: false };
  }
  if (code === "INVALID_2FA" || result.error === "INVALID_2FA") {
    return { error: "Invalid 2FA Code. Please try again.", success: false };
  }
  if (code?.includes("SUSPICIOUS_IP_BLOCK") || result.error?.includes("SUSPICIOUS_IP_BLOCK")) {
    return { error: "Login blocked due to suspicious IP detection (VPN/Proxy). Please disable your VPN.", success: false };
  }
  if (code?.includes("SUSPICIOUS_LOGIN_BLOCK") || result.error?.includes("SUSPICIOUS_LOGIN_BLOCK")) {
    return { error: "Geo-suspicious login detected (Impossible Travel). Account security review required.", success: false };
  }
  const errorStr = String(code || result.error);
  if (
    errorStr.includes("CredentialsSignin") ||
    errorStr.includes("Readonly") ||
    errorStr.includes("INVALID_PASSWORD") ||
    errorStr.includes("credentials")
  ) {
    setAttemptCount((prev) => prev + 1);
    const remaining = 5 - (attemptCount + 1);
    const attemptsPlural = remaining !== 1 ? "s" : "";
    const errorMsg = remaining > 0
      ? `Invalid email or password. ${remaining} attempt${attemptsPlural} remaining.`
      : "Account temporarily locked due to too many failed attempts.";
    return { error: errorMsg, success: false };
  }
  return { error: "Invalid email or password. Please try again.", success: false };
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = resolveSafeCallbackUrl(searchParams?.get("callbackUrl"));
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    twoFactorCode: "",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [googleSignInEnabled, setGoogleSignInEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    getProviders()
      .then((providers) => {
        if (active) setGoogleSignInEnabled(Boolean(providers?.google));
      })
      .catch((err) => {
        logger.warn("Failed to load auth providers for login page", { error: err });
        if (active) setGoogleSignInEnabled(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (searchParams?.get("step") === "2fa") {
      setShow2FA(true);
      const emailParam = searchParams.get("email");
      if (emailParam) {
        setFormData((prev) => ({ ...prev, email: emailParam }));
      }
    }
  }, [searchParams]);

  // Show contextual messages from session events
  const reason = searchParams?.get("reason");
  const authError = searchParams?.get("error");
  const registered = searchParams?.get("registered") === "true";
  const sessionMessage = getSessionMessage(registered, reason, authError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    // Client-side Zod Validation
    const validation = loginSchema.safeParse({
      email: formData.email.trim(),
      password: formData.password,
      twoFactorCode: show2FA ? formData.twoFactorCode : "",
    });

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path[0];
        if (typeof path === "string") {
          errors[path] = issue.message;
        }
      });
      setFieldErrors(errors);
      setError("Please fix the validation errors below.");
      return;
    }

    // Client-side lockout: warn after 5 failed attempts
    if (attemptCount >= 5) {
      setError("Too many failed attempts. Please wait a few minutes before trying again.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
        twoFactorCode: show2FA ? formData.twoFactorCode : "",
        redirect: false,
      });

      const processRes = handleSignInResult(result, attemptCount, setAttemptCount, setShow2FA);
      if (processRes.error) {
        setError(processRes.error);
      } else if (processRes.success) {
        setAttemptCount(0);
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err: unknown) {
      const errorMsg = (err instanceof Error ? err.message : String(err)) || (err instanceof Error ? err.name : "Error") || String(err);
      const isExtensionBlock =
        errorMsg.toLowerCase().includes("clientfetcherror") ||
        errorMsg.toLowerCase().includes("failed to fetch") ||
        errorMsg.toLowerCase().includes("frame_ant");

      if (isExtensionBlock) {
        window.location.href = callbackUrl;
        return;
      }

      if (
        errorMsg.includes("CredentialsSignin") ||
        errorMsg.includes("INVALID_PASSWORD") ||
        errorMsg.includes("credentials")
      ) {
        setAttemptCount((prev) => prev + 1);
        const remaining = 5 - (attemptCount + 1);
        const attemptsPlural = remaining !== 1 ? "s" : "";
        setError(
          remaining > 0
            ? `Invalid email or password. ${remaining} attempt${attemptsPlural} remaining.`
            : "Account temporarily locked due to too many failed attempts."
        );
        return;
      }

      if (errorMsg.includes("2FA_REQUIRED")) {
        setShow2FA(true);
        return;
      }

      if (errorMsg.includes("500") || errorMsg.includes("Internal Server Error")) {
        setError("Invalid email or password. Please try again.");
        return;
      }

      setError("Invalid email or password. Please try again.");
      logger.error("[Login] signIn error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      pageTitle="Welcome Back"
      pageSubtitle="Sign in to manage your creator collaborations and escrow payouts"
    >
      {/* Session expiry reason banner */}
      {sessionMessage && (
        <div className="auth-banner mb-6" role="status">
          {sessionMessage}
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="auth-error-banner mb-6"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-form-group">
          <Input
            id="email"
            type="email"
            label="Email Address"
            placeholder="you@example.com"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            required
            autoComplete="email"
            error={fieldErrors.email}
            fullWidth
          />
        </div>

        <div className="auth-form-group mb-6">
          <div className="flex justify-between items-center mb-1.5">
            <label className="label mb-0" htmlFor="password">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold auth-link"
            >
              Forgot password?
            </Link>
          </div>
          <div className="auth-field-relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
              autoComplete="current-password"
              error={fieldErrors.password}
              className="auth-field-password-input"
              fullWidth
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="auth-field-password-toggle"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {show2FA && (
          <div className="auth-form-group mb-6 animate-slide-down">
            <Input
              id="twoFactorCode"
              type="text"
              label="Authenticator App Code (2FA)"
              placeholder="Enter 6-digit code"
              value={formData.twoFactorCode}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  twoFactorCode: e.target.value.replace(/\D/g, ""),
                })
              }
              maxLength={6}
              required
              autoComplete="off"
              error={fieldErrors.twoFactorCode}
              fullWidth
            />
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={isLoading}
          loading={isLoading}
          fullWidth
          className="auth-submit-btn"
        >
          Sign In
        </Button>
      </form>

      {googleSignInEnabled && (
        <>
          <div className="auth-divider-row">
            <div className="auth-divider-line" />
            <span className="auth-divider-text">or continue with</span>
            <div className="auth-divider-line" />
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() => signIn("google", { callbackUrl })}
            fullWidth
            className="auth-google-btn"
            leftIcon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            }
          >
            Sign in with Google
          </Button>
        </>
      )}

      <div className="auth-divider-line mb-4" />

      <p className="auth-footer-text">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="auth-footer-link">
          Sign Up
        </Link>
      </p>
    </AuthLayout>
  );
}
