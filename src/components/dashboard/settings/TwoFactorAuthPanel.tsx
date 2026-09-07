"use client";


import { useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Badge, Button, Input } from "@/components/ui";
import { copyToClipboard } from "@/lib/clipboard";

interface TwoFactorAuthPanelProps {
isSaving: boolean;
setIsSaving: (val: boolean) => void;
showToast: (message: string, type?: "success" | "error" | "info") => void;
}

interface SettingsResponse {
user?: { isTwoFactorEnabled?: boolean };
}

export default function TwoFactorAuthPanel({
  isSaving,
  setIsSaving,
  showToast,
}: Readonly<TwoFactorAuthPanelProps>) {
const { data: settingsData, mutate: refreshSettings } = useSWR<SettingsResponse>("/api/settings", fetcher);
const [override2FA, setOverride2FA] = useState<boolean | null>(null);
const [qrCodeData, setQrCodeData] = useState<{
secret: string;
qrCodeUrl: string;
} | null>(null);
const [setupCode, setSetupCode] = useState("");
const [is2FASetupVisible, setIs2FASetupVisible] = useState(false);
const [disable2FAPassword, setDisable2FAPassword] = useState("");
const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

const is2FAEnabled = override2FA ?? !!settingsData?.user?.isTwoFactorEnabled;

const setIs2FAEnabled = (val: boolean) => {
setOverride2FA(val);
refreshSettings();
};

return (
<div className="flex flex-col gap-6">
{/* Recovery Codes Display shown once after 2FA setup */}
{recoveryCodes.length > 0 && (
<div className="card card-amber-warning">
<div className="flex justify-between items-center mb-3">
<h3 className="text-base font-extrabold text-amber flex items-center gap-2">
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5 text-amber">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
  Save Your Recovery Codes
</h3>
<Button variant="ghost" onClick={() => setRecoveryCodes([])} className="text-xs">I've saved them ✓</Button>
</div>
<p className="text-sm text-secondary mb-3">
These codes can be used to access your account if you lose your authenticator. Each code can only be used once. Store them somewhere safe they won't be shown again.
</p>
<div className="grid gap-2 mb-3 responsive-two-col">
{recoveryCodes.map((code) => (
<div key={code} className="text-sm font-bold bg-tertiary rounded-sm border-card font-mono px-3 py-2 tracking-widest">
{code}
</div>
))}
</div>
<Button
variant="secondary"
aria-label="Copy all recovery codes to clipboard"
onClick={() => copyToClipboard(recoveryCodes.join("\n")).then(() => showToast("Recovery codes copied!", "success"))}
>
Copy All Codes
</Button>
</div>
)}

{/* Two-Factor Authentication */}
<div className="card">
<div
className="flex justify-between items-start mb-4"
>
<div>
<h2
className="text-lg font-bold mb-1 flex items-center gap-2"
>
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5 text-blue-500">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
Two-Factor Authentication
</h2>
<p
className="text-sm text-secondary"
>
Add an extra layer of security to your account.
</p>
</div>
{is2FAEnabled ? (
<Badge variant="success">Enabled</Badge>
) : (
<Badge variant="warning">Disabled</Badge>
)}
</div>

{!is2FAEnabled && !is2FASetupVisible && (
<Button
variant="secondary"
className="w-full"
disabled={isSaving}
onClick={async () => {
  setIsSaving(true);
  try {
    const res = await fetch("/api/user/2fa/setup", {
      method: "POST",
    });
    const data = await res.json();
    if (data.qrCodeUrl) {
      setQrCodeData(data);
      setIs2FASetupVisible(true);
    } else {
      showToast(data.error || "Failed to initiate 2FA setup", "error");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error";
    showToast(msg, "error");
  } finally {
    setIsSaving(false);
  }
}}
>
Enable 2FA
</Button>
)}

{is2FASetupVisible && qrCodeData && !is2FAEnabled && (
<div
className="mt-4 p-4 bg-tertiary rounded-md"
>
<p className="text-sm mb-3">
1. Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy):
</p>
<div
className="flex justify-center mb-4 p-4 rounded-md qr-code-container"
>
<Image
src={qrCodeData.qrCodeUrl}
alt="2FA QR Code"
width={150}
height={150}
unoptimized
/>
</div>
<p
className="text-xs text-muted text-center mb-4"
>
Or enter code manually: {qrCodeData.secret}
</p>
<p className="text-sm mb-2">
2. Enter the 6-digit code from your app to verify setup:
</p>
<div className="flex gap-2">
<Input
id="2fa-setup-code"
type="text"
placeholder="000000"
maxLength={6}
aria-label="6-digit authenticator code"
autoComplete="one-time-code"
inputMode="numeric"
value={setupCode}
onChange={(e) =>
setSetupCode(e.target.value.replace(/\D/g, ""))
}
/>
<Button
variant="primary"
disabled={isSaving}
onClick={async () => {
  if (setupCode.length !== 6) {
    showToast("Enter 6 digit code", "error");
    return;
  }
  setIsSaving(true);
  try {
    const res = await fetch("/api/user/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: setupCode }),
    });
    const data = await res.json();
    if (data.success) {
      setIs2FAEnabled(true);
      setIs2FASetupVisible(false);
      setSetupCode("");
      if (Array.isArray(data.recoveryCodes)) {
        setRecoveryCodes(data.recoveryCodes);
      }
      showToast(
        "Two-Factor Authentication successfully enabled! Save your recovery codes.",
        "success",
      );
    } else {
      showToast(data.error || "Invalid code", "error");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error";
    showToast(msg, "error");
  } finally {
    setIsSaving(false);
  }
}}
>
Verify & Enable
</Button>
</div>
</div>
)}

{is2FAEnabled && (
<div
className="mt-4 p-4 bg-tertiary rounded-md"
>
<p className="text-sm mb-3">
To disable 2FA, please enter your current password:
</p>
<div
className="flex gap-2 flex-col"
>
<Input
id="disable-2fa-password"
type="password"
placeholder="Current Password"
aria-label="Current password to disable two-factor authentication"
autoComplete="current-password"
value={disable2FAPassword}
onChange={(e) => setDisable2FAPassword(e.target.value)}
fullWidth
/>
<Button
variant="danger"
disabled={isSaving}
onClick={async () => {
  if (!disable2FAPassword) {
    showToast("Password required", "error");
    return;
  }
  setIsSaving(true);
  try {
    const res = await fetch("/api/user/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: disable2FAPassword,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setIs2FAEnabled(false);
      setDisable2FAPassword("");
      showToast(
        "Two-Factor Authentication successfully disabled.",
        "success",
      );
    } else {
      showToast(data.error || "Failed to disable 2FA", "error");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error";
    showToast(msg, "error");
  } finally {
    setIsSaving(false);
  }
}}
>
Disable 2FA
</Button>
</div>
</div>
)}
</div>
</div>
);
}
