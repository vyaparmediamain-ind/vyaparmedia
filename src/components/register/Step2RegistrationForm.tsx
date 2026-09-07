"use client";

import Link from "next/link";
import { Input, Button } from "@/components/ui";
import {
Step2Header,
PasswordField,
UserType,
} from "./RegistrationHelpers";
import { EmailOtpField, PhoneOtpField } from "./OtpFields";
import { useRegistration } from "./useRegistration";

interface Step2RegistrationFormProps {
readonly registration: ReturnType<typeof useRegistration>;
readonly setStep: (step: number) => void;
readonly userType: UserType;
}

export function Step2RegistrationForm({
registration,
setStep,
userType,
}: Readonly<Step2RegistrationFormProps>) {
const {
formData,
setFormData,
error,
fieldErrors,
handleSubmit,
emailOtpVerified,
phoneOtpVerified,
showPassword,
setShowPassword,
showConfirmPassword,
setShowConfirmPassword,
isLoading,
getVerificationStatusText,
renderSubmitButtonContent,
} = registration;

return (
<>
<Step2Header userType={userType} onBack={() => setStep(1)} />

{error && (
<div className="text-center mb-6 auth-error-banner">
{error}
</div>
)}

<form onSubmit={handleSubmit}>
<div className="auth-form-group">
<Input
id="name"
label={userType === "BRAND" ? "Brand / Company Name *" : "Full Name *"}
type="text"
placeholder={userType === "BRAND" ? "Acme Pvt Ltd" : "Your full name"}
value={formData.name}
onChange={(e) =>
setFormData({ ...formData, name: e.target.value })
}
required
maxLength={80}
autoComplete={userType === "BRAND" ? "organization" : "name"}
error={fieldErrors.name}
fullWidth
/>
</div>

{/* Email field + OTP */}
<EmailOtpField registration={registration} />

{/* Phone field + OTP */}
<PhoneOtpField registration={registration} />

{/* Verification status banner */}
{(emailOtpVerified || phoneOtpVerified) && (
<div className={`auth-otp-status-banner ${emailOtpVerified && phoneOtpVerified ? "verified" : "warning"}`}>
{getVerificationStatusText()}
</div>
)}

{/* Password */}
<PasswordField
id="password"
label="Password *"
placeholder="Minimum 8 characters"
value={formData.password}
onChange={(val) => setFormData({ ...formData, password: val })}
show={showPassword}
setShow={setShowPassword}
minLength={8}
hint="Must contain 8+ chars, uppercase, lowercase, number & special char."
error={fieldErrors.password}
/>

{/* Confirm password */}
<PasswordField
id="confirmPassword"
label="Confirm Password *"
placeholder="Re-enter password"
value={formData.confirmPassword}
onChange={(val) => setFormData({ ...formData, confirmPassword: val })}
show={showConfirmPassword}
setShow={setShowConfirmPassword}
error={fieldErrors.confirmPassword}
/>

{/* Referral code */}
<div className="auth-form-group mb-6">
<Input
id="referralCode"
label="Referral Code (optional)"
type="text"
placeholder="Enter if you have one"
value={formData.referralCode}
onChange={(e) =>
setFormData({
...formData,
referralCode: e.target.value.toUpperCase(),
})
}
error={fieldErrors.referralCode}
fullWidth
/>
</div>

{/* Terms */}
<div className="auth-form-group mb-6">
<div className="auth-terms-row">
<input
id="agreeToTerms"
type="checkbox"
checked={formData.agreeToTerms}
onChange={(e) =>
setFormData({ ...formData, agreeToTerms: e.target.checked })
}
className="auth-checkbox"
/>
<label
htmlFor="agreeToTerms"
className="text-sm text-secondary cursor-pointer"
>
I agree to the{" "}
<Link
href="/terms"
className="auth-link"
>
Terms of Service
</Link>{" "}
and{" "}
<Link
href="/privacy"
className="auth-link"
>
Privacy Policy
</Link>
</label>
</div>
{fieldErrors.agreeToTerms && (
<span className="auth-validation-error">
{fieldErrors.agreeToTerms}
</span>
)}
</div>

{/* Submit */}
<Button
type="submit"
variant="primary"
disabled={
isLoading || !emailOtpVerified || !phoneOtpVerified
}
className="auth-submit-btn"
>
{renderSubmitButtonContent()}
</Button>
</form>

<div className="divider mt-3" />

<p className="auth-footer-text">
Already have an account?{" "}
<Link
href="/login"
className="auth-footer-link"
>
Sign In
</Link>
</p>
</>
);
}
