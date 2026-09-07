"use client";

import { Deal, Prisma } from "@prisma/client";
export { formatCurrency } from "@/lib/utils-client";

export const formatContractDate = (value: unknown) => {
if (!value || typeof value !== "string") return "Not set";
const date = new Date(value);
return Number.isNaN(date.getTime())
? value
: date.toLocaleDateString("en-IN", {
day: "numeric",
month: "short",
year: "numeric",
});
};

export const normalizeTextArray = (value: unknown): string[] =>
Array.isArray(value)
? value.map((item) => String(item || "").trim()).filter(Boolean)
: [];

export const getIncludedRevisions = (
terms: { includedRevisions?: unknown } | null | undefined,
dealObj: { maxRevisions?: unknown } | null | undefined
): string => {
const val = terms?.includedRevisions ?? dealObj?.maxRevisions;
if (typeof val === "number") return String(val);
if (typeof val === "string" && val.trim()) return val.trim();
return "Standard";
};

export interface DeliverableItem {
type: string;
label: string;
count: number;
}

/** Shape of each deliverable entry stored in campaign.deliverables JSON */
interface DeliverableConfig {
type: string;
label?: string;
count?: number;
}

/** Shape of each content submission attached to a deal */
export interface ContentSubmission {
id?: string;
contentUrl?: string;
notes?: string;
createdAt?: string;
status?: string;
contentUrls?: ContentUrlEntry[];
}

/** Shape of each URL item inside a content submission */
export interface ContentUrlEntry {
type: string;
url: string;
status?: string;
feedback?: string;
}

export interface ContractTermsJson {
deliverables?: DeliverableConfig[];
submissionDeadline?: string;
postingDeadline?: string;
reviewPeriodHours?: number;
includedRevisions?: number | string;
requiresProduct?: boolean;
productValue?: number;
productHandlingFee?: number;
mandatoryElements?: string[];
mandatoryTags?: string[];
influencerPayout?: number;
platformFee?: number;
gatewayFee?: number;
totalAmount?: number;
influencerObligations?: string[];
brandObligations?: string[];
}

export function parseContractTerms(raw: unknown): ContractTermsJson {
if (!raw) return {};
if (typeof raw === "string") {
try {
return JSON.parse(raw) as ContractTermsJson;
} catch {
return {};
}
}
return raw as ContractTermsJson;
}

interface EngagementMetricsData {
views: number;
likes: number;
comments: number;
shares?: number;
saves?: number;
estimatedReach?: number;
engagementRate?: number;
}

export interface EngagementSnapshot {
interval?: string;
isEstimated?: boolean;
timestamp: string;
metrics: EngagementMetricsData;
}

interface ROIData {
estimatedCostPerView: number;
earnedMediaValue: number;
estimatedReach: number;
estimatedValue?: number;
roiPercentage?: number;
costPerView?: number;
costPerEngagement?: number;
}

export interface EngagementReport {
dealId: string;
campaignId: string;
influencerId: string;
postUrl: string;
lastUpdated: string;
currentMetrics: EngagementMetricsData;
snapshots: EngagementSnapshot[];
roi: ROIData;
hasEstimatedData?: boolean;
trend?: string;
}

export const statusConfig: Record<string, { label: string; color: string }> = {
PENDING_SIGNATURE: { label: "Pending Signature", color: "var(--color-primary)" },
ACTIVE: { label: "Active", color: "var(--color-accent-emerald)" },
CONTENT_SUBMITTED: { label: "Content Submitted", color: "var(--color-accent-amber)" },
REVISION_REQUESTED: { label: "Revision Requested", color: "var(--color-accent-rose)" },
CONTENT_APPROVED: { label: "Approved (Pending Post)", color: "var(--color-accent-teal)" },
POSTED: { label: "Posted (Verifying)", color: "var(--color-primary)" },
VERIFIED: { label: "Verified (Settling)", color: "var(--color-accent-emerald)" },
COMPLETED: { label: "Completed", color: "var(--color-success)" },
CANCELLED: { label: "Cancelled", color: "var(--color-text-muted)" },
DISPUTED: { label: "Disputed", color: "var(--color-accent-rose)" },
};

export const ratingLabelMap: Record<number, string> = {
1: "Poor - Disappointed",
2: "Fair - Needs improvement",
3: "Good - Satisfactory",
4: "Very Good - Great work",
5: "Excellent - Outstanding!",
};

export function getFlatDeliverablesList(dealObj: DealDetail | null | undefined) {
  const terms = parseContractTerms(dealObj?.contractTerms);
  const rawDeliverables = terms.deliverables ?? dealObj?.campaign?.deliverables;
  if (!rawDeliverables) return [];
  const arr = Array.isArray(rawDeliverables)
    ? (rawDeliverables as unknown as DeliverableConfig[])
    : ([] as DeliverableConfig[]);
  const list: { type: string; label: string }[] = [];
  arr.forEach((d: DeliverableConfig) => {
    const count = typeof d.count === "number" ? d.count : 1;
    const label = d.label || d.type || "Deliverable";
    for (let i = 0; i < count; i++) {
      const suffix = count > 1 ? ` _${i + 1}` : "";
      list.push({
        type: count > 1 ? `${d.type}_${i + 1}` : d.type,
        label: `${label}${suffix}`,
      });
    }
  });
  return list;
}

export interface DealDetail extends Omit<Deal, "contractTerms" | "shippingAddress" | "contractSignature"> {
campaign: {
title: string;
deliverables: Prisma.JsonValue;
requirements: string;
};
influencer: {
displayName: string;
};
contractTerms: Prisma.JsonValue;
shippingAddress: Prisma.JsonValue;
contractSignature: Prisma.JsonValue;
contentSubmissions?: ContentSubmission[];
}
