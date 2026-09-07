"use client";


import { logger } from "@/lib/logger-client";
import { useState } from "react";
import type { User } from "./ProfileTab";
import { Button, Input } from "@/components/ui";
import { passwordChangeSchema } from "@/lib/validations/auth";

interface PasswordPanelProps {
user: User;
isSaving: boolean;
setIsSaving: (val: boolean) => void;
showToast: (message: string, type?: "success" | "error" | "info") => void;
}

function validatePasswordChange(
  passwordData: { currentPassword: string; newPassword: string; confirmPassword: string },
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

type ForgotPasswordStep = 'method' | 'otp' | 'new_password';
type ForgotPasswordMethod = 'email' | 'phone' | null;

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
}>({ active: false, step: 'method', method: null, otp: '' });

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

const valErr = validatePasswordChange(passwordData, forgotPasswordState.active);
if (valErr) {
setPasswordError(valErr);
return;
}

setIsSaving(true);

type OtpType = 'email' | 'phone' | null;

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
const res = await fetch("/api/auth/change-password", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(body),
});
const data = await res.json();
if (res.ok) {
setPasswordSuccess("Password updated successfully!");
setPasswordData({
currentPassword: "",
newPassword: "",
confirmPassword: "",
});
} else {
setPasswordError(data.error || "Failed to update password");
}
} catch (_error) {
logger.error("Password change error:", _error);
setPasswordError("An error occurred");
} finally {
setIsSaving(false);
if (forgotPasswordState.active) {
setForgotPasswordState({ active: false, step: 'method', method: null, otp: '' });
}
}
};

const handleSendForgotPasswordOtp = async (method: 'email' | 'phone') => {
setIsSaving(true);
setPasswordError("");
setPasswordSuccess("");
setForgotPasswordState(prev => ({ ...prev, method, active: true }));

const contact = method === 'email' ? user?.email : user?.phone;

if (!contact) {
setPasswordError(`No ${method} associated with this account`);
setIsSaving(false);
return;
}

try {
const res = await fetch("/api/user/send-otp", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
type: method,
contact: contact
}),
});
const data = await res.json();
if (res.ok) {
setForgotPasswordState(prev => ({ ...prev, method, step: 'otp', active: true }));
setPasswordSuccess(`OTP sent to your ${method}`);
} else {
setPasswordError(data.error || "Failed to send OTP");
setForgotPasswordState({ active: false, step: 'method', method: null, otp: '' });
}
} catch (_err) {
logger.error("Forgot password OTP send error:", _err);
setPasswordError("Network error. Please try again.");
setForgotPasswordState({ active: false, step: 'method', method: null, otp: '' });
} finally {
setIsSaving(false);
}
};

const setCurrentPassword = (val: string) => {
setPasswordData(prev => ({ ...prev, currentPassword: val }));
};

return (
<div className="card">
<h2
className="text-xl font-bold mb-6"
>
Change Password
</h2>

{passwordSuccess && (
<div
role="status"
aria-live="polite"
className="p-3 mb-4 bg-emerald-subtle rounded-sm text-emerald settings-alert"
data-tone="success"
>
{passwordSuccess}
</div>
)}

{passwordError && (
<div
role="alert"
aria-live="assertive"
className="p-3 mb-4 rounded-sm text-rose bg-rose-subtle settings-alert"
data-tone="danger"
>
{passwordError}
</div>
)}

<form onSubmit={handlePasswordChange}>
<ForgotPasswordSection
forgotPasswordState={forgotPasswordState}
setForgotPasswordState={setForgotPasswordState}
handleSendForgotPasswordOtp={handleSendForgotPasswordOtp}
isSaving={isSaving}
user={user}
/>

{!forgotPasswordState.active && (
<CurrentPasswordSection
passwordConfirmPending={passwordConfirmPending}
setForgotPasswordState={setForgotPasswordState}
showPassword={showPassword}
setShowPassword={setShowPassword}
currentPassword={passwordData.currentPassword}
setCurrentPassword={setCurrentPassword}
/>
)}

{(!forgotPasswordState.active || forgotPasswordState.step === 'otp') && (
<>
<div className="mb-5">
<label className="label mb-2 block" htmlFor="new-password-input">New Password</label>
<div className="relative flex items-center">
<Input
id="new-password-input"
type={showPassword.new ? "text" : "password"}
value={passwordData.newPassword}
onChange={(e) =>
setPasswordData({
...passwordData,
newPassword: e.target.value,
})
}
required
fullWidth
className="pr-10"
/>
<button
type="button"
aria-label={showPassword.new ? "Hide new password" : "Show new password"}
onClick={() =>
setShowPassword({
...showPassword,
new: !showPassword.new,
})
}
className="password-eye-button"
>
{showPassword.new ? (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
) : (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a19.16 19.16 0 0 1 5.44-5.44M1 1l22 22" />
    <path d="M12 12A3 3 0 0 0 12 6c-.34 0-.67.04-1 .12" />
    <path d="M21.54 15A10 10 0 0 0 22 13c0 0-3-7-10-7-1.7 0-3.2.43-4.53 1.15" />
  </svg>
)}
</button>
</div>
</div>

<div className="mb-6">
<label className="label mb-2 block" htmlFor="confirm-password-input">Confirm New Password</label>
<div className="relative flex items-center">
<Input
id="confirm-password-input"
type={showPassword.confirm ? "text" : "password"}
value={passwordData.confirmPassword}
onChange={(e) =>
setPasswordData({
...passwordData,
confirmPassword: e.target.value,
})
}
required
fullWidth
className="pr-10"
/>
<button
type="button"
aria-label={showPassword.confirm ? "Hide confirm password" : "Show confirm password"}
onClick={() =>
setShowPassword({
...showPassword,
confirm: !showPassword.confirm,
})
}
className="password-eye-button"
>
{showPassword.confirm ? (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
) : (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a19.16 19.16 0 0 1 5.44-5.44M1 1l22 22" />
    <path d="M12 12A3 3 0 0 0 12 6c-.34 0-.67.04-1 .12" />
    <path d="M21.54 15A10 10 0 0 0 22 13c0 0-3-7-10-7-1.7 0-3.2.43-4.53 1.15" />
  </svg>
)}
</button>
</div>
</div>

{passwordConfirmPending ? (
<div className="flex flex-col gap-2 p-3 rounded-md password-confirm-card">
<p className="text-sm font-semibold text-rose flex items-center gap-2">
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-rose">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
  Are you sure you want to update your password?
</p>
<div className="flex flex-col sm:flex-row gap-2">
<Button type="submit" variant="danger" className="flex-1" disabled={isSaving}>
{isSaving ? <span className="loading" /> : "Yes, Update Password"}
</Button>
<Button type="button" variant="secondary" className="flex-1" onClick={() => setPasswordConfirmPending(false)}>
Cancel
</Button>
</div>
</div>
) : (
<Button
type="submit"
variant="primary"
disabled={isSaving}
className="w-full"
>
{isSaving ? <span className="loading" /> : "Update Password"}
</Button>
)}
</>
)}
</form>
</div>
);
}

// ==================== SUBCOMPONENTS ====================

interface ForgotPasswordSectionProps {
readonly forgotPasswordState: {
readonly active: boolean;
readonly step: ForgotPasswordStep;
readonly method: ForgotPasswordMethod;
readonly otp: string;
};
readonly setForgotPasswordState: React.Dispatch<React.SetStateAction<{
active: boolean;
step: ForgotPasswordStep;
method: ForgotPasswordMethod;
otp: string;
}>>;
readonly handleSendForgotPasswordOtp: (method: 'email' | 'phone') => void;
readonly isSaving: boolean;
readonly user: User;
}

function ForgotPasswordSection({
forgotPasswordState,
setForgotPasswordState,
handleSendForgotPasswordOtp,
isSaving,
user,
}: ForgotPasswordSectionProps) {
if (!forgotPasswordState.active) return null;
return (
<div className="mb-5 flex flex-col gap-2.5">
{forgotPasswordState.step === 'method' && (
<>
<p className="text-sm text-secondary">Choose where to send the OTP:</p>
<div className="flex flex-col sm:flex-row gap-3">
<Button type="button" variant="secondary" onClick={() => handleSendForgotPasswordOtp('email')} disabled={isSaving || !user?.email} className="flex-1">{user?.email ? "Send to Email" : "No Email Added"}</Button>
<Button type="button" variant="secondary" onClick={() => handleSendForgotPasswordOtp('phone')} disabled={isSaving || !user?.phone} className="flex-1">{user?.phone ? "Send to Phone" : "No Phone Added"}</Button>
</div>
<Button type="button" className="text-muted text-sm cursor-pointer border-none bg-none settings-link-button" onClick={() => setForgotPasswordState({ active: false, step: 'method', method: null, otp: '' })}>Cancel</Button>
</>
)}
{forgotPasswordState.step === 'otp' && (
<>
<Input
label={`Enter OTP sent to your ${forgotPasswordState.method}`}
id="otp-input"
type="text"
placeholder="e.g. 123456"
value={forgotPasswordState.otp}
onChange={(e) => setForgotPasswordState(prev => ({ ...prev, otp: e.target.value }))}
required
autoComplete="one-time-code"
fullWidth
/>
<Button type="button" className="text-muted text-sm cursor-pointer border-none bg-none settings-link-button self-start" onClick={() => setForgotPasswordState({ active: false, step: 'method', method: null, otp: '' })}>Cancel Reset</Button>
</>
)}
</div>
);
}

interface CurrentPasswordSectionProps {
readonly passwordConfirmPending: boolean;
readonly setForgotPasswordState: React.Dispatch<React.SetStateAction<{
active: boolean;
step: 'method' | 'otp' | 'new_password';
method: 'email' | 'phone' | null;
otp: string;
}>>;
readonly showPassword: { current: boolean };
readonly setShowPassword: React.Dispatch<React.SetStateAction<{ current: boolean; new: boolean; confirm: boolean }>>;
readonly currentPassword: string;
readonly setCurrentPassword: (val: string) => void;
}

function CurrentPasswordSection({
passwordConfirmPending: _confirmPending,
setForgotPasswordState,
showPassword,
setShowPassword,
currentPassword,
setCurrentPassword,
}: CurrentPasswordSectionProps) {
return (
<div className="mb-5">
<div className="flex justify-between items-center mb-2">
<label className="label mb-0" htmlFor="current-password-input">Current Password</label>
<Button
type="button"
variant="ghost"
onClick={() => setForgotPasswordState({ active: true, step: 'method', method: null, otp: '' })}
className="text-xs font-semibold cursor-pointer border-none text-primary-light p-0 bg-none hover:underline"
>
Forgot Password?
</Button>
</div>
<div className="relative flex items-center">
<Input
id="current-password-input"
type={showPassword.current ? "text" : "password"}
value={currentPassword}
onChange={(e) => setCurrentPassword(e.target.value)}
required
fullWidth
className="pr-10"
/>
<button
type="button"
aria-label={showPassword.current ? "Hide current password" : "Show current password"}
onClick={() =>
setShowPassword(prev => ({
...prev,
current: !prev.current,
}))
}
className="password-eye-button"
>
{showPassword.current ? (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
) : (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a19.16 19.16 0 0 1 5.44-5.44M1 1l22 22" />
    <path d="M12 12A3 3 0 0 0 12 6c-.34 0-.67.04-1 .12" />
    <path d="M21.54 15A10 10 0 0 0 22 13c0 0-3-7-10-7-1.7 0-3.2.43-4.53 1.15" />
  </svg>
)}
</button>
</div>
</div>
);
}
