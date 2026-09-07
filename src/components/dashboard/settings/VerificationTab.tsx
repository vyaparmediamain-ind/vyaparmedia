"use client";

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

export interface VerificationData {
verificationLevel?: string;
trustScore?: number;
tier?: number;
tierLimit?: number | null;
tierDescription?: string;
emailVerified?: boolean;
phoneVerified?: boolean;
userType?: string;
documents?: {
id: string;
type: string;
status: string;
rejectionReason?: string;
}[];
}

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
<div
className="flex justify-center p-10"
>
<span
className="loading w-32 h-32"
/>
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
<div
className="flex flex-col gap-6 max-w-900"
>
<TierStatusCardComponent
tier={tier}
tierColors={tierColors}
isUnlimited={isUnlimited}
tierLimit={tierLimit}
tierDesc={tierDesc}
trustScore={verificationData.trustScore || 600}
/>

<Step1MandatoryCardComponent
emailVerified={emailVerified}
phoneVerified={phoneVerified}
/>

{/* DigiLocker Instant Verification */}
<DigiLockerCardComponent
isConnectingDigiLocker={isConnectingDigiLocker}
handleDigiLockerConnect={handleDigiLockerConnect}
/>

<Tier1CardComponent
tier={tier}
renderDocRow={renderDocRow}
/>

{/* Tier 2 */}
<Tier2CardComponent
tier={tier}
isBrand={isBrand}
renderDocRow={renderDocRow}
/>

{/* Tier 3 Business docs (Brand only) */}
{isBrand && (
<Tier3CardComponent
tier={tier}
renderDocRow={renderDocRow}
/>
)}

{/* Security note */}
<div
className="text-xs text-muted bg-secondary rounded-md border-card leading-relaxed px-4 py-3 flex items-start gap-2"
>
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald mt-0.5 flex-shrink-0">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
  <span>
    <strong>Security:</strong> All documents are encrypted and reviewed by our compliance team within 1-2 business days. They are never shared with third parties without your consent.
  </span>
</div>

<input
type="file"
ref={fileInputRef}
aria-label="Upload verification document"
onChange={handleFileChange}
className="hidden"
accept="image/*,application/pdf"
/>
</div>
);
}
