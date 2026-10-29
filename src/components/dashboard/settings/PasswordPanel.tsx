"use client";

import { useState } from "react";
import { logger } from "@/lib/logger-client";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import type { User } from "./ProfileTab";
import { Button, Input } from "@/components/ui";
import { passwordChangeSchema } from "@/lib/validations/auth";
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";

interface PasswordPanelProps {
  user: User;
  isSaving: boolean;
  setIsSaving: (val: boolean) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

function validatePasswordChange(
  passwordData: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  },
  isForgotPasswordFlow: boolean
) {
  if (isForgotPasswordFlow) {
    if (!passwordData.newPassword || passwordData.newPassword.length < 8) {
      return "New password must be at least 8 characters long";
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return "Passwords do not match";
    }
    return null;
  }

  const result = passwordChangeSchema.safeParse({
    currentPassword: passwordData.currentPassword,
    newPassword: passwordData.newPassword,
    confirmNewPassword: passwordData.confirmPassword,
  });
  if (!result.success) {
    return result.error.issues[0]?.message || "Invalid password data";
  }
  return null;
}

type ForgotPasswordStep = "method" | "otp" | "new_password";
type ForgotPasswordMethod = "email" | "phone" | null;

export default function PasswordPanel({
  user,
  isSaving,
  setIsSaving,
  showToast: _showToast,
}: Readonly<PasswordPanelProps>) {
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Forgot Password State
  const [forgotPasswordState, setForgotPasswordState] = useState<{
    active: boolean;
    step: ForgotPasswordStep;
    method: ForgotPasswordMethod;
    otp: string;
  }>({ active: false, step: "method", method: null, otp: "" });

  const [passwordConfirmPending, setPasswordConfirmPending] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordConfirmPending) {
      setPasswordConfirmPending(true);
      return;
    }
    setPasswordConfirmPending(false);
    setPasswordError("");
    setPasswordSuccess("");

    const valErr = validatePasswordChange(
      passwordData,
      forgotPasswordState.active
    );
    if (valErr) {
      setPasswordError(valErr);
      return;
    }

    setIsSaving(true);

    type OtpType = "email" | "phone" | null;

    interface ChangePasswordRequest {
      newPassword: string;
      otpType?: OtpType;
      otpCode?: string;
      oldPassword?: string;
    }

    const body: ChangePasswordRequest = {
      newPassword: passwordData.newPassword,
    };

    if (forgotPasswordState.active) {
      body.otpType = forgotPasswordState.method;
      body.otpCode = forgotPasswordState.otp;
    } else {
      body.oldPassword = passwordData.currentPassword;
    }

    try {
      const data = (await apiClient.users.changePassword(body)) as {
        success?: boolean;
        error?: string;
      };
      if (data.success !== false) {
        setPasswordSuccess("Password updated successfully!");
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        setPasswordError(data.error || "Failed to update password");
      }
    } catch (err) {
      logger.error("Password change error:", err);
      setPasswordError(
        formatUserError(
          err,
          "Unable to update password. Please check your current password and try again."
        )
      );
    } finally {
      setIsSaving(false);
      if (forgotPasswordState.active) {
        setForgotPasswordState({
          active: false,
          step: "method",
          method: null,
          otp: "",
        });
      }
    }
  };

  const handleSendForgotPasswordOtp = async (method: "email" | "phone") => {
    setIsSaving(true);
    setPasswordError("");
    setPasswordSuccess("");
    setForgotPasswordState((prev) => ({ ...prev, method, active: true }));

    const contact = method === "email" ? user?.email : user?.phone;

    if (!contact) {
      setPasswordError(`No ${method} associated with this account`);
      setIsSaving(false);
      return;
    }

    try {
      const data = (await apiClient.users.sendOtp({
        type: method,
        value: contact,
      })) as { success?: boolean; error?: string };
      if (data.success !== false) {
        setForgotPasswordState((prev) => ({
          ...prev,
          method,
          step: "otp",
          active: true,
        }));
        setPasswordSuccess(`OTP sent to your ${method}`);
      } else {
        setPasswordError(data.error || "Failed to send OTP");
        setForgotPasswordState({
          active: false,
          step: "method",
          method: null,
          otp: "",
        });
      }
    } catch (err) {
      logger.error("Forgot password OTP send error:", err);
      setPasswordError(
        formatUserError(
          err,
          "Unable to send verification OTP. Please try again."
        )
      );
      setForgotPasswordState({
        active: false,
        step: "method",
        method: null,
        otp: "",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Password &amp; Credentials
            </h3>
            <p className="text-xs text-muted-foreground">
              Ensure your account is protected with a strong password (minimum 8 characters)
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border">
          <ShieldCheck className="w-3.5 h-3.5" /> Bcrypt Hashed
        </span>
      </div>

      {passwordSuccess && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-verified-muted text-verified border border-verified-border text-xs font-semibold flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{passwordSuccess}</span>
        </div>
      )}

      {passwordError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-disputed-muted text-disputed border border-disputed-border text-xs font-semibold flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{passwordError}</span>
        </div>
      )}

      <form onSubmit={handlePasswordChange} className="space-y-4">
        {/* Forgot Password OTP flow */}
        {forgotPasswordState.active && (
          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3 animate-in fade-in duration-200">
            {forgotPasswordState.step === "method" && (
              <>
                <span className="text-xs font-bold text-foreground block">
                  Select verification destination to reset password:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSendForgotPasswordOtp("email")}
                    disabled={isSaving || !user?.email}
                    className="text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {user?.email ? "Send OTP to Email" : "No Email Added"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSendForgotPasswordOtp("phone")}
                    disabled={isSaving || !user?.phone}
                    className="text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {user?.phone ? "Send OTP to Mobile" : "No Mobile Added"}
                  </Button>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setForgotPasswordState({
                        active: false,
                        step: "method",
                        method: null,
                        otp: "",
                      })
                    }
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel Reset
                  </button>
                </div>
              </>
            )}

            {forgotPasswordState.step === "otp" && (
              <div className="space-y-3">
                <Input
                  label={`Enter OTP sent to your ${forgotPasswordState.method}`}
                  id="otp-input"
                  type="text"
                  placeholder="e.g. 123456"
                  value={forgotPasswordState.otp}
                  onChange={(e) =>
                    setForgotPasswordState((prev) => ({
                      ...prev,
                      otp: e.target.value,
                    }))
                  }
                  required
                  autoComplete="one-time-code"
                  fullWidth
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setForgotPasswordState({
                        active: false,
                        step: "method",
                        method: null,
                        otp: "",
                      })
                    }
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Current Password Field (when not in forgot-password flow) */}
        {!forgotPasswordState.active && (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label
                htmlFor="current-password-input"
                className="text-xs font-bold text-foreground"
              >
                Current Password
              </label>
              <button
                type="button"
                onClick={() =>
                  setForgotPasswordState({
                    active: true,
                    step: "method",
                    method: null,
                    otp: "",
                  })
                }
                className="text-xs font-semibold text-primary hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative flex items-center">
              <Input
                id="current-password-input"
                type={showPassword.current ? "text" : "password"}
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData((prev) => ({
                    ...prev,
                    currentPassword: e.target.value,
                  }))
                }
                placeholder="Enter current password"
                required
                fullWidth
                className="pr-10"
              />
              <button
                type="button"
                aria-label={
                  showPassword.current
                    ? "Hide current password"
                    : "Show current password"
                }
                onClick={() =>
                  setShowPassword((prev) => ({
                    ...prev,
                    current: !prev.current,
                  }))
                }
                className="absolute right-3 p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword.current ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* New Password & Confirm Password */}
        {(!forgotPasswordState.active || forgotPasswordState.step === "otp") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="new-password-input"
                className="text-xs font-bold text-foreground block mb-1.5"
              >
                New Password
              </label>
              <div className="relative flex items-center">
                <Input
                  id="new-password-input"
                  type={showPassword.new ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({
                      ...prev,
                      newPassword: e.target.value,
                    }))
                  }
                  placeholder="At least 8 characters"
                  required
                  fullWidth
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={
                    showPassword.new
                      ? "Hide new password"
                      : "Show new password"
                  }
                  onClick={() =>
                    setShowPassword((prev) => ({
                      ...prev,
                      new: !prev.new,
                    }))
                  }
                  className="absolute right-3 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword.new ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password-input"
                className="text-xs font-bold text-foreground block mb-1.5"
              >
                Confirm New Password
              </label>
              <div className="relative flex items-center">
                <Input
                  id="confirm-password-input"
                  type={showPassword.confirm ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  placeholder="Re-enter new password"
                  required
                  fullWidth
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={
                    showPassword.confirm
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  onClick={() =>
                    setShowPassword((prev) => ({
                      ...prev,
                      confirm: !prev.confirm,
                    }))
                  }
                  className="absolute right-3 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword.confirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action / Confirmation Box */}
        {passwordConfirmPending ? (
          <div className="p-4 rounded-xl bg-disputed-muted/50 border border-disputed-border space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-disputed text-xs font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Are you sure you want to update your password?</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPasswordConfirmPending(false)}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                size="sm"
                disabled={isSaving}
                className="text-xs font-bold"
              >
                {isSaving ? "Updating..." : "Yes, Update Password"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSaving}
              aria-busy={isSaving}
              className="text-xs font-bold px-5"
            >
              {isSaving ? "Saving..." : "Update Password"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
