"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import {
  parseUserType,
  UserTypeSelection,
} from "@/components/register/RegistrationHelpers";
import { useRegistration } from "@/components/register/useRegistration";
import { Step2RegistrationForm } from "@/components/register/Step2RegistrationForm";
import { AuthLayout } from "@/components/auth/AuthLayout";

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
  isAdult: z.literal(true, {
    message: "You must be at least 18 years of age to register",
  }).optional().default(true),
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
    <AuthLayout wideCard={step === 1}>
      {/* Micro-progress indicator & time estimate */}
      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-foreground">
            Step {step} of 2: {step === 1 ? "Select Account Role" : "Account Setup"}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-verified bg-verified-muted px-2.5 py-0.5 rounded-full border border-verified-border shrink-0 whitespace-nowrap">
            <span>⚡</span>
            <span>~2 min quick setup</span>
          </span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>
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
    </AuthLayout>
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
