"use client";

import React from "react";
import { Button } from "@/components/ui";
import { formatCurrency } from "@/lib/utils-client";
import {
  ShieldCheck,
  Clock,
  AlertCircle,
  Upload,
  Lock,
  Award,
  Sparkles,
} from "lucide-react";

interface StatusBadgeProps {
  doc?: { status: string; rejectionReason?: string | null } | null | undefined;
}

export function StatusBadge({ doc }: Readonly<StatusBadgeProps>) {
  if (!doc) {
    return (
      <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full border border-border">
        Not Uploaded
      </span>
    );
  }

  if (doc.status === "VERIFIED") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-verified bg-verified-muted px-2.5 py-0.5 rounded-full border border-verified-border">
        <ShieldCheck className="w-3 h-3" /> Verified
      </span>
    );
  }

  if (doc.status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-disputed bg-disputed-muted px-2.5 py-0.5 rounded-full border border-disputed-border">
        <AlertCircle className="w-3 h-3" /> Rejected
      </span>
    );
  }

  // PENDING / UNDER_REVIEW
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-pending bg-pending-muted px-2.5 py-0.5 rounded-full border border-pending-border">
      <Clock className="w-3 h-3 animate-pulse" /> Under Review
    </span>
  );
}

export function getTierIcon(tier: number): React.ReactNode {
  if (tier === 0) {
    return <Lock className="w-5 h-5 text-muted-foreground" />;
  }
  if (tier === 1) {
    return <ShieldCheck className="w-5 h-5 text-primary" />;
  }
  if (tier === 2) {
    return <Award className="w-5 h-5 text-pending" />;
  }
  // Tier 3
  return <Sparkles className="w-5 h-5 text-verified" />;
}

interface UploadBtnProps {
  doc?: { status: string; rejectionReason?: string | null } | null | undefined;
  type: string;
  isUploading: boolean;
  uploadingDocType: string | null;
  onUpload: (type: string) => void;
}

function UploadBtn({
  doc,
  type,
  isUploading,
  uploadingDocType,
  onUpload,
}: Readonly<UploadBtnProps>) {
  if (doc?.status === "VERIFIED") return null;

  const isCurrentUploading = isUploading && uploadingDocType === type;

  return (
    <Button
      variant="secondary"
      size="sm"
      aria-label={`${doc ? "Re-upload" : "Upload"} ${type.replaceAll("_", " ").toLowerCase()}`}
      aria-busy={isCurrentUploading}
      onClick={() => onUpload(type)}
      disabled={isUploading}
      className="text-xs font-bold px-3 py-1 flex items-center gap-1.5 shadow-xs"
    >
      <Upload className="w-3 h-3" />
      <span>{isCurrentUploading ? "Uploading..." : doc ? "Re-upload" : "Upload Document"}</span>
    </Button>
  );
}

interface DocRowProps {
  type: string;
  label: string;
  icon: string;
  desc: string;
  doc?: { status: string; rejectionReason?: string | null } | null | undefined;
  isUploading: boolean;
  uploadingDocType: string | null;
  onUpload: (type: string) => void;
}

export function DocRow({
  type,
  label,
  icon,
  desc,
  doc,
  isUploading,
  uploadingDocType,
  onUpload,
}: Readonly<DocRowProps>) {
  const isVerified = doc?.status === "VERIFIED";
  const isRejected = doc?.status === "REJECTED";

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border transition-all ${
        isVerified
          ? "bg-verified-muted/20 border-verified-border/60"
          : isRejected
          ? "bg-disputed-muted/20 border-disputed-border/60"
          : "bg-muted/30 border-border hover:border-border/80"
      }`}
    >
      <div className="flex items-start sm:items-center gap-3">
        <span className="text-xl shrink-0 p-2 rounded-lg bg-card border border-border flex items-center justify-center">
          {icon}
        </span>
        <div>
          <div className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-2">
            <span>{label}</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            {desc}
          </div>
          {isRejected && doc?.rejectionReason && (
            <div className="mt-1 text-[11px] font-semibold text-disputed flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>Reason: {doc.rejectionReason}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
        <StatusBadge doc={doc} />
        <UploadBtn
          doc={doc}
          type={type}
          isUploading={isUploading}
          uploadingDocType={uploadingDocType}
          onUpload={onUpload}
        />
      </div>
    </div>
  );
}

export function getMonthlyLimitText(isUnlimited: boolean, tier: number, tierLimit: number | null) {
  if (isUnlimited) return "∞ Unlimited Payouts";
  if (tier === 0) return "Payouts Locked";
  if (tierLimit) return `${formatCurrency(tierLimit)} / month`;
  return "—";
}

export function getTierUpgradeActionText(tier: number, isBrand: boolean) {
  if (tier < 1) return "Complete Tier 1 to unlock escrow withdrawals";
  if (isBrand) return "Upload corporate documents to unlock unlimited campaign budget";
  return "Verify PAN & Tax identity to unlock up to ₹5,00,000 monthly withdrawals";
}
