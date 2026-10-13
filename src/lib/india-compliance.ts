import { z } from "zod";

const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;
const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[\dA-Z]$/;
const ITR_ACK_REGEX = /^\d{10,20}$/;
const ASSESSMENT_YEAR_REGEX = /^20\d{2}-\d{2}$/;

const GST_REGISTRATION_TYPES = [
"UNREGISTERED",
"REGISTERED",
"COMPOSITION",
"EXEMPT",
] as const;

const GST_TURNOVER_SLABS = [
"BELOW_20L",
"BETWEEN_20L_AND_5CR",
"FIVE_CR_PLUS",
"TEN_CR_PLUS",
] as const;

export type GstRegistrationType = (typeof GST_REGISTRATION_TYPES)[number];
export type GstTurnoverSlab = (typeof GST_TURNOVER_SLABS)[number];

function normalizePan(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function normalizeGstin(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function normalizeItrAcknowledgement(value: string) {
  return value.replace(/\s+/g, "");
}

export function maskIdentifier(last4?: string | null) {
return last4 ? `****${last4}` : null;
}

export function getGstinStateCode(gstin?: string | null) {
return gstin ? gstin.slice(0, 2) : null;
}

export function gstinBelongsToPan(gstin: string, pan: string) {
return normalizeGstin(gstin).slice(2, 12) === normalizePan(pan);
}

export function isEInvoiceApplicable(slab?: GstTurnoverSlab | null) {
return slab === "FIVE_CR_PLUS" || slab === "TEN_CR_PLUS";
}

function emptyToUndefined(value: unknown) {
if (typeof value !== "string") return value;
const trimmed = value.trim();
return trimmed.length === 0 ? undefined : trimmed;
}

export const indiaTaxComplianceInputSchema = z
.object({
panNumber: z.preprocess(
emptyToUndefined,
z
.string()
.transform(normalizePan)
.refine((value) => PAN_REGEX.test(value), "Invalid PAN format")
.optional(),
),
gstin: z.preprocess(
emptyToUndefined,
z
.string()
.transform(normalizeGstin)
.refine((value) => GSTIN_REGEX.test(value), "Invalid GSTIN format")
.optional(),
),
  gstRegistrationType: z
    .preprocess(emptyToUndefined, z.enum(GST_REGISTRATION_TYPES).optional()),
gstTurnoverSlab: z
.preprocess(emptyToUndefined, z.enum(GST_TURNOVER_SLABS).optional()),
itrAcknowledgementNumber: z.preprocess(
emptyToUndefined,
z
.string()
.transform(normalizeItrAcknowledgement)
.refine(
(value) => ITR_ACK_REGEX.test(value),
"Invalid ITR acknowledgement number",
)
.optional(),
),
itrAssessmentYear: z.preprocess(
emptyToUndefined,
z
.string()
.trim()
.refine(
(value) => ASSESSMENT_YEAR_REGEX.test(value),
"Assessment year must use YYYY-YY format",
)
.optional(),
),
})
.superRefine((data, ctx) => {
const registeredForGst =
data.gstRegistrationType === "REGISTERED" ||
data.gstRegistrationType === "COMPOSITION";

if (registeredForGst && !data.gstin) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["gstin"],
message: "GSTIN is required for registered GST profiles",
});
}

if (data.panNumber && data.gstin && !gstinBelongsToPan(data.gstin, data.panNumber)) {
ctx.addIssue({
code: z.ZodIssueCode.custom,
path: ["gstin"],
message: "GSTIN embedded PAN does not match the PAN number",
});
}
});

type IndiaTaxSummaryInput = {
  userType: "BRAND" | "INFLUENCER" | "ADMIN";
  panPresent: boolean;
  gstinPresent: boolean;
  itrPresent: boolean;
  gstRegistrationType?: GstRegistrationType | null;
  gstTurnoverSlab?: GstTurnoverSlab | null;
  profileCompleteForInvoice?: boolean;
};

export function getIndiaTaxSummary(input: IndiaTaxSummaryInput) {
const blocking: string[] = [];
const advisories: string[] = [];

checkPanRequirement(input, blocking);
if (input.userType === "BRAND") {
checkBrandRequirements(input, blocking, advisories);
}
checkInfluencerRequirements(input, advisories);
checkGstTurnoverSlab(input, advisories);

return {
status: blocking.length > 0 ? "ACTION_REQUIRED" : "READY",
blocking,
advisories,
};
}

function checkPanRequirement(input: IndiaTaxSummaryInput, blocking: string[]) {
if (input.userType !== "ADMIN" && !input.panPresent) {
blocking.push("PAN is required before payouts and tax reconciliation.");
}
}

function checkBrandRequirements(input: IndiaTaxSummaryInput, blocking: string[], advisories: string[]) {
if (!input.profileCompleteForInvoice) {
blocking.push("Legal address, state, and PIN code are required for GST invoice records.");
}

const registeredForGst =
input.gstRegistrationType === "REGISTERED" ||
input.gstRegistrationType === "COMPOSITION";

if (registeredForGst && !input.gstinPresent) {
blocking.push("GSTIN is required when the brand is GST registered.");
}

if (input.gstTurnoverSlab === "FIVE_CR_PLUS" || input.gstTurnoverSlab === "TEN_CR_PLUS") {
advisories.push("AATO 5 crore plus: B2B e-invoice workflow/IRN readiness is applicable.");
}

if (input.gstTurnoverSlab === "TEN_CR_PLUS") {
advisories.push("AATO 10 crore plus: e-invoices should be reported within the current IRP reporting window.");
}
}

function checkInfluencerRequirements(input: IndiaTaxSummaryInput, advisories: string[]) {
if (input.userType === "INFLUENCER" && !input.itrPresent) {
advisories.push("ITR acknowledgement is recommended for higher-trust payout reviews.");
}
if (input.userType === "INFLUENCER" && input.gstRegistrationType === "REGISTERED") {
advisories.push("GST Section 52 TCS (1%) applies to registered supplier payouts processed via platform.");
}
}

function checkGstTurnoverSlab(input: IndiaTaxSummaryInput, advisories: string[]) {
if (!input.gstTurnoverSlab) {
advisories.push("Select GST turnover slab so tax readiness rules stay explicit.");
}
}

export interface GstTcsCalculation {
  taxableAmountPaise: number;
  tcsRate: number;
  tcsAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  isInterState: boolean;
}

/**
 * Calculates Tax Collected at Source (TCS) under Section 52 of the CGST Act, 2017.
 * Applicable to electronic commerce operators collecting consideration for supplies made through them.
 * Rate: 0.5% CGST + 0.5% SGST (intra-state) or 1.0% IGST (inter-state).
 */
export function calculateGstTcs(
  taxableAmountPaise: number,
  supplierStateCode?: string | null,
  operatorStateCode: string = "29", // Karnataka default
): GstTcsCalculation {
  const amount = Math.max(0, Math.round(taxableAmountPaise));
  const tcsRate = 0.01; // 1% net TCS under Section 52
  const tcsAmountPaise = Math.round(amount * tcsRate);

  const isInterState = Boolean(supplierStateCode && supplierStateCode !== operatorStateCode);
  if (isInterState) {
    return {
      taxableAmountPaise: amount,
      tcsRate,
      tcsAmountPaise,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: tcsAmountPaise,
      isInterState: true,
    };
  }

  const half = Math.floor(tcsAmountPaise / 2);
  return {
    taxableAmountPaise: amount,
    tcsRate,
    tcsAmountPaise,
    cgstPaise: half,
    sgstPaise: tcsAmountPaise - half,
    igstPaise: 0,
    isInterState: false,
  };
}
