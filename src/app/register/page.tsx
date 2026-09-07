"use client";

import Logo from "../../components/Logo";
import Image from "next/image";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import {
parseUserType,
UserTypeSelection,
} from "@/components/register/RegistrationHelpers";
import { useRegistration } from "@/components/register/useRegistration";
import { Step2RegistrationForm } from "@/components/register/Step2RegistrationForm";

export const registerSchema = z.object({
name: z.string().min(2, "Name must be at least 2 characters").max(80, "Name cannot exceed 80 characters"),
email: z.string().email("Please enter a valid email address"),
phone: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian phone number"),
password: z
.string()
.min(8, "Password must be at least 8 characters")
.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
.regex(/[a-z]/, "Password must contain at least one lowercase letter")
.regex(/\d/, "Password must contain at least one number")
.regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
confirmPassword: z.string(),
referralCode: z
.string()
.trim()
.toUpperCase()
.regex(/^[A-Z0-9]+$/, "Referral code can only contain uppercase letters and numbers")
.optional()
.or(z.literal("")),
agreeToTerms: z.literal(true, {
message: "You must agree to the Terms of Service and Privacy Policy",
}),
}).refine((data) => data.password === data.confirmPassword, {
message: "Passwords do not match",
path: ["confirmPassword"],
});

function RegisterContent() {
const router = useRouter();
const searchParams = useSearchParams();
const urlError = searchParams?.get("error");
const initialError = urlError === "OAuthAccountNotRegistered"
? "Please create an account before signing in with Google."
: "";
const initialType = parseUserType(searchParams.get("type"));
const initialReferralCode = searchParams.get("ref")?.trim().toUpperCase() || "";

const registration = useRegistration(initialType, initialReferralCode, initialError, router);

const {
step,
setStep,
userType,
handleUserTypeSelect,
} = registration;

return (
<div className="flex items-center justify-center p-6 auth-wrapper">
{/* Realistic Abstract Background */}
<div className="auth-bg-wrapper">
<Image
src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
alt="Abstract Background"
fill
unoptimized
className="auth-bg-image"
/>
<div className="auth-bg-overlay" />
</div>

<div
className={`card animate-fade-in-scale auth-card ${
step === 1 ? "register-card-step1" : "register-card-step2"
}`}
>
<div className="auth-logo-row">
<Logo />
</div>

{/* Step 1: Choose User Type */}
{step === 1 && (
<UserTypeSelection
userType={userType}
handleUserTypeSelect={handleUserTypeSelect}
/>
)}

{/* Step 2: Registration Form */}
{step === 2 && userType && (
<Step2RegistrationForm
registration={registration}
setStep={setStep}
userType={userType}
/>
)}
</div >
</div >
);
}

export default function RegisterPage() {
return (
<Suspense
fallback={
<div className="flex items-center justify-center min-h-screen">
<span className="loading w-32 h-32" />
</div>
}
>
<RegisterContent />
</Suspense>
);
}
