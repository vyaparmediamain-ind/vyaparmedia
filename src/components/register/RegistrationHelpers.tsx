"use client";

import Link from "next/link";
import { Button, Input } from "@/components/ui";

export type UserType = "INFLUENCER" | "BRAND";

export const userTypeInfo = {
  INFLUENCER: {
    title: "Creator / Influencer",
    icon: "CR",
    description:
      "Create high-impact content, collaborate with top Indian brands, and earn with guaranteed escrow payouts.",
    benefits: [
      "100% Guaranteed escrow payments",
      "Direct brand deals & custom proposals",
      "Automated tax & TDS compliance",
    ],
  },
  BRAND: {
    title: "Brand / Business",
    icon: "BR",
    description:
      "Hire verified creators, launch escrow-secured campaigns, track real engagement, and grow your vyapar.",
    benefits: [
      "Government KYC & social fraud vetting",
      "Milestone-based escrow payment safety",
      "Legally binding smart contracts",
    ],
  },
};

export function parseUserType(value: string | null): UserType | null {
  const normalized = value?.toUpperCase();
  return normalized === "INFLUENCER" || normalized === "BRAND"
    ? normalized
    : null;
}

export function formatOtpChannel(channel: "whatsapp" | "sms" | "dev" | null) {
  if (channel === "sms") return "by SMS";
  if (channel === "dev") return "in development mode";
  return "on WhatsApp";
}

export async function getDeviceFingerprint() {
  const raw = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen.width,
    screen.height,
    screen.colorDepth,
    navigator.hardwareConcurrency || 0,
    navigator.platform,
  ].join("|");

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

interface UserTypeSelectionProps {
  readonly userType: UserType | null;
  readonly handleUserTypeSelect: (type: UserType) => void;
}

export function UserTypeSelection({ userType, handleUserTypeSelect }: Readonly<UserTypeSelectionProps>) {
  return (
    <>
      <h1 className="usertype-title">
        Join VyaparMedia
      </h1>
      <p className="usertype-subtitle">
        Choose how you want to use the platform
      </p>

      <div className="usertype-grid">
        {(Object.keys(userTypeInfo) as UserType[]).map((type) => (
          <button
            type="button"
            key={type}
            onClick={() => handleUserTypeSelect(type)}
            className={`usertype-card hover-lift ${
              userType === type ? "usertype-card-selected" : ""
            }`}
          >
            <div className="usertype-icon-wrapper">
              {type === "INFLUENCER" ? (
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              ) : (
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              )}
            </div>
            <h3 className="usertype-card-name">
              {userTypeInfo[type].title}
            </h3>
            <p className="usertype-card-desc">
              {userTypeInfo[type].description}
            </p>
            <ul className="usertype-benefit-list">
              {userTypeInfo[type].benefits.map((benefit) => (
                <li key={benefit} className="usertype-benefit-item">
                  <svg
                    className="usertype-benefit-icon"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>{" "}
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <div className="divider" />

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

interface Step2HeaderProps {
  readonly userType: UserType;
  readonly onBack: () => void;
}

export function Step2Header({ userType, onBack }: Step2HeaderProps) {
  return (
    <>
      <Button
        variant="ghost"
        onClick={onBack}
        className="auth-back-btn"
      >
        Back
      </Button>

      <div className="auth-header-container">
        <div className="auth-header-icon">
          {userType === "INFLUENCER" ? (
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          ) : (
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          )}
        </div>
        <div>
          <h1 className="auth-header-title">
            Create {userTypeInfo[userType].title} Account
          </h1>
          <p className="auth-header-subtitle">
            Verify your email &amp; phone to get started
          </p>
        </div>
      </div>
    </>
  );
}

interface PasswordFieldProps {
  readonly id: string;
  readonly label: string;
  readonly placeholder: string;
  readonly value: string;
  readonly onChange: (val: string) => void;
  readonly show: boolean;
  readonly setShow: (show: boolean) => void;
  readonly minLength?: number | undefined;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
}

export function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  show,
  setShow,
  minLength,
  hint,
  error,
}: PasswordFieldProps) {
  return (
    <div className="auth-form-group flex flex-col gap-2">
      {label && (
        <label className="label mb-0" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="auth-field-relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={minLength}
          className="auth-field-password-input"
          error={error}
          fullWidth
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShow(!show)}
          className="auth-field-password-toggle"
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {show ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          )}
        </Button>
      </div>
      {hint && (
        <p className="text-xs text-muted mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}
