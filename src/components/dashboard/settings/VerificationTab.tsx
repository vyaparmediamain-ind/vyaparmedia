"use client";

import React from "react";
import type { User } from "./ProfileTab";
import { useDocUpload } from "./verification/useDocUpload";
import { DocRow } from "./verification/VerificationHelpers";
import {
  DigiLockerCardComponent,
  Tier1CardComponent,
  Tier2CardComponent,
  Tier3CardComponent,
  TierStatusCardComponent,
  Step1MandatoryCardComponent,
} from "./verification/VerificationCards";
import { ShieldCheck, HelpCircle } from "lucide-react";
import Link from "next/link";
import { AuthenticityAppealBanner } from "@/components/dashboard/AuthenticityAppealBanner";

import type { VerificationData } from "./verification/types";
export type { VerificationData };

interface VerificationTabProps {
  user: User;
  verificationData: VerificationData | null;
  setVerificationData: React.Dispatch<React.SetStateAction<VerificationData | null>>;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export default function VerificationTab({
  user,
  verificationData,
  setVerificationData,
  showToast,
}: Readonly<VerificationTabProps>) {
  const {
    isUploading,
    uploadingDocType,
    isConnectingDigiLocker,
    fileInputRef,
    handleUpload,
    handleDigiLockerConnect,
    handleFileChange,
  } = useDocUpload(showToast, setVerificationData);

  if (!verificationData) {
    return (
      <div className="rounded-2xl border border-border bg-card p-12 text-center max-w-2xl mx-auto space-y-3">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        <h3 className="text-sm font-bold text-foreground">Synchronizing Government Verification Status...</h3>
        <p className="text-xs text-muted-foreground">Checking DigiLocker and uploaded verification documents.</p>
      </div>
    );
  }

  const docs = verificationData.documents || [];
  const tier: number = verificationData.tier ?? 0;
  const tierLimit: number | null = verificationData.tierLimit ?? null;
  const tierDesc: string = verificationData.tierDescription || "";
  const emailVerified: boolean = !!verificationData.emailVerified;
  const phoneVerified: boolean = !!verificationData.phoneVerified;
  const roleType: string = verificationData.userType || user?.userType || "INFLUENCER";
  const isBrand = roleType === "BRAND";

  const getDocStatus = (type: string) => docs.find((d) => d.type === type);
  const tierColors = ["#6b7280", "#2563eb", "#f59e0b", "#10b981"];
  const isUnlimited = tierLimit === null;

  const renderDocRow = (type: string, label: string, icon: string, desc: string) => {
    return (
      <DocRow
        type={type}
        label={label}
        icon={icon}
        desc={desc}
        doc={getDocStatus(type)}
        isUploading={isUploading}
        uploadingDocType={uploadingDocType}
        onUpload={handleUpload}
      />
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Hidden File Input for Document Uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        aria-hidden="true"
        onChange={handleFileChange}
      />

      {/* Authenticity & Fraud Appeal Alert (if under review) */}
      {roleType === "INFLUENCER" && <AuthenticityAppealBanner />}

      {/* 1. Tier Status Overview */}
      <TierStatusCardComponent
        tier={tier}
        tierColors={tierColors}
        isUnlimited={isUnlimited}
        tierLimit={tierLimit}
        tierDesc={tierDesc}
        trustScore={verificationData.trustScore || 600}
      />

      {/* 2. Step 1 Prerequisite: Contact Verification */}
      <Step1MandatoryCardComponent
        emailVerified={emailVerified}
        phoneVerified={phoneVerified}
      />

      {/* 3. DigiLocker Instant Verification Banner */}
      <DigiLockerCardComponent
        isConnectingDigiLocker={isConnectingDigiLocker}
        handleDigiLockerConnect={handleDigiLockerConnect}
      />

      {/* 4. Tier 1: Basic Identity (Aadhaar + Selfie) */}
      <Tier1CardComponent
        tier={tier}
        renderDocRow={renderDocRow}
      />

      {/* 5. Tier 2: Financial Identity (PAN + Bank) */}
      <Tier2CardComponent
        tier={tier}
        isBrand={isBrand}
        renderDocRow={renderDocRow}
      />

      {/* 6. Tier 3: Corporate & Business Verification (GST, MSME, CIN) */}
      <Tier3CardComponent
        tier={tier}
        renderDocRow={renderDocRow}
      />

      {/* 7. Indian DPDP & Escrow Trust Footer */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-verified shrink-0" />
          <span>Compliant with Indian Digital Personal Data Protection (DPDP) Act 2023 &amp; RBI Escrow Guidelines.</span>
        </div>
        <Link href="/help" className="text-primary hover:underline font-semibold flex items-center gap-1 shrink-0">
          <HelpCircle className="w-3.5 h-3.5" /> Verification FAQ
        </Link>
      </div>
    </div>
  );
}
