"use client";

import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { logger } from "@/lib/logger-client";
import { useState } from "react";
import type { User } from "./ProfileTab";
import { Button, Input } from "@/components/ui";
import {
  ShieldCheck,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";

interface ContactVerificationPanelProps {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  isSaving: boolean;
  setIsSaving: (val: boolean) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export default function ContactVerificationPanel({
  user,
  setUser,
  isSaving,
  setIsSaving,
  showToast,
}: Readonly<ContactVerificationPanelProps>) {
  // verifyContactState manages initial verification of unverified email/phone records.
  const [verifyContactState, setVerifyContactState] = useState<{
    type: "email" | "phone" | null;
    step: "idle" | "code" | "input";
  }>({ type: null, step: "idle" });
  const [contactVerifyCode, setContactVerifyCode] = useState("");
  const [pendingContact, setPendingContact] = useState("");

  // changeContactState manages the re-verification pipeline when modifying an already-verified email or phone number.
  const [changeContactState, setChangeContactState] = useState<{
    active: boolean;
    type: "email" | "phone" | null;
    step: "idle" | "verify-current" | "enter-new" | "verify-new";
    currentEmailOtp: string;
    currentPhoneOtp: string;
    newContact: string;
    newOtp: string;
  }>({
    active: false,
    type: null,
    step: "idle",
    currentEmailOtp: "",
    currentPhoneOtp: "",
    newContact: "",
    newOtp: "",
  });

  const handleStartContactChange = async (type: "email" | "phone") => {
    if (!user?.email && !user?.phone) {
      showToast(
        "No available contact method to verify. Please contact support.",
        "error"
      );
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.users.changeContact({ action: "init" });
      setChangeContactState((prev) => ({
        ...prev,
        active: true,
        type,
        step: "verify-current",
      }));
    } catch (err: unknown) {
      logger.error("[change-contact] start contact change error:", err);
      showToast(
        formatUserError(
          err,
          "Unable to initiate contact change. Please try again."
        ),
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyCurrentContacts = async () => {
    if (user?.email && !changeContactState.currentEmailOtp) {
      showToast("Please enter the Email OTP", "error");
      return;
    }
    if (user?.phone && !changeContactState.currentPhoneOtp) {
      showToast("Please enter the Phone OTP", "error");
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.users.changeContact({
        action: "verify-current",
        currentEmailOtp: changeContactState.currentEmailOtp || undefined,
        currentPhoneOtp: changeContactState.currentPhoneOtp || undefined,
      });
      setChangeContactState((prev) => ({ ...prev, step: "enter-new" }));
    } catch (err: unknown) {
      logger.error("[change-contact] verify current error:", err);
      showToast(
        formatUserError(
          err,
          "Verification failed. Please check the code and try again."
        ),
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendNewContactOtp = async () => {
    if (!changeContactState.newContact) {
      showToast(`Please enter your new ${changeContactState.type}`, "error");
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.users.changeContact({
        action: "send-new",
        type: changeContactState.type,
        newContact: changeContactState.newContact,
      });
      setChangeContactState((prev) => ({ ...prev, step: "verify-new" }));
      showToast(`OTP sent to new ${changeContactState.type}`, "success");
    } catch (err: unknown) {
      logger.error("[change-contact] send new OTP error:", err);
      showToast(
        formatUserError(err, "Failed to send OTP. Please try again."),
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmNewContact = async () => {
    if (!changeContactState.newOtp) {
      showToast("Please enter the OTP", "error");
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.users.changeContact({
        action: "confirm-new",
        type: changeContactState.type,
        newContact: changeContactState.newContact,
        newOtp: changeContactState.newOtp,
      });
      showToast(`${changeContactState.type} updated successfully!`, "success");
      setChangeContactState({
        active: false,
        type: null,
        step: "idle",
        currentEmailOtp: "",
        currentPhoneOtp: "",
        newContact: "",
        newOtp: "",
      });
      window.location.reload(); // Refresh to reflect new session data
    } catch (err: unknown) {
      logger.error("[change-contact] confirm new contact error:", err);
      showToast(
        formatUserError(
          err,
          "Failed to confirm contact change. Please check the code and try again."
        ),
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderEmailAction = () => {
    if (user?.emailVerified && user?.email) {
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={isSaving}
            className="text-xs font-semibold"
            onClick={() => handleStartContactChange("email")}
          >
            Change
          </Button>
        </div>
      );
    }
    if (
      verifyContactState.type === "email" &&
      verifyContactState.step === "code"
    ) {
      return (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            id="email-verify-code"
            placeholder="Enter OTP"
            aria-label="Email verification code"
            className="text-xs w-28"
            value={contactVerifyCode}
            onChange={(e) => setContactVerifyCode(e.target.value)}
          />
          <Button
            variant="primary"
            size="sm"
            disabled={isSaving}
            onClick={async () => {
              setIsSaving(true);
              try {
                await apiClient.users.verifyContact({
                  type: "email",
                  code: contactVerifyCode,
                });
                showToast("Email Verified!", "success");
                setVerifyContactState({ type: null, step: "idle" });
                setContactVerifyCode("");
                setUser((prev) =>
                  prev ? { ...prev, emailVerified: true } : null
                );
              } catch (err: unknown) {
                showToast(
                  formatUserError(
                    err,
                    "Email verification failed. Please check the code and try again."
                  ),
                  "error"
                );
              } finally {
                setIsSaving(false);
              }
            }}
            className="text-xs font-bold"
          >
            Verify
          </Button>
        </div>
      );
    }
    return (
      <Button
        variant="primary"
        size="sm"
        disabled={isSaving}
        onClick={async () => {
          if (!user?.email) {
            showToast("No email found to verify.", "error");
            return;
          }
          setIsSaving(true);
          try {
            await apiClient.users.sendOtp({
              type: "email",
              contact: user.email,
            });
            showToast(`Verification code sent to ${user.email}`, "success");
            setVerifyContactState({ type: "email", step: "code" });
          } catch (err: unknown) {
            showToast(
              formatUserError(
                err,
                "Failed to send verification code. Please try again."
              ),
              "error"
            );
          } finally {
            setIsSaving(false);
          }
        }}
        className="text-xs font-bold"
      >
        Verify Email
      </Button>
    );
  };

  const renderPhoneAction = () => {
    if (user?.phoneVerified && user?.phone) {
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={isSaving}
            className="text-xs font-semibold"
            onClick={() => handleStartContactChange("phone")}
          >
            Change
          </Button>
        </div>
      );
    }
    if (
      verifyContactState.type === "phone" &&
      verifyContactState.step === "code"
    ) {
      return (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            id="phone-verify-code"
            placeholder="Enter OTP"
            aria-label="Phone verification code"
            className="text-xs w-28"
            value={contactVerifyCode}
            onChange={(e) => setContactVerifyCode(e.target.value)}
          />
          <Button
            variant="primary"
            size="sm"
            disabled={isSaving}
            onClick={async () => {
              setIsSaving(true);
              try {
                await apiClient.users.verifyContact({
                  type: "phone",
                  code: contactVerifyCode,
                });
                showToast("Phone Verified!", "success");
                setVerifyContactState({ type: null, step: "idle" });
                setContactVerifyCode("");
                setUser((prev) => {
                  if (!prev) return null;
                  const nextUser = { ...prev, phoneVerified: true };
                  const p = pendingContact || prev.phone;
                  if (p) nextUser.phone = p;
                  return nextUser;
                });
              } catch (err: unknown) {
                showToast(
                  formatUserError(
                    err,
                    "Phone verification failed. Please check the code and try again."
                  ),
                  "error"
                );
              } finally {
                setIsSaving(false);
              }
            }}
            className="text-xs font-bold"
          >
            Verify
          </Button>
        </div>
      );
    }
    if (
      verifyContactState.type === "phone" &&
      verifyContactState.step === "input"
    ) {
      return (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            aria-label="Phone number with country code"
            placeholder="e.g. 9876543210"
            className="text-xs w-36"
            value={pendingContact}
            onChange={(e) => setPendingContact(e.target.value)}
          />
          <Button
            variant="primary"
            size="sm"
            disabled={isSaving}
            onClick={async () => {
              if (pendingContact) {
                setIsSaving(true);
                try {
                  await apiClient.users.sendOtp({
                    type: "phone",
                    contact: pendingContact,
                  });
                  showToast(`OTP sent to ${pendingContact}`, "success");
                  setVerifyContactState({ type: "phone", step: "code" });
                } catch (err: unknown) {
                  showToast(
                    formatUserError(
                      err,
                      "Failed to send OTP. Please try again."
                    ),
                    "error"
                  );
                } finally {
                  setIsSaving(false);
                }
              }
            }}
            className="text-xs font-bold"
          >
            {isSaving ? "..." : "Send OTP"}
          </Button>
        </div>
      );
    }
    return (
      <Button
        variant="primary"
        size="sm"
        disabled={isSaving}
        onClick={() => {
          setPendingContact("");
          setVerifyContactState({ type: "phone", step: "input" });
        }}
        className="text-xs font-bold"
      >
        Add &amp; Verify
      </Button>
    );
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Contact Authentication
            </h3>
            <p className="text-xs text-muted-foreground">
              Required for two-factor security challenges, password recovery, and escrow alerts
            </p>
          </div>
        </div>

        <div>
          {user?.emailVerified && user?.phoneVerified ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-verified bg-verified-muted px-2.5 py-1 rounded-full border border-verified-border">
              <CheckCircle2 className="w-3.5 h-3.5" /> All Contacts Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-pending bg-pending-muted px-2.5 py-1 rounded-full border border-pending-border">
              <Clock className="w-3.5 h-3.5" /> Action Recommended
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {/* Email Row */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-muted/30 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-card border border-border text-primary shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Email Address</div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">
                {user?.email || "No email address linked"}
              </div>
            </div>
          </div>
          <div>{renderEmailAction()}</div>
        </div>

        {/* Phone Row */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-muted/30 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-card border border-border text-primary shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Mobile Phone (SMS OTP)</div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">
                {user?.phone ? `+91 ${user.phone}` : "Required for milestone payout calls & SMS"}
              </div>
            </div>
          </div>
          <div>{renderPhoneAction()}</div>
        </div>
      </div>

      {/* Change Contact Inline Drawer */}
      {changeContactState.active && (
        <div className="p-4 sm:p-5 bg-muted/40 rounded-2xl border border-border space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <h4 className="text-sm font-bold text-foreground">
              Update {changeContactState.type === "email" ? "Email Address" : "Phone Number"}
            </h4>
            <button
              type="button"
              aria-label="Dismiss contact change dialog"
              className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              onClick={() =>
                setChangeContactState({
                  active: false,
                  type: null,
                  step: "idle",
                  currentEmailOtp: "",
                  currentPhoneOtp: "",
                  newContact: "",
                  newOtp: "",
                })
              }
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {changeContactState.step === "verify-current" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                To protect your account, we have sent a verification code to your current contact method(s). Please enter the OTP to continue.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {user?.email && (
                  <Input
                    id="verify-current-email-otp"
                    label="Current Email OTP"
                    type="text"
                    placeholder="e.g. 123456"
                    value={changeContactState.currentEmailOtp}
                    onChange={(e) =>
                      setChangeContactState({
                        ...changeContactState,
                        currentEmailOtp: e.target.value,
                      })
                    }
                    fullWidth
                  />
                )}
                {user?.phone && (
                  <Input
                    id="verify-current-phone-otp"
                    label="Current Phone OTP"
                    type="text"
                    placeholder="e.g. 123456"
                    value={changeContactState.currentPhoneOtp}
                    onChange={(e) =>
                      setChangeContactState({
                        ...changeContactState,
                        currentPhoneOtp: e.target.value,
                      })
                    }
                    fullWidth
                  />
                )}
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleVerifyCurrentContacts}
                  disabled={isSaving}
                  className="text-xs font-bold"
                >
                  Verify &amp; Continue
                </Button>
              </div>
            </div>
          )}

          {changeContactState.step === "enter-new" && (
            <div className="space-y-3">
              <Input
                id="verify-new-contact"
                label={`Enter your new ${changeContactState.type}`}
                type={changeContactState.type === "email" ? "email" : "text"}
                placeholder={`New ${changeContactState.type}`}
                value={changeContactState.newContact}
                onChange={(e) =>
                  setChangeContactState({
                    ...changeContactState,
                    newContact: e.target.value,
                  })
                }
                fullWidth
              />
              <div className="flex justify-end pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSendNewContactOtp}
                  disabled={isSaving}
                  className="text-xs font-bold"
                >
                  Send OTP to New {changeContactState.type}
                </Button>
              </div>
            </div>
          )}

          {changeContactState.step === "verify-new" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                We sent a 6-digit OTP to <strong>{changeContactState.newContact}</strong>.
              </p>
              <Input
                id="verify-new-contact-otp"
                label="Enter 6-Digit OTP"
                type="text"
                placeholder="e.g. 123456"
                value={changeContactState.newOtp}
                onChange={(e) =>
                  setChangeContactState({
                    ...changeContactState,
                    newOtp: e.target.value,
                  })
                }
                fullWidth
              />
              <div className="flex justify-end pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmNewContact}
                  disabled={isSaving}
                  className="text-xs font-bold"
                >
                  Confirm &amp; Save
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
