import { AppError } from "@/lib/errors";
/**
* Contract Engine - Manages deal agreements, structured terms, and fee enforcement.
* STRICT RULE-BASED LOGIC ONLY.
*/

import prisma from "./db";
import { Prisma } from "@prisma/client";
import { addDays } from "date-fns";
import { getDealTotalAmount } from "./utils";
import { createActivityLog } from "./audit";
import { PLATFORM_CONFIG } from "./platform-config";
import { env } from "@/env";

// ==================== TYPES ====================

export interface ContractDeliverable {
type: string;
count: number;
platform: "INSTAGRAM" | "YOUTUBE" | "OTHER";
details: string;
duration?: string;
specs?: string;
}

export interface ContractTerms {
dealId: string;
dealAmount: number; // Creator fee in paise
totalAmount: number; // Brand payable in paise
platformFee: number;
gatewayFee: number;
platformFeePercent: number;
influencerPayout: number;
productHandlingFee: number;
requiresProduct: boolean;
productName?: string;
productValue?: number;
productDescription?: string;

// Platform Details
platform: {
name: string;
legalName: string;
address: string;
gstin: string;
email: string;
phone: string;
website: string;
};

// Deliverables
deliverables: ContractDeliverable[];
mandatoryTags: string[]; // @brand, #ad
mandatoryElements: string[]; // Backward-compatible alias used by legacy flows
disclosureRequirement: string;

// Timeline
submissionDeadline: string; // ISO Date
reviewPeriodHours: number; // Default 48h
postingDeadline: string; // ISO Date

// Revisions
includedRevisions: number; // Default 2
costPerExtraRevision: number; // Default 50000 (INR 500)
maxRevisionsLimit?: number; // Optional hard limit cap for revisions

// Cancellation Policy
cancellationFee: {
beforeApproval: number; // 0%
afterApproval: number; // 30% — payout when cancelled after submission but before approval
afterSubmission: number; // 70% — payout when cancelled after brand approval
afterPosting: number; // 100%
};

// Late Fees
brandLateApprovalFee: number; // 5% flat fee if brand delays >48h

contentUsage: {
organicRepost: string;
paidAds: string;
whitelisting: string;
};
influencerObligations: string[];
brandObligations: string[];
taxNote: string;
proposalMessage?: string;

createdAt: string;
version: number;
}

// ==================== GENERATE CONTRACT ====================

function collectContractText(value: unknown, depth = 0): string[] {
  if (depth > 5 || value === null || value === undefined) return [];

  if (typeof value === "string" || typeof value === "number") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectContractText(item, depth + 1));
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .filter(([k]) => Object.hasOwn(value, k))
      .flatMap(([, item]) => collectContractText(item, depth + 1));
  }

  return [];
}

function uniqueNonEmpty(values: string[]): string[] {
return Array.from(
new Set(values.map((item) => item.trim()).filter(Boolean)),
);
}

function inferPlatform(text: string): "INSTAGRAM" | "YOUTUBE" | "OTHER" {
const normalized = text.toUpperCase();
if (normalized.includes("YOUTUBE") || normalized.includes("SHORT")) {
return "YOUTUBE";
}
if (
normalized.includes("INSTAGRAM") ||
normalized.includes("REEL") ||
normalized.includes("STORY") ||
normalized.includes("POST")
) {
return "INSTAGRAM";
}
return "OTHER";
}

function normalizeContractDeliverables(value: unknown): ContractDeliverable[] {
if (typeof value === "string") {
return [
{
type: "POST",
count: 1,
platform: inferPlatform(value),
details: value,
},
];
}

if (!Array.isArray(value)) return [];

return value
.map((item) => {
if (typeof item === "string") {
return {
type: "POST",
count: 1,
platform: inferPlatform(item),
details: item,
};
}

if (!item || typeof item !== "object") return null;

const record = item as Record<string, unknown>;
const recordType = typeof record.type === "string" ? record.type : "";
const type = (recordType || "POST").trim().toUpperCase();
const recordSpecs = typeof record.specs === "string" ? record.specs : "";
const recordDetails = typeof record.details === "string" ? record.details : "";
const details = (recordSpecs || recordDetails || type).trim();
const count = Math.max(1, Math.min(50, Number(record.count || 1)));
const platform = inferPlatform(`${type} ${details}`);

let durationVal = "";
if (typeof record.duration === "string") {
durationVal = record.duration;
} else if (typeof record.duration === "number") {
durationVal = String(record.duration);
}
const specsVal = typeof record.specs === "string" ? record.specs : "";

return {
type,
count,
platform,
details,
...(durationVal ? { duration: durationVal.trim() } : {}),
...(specsVal ? { specs: specsVal.trim() } : {}),
};
})
.filter((item): item is ContractDeliverable => Boolean(item));
}

function extractMandatoryElements(text: string): string[] {
const matches = text.match(/[#@][A-Za-z0-9_.-]{2,50}/g) || [];
return uniqueNonEmpty(["#ad", "#sponsored", ...matches]).slice(0, 24);
}

export function generateContractTerms(
dealId: string,
campaign: {
totalBudget: number;
perInfluencerBudget?: number;
deliverables: unknown;
requirements?: string;
contentDeadline?: Date;
postingDeadline?: Date;
requiresProduct?: boolean;
productName?: string | null;
productValue?: number | null;
productDescription?: string | null;
},
proposal?: {
rate?: number;
message?: string;
platformFee?: number;
gatewayFee?: number;
totalAmount?: number;
platformFeePercent?: number;
influencerPayout?: number;
productHandlingFee?: number;
},
): ContractTerms {
const dealAmount = proposal?.rate || campaign.perInfluencerBudget || 0;
const platformFeePercent = env.PLATFORM_FEE_PERCENTAGE;
const effectivePlatformFeePercent =
proposal?.platformFeePercent ?? platformFeePercent;
const productHandlingFee = proposal?.productHandlingFee ?? 0;
const platformFee =
proposal?.platformFee ??
Math.round((dealAmount * effectivePlatformFeePercent) / 100) +
productHandlingFee;
const gatewayFee =
proposal?.gatewayFee ??
Math.round(
((dealAmount + platformFee) *
env.GATEWAY_FEE_PERCENTAGE) /
100,
);
const totalAmount =
proposal?.totalAmount ?? dealAmount + platformFee + gatewayFee;
const influencerPayout = proposal?.influencerPayout ?? dealAmount;
const requiresProduct = Boolean(campaign.requiresProduct);
const productValue = Math.max(0, Number(campaign.productValue || 0));

const deliverables = normalizeContractDeliverables(campaign.deliverables);
const contractText = collectContractText([
campaign.requirements,
campaign.deliverables,
proposal?.message,
]).join(" ");
const mandatoryElements = extractMandatoryElements(contractText);

return {
dealId,
dealAmount,
totalAmount,
platformFee,
gatewayFee,
platformFeePercent: effectivePlatformFeePercent,
influencerPayout,
productHandlingFee,
requiresProduct,
...(requiresProduct && campaign.productName
? { productName: campaign.productName }
: {}),
...(requiresProduct ? { productValue } : {}),
...(requiresProduct && campaign.productDescription
? { productDescription: campaign.productDescription }
: {}),

platform: {
name: PLATFORM_CONFIG.name,
legalName: PLATFORM_CONFIG.legalName,
address: PLATFORM_CONFIG.address,
gstin: PLATFORM_CONFIG.gstin,
email: PLATFORM_CONFIG.email,
phone: PLATFORM_CONFIG.phone,
website: PLATFORM_CONFIG.website,
},

deliverables,
mandatoryTags: mandatoryElements,
mandatoryElements,
disclosureRequirement:
"Creator must include required advertising disclosures and mandatory tags in approved content and live posts.",

submissionDeadline: campaign.contentDeadline
? campaign.contentDeadline.toISOString()
: addDays(new Date(), 7).toISOString(),
reviewPeriodHours: 48,
postingDeadline: campaign.postingDeadline
? campaign.postingDeadline.toISOString()
: addDays(new Date(), 14).toISOString(),

includedRevisions: 2,
costPerExtraRevision: 50000, // INR 500

cancellationFee: {
beforeApproval: 0,
afterApproval: 30,
afterSubmission: 70,
afterPosting: 100,
},

brandLateApprovalFee: 10, // 10%

contentUsage: {
organicRepost:
"Brand may repost approved content organically with creator credit for the campaign unless the deal states otherwise.",
paidAds:
"Paid usage, boosting, dark posts, or whitelisting require explicit written approval in the deal chat or a separate addendum.",
whitelisting:
"Creator account access, whitelisting, or collaborator permissions are never implied by this contract.",
},
influencerObligations: [
...(requiresProduct
? [
"Provide a complete shipping address before the brand dispatches the product.",
"Confirm product receipt before submitting campaign content.",
]
: []),
"Submit original content by the submission deadline.",
"Keep approved live posts public until the posting obligation ends unless the brand agrees otherwise.",
"Do not share private contact details outside platform rules before the deal is active.",
"Do not use fake engagement, misleading analytics, copied content, or undisclosed AI/deepfake assets.",
],
brandObligations: [
"Fund or authorize payment before requiring work beyond normal proposal review.",
"Review content within the review window with clear approval or revision feedback.",
"Do not request extra usage rights, deliverables, or deadlines outside the signed terms without mutual consent.",
requiresProduct
? "Dispatch the product sample with tracking details before requiring content submission."
: "Provide brand assets on time when the campaign requires them.",
],
taxNote:
"Each party is responsible for GST, TDS, ITR, invoice, and other tax obligations that apply to them under Indian law.",
...(proposal?.message ? { proposalMessage: proposal.message } : {}),

createdAt: new Date().toISOString(),
version: 3,
};
}

// ==================== FEE CALCULATORS ====================

export async function calculateCancellation(dealId: string, tx?: Prisma.TransactionClient): Promise<{
  refundAmount: number;
  payoutAmount: number;
  platformFeeKept: number;
  reason: string;
}> {
  const client = tx || prisma;
  const deal = await client.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      amount: true,
      totalAmount: true,
      status: true,
      platformFee: true,
      contractTerms: true,
    },
  });

if (!deal) {
throw AppError.notFound("Deal not found");
}

const totalHeld = getDealTotalAmount(deal);
const dealAmount = deal.amount;

const policy = (deal.contractTerms as { cancellationFee?: { beforeApproval: number; afterApproval: number; afterSubmission: number; afterPosting: number } } | null)?.cancellationFee || {
beforeApproval: 0,
afterApproval: 30,
afterSubmission: 70,
afterPosting: 100,
};

// Determine cancellation payout percentage based on deal status and contract terms
let payoutPercent: number;
let reason: string;

switch (deal.status) {
    case "PENDING_SIGNATURE":
    case "PAYMENT_PENDING":
    case "PAYMENT_HELD":
      payoutPercent = policy.beforeApproval ?? 0;
      reason = `Cancelled before deal activation (${payoutPercent}% cancellation fee)`;
      break;
    case "ACTIVE":
      payoutPercent = policy.afterApproval ?? 30;
      reason = `Cancelled after deal activation but before content submission (${payoutPercent}% payout)`;
      break;
    case "CONTENT_SUBMITTED":
    case "REVISION_REQUESTED":
    case "DISPUTED":
      payoutPercent = policy.afterSubmission ?? 70;
      reason = `Cancelled after content submission but before approval (${payoutPercent}% payout)`;
      break;
    case "CONTENT_APPROVED":
      payoutPercent = policy.afterSubmission ?? 70;
      reason = `Cancelled after content approval by brand (${payoutPercent}% payout)`;
      break;
    case "POSTED":
    case "VERIFIED":
    case "COMPLETED":
      payoutPercent = "afterPosting" in policy ? policy.afterPosting : 100;
      reason = `Cancelled after content posted or verified (${payoutPercent}% payout)`;
      break;
    default:
      payoutPercent = 0;
      reason = "Cancellation before approval";
}

  const payoutAmount = Math.round(dealAmount * (payoutPercent / 100));
  // Platform keeps proportional amount of the actual platform fee
  const platformFeeKept = Math.round((deal.platformFee ?? Math.round(dealAmount * 0.1)) * (payoutPercent / 100));
  const refundAmount = Math.max(0, totalHeld - payoutAmount - platformFeeKept);

  return {
    refundAmount,
    payoutAmount,
    platformFeeKept,
    reason,
  };
}

export function checkRevisionLimit(
  deal: { revisionsUsed: number; maxRevisions: number },
  contract: ContractTerms,
): { allowed: boolean; cost: number; message?: string } {
  if (contract.maxRevisionsLimit !== undefined && deal.revisionsUsed >= contract.maxRevisionsLimit) {
    return {
      allowed: false,
      cost: 0,
      message: `Maximum revision limit of ${contract.maxRevisionsLimit} reached. No further revisions are allowed.`,
    };
  }

  if (deal.revisionsUsed < deal.maxRevisions) {
    return { allowed: true, cost: 0 };
  }

  // Extra revision
  return {
    allowed: true, // Allowed but paid
    cost: contract.costPerExtraRevision,
    message: `Free revisions used. This revision will cost INR ${(contract.costPerExtraRevision / 100).toFixed(2)}.`,
  };
}

// ==================== DIGITAL SIGNATURES ====================

import crypto from "node:crypto";
import { logger } from "./logger";

export interface ContractSignature {
userId: string;
signedAt: string;
signatureHash: string; // HMAC-SHA256 of contract terms
ipAddress?: string | undefined;
userAgent?: string | undefined;
}

export interface SignedContract {
contractTerms: ContractTerms;
contractHash: string; // SHA-256 hash of stringified terms
influencerSignature?: ContractSignature | undefined;
brandSignature?: ContractSignature | undefined;
isFullySigned: boolean;
signedAt?: string | undefined;
}

/**
* Generate a tamper-proof hash of contract terms.
* Any modification to the terms will change this hash.
*/
function deterministicJsonStringify(value: unknown): string {
if (
value === undefined ||
typeof value === "function" ||
typeof value === "symbol"
) {
return "null";
}

if (value === null || typeof value !== "object") {
return JSON.stringify(value) ?? "null";
}

if (value instanceof Date) {
return JSON.stringify(value.toISOString());
}

if (Array.isArray(value)) {
return `[${value
.map((item) => {
const stringified = deterministicJsonStringify(item);
return stringified ?? "null";
})
.join(",")}]`;
}

const objectValue = value as Record<string, unknown>;
const entries = Object.keys(objectValue)
.sort((a, b) => a.localeCompare(b))
.flatMap((key) => {
const item = objectValue[key];
if (
item === undefined ||
typeof item === "function" ||
typeof item === "symbol"
) {
return [];
}

const stringified = deterministicJsonStringify(item);
if (stringified === undefined) return [];

return `${JSON.stringify(key)}:${stringified}`;
});

return `{${entries.join(",")}}`;
}

function generateContractHash(terms: ContractTerms): string {
const canonical = deterministicJsonStringify(terms);
return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
* Sign a contract - creates an HMAC signature using the user's ID + contract hash.
* This proves that this specific user agreed to these specific terms.
*/
function signContract(
terms: ContractTerms,
userId: string,
ipAddress?: string,
userAgent?: string,
): ContractSignature {
const contractHash = generateContractHash(terms);
const signingKey = process.env.CONTRACT_SIGNING_SECRET;

// Always require the signing secret never fall back to a hardcoded key
if (!signingKey) {
throw AppError.badRequest("CONTRACT_SIGNING_SECRET environment variable is required. Set it in .env.local for development.",);
}
if (signingKey.length < 32) {
throw AppError.badRequest("CONTRACT_SIGNING_SECRET must be at least 32 characters long",);
}

const key = signingKey;
const timestamp = new Date().toISOString();
const payload = `${userId}:${contractHash}:${timestamp}`;
const signatureHash = crypto
.createHmac("sha256", key)
.update(payload)
.digest("hex");

return {
userId,
signedAt: timestamp,
signatureHash,
ipAddress,
userAgent,
};
}

/**
* Verify a contract signature is valid and terms haven't been tampered with.
*/
export function verifyContractSignature(
terms: ContractTerms,
signature: ContractSignature,
): boolean {
const contractHash = generateContractHash(terms);
const signingKey = process.env.CONTRACT_SIGNING_SECRET;

// Always require the signing secret never fall back to a hardcoded key
if (!signingKey) {
throw AppError.badRequest("CONTRACT_SIGNING_SECRET environment variable is required. Set it in .env.local for development.",);
}

const key = signingKey;
const payload = `${signature.userId}:${contractHash}:${signature.signedAt}`;
const expectedHash = crypto
.createHmac("sha256", key)
.update(payload)
.digest("hex");

// Use timingSafeEqual to prevent timing attacks.
// Both expectedHash and signatureHash are hex-encoded HMAC-SHA256 strings.
// Decode as "hex" (32-byte binary buffers) for correct semantic comparison.
// Using "utf8" creates 64-byte ASCII buffers which happen to work today but
// would silently break if either side switched encoding in a future refactor.
const expectedBuffer = Buffer.from(expectedHash, "hex");
const actualBuffer = Buffer.from(signature.signatureHash, "hex");
if (expectedBuffer.length !== actualBuffer.length) return false;

return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function validateSigningRequest(
deal: { influencer: { userId: string }; brand: { userId: string } | null; status: string; contractTerms: unknown } | null,
userId: string,
role: "INFLUENCER" | "BRAND",
actorStatus?: string
) {
if (!deal) throw AppError.notFound("Deal not found");
if (!deal.contractTerms) throw AppError.badRequest("No contract terms to sign");
if (deal.status !== "PENDING_SIGNATURE") {
throw AppError.badRequest("Deal is not pending signature");
}

const isInfluencer = userId === deal.influencer.userId;
const isBrand = userId === deal.brand?.userId;

if (role === "INFLUENCER" && !isInfluencer)
throw AppError.badRequest("User is not the influencer on this deal");
if (role === "BRAND" && !isBrand)
throw AppError.badRequest("User is not the brand on this deal");

if (actorStatus === "SUSPENDED" || actorStatus === "BANNED") {
throw AppError.badRequest("Account suspended. Cannot perform this action.");
}
}

function buildUpdatedSignature(
existingSigs: SignedContract,
role: "INFLUENCER" | "BRAND",
signature: ContractSignature,
terms: ContractTerms,
contractHash: string
): SignedContract {
if (role === "INFLUENCER" && existingSigs.influencerSignature) {
throw AppError.badRequest("Influencer has already signed this contract");
}
if (role === "BRAND" && existingSigs.brandSignature) {
throw AppError.badRequest("Brand has already signed this contract");
}

const updated: SignedContract = {
contractTerms: terms,
contractHash,
influencerSignature:
role === "INFLUENCER" ? signature : existingSigs.influencerSignature,
brandSignature:
role === "BRAND" ? signature : existingSigs.brandSignature,
isFullySigned: false,
signedAt: undefined,
};

if (updated.influencerSignature && updated.brandSignature) {
updated.isFullySigned = true;
updated.signedAt = new Date().toISOString();
}

return updated;
}

/**
* Sign and save contract to the deal record.
* Returns the updated signed contract state.
*/
export async function signAndSaveDealContract(
dealId: string,
userId: string,
role: "INFLUENCER" | "BRAND",
ipAddress?: string,
userAgent?: string,
): Promise<{ success: boolean; signed: SignedContract; message: string }> {
const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
// LOCK: Acquire row lock to prevent lost updates during concurrent signing
await tx.deal.update({
where: { id: dealId },
data: { updatedAt: new Date() }, // Update timestamp to lock row
});

const deal = await tx.deal.findUnique({
where: { id: dealId },
select: {
id: true,
status: true,
contractTerms: true,
contractSignature: true,
reservedFromWallet: true,
influencer: { select: { userId: true } },
brand: { select: { userId: true } },
},
});

const actor = await tx.user.findUnique({
where: { id: userId },
select: { status: true },
});

validateSigningRequest(deal, userId, role, actor?.status);
if (!deal?.contractTerms) {
  throw AppError.badRequest("Deal has no contract terms to sign");
}

// Safe cast as we enforce schema structure elsewhere
const terms = deal.contractTerms as unknown as ContractTerms;

// Generate signature
const signature = signContract(terms, userId, ipAddress, userAgent);
const contractHash = generateContractHash(terms);

// Get existing signatures
const existingSigs =
(deal.contractSignature
? (deal.contractSignature as unknown as SignedContract)
: null) ||
({
contractTerms: terms,
contractHash,
influencerSignature: undefined,
brandSignature: undefined,
isFullySigned: false,
signedAt: undefined,
} as SignedContract);

// Update with new signature
const updated = buildUpdatedSignature(existingSigs, role, signature, terms, contractHash);

// Save to deal
const signedAt = new Date(signature.signedAt);
await tx.deal.update({
where: { id: dealId },
data: {
contractSignature: structuredClone(updated) as unknown as Prisma.InputJsonValue,
...(role === "BRAND"
? { brandSignedAt: signedAt }
: { influencerSignedAt: signedAt }),
...(updated.isFullySigned && deal.status === "PENDING_SIGNATURE"
? { status: deal.reservedFromWallet ? "PAYMENT_HELD" : "PAYMENT_PENDING" }
: {}),
},
});

// Log the signature event
await createActivityLog({
userId,
action: "CONTRACT_SIGNED",
metadata: {
dealId,
role,
contractHash,
isFullySigned: updated.isFullySigned,
signedAt: signature.signedAt,
ipAddress,
},
}, tx);

return updated;
}, {
isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
});

logger.info("Contract signed", {
dealId,
userId,
role,
isFullySigned: result.isFullySigned,
});

return {
success: true,
signed: result,
message: result.isFullySigned
? "Contract fully signed by both parties. Payment is secured and the deal can proceed."
: `Contract signed by ${role.toLowerCase()}. Waiting for counterparty signature.`,
};
}
