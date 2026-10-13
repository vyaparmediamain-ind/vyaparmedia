"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger-client";
import { registerSchema } from "@/app/register/page";
import { UserType, getDeviceFingerprint } from "./RegistrationHelpers";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";

export function useRegistration(
initialType: UserType | null,
initialReferralCode: string,
initialError: string,
router: ReturnType<typeof useRouter>
) {
const [step, setStep] = useState(initialType ? 2 : 1);
const [userType, setUserType] = useState<UserType | null>(initialType);
const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
const [formData, setFormData] = useState({
name: "",
email: "",
phone: "",
password: "",
confirmPassword: "",
referralCode: initialReferralCode,
agreeToTerms: false,
});
const [error, setError] = useState(initialError);
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
const [isLoading, setIsLoading] = useState(false);

// OTP verification state
const [emailOtpSent, setEmailOtpSent] = useState(false);
const [emailOtpVerified, setEmailOtpVerified] = useState(false);
const [emailOtp, setEmailOtp] = useState("");
const [emailOtpLoading, setEmailOtpLoading] = useState(false);
const [emailOtpError, setEmailOtpError] = useState("");
const [emailCooldown, setEmailCooldown] = useState(0);
const [verifiedEmail, setVerifiedEmail] = useState("");

const [phoneOtpSent, setPhoneOtpSent] = useState(false);
const [phoneOtpVerified, setPhoneOtpVerified] = useState(false);
const [phoneOtp, setPhoneOtp] = useState("");
const [phoneOtpLoading, setPhoneOtpLoading] = useState(false);
const [phoneOtpError, setPhoneOtpError] = useState("");
const [phoneOtpChannel, setPhoneOtpChannel] = useState<"whatsapp" | "sms" | "dev" | null>(null);
const [phoneCooldown, setPhoneCooldown] = useState(0);
const [verifiedPhone, setVerifiedPhone] = useState("");

const emailTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
const phoneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

const getEmailOtpButtonText = () => {
if (emailOtpLoading) return "Sending...";
if (emailCooldown > 0) return `Resend (${emailCooldown}s)`;
if (emailOtpSent) return "Resend OTP";
return "Send OTP";
};

const getPhoneOtpButtonText = () => {
if (phoneOtpLoading) return "Sending...";
if (phoneCooldown > 0) return `Resend (${phoneCooldown}s)`;
if (phoneOtpSent) return "Resend OTP";
return "Send OTP";
};

const getVerificationStatusText = () => {
if (emailOtpVerified && phoneOtpVerified) {
return "Both email and phone verified - you can create your account!";
}
const remaining = emailOtpVerified ? "Phone" : "Email";
return `${remaining} verification remaining`;
};

const renderSubmitButtonContent = () => {
if (isLoading) return "Creating...";
if (!emailOtpVerified || !phoneOtpVerified) return "Verify Email & Phone First";
return "Create Account";
};

  // Cooldown timer
  const startCooldown = useCallback(
    (setter: React.Dispatch<React.SetStateAction<number>>, seconds: number, type: "email" | "phone") => {
      setter(seconds);
      const ref = type === "email" ? emailTimerRef : phoneTimerRef;
      if (ref.current) clearInterval(ref.current);

      ref.current = setInterval(() => {
        setter((prev) => {
          if (prev <= 1) {
            if (ref.current) clearInterval(ref.current);
            ref.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [],
  );

  useEffect(() => {
    const emailRef = emailTimerRef;
    const phoneRef = phoneTimerRef;
    return () => {
      if (emailRef.current) clearInterval(emailRef.current);
      if (phoneRef.current) clearInterval(phoneRef.current);
    };
  }, []);


// Send email OTP
const handleSendEmailOtp = async () => {
if (!formData.email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)) {
setEmailOtpError("Enter a valid email address first");
return;
}
setEmailOtpLoading(true);
setEmailOtpError("");
try {
const data = await apiClient.auth.sendEmailOtp({ email: formData.email, type: "registration" });
if (data.otp && process.env.NODE_ENV !== "production") {
setEmailOtp(data.otp);
}
setEmailOtpSent(true);
startCooldown(setEmailCooldown, 60, "email");
} catch (err: unknown) {
  setEmailOtpError(formatUserError(err, "Failed to send email OTP. Please try again."));
} finally {
setEmailOtpLoading(false);
}
};

// Verify email OTP
const handleVerifyEmailOtp = async () => {
if (emailOtp?.length !== 6) {
setEmailOtpError("Enter a 6-digit OTP");
return;
}
setEmailOtpLoading(true);
setEmailOtpError("");
try {
await apiClient.auth.verifyEmailOtp({
email: formData.email,
otp: emailOtp,
type: "registration",
});
setEmailOtpVerified(true);
setVerifiedEmail(formData.email);
} catch (err: unknown) {
  setEmailOtpError(formatUserError(err, "The email OTP is invalid or has expired. Please try again."));
} finally {
setEmailOtpLoading(false);
}
};

// Send phone OTP
const handleSendPhoneOtp = async () => {
if (!formData.phone || !/^[6-9]\d{9}$/.test(formData.phone)) {
setPhoneOtpError("Enter a valid 10-digit Indian mobile number");
return;
}
setPhoneOtpLoading(true);
setPhoneOtpError("");
try {
const data = await apiClient.auth.sendPhoneOtp({ phone: formData.phone, type: "registration" });
setPhoneOtpChannel(data.channel || null);
if (data.otp && process.env.NODE_ENV !== "production") {
setPhoneOtp(data.otp);
}
setPhoneOtpSent(true);
startCooldown(setPhoneCooldown, 60, "phone");
} catch (err: unknown) {
  setPhoneOtpError(formatUserError(err, "Failed to send SMS OTP. Please check your phone number and try again."));
} finally {
setPhoneOtpLoading(false);
}
};

// Verify phone OTP
const handleVerifyPhoneOtp = async () => {
if (phoneOtp?.length !== 6) {
setPhoneOtpError("Enter a 6-digit OTP");
return;
}
setPhoneOtpLoading(true);
setPhoneOtpError("");
try {
await apiClient.auth.verifyPhoneOtp({
phone: formData.phone,
otp: phoneOtp,
type: "registration",
});
setPhoneOtpVerified(true);
setVerifiedPhone(formData.phone);
} catch (err: unknown) {
  setPhoneOtpError(formatUserError(err, "The phone OTP is invalid or has expired. Please try again."));
} finally {
setPhoneOtpLoading(false);
}
};

const handleUserTypeSelect = (type: UserType) => {
setUserType(type);
setStep(2);
};

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setError("");
setFieldErrors({});

    if (!emailOtpVerified || formData.email !== verifiedEmail) {
      setError("Please verify your email address first");
      return;
    }
    if (!phoneOtpVerified || formData.phone !== verifiedPhone) {
      setError("Please verify your phone number first");
      return;
    }
if (!userType) {
setError("Please choose whether you are joining as a brand or influencer");
setStep(1);
return;
}

const validation = registerSchema.safeParse({
name: formData.name.trim(),
email: formData.email,
phone: formData.phone,
password: formData.password,
confirmPassword: formData.confirmPassword,
referralCode: formData.referralCode || undefined,
agreeToTerms: formData.agreeToTerms,
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

if (formData.referralCode?.trim()) {
  try {
    const checkRes = await fetch(`/api/referrals/validate?code=${encodeURIComponent(formData.referralCode.trim())}`);
    const checkData = await checkRes.json();
    if (!checkData.valid) {
      setFieldErrors((prev) => ({ ...prev, referralCode: "Invalid referral code. Please enter a valid code or leave blank." }));
      setError("The referral code you entered is invalid.");
      return;
    }
  } catch (checkErr) {
    logger.warn("[register] Referral code pre-check warning:", { error: String(checkErr) });
  }
}

setIsLoading(true);

try {
const deviceFingerprint = await getDeviceFingerprint().catch(() => undefined);
await apiClient.auth.register({
name: formData.name.trim(),
email: formData.email,
phone: formData.phone,
password: formData.password,
userType,
referralCode: formData.referralCode || undefined,
emailOtpVerified: true,
phoneOtpVerified: true,
deviceFingerprint,
});

router.push("/login?registered=true&callbackUrl=/onboarding");
} catch (err: unknown) {
logger.error("[register] submission error:", err);
if (err instanceof ApiClientError) {
  const raw = err.raw as { details?: { fieldErrors?: Record<string, string[]> }; error?: string } | null;
  if (raw?.details?.fieldErrors) {
    const firstField = Object.keys(raw.details.fieldErrors)[0];
    const firstError = firstField ? raw.details.fieldErrors[firstField]?.[0] : undefined;
    setError(firstError ? formatUserError(firstError) : formatUserError(err, "Registration failed. Please check your details and try again."));
  } else {
    setError(formatUserError(err, "Registration failed. Please check your details and try again."));
  }
} else {
  setError(formatUserError(err, "An error occurred during registration. Please try again."));
}
} finally {
setIsLoading(false);
}
};

return {
step,
setStep,
userType,
setUserType,
showPassword,
setShowPassword,
showConfirmPassword,
setShowConfirmPassword,
formData,
setFormData,
error,
setError,
fieldErrors,
setFieldErrors,
isLoading,
setIsLoading,
emailOtpSent,
setEmailOtpSent,
emailOtpVerified,
setEmailOtpVerified,
emailOtp,
setEmailOtp,
emailOtpLoading,
setEmailOtpLoading,
emailOtpError,
setEmailOtpError,
emailCooldown,
setEmailCooldown,
phoneOtpSent,
setPhoneOtpSent,
phoneOtpVerified,
setPhoneOtpVerified,
phoneOtp,
setPhoneOtp,
phoneOtpLoading,
setPhoneOtpLoading,
phoneOtpError,
setPhoneOtpError,
phoneOtpChannel,
setPhoneOtpChannel,
phoneCooldown,
setPhoneCooldown,
getEmailOtpButtonText,
getPhoneOtpButtonText,
getVerificationStatusText,
renderSubmitButtonContent,
startCooldown,
handleSendEmailOtp,
handleVerifyEmailOtp,
handleSendPhoneOtp,
handleVerifyPhoneOtp,
handleUserTypeSelect,
handleSubmit,
};
}
