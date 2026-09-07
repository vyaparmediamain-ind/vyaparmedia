"use client";


import { logger } from "@/lib/logger-client";
import { useState } from "react";
import type { User } from "./ProfileTab";
import { Button, Input } from "@/components/ui";

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
type: 'email' | 'phone' | null;
step: 'idle' | 'input' | 'code';
}>({ type: null, step: 'idle' });
const [contactVerifyCode, setContactVerifyCode] = useState("");
const [pendingContact, setPendingContact] = useState("");

// changeContactState controls the secure multi-stage contact change workflow:
// 1. 'verify-current': Verifies OTPs sent to current active communication channels to prove identity.
// 2. 'enter-new': Accepts the desired new email or phone number.
// 3. 'verify-new': Sends and verifies an OTP on the new channel to ensure it is active before commit.
const [changeContactState, setChangeContactState] = useState<{
active: boolean;
type: 'email' | 'phone' | null;
step: 'idle' | 'verify-current' | 'enter-new' | 'verify-new';
currentEmailOtp: string;
currentPhoneOtp: string;
newContact: string;
newOtp: string;
}>({
active: false,
type: null,
step: 'idle',
currentEmailOtp: '',
currentPhoneOtp: '',
newContact: '',
newOtp: '',
});

const handleStartContactChange = async (type: 'email' | 'phone') => {
if (!user?.email && !user?.phone) {
showToast("No available contact method to verify. Please contact support.", "error");
return;
}
setIsSaving(true);
try {
const res = await fetch("/api/user/change-contact", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ action: "init" }),
});
const data = await res.json();
if (res.ok) {
setChangeContactState(prev => ({ ...prev, active: true, type, step: 'verify-current' }));
} else {
showToast(data.error || "Failed to initiate contact change", "error");
}
} catch (err: unknown) {
logger.error("[change-contact] start contact change error:", err);
showToast("Network error.", "error");
} finally {
setIsSaving(false);
}
};

const handleVerifyCurrentContacts = async () => {
if (user?.email && !changeContactState.currentEmailOtp) {
showToast("Please enter the Email OTP", "error"); return;
}
if (user?.phone && !changeContactState.currentPhoneOtp) {
showToast("Please enter the Phone OTP", "error"); return;
}
setIsSaving(true);
try {
const res = await fetch("/api/user/change-contact", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
action: "verify-current",
currentEmailOtp: changeContactState.currentEmailOtp || undefined,
currentPhoneOtp: changeContactState.currentPhoneOtp || undefined
}),
});
const data = await res.json();
if (res.ok) {
setChangeContactState(prev => ({ ...prev, step: 'enter-new' }));
} else {
showToast(data.error || "Invalid OTP(s)", "error");
}
} catch (err: unknown) {
logger.error("[change-contact] verify current error:", err);
showToast("Network error", "error");
} finally {
setIsSaving(false);
}
};

const handleSendNewContactOtp = async () => {
if (!changeContactState.newContact) { showToast(`Please enter your new ${changeContactState.type}`, "error"); return; }
setIsSaving(true);
try {
const res = await fetch("/api/user/change-contact", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ action: "send-new", type: changeContactState.type, newContact: changeContactState.newContact }),
});
const data = await res.json();
if (res.ok) {
setChangeContactState(prev => ({ ...prev, step: 'verify-new' }));
showToast(`OTP sent to new ${changeContactState.type}`, "success");
} else { showToast(data.error || "Failed to send OTP", "error"); }
} catch (err: unknown) {
logger.error("[change-contact] send new OTP error:", err);
showToast("Network error", "error");
} finally {
setIsSaving(false);
}
};

const handleConfirmNewContact = async () => {
if (!changeContactState.newOtp) { showToast("Please enter the OTP", "error"); return; }
setIsSaving(true);
try {
const res = await fetch("/api/user/change-contact", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ action: "confirm-new", type: changeContactState.type, newContact: changeContactState.newContact, newOtp: changeContactState.newOtp }),
});
const data = await res.json();
if (res.ok) {
showToast(`${changeContactState.type} updated successfully!`, "success");
setChangeContactState({ active: false, type: null, step: 'idle', currentEmailOtp: '', currentPhoneOtp: '', newContact: '', newOtp: '' });
window.location.reload(); // Refresh to reflect new session data
} else { showToast(data.error || "Invalid OTP", "error"); }
} catch (err: unknown) {
logger.error("[change-contact] confirm new contact error:", err);
showToast("Network error", "error");
} finally {
setIsSaving(false);
}
};

const renderEmailAction = () => {
if (user?.emailVerified && user?.email) {
return (
<div className="flex gap-2 items-center">
<span className="inline-flex items-center gap-1 text-xs font-bold text-emerald bg-emerald-subtle rounded-2xl px-3-py-1-2">
Verified
</span>
<Button variant="secondary" disabled={isSaving} className="text-xs px-2 py-1" onClick={() => handleStartContactChange('email')}>{isSaving ? '...' : 'Change'}</Button>
</div>
);
}
if (verifyContactState.type === 'email' && verifyContactState.step === 'code') {
return (
<div className="flex gap-2">
<Input type="text" id="email-verify-code" placeholder="OTP" aria-label="Email verification code" className="text-xs px-2 py-1 w-80" value={contactVerifyCode} onChange={(e) => setContactVerifyCode(e.target.value)} />
<Button variant="primary" disabled={isSaving} onClick={async () => {
  setIsSaving(true);
  try {
    const res = await fetch('/api/user/verify-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email', code: contactVerifyCode })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Email Verified!', 'success');
      setVerifyContactState({ type: null, step: 'idle' });
      setContactVerifyCode('');
      setUser(prev => prev ? { ...prev, emailVerified: true } : null);
    } else {
      showToast(data.error || 'Invalid code', 'error');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error occurred';
    showToast(msg, 'error');
  } finally {
    setIsSaving(false);
  }
}} className="text-xs px-2 py-1">Verify</Button>
</div>
);
}
return (
<Button variant="secondary" disabled={isSaving} onClick={async () => {
if (!user?.email) { showToast('No email found to verify.', 'error'); return; }
setIsSaving(true);
try {
const res = await fetch("/api/user/send-otp", {
method: "POST",
body: JSON.stringify({ type: 'email', contact: user.email })
});
if (res.ok) {
showToast(`Verification code sent to ${user.email}`, 'success');
setVerifyContactState({ type: 'email', step: 'code' });
} else {
const errorData = await res.json();
showToast(errorData.error || 'Failed to send OTP to email.', 'error');
}
} catch (err: unknown) {
const msg = err instanceof Error ? err.message : 'Error occurred';
showToast(msg, 'error');
} finally {
setIsSaving(false);
}
}} className="text-xs px-3-py-1">
Verify Email
</Button>
);
};

const renderPhoneAction = () => {
if (user?.phoneVerified && user?.phone) {
return (
<div className="flex gap-2 items-center">
<span className="inline-flex items-center gap-1 text-xs font-bold text-emerald bg-emerald-subtle rounded-2xl px-3-py-1-2">
Verified
</span>
<Button variant="secondary" disabled={isSaving} className="text-xs px-2 py-1" onClick={() => handleStartContactChange('phone')}>{isSaving ? '...' : 'Change'}</Button>
</div>
);
}
if (verifyContactState.type === 'phone' && verifyContactState.step === 'code') {
return (
<div className="flex gap-2">
<Input type="text" id="phone-verify-code" placeholder="OTP" aria-label="Phone verification code" className="text-xs px-2 py-1 w-80" value={contactVerifyCode} onChange={(e) => setContactVerifyCode(e.target.value)} />
<Button variant="primary" disabled={isSaving} onClick={async () => {
  setIsSaving(true);
  try {
    const res = await fetch('/api/user/verify-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'phone', code: contactVerifyCode })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Phone Verified!', 'success');
      setVerifyContactState({ type: null, step: 'idle' });
      setContactVerifyCode('');
      setUser(prev => {
        if (!prev) return null;
        const nextUser: User = { ...prev, phoneVerified: true };
        const p = pendingContact || prev.phone;
        if (p) nextUser.phone = p;
        return nextUser;
      });
    } else {
      showToast(data.error || 'Invalid code', 'error');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error occurred';
    showToast(msg, 'error');
  } finally {
    setIsSaving(false);
  }
}} className="text-xs px-2 py-1">Verify</Button>
</div>
);
}
if (verifyContactState.type === 'phone' && verifyContactState.step === 'input') {
return (
<div className="flex gap-2">
<Input type="text" aria-label="Phone number with country code" placeholder="e.g. 919876543210" className="text-xs px-2 py-1 w-130" value={pendingContact} onChange={(e) => setPendingContact(e.target.value)} />
<Button variant="primary" disabled={isSaving} onClick={async () => {
if (pendingContact) {
setIsSaving(true);
try {
const res = await fetch('/api/user/send-otp', {
method: 'POST',
body: JSON.stringify({ type: 'phone', contact: pendingContact })
});
if (res.ok) {
showToast(`OTP sent to ${pendingContact}`, 'success');
setVerifyContactState({ type: 'phone', step: 'code' });
} else {
const errorData = await res.json();
showToast(errorData.error || 'Failed to send OTP to phone. Ensure correct country code is used.', 'error');
}
} catch (err: unknown) {
const msg = err instanceof Error ? err.message : 'Error occurred';
showToast(msg, 'error');
} finally {
setIsSaving(false);
}
}
}} className="text-xs px-2 py-1">
{isSaving ? '...' : 'Send OTP'}
</Button>
</div>
);
}
return (
<Button variant="secondary" disabled={isSaving} onClick={() => {
setPendingContact('');
setVerifyContactState({ type: 'phone', step: 'input' });
}} className="text-xs px-3-py-1">
Add & Verify
</Button>
);
};

return (
<div className="card">
<h2 className="text-xl font-bold mb-6">
Contact Verification
</h2>
    <div className="flex flex-col gap-4">
      {/* Email Verification */}
      <div className={`flex justify-between items-center p-3 rounded-sm ${user?.emailVerified && user?.email ? "bg-emerald-subtle border-emerald-subtle" : "bg-tertiary border-inactive-login"}`}>
        <div>
          <div className="font-semibold text-sm flex items-center gap-2">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-500">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            Email Address
          </div>
          <div className="text-xs text-muted">{user?.email || 'N/A'}</div>
        </div>
        {renderEmailAction()}
      </div>

      {/* Phone Verification */}
      <div className={`flex justify-between items-center p-3 rounded-sm ${user?.phoneVerified && user?.phone ? "bg-emerald-subtle border-emerald-subtle" : "bg-tertiary border-inactive-login"}`}>
        <div>
          <div className="font-semibold text-sm flex items-center gap-2">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-500">
              <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
              <path d="M12 18h.01" />
            </svg>
            Phone Number
          </div>
          <div className="text-xs text-muted">
            {user?.phoneVerified && user?.phone ? `+91-${user.phone}` : 'Required for campaign payout calls'}
          </div>
        </div>
        {renderPhoneAction()}
      </div>
    </div>

    {/* Change Contact Inline UI */}
    {changeContactState.active && (
      <div className="p-4 bg-tertiary rounded-md border-card mt-5">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-base font-semibold m-0">Change {changeContactState.type === 'email' ? 'Email Address' : 'Phone Number'}</h4>
          <Button variant="ghost" aria-label="Dismiss contact change dialog" className="text-muted cursor-pointer border-none bg-none" onClick={() => setChangeContactState({ active: false, type: null, step: 'idle', currentEmailOtp: '', currentPhoneOtp: '', newContact: '', newOtp: '' })}>✕</Button>
        </div>

{changeContactState.step === 'verify-current' && (
<div className="flex flex-col gap-3">
<div className="text-sm text-secondary">To protect your account, we've sent an OTP to your current contact method(s). Please enter the OTP to continue.</div>
{user?.email && (
<div>
<label className="label" htmlFor="verify-current-email-otp">OTP from Email</label>
<Input id="verify-current-email-otp" type="text" placeholder="e.g. 123456" value={changeContactState.currentEmailOtp} onChange={e => setChangeContactState({ ...changeContactState, currentEmailOtp: e.target.value })} fullWidth />
</div>
)}
{user?.phone && (
<div>
<label className="label" htmlFor="verify-current-phone-otp">OTP from Phone</label>
<Input id="verify-current-phone-otp" type="text" placeholder="e.g. 123456" value={changeContactState.currentPhoneOtp} onChange={e => setChangeContactState({ ...changeContactState, currentPhoneOtp: e.target.value })} fullWidth />
</div>
)}
<Button variant="primary" onClick={handleVerifyCurrentContacts} disabled={isSaving}>Verify & Continue</Button>
</div>
)}

{changeContactState.step === 'enter-new' && (
<div className="flex flex-col gap-3">
<div>
<label className="label" htmlFor="verify-new-contact">Enter your new {changeContactState.type}</label>
<Input id="verify-new-contact" type={changeContactState.type === 'email' ? 'email' : 'text'} placeholder={`New ${changeContactState.type}`} value={changeContactState.newContact} onChange={e => setChangeContactState({ ...changeContactState, newContact: e.target.value })} fullWidth />
</div>
<Button variant="primary" onClick={handleSendNewContactOtp} disabled={isSaving}>Send OTP to New {changeContactState.type}</Button>
</div>
)}

{changeContactState.step === 'verify-new' && (
<div className="flex flex-col gap-3">
<div className="text-sm text-secondary">We've sent an OTP to {changeContactState.newContact}.</div>
<div>
<label className="label" htmlFor="verify-new-contact-otp">Enter OTP</label>
<Input id="verify-new-contact-otp" type="text" placeholder="e.g. 123456" value={changeContactState.newOtp} onChange={e => setChangeContactState({ ...changeContactState, newOtp: e.target.value })} fullWidth />
</div>
<Button variant="primary" onClick={handleConfirmNewContact} disabled={isSaving}>Confirm & Save</Button>
</div>
)}
</div>
)}
</div>
);
}
