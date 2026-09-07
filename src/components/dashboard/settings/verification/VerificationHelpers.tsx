"use client";

import { Button } from "@/components/ui";

interface StatusBadgeProps {
doc?: { status: string; rejectionReason?: string | null } | null | undefined;
}

export function StatusBadge({ doc }: Readonly<StatusBadgeProps>) {
if (!doc)
return (
<span
className="text-muted text-xs bg-tertiary rounded-2xl px-2 py-0.5"
>
Not uploaded
</span>
);
const icons: Record<string, string> = {
  VERIFIED: "✓",
  PENDING: "⏳",
  UNDER_REVIEW: "⏳",
  REJECTED: "✗",
};
const labels: Record<string, string> = {
  VERIFIED: "Verified",
  PENDING: "Under Review",
  UNDER_REVIEW: "Under Review",
  REJECTED: "Rejected",
};
  let statusClass = "text-amber bg-amber-subtle border-amber-subtle";
  if (doc.status === "VERIFIED") {
    statusClass = "text-emerald bg-emerald-subtle border-emerald-subtle";
  } else if (doc.status === "REJECTED") {
    statusClass = "text-rose bg-rose-subtle border-rose-subtle";
  }

  return (
    <span
      className={`font-semibold text-xs rounded-2xl px-2 py-0.5 ${statusClass}`}
    >
      {icons[doc.status] ?? "•"} {labels[doc.status] ?? doc.status}
    </span>
  );
}

export function getTierIcon(tier: number): React.ReactNode {
  const common = "w-6 h-6 stroke-current";
  if (tier === 0) {
    return (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={common}>
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );
  }
  if (tier === 1) {
    return (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`${common} text-amber-600`}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    );
  }
  if (tier === 2) {
    return (
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`${common} text-slate-300`}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  // Tier 3
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`${common} text-amber-400`}>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

interface UploadBtnProps {
doc?: { status: string; rejectionReason?: string | null } | null | undefined;
type: string;
isUploading: boolean;
uploadingDocType: string | null;
onUpload: (type: string) => void;
}

function getUploadButtonText(isUploading: boolean, uploadingDocType: string | null, type: string, hasDoc: boolean) {
if (isUploading && uploadingDocType === type) return "⏳";
if (hasDoc) return "↑ Re-upload";
return "↑ Upload";
}

function UploadBtn({
doc,
type,
isUploading,
uploadingDocType,
onUpload,
}: Readonly<UploadBtnProps>) {
if (doc?.status === "VERIFIED") return null;
return (
<Button
variant="secondary"
aria-label={`${doc ? "Re-upload" : "Upload"} ${type.replaceAll("_", " ").toLowerCase()}`}
aria-busy={isUploading && uploadingDocType === type}
onClick={() => onUpload(type)}
disabled={isUploading}
className="text-xs px-2 py-1"
>
{getUploadButtonText(isUploading, uploadingDocType, type, !!doc)}
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
  let rowClass = "bg-tertiary border-card";
  if (doc?.status === "VERIFIED") {
    rowClass = "bg-emerald-subtle border-emerald-subtle";
  } else if (doc?.status === "REJECTED") {
    rowClass = "bg-tertiary border-rose-subtle";
  }

  return (
    <div
      className={`flex items-center justify-between rounded-md px-4 py-3 ${rowClass}`}
    >
<div
className="flex items-center gap-2.5"
>
<span className="text-lg">{icon}</span>
<div>
<div className="font-semibold text-sm">
{label}
</div>
<div
className="text-muted text-xs"
>
{desc}
</div>
{doc?.status === "REJECTED" &&
doc.rejectionReason && (
<div
className="mt-1 text-xs text-rose"
>
✗ Rejected: {doc.rejectionReason}
</div>
)}
</div>
</div>
<div
className="flex flex-col items-end gap-1.5"
>
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
if (isUnlimited) return "∞ Unlimited";
if (tier === 0) return "Locked";
if (tierLimit) return `₹${(tierLimit / 100).toLocaleString("en-IN")}`;
return "—";
}

export function getTierUpgradeActionText(tier: number, isBrand: boolean) {
if (tier < 1) return "🔒 Complete Tier 1 first";
if (isBrand) return "📋 Upload to unlock ₹1L limit";
return "🚀 Upload to unlock unlimited campaigns";
}
