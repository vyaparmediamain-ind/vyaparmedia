"use client";

export { formatCurrency, formatDate } from "@/lib/utils-client";
import { formatDate } from "@/lib/utils-client";
import {
  type DealDetail,
  type ContentSubmissionItem as ContentSubmission,
  type ContentUrlEntry,
} from "@/lib/schemas";

export type { DealDetail, ContentSubmission, ContentUrlEntry };

export const formatContractDate = (value: unknown) => {
  return formatDate(value as string | Date | null | undefined, "Not set");
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


export interface ContractTermsJson {
  dealId?: string;
  dealAmount?: number;
  totalAmount?: number;
  deliverables?: DeliverableConfig[];
  submissionDeadline?: string;
  postingDeadline?: string;
  reviewPeriodHours?: number;
  includedRevisions?: number | string;
  costPerExtraRevision?: number;
  requiresProduct?: boolean;
  productName?: string;
  productValue?: number;
  productDescription?: string;
  productHandlingFee?: number;
  mandatoryElements?: string[];
  mandatoryTags?: string[];
  disclosureRequirement?: string;
  influencerPayout?: number;
  platformFee?: number;
  gstAmount?: number;
  gstPercent?: number;
  gatewayFee?: number;
  platformFeePercent?: number;
  influencerObligations?: string[];
  brandObligations?: string[];
  contentUsage?: {
    organicRepost?: string;
    paidAds?: string;
    whitelisting?: string;
  };
  cancellationFee?: {
    beforeApproval?: number;
    afterApproval?: number;
    afterSubmission?: number;
    afterPosting?: number;
  };
  proposalMessage?: string;
  brandLateApprovalFee?: number;
  platform?: {
    name?: string;
    legalName?: string;
    address?: string;
    gstin?: string;
    email?: string;
    phone?: string;
    website?: string;
  };
  taxNote?: string;
  createdAt?: string;
  version?: number;
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
clickThroughRate?: number;
metricsQuality?: {
  views?: string;
  likes?: string;
  comments?: string;
  shares?: string;
  saves?: string;
  clicks?: string;
  reach?: string;
  ratesQuality?: {
    engagementRate?: string;
    clickThroughRate?: string;
  };
};
}

export interface EngagementSnapshot {
interval?: string;
isEstimated?: boolean;
timestamp: string;
metrics: EngagementMetricsData;
metricsQuality?: {
  views?: string;
  likes?: string;
  comments?: string;
  shares?: string;
  saves?: string;
  clicks?: string;
  reach?: string;
  ratesQuality?: {
    engagementRate?: string;
    clickThroughRate?: string;
  };
};
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

import type { DealStatus } from "@prisma/client";

export const statusConfig: Record<DealStatus, { label: string; color: string }> = {
  PENDING_SIGNATURE: { label: "Pending Signature", color: "var(--color-primary)" },
  PAYMENT_PENDING: { label: "Payment Pending", color: "var(--color-accent-amber)" },
  PAYMENT_HELD: { label: "Funds in Escrow", color: "var(--color-accent-teal)" },
  ACTIVE: { label: "Active", color: "var(--color-accent-emerald)" },
  CONTENT_SUBMITTED: { label: "Content Submitted", color: "var(--color-accent-amber)" },
  REVISION_REQUESTED: { label: "Revision Requested", color: "var(--color-accent-rose)" },
  CONTENT_APPROVED: { label: "Approved (Pending Post)", color: "var(--color-accent-teal)" },
  POSTED: { label: "Posted (Verifying)", color: "var(--color-primary)" },
  VERIFICATION_PENDING: { label: "Verification Pending", color: "var(--color-primary)" },
  VERIFIED: { label: "Verified (Settling)", color: "var(--color-accent-emerald)" },
  COMPLETED: { label: "Completed", color: "var(--color-success)" },
  CANCELLED: { label: "Cancelled", color: "var(--color-text-muted-foreground)" },
  DISPUTED: { label: "Disputed", color: "var(--color-accent-rose)" },
};

export const ratingLabelMap: Record<number, string> = {
1: "Poor - Disappointed",
2: "Fair - Needs improvement",
3: "Good - Satisfactory",
4: "Very Good - Great work",
5: "Excellent - Outstanding!",
};

function isDeliverableConfig(item: unknown): item is DeliverableConfig {
  return typeof item === "object" && item !== null && "type" in item;
}

export function getFlatDeliverablesList(dealObj: DealDetail | null | undefined) {
  const terms = parseContractTerms(dealObj?.contractTerms);
  const rawDeliverables = terms.deliverables ?? dealObj?.campaign?.deliverables;
  if (!rawDeliverables) return [];
  const arr: DeliverableConfig[] = Array.isArray(rawDeliverables)
    ? rawDeliverables.filter(isDeliverableConfig)
    : [];
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

/**
 * Comprehensive hashtag, brand mention and ASCI compliance tag extractor.
 * Scans:
 * 1. Contract Terms: terms.mandatoryTags & terms.mandatoryElements
 * 2. Campaign Details: requirements, guidelines, description, title
 * 3. Deliverables Matrix: specifications, briefs, and labels
 * 4. Official Brand Handle: @brandname
 * 5. Statutory ASCI Compliance Tags: #ad, #sponsored, #collab, #vyaparmedia
 */
export function extractAllDealHashtagsAndMentions(
  deal: {
    campaign?: {
      title?: string | null | undefined;
      description?: string | null | undefined;
      requirements?: string | null | undefined;
      guidelines?: string | null | undefined;
      deliverables?: unknown;
    } | null | undefined;
    contractTerms?: unknown;
    brand?: {
      companyName?: string | null | undefined;
    } | null | undefined;
  } | null | undefined,
  terms?: {
    mandatoryTags?: unknown;
    mandatoryElements?: unknown;
    deliverables?: unknown;
  } | null | undefined
): string[] {
  const set = new Set<string>();

  const resolvedTerms = terms || (deal?.contractTerms ? parseContractTerms(deal.contractTerms) : null);

  // [1] Contract Terms: mandatoryTags & mandatoryElements
  const rawTermsTags = [
    ...(Array.isArray(resolvedTerms?.mandatoryTags) ? (resolvedTerms.mandatoryTags as unknown[]) : []),
    ...(Array.isArray(resolvedTerms?.mandatoryElements) ? (resolvedTerms.mandatoryElements as unknown[]) : []),
  ];
  for (const t of rawTermsTags) {
    if (typeof t === "string" && t.trim()) {
      const cleaned = t.trim();
      set.add(cleaned.startsWith("#") || cleaned.startsWith("@") ? cleaned : `#${cleaned}`);
    }
  }

  // [2 & 3] Campaign Details & Deliverables Matrix scanning
  const campaignTexts = [
    deal?.campaign?.title,
    deal?.campaign?.description,
    deal?.campaign?.requirements,
    deal?.campaign?.guidelines,
  ].filter(Boolean).join(" ");

  const deliverables = resolvedTerms?.deliverables || deal?.campaign?.deliverables;
  const deliverablesText = deliverables ? JSON.stringify(deliverables) : "";
  const allScanText = `${campaignTexts} ${deliverablesText}`;

  const textMatches = allScanText.match(/[#@][A-Za-z0-9_.-]{2,50}/g) || [];
  for (const m of textMatches) {
    set.add(m.trim());
  }

  // [4] Official Brand Handle: @brandname
  const brandName = deal?.brand?.companyName;
  if (brandName && brandName.trim() && !["brand", "brand partner", "client"].includes(brandName.trim().toLowerCase())) {
    const sanitizedBrand = brandName.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (sanitizedBrand.length >= 2) {
      set.add(`@${sanitizedBrand}`);
    }
  }

  // [5] Statutory ASCI Compliance Tags (Guaranteed for legal escrow safety)
  set.add("#ad");
  set.add("#sponsored");
  set.add("#collab");
  set.add("#vyaparmedia");

  return Array.from(set);
}

