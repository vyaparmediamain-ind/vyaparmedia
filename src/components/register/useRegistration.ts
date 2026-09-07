"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger-client";
import { registerSchema } from "@/app/register/page";
import { UserType, getDeviceFingerprint } from "./RegistrationHelpers";

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
const res = await fetch("/api/auth/verify-email-otp", {
method: "PUT",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ email: formData.email, type: "registration" }),
});
const data = await res.json();
if (!res.ok) {
setEmailOtpError(data.error || "Failed to send OTP");
return;
}
if (data.otp && process.env.NODE_ENV !== "production") {
setEmailOtp(data.otp);
}
setEmailOtpSent(true);
startCooldown(setEmailCooldown, 60, "email");
} catch {
setEmailOtpError("Network error. Please try again.");
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
const res = await fetch("/api/auth/verify-email-otp", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
email: formData.email,
otp: emailOtp,
type: "registration",
}),
});
const data = await res.json();
if (!res.ok) {
setEmailOtpError(data.error || "Invalid OTP");
return;
}
setEmailOtpVerified(true);
setVerifiedEmail(formData.email);
} catch {
setEmailOtpError("Network error. Please try again.");
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
const res = await fetch("/api/auth/verify-otp", {
method: "PUT",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ phone: formData.phone, type: "registration" }),
});
const data = await res.json();
if (!res.ok) {
setPhoneOtpError(data.error || "Failed to send OTP");
return;
}
setPhoneOtpChannel(data.channel || null);
if (data.otp && process.env.NODE_ENV !== "production") {
setPhoneOtp(data.otp);
}
setPhoneOtpSent(true);
startCooldown(setPhoneCooldown, 60, "phone");
} catch {
setPhoneOtpError("Network error. Please try again.");
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
const res = await fetch("/api/auth/verify-otp", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
phone: formData.phone,
otp: phoneOtp,
type: "registration",
}),
});
const data = await res.json();
if (!res.ok) {
setPhoneOtpError(data.error || "Invalid OTP");
return;
}
setPhoneOtpVerified(true);
setVerifiedPhone(formData.phone);
} catch {
setPhoneOtpError("Network error. Please try again.");
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

setIsLoading(true);

try {
const deviceFingerprint = await getDeviceFingerprint().catch(() => undefined);
const response = await fetch("/api/auth/register", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
name: formData.name.trim(),
email: formData.email,
phone: formData.phone,
password: formData.password,
userType,
referralCode: formData.referralCode || undefined,
emailOtpVerified: true,
phoneOtpVerified: true,
deviceFingerprint,
}),
});

const data = await response.json();

if (!response.ok) {
if (data.details?.fieldErrors) {
const firstField = Object.keys(data.details.fieldErrors)[0];
const firstError = firstField ? data.details.fieldErrors[firstField]?.[0] : undefined;
setError(firstError || data.error || "Registration failed");
} else {
setError(data.error || "Registration failed");
}
return;
}

router.push("/login?registered=true");
} catch (err: unknown) {
logger.error("[register] submission error:", err);
setError("An error occurred. Please try again.");
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
