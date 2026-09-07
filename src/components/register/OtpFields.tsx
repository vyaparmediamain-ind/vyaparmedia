"use client";

import { Input, Button } from "@/components/ui";
import { formatOtpChannel } from "./RegistrationHelpers";
import { useRegistration } from "./useRegistration";

interface EmailOtpFieldProps {
readonly registration: ReturnType<typeof useRegistration>;
}

export function EmailOtpField({ registration }: EmailOtpFieldProps) {
const {
formData,
setFormData,
emailOtpSent,
setEmailOtpSent,
emailOtpVerified,
setEmailOtpVerified,
emailOtp,
setEmailOtp,
emailOtpLoading,
emailOtpError,
emailCooldown,
getEmailOtpButtonText,
handleSendEmailOtp,
handleVerifyEmailOtp,
} = registration;

return (
<div className="auth-form-group">
<label className="label" htmlFor="email">
Email Address *
</label>
<div className="auth-otp-row">
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={formData.email}
          onChange={(e) => {
            setFormData({ ...formData, email: e.target.value });
            if (emailOtpVerified || emailOtpSent) {
              setEmailOtpVerified(false);
              setEmailOtpSent(false);
              setEmailOtp("");
            }
          }}
          required
          disabled={emailOtpVerified}
          className={emailOtpVerified ? "auth-input-verified" : ""}
          error={registration.fieldErrors?.email}
          fullWidth
        />
        {!emailOtpVerified && (
          <Button
            id="send-email-otp"
            type="button"
            onClick={handleSendEmailOtp}
            disabled={emailOtpLoading || emailCooldown > 0}
            className="otp-button"
          >
            {getEmailOtpButtonText()}
          </Button>
        )}
      </div>

      {emailOtpVerified && (
        <div className="mt-2">
          <span className="verified-badge">Email Verified</span>
        </div>
      )}

      {emailOtpSent && !emailOtpVerified && (
        <div className="mt-2">
          <p className="auth-success-msg">
            OTP sent to {formData.email}
          </p>
          <div className="auth-otp-row">
            <Input
              id="email-otp-input"
              type="text"
              placeholder="Enter 6-digit OTP"
              value={emailOtp}
              onChange={(e) =>
                setEmailOtp(
                  e.target.value.replace(/\D/g, "").slice(0, 6),
                )
              }
              maxLength={6}
              className="auth-input-otp"
              fullWidth
            />
            <Button
              id="verify-email-otp"
              type="button"
              onClick={handleVerifyEmailOtp}
              disabled={emailOtpLoading || emailOtp.length !== 6}
              className="otp-button"
            >
              {emailOtpLoading ? "..." : "Verify"}
            </Button>
          </div>
          {emailOtpError && (
            <p className="auth-error-msg">
              {emailOtpError}
            </p>
          )}
        </div>
      )}

      {!emailOtpSent && emailOtpError && (
        <p className="auth-error-msg">
          {emailOtpError}
        </p>
      )}
    </div>
  );
}

interface PhoneOtpFieldProps {
  readonly registration: ReturnType<typeof useRegistration>;
}

export function PhoneOtpField({ registration }: PhoneOtpFieldProps) {
  const {
    formData,
    setFormData,
    phoneOtpSent,
    setPhoneOtpSent,
    phoneOtpVerified,
    setPhoneOtpVerified,
    phoneOtp,
    setPhoneOtp,
    phoneOtpLoading,
    phoneOtpError,
    phoneOtpChannel,
    phoneCooldown,
    getPhoneOtpButtonText,
    handleSendPhoneOtp,
    handleVerifyPhoneOtp,
  } = registration;

  return (
    <div className="auth-form-group">
      <label className="label" htmlFor="phone">
        Phone Number *
      </label>
      <div className="auth-otp-row auth-phone-row">
        <span className="auth-input-phone-prefix">
          +91
        </span>
        <Input
          id="phone"
          type="tel"
          placeholder="9876543210"
          value={formData.phone}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "").slice(0, 10);
            setFormData({ ...formData, phone: val });
            if (phoneOtpVerified || phoneOtpSent) {
              setPhoneOtpVerified(false);
              setPhoneOtpSent(false);
              setPhoneOtp("");
            }
          }}
          required
          disabled={phoneOtpVerified}
          maxLength={10}
          className={phoneOtpVerified ? "auth-input-verified" : ""}
          error={registration.fieldErrors?.phone}
          fullWidth
        />
        {!phoneOtpVerified && (
          <Button
            id="send-phone-otp"
            type="button"
            onClick={handleSendPhoneOtp}
            disabled={phoneOtpLoading || phoneCooldown > 0}
            className="otp-button"
          >
            {getPhoneOtpButtonText()}
          </Button>
        )}
</div>

{phoneOtpVerified && (
<div className="mt-2">
<span className="verified-badge">Phone Verified</span>
</div>
)}

{phoneOtpSent && !phoneOtpVerified && (
<div className="mt-2">
<p className="auth-success-msg">
OTP sent {formatOtpChannel(phoneOtpChannel)} to +91-{formData.phone}
</p>
<div className="auth-otp-row">
            <Input
              id="phone-otp-input"
              type="text"
              placeholder="Enter 6-digit OTP"
              value={phoneOtp}
              onChange={(e) =>
                setPhoneOtp(
                  e.target.value.replace(/\D/g, "").slice(0, 6),
                )
              }
              maxLength={6}
              className="auth-input-otp"
              fullWidth
            />
<Button
id="verify-phone-otp"
type="button"
onClick={handleVerifyPhoneOtp}
disabled={phoneOtpLoading || phoneOtp.length !== 6}
className="otp-button"
>
{phoneOtpLoading ? "..." : "Verify"}
</Button>
</div>
{phoneOtpError && (
<p className="auth-error-msg">
{phoneOtpError}
</p>
)}
</div>
)}

{!phoneOtpSent && phoneOtpError && (
<p className="auth-error-msg">
{phoneOtpError}
</p>
)}
</div>
);
}
