import { apiWrapper } from "@/lib/api-wrapper";
import { AppError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { DocumentType, Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { createActivityLog } from "@/lib/audit";
import { encrypt, tryDecrypt } from "@/lib/encryption";
import {
type GstRegistrationType,
type GstTurnoverSlab,
getGstinStateCode,
getIndiaTaxSummary,
gstinBelongsToPan,
indiaTaxComplianceInputSchema,
isEInvoiceApplicable,
maskIdentifier,
} from "@/lib/india-compliance";
import { logger } from "@/lib/logger";
import { isBrand, isInfluencer } from "@/lib/rbac";

interface IndiaTaxInput {
gstRegistrationType?: GstRegistrationType | null | undefined;
gstTurnoverSlab?: GstTurnoverSlab | null | undefined;
panNumber?: string | null | undefined;
gstin?: string | null | undefined;
itrAcknowledgementNumber?: string | null | undefined;
itrAssessmentYear?: string | null | undefined;
}

type IndiaTaxUser = Prisma.UserGetPayload<{
select: {
id: true;
userType: true;
taxCompliance: true;
influencerProfile: { select: { displayName: true } };
brandProfile: {
select: {
companyName: true;
address: true;
state: true;
pinCode: true;
};
};
};
}>;

type IndiaTaxCompliance = Prisma.IndiaTaxComplianceGetPayload<Record<string, never>>;

import { verifyPAN, verifyGST } from "@/lib/kyc";

function namesMatch(registeredName: string, kycName: string): boolean {
  const commonTokens = new Set([
    "kumar", "singh", "devi", "prasad", "sri", "shree", "mr", "mrs", "miss", "dr", 
    "and", "co", "ltd", "pvt", "private", "limited"
  ]);
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !commonTokens.has(token));
  const regTokens = normalize(registeredName);
  const kycTokens = normalize(kycName);
  if (regTokens.length === 0 || kycTokens.length === 0) return false;

  const matches = regTokens.filter((token) => kycTokens.includes(token));
  const matchRatio = matches.length / Math.max(regTokens.length, kycTokens.length);
  return matches.length >= 2 ? (matchRatio >= 0.6) : (matchRatio >= 0.8);
}

function isInvoiceProfileComplete(user: {
brandProfile?: {
address: string | null;
state: string | null;
pinCode: string | null;
} | null;
}) {
const profile = user.brandProfile;
return Boolean(profile?.address && profile.state && profile.pinCode);
}

const GST_REGISTRATION_VALUES = new Set<string>([
"UNREGISTERED",
"REGISTERED",
"COMPOSITION",
"EXEMPT",
]);
const GST_TURNOVER_VALUES = new Set<string>([
"BELOW_20L",
"BETWEEN_20L_AND_5CR",
"FIVE_CR_PLUS",
"TEN_CR_PLUS",
]);

function toGstRegistrationType(value?: string | null): GstRegistrationType | undefined {
return value && GST_REGISTRATION_VALUES.has(value) ? (value as GstRegistrationType) : undefined;
}

function toGstTurnoverSlab(value?: string | null): GstTurnoverSlab | null | undefined {
if (value === null) return null;
return value && GST_TURNOVER_VALUES.has(value) ? (value as GstTurnoverSlab) : undefined;
}

async function _handler_GET() {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

const user = await prisma.user.findUnique({
where: { id: session.user.id },
select: {
id: true,
userType: true,
taxCompliance: true,
brandProfile: {
select: {
address: true,
state: true,
pinCode: true,
},
},
verificationDocs: {
where: { type: "PAN_CARD" as DocumentType, status: "VERIFIED" },
select: { id: true },
take: 1,
},
},
});

if (!user) {
return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
}

const compliance = user.taxCompliance;
const summaryInput = {
userType: user.userType,
panPresent: Boolean(compliance?.panLast4),
gstinPresent: Boolean(compliance?.gstinLast4),
itrPresent: Boolean(compliance?.itrAcknowledgementLast4),
profileCompleteForInvoice:
isBrand(user.userType) ? isInvoiceProfileComplete(user) : true,
};
const currentRegistrationType = toGstRegistrationType(compliance?.gstRegistrationType);
const currentTurnoverSlab = toGstTurnoverSlab(compliance?.gstTurnoverSlab);
const summary = getIndiaTaxSummary({
...summaryInput,
...(currentRegistrationType === undefined ? {} : { gstRegistrationType: currentRegistrationType }),
...(currentTurnoverSlab === undefined ? {} : { gstTurnoverSlab: currentTurnoverSlab }),
});

return NextResponse.json({
success: true,
data: {
userType: user.userType,
verifiedPanDocument: user.verificationDocs.length > 0,
compliance: compliance
? {
id: compliance.id,
panNumberMasked: maskIdentifier(compliance.panLast4),
gstinMasked: maskIdentifier(compliance.gstinLast4),
gstStateCode: compliance.gstStateCode,
gstRegistrationType: compliance.gstRegistrationType,
gstTurnoverSlab: compliance.gstTurnoverSlab,
itrAcknowledgementMasked: maskIdentifier(
compliance.itrAcknowledgementLast4,
),
itrAssessmentYear: compliance.itrAssessmentYear,
tdsSection: compliance.tdsSection,
eInvoiceApplicable: compliance.eInvoiceApplicable,
status: summary.status,
verifiedAt: compliance.verifiedAt,
updatedAt: compliance.updatedAt,
}
: null,
summary,
},
});
} catch (error) {
logger.error("India tax compliance fetch failed", error);
return NextResponse.json(
{ success: false, message: "Failed to load India tax compliance" },
{ status: 500 },
);
}
}

function determineGstAndPanState(
data: IndiaTaxInput,
current: IndiaTaxCompliance | null,
bodyRecord: Record<string, unknown>
) {
const nextRegistrationType = Object.hasOwn(bodyRecord, "gstRegistrationType")
? (data.gstRegistrationType ?? "UNREGISTERED")
: (toGstRegistrationType(current?.gstRegistrationType) ?? "UNREGISTERED");

const registeredForGst = nextRegistrationType === "REGISTERED" || nextRegistrationType === "COMPOSITION";
const currentPan = tryDecrypt(current?.panNumber);
const currentGstin = tryDecrypt(current?.gstin);
const nextPanNumber = data.panNumber ?? currentPan ?? null;
const nextGstin = registeredForGst ? (data.gstin ?? currentGstin ?? null) : null;
const nextGstinPresent = registeredForGst ? Boolean(nextGstin || current?.gstinLast4) : false;

return {
nextRegistrationType,
registeredForGst,
nextPanNumber,
nextGstin,
nextGstinPresent,
};
}

async function verifyPanDetails(panNumber: string, registeredName?: string | null) {
const kycRes = await verifyPAN(panNumber);
if (!kycRes.success || kycRes.status === "REJECTED") {
throw AppError.badRequest(`PAN verification failed: ${kycRes.error || "Invalid PAN number"}`);
}

if (kycRes.status === "VERIFIED" && kycRes.data?.name && registeredName) {
if (!namesMatch(registeredName, kycRes.data.name)) {
throw AppError.badRequest(
`PAN holder name mismatch. PAN is registered under '${kycRes.data.name}', but your profile name is '${registeredName}'.`
);
}
}
}

async function verifyGstDetails(gstin: string, registeredName?: string | null) {
const kycRes = await verifyGST(gstin);
if (!kycRes.success || kycRes.status === "REJECTED") {
throw AppError.badRequest(`GSTIN verification failed: ${kycRes.error || "Invalid GSTIN"}`);
}

if (kycRes.status === "VERIFIED" && kycRes.data?.name && registeredName) {
if (!namesMatch(registeredName, kycRes.data.name)) {
throw AppError.badRequest(
`GST business name mismatch. GST is registered under '${kycRes.data.name}', but your company name is '${registeredName}'.`
);
}
}
}

async function validateTaxComplianceState(
user: IndiaTaxUser,
data: IndiaTaxInput,
current: IndiaTaxCompliance | null,
registeredForGst: boolean,
nextGstinPresent: boolean,
nextPanNumber: string | null,
nextGstin: string | null
) {
if (registeredForGst && !nextGstinPresent) {
throw AppError.badRequest("Open verification fail: GSTIN is required for registered GST profiles");
}

if (registeredForGst && data.panNumber && current?.gstinLast4 && !nextGstin) {
throw AppError.badRequest("Please re-enter GSTIN when changing PAN so we can verify the embedded PAN.");
}

if (nextPanNumber && nextGstin && !gstinBelongsToPan(nextGstin, nextPanNumber)) {
throw AppError.badRequest("GSTIN embedded PAN does not match the PAN number");
}

if (data.panNumber) {
const registeredName = isInfluencer(user.userType)
? user.influencerProfile?.displayName
: user.brandProfile?.companyName;
await verifyPanDetails(data.panNumber, registeredName);
}

if (registeredForGst && data.gstin) {
const registeredName = user.brandProfile?.companyName;
await verifyGstDetails(data.gstin, registeredName);
}
}

function populatePanDetails(updateData: Record<string, unknown>, panNumber?: string | null) {
  if (panNumber) {
    updateData.panNumber = encrypt(panNumber);
    updateData.panLast4 = panNumber.slice(-4);
  }
}

function populateRegisteredGstDetails(updateData: Record<string, unknown>, gstin?: string | null) {
  if (gstin) {
    updateData.gstin = encrypt(gstin);
    updateData.gstinLast4 = gstin.slice(-4);
    updateData.gstStateCode = getGstinStateCode(gstin);
  }
}

function clearGstDetails(updateData: Record<string, unknown>) {
  updateData.gstin = null;
  updateData.gstinLast4 = null;
  updateData.gstStateCode = null;
}

function populateItrDetails(
  updateData: Record<string, unknown>,
  itrAcknowledgementNumber?: string | null,
  itrAssessmentYear?: string | null
) {
  if (itrAcknowledgementNumber) {
    updateData.itrAcknowledgementNumber = encrypt(itrAcknowledgementNumber);
    updateData.itrAcknowledgementLast4 = itrAcknowledgementNumber.slice(-4);
  }
  if (itrAssessmentYear) {
    updateData.itrAssessmentYear = itrAssessmentYear;
  }
}

function buildComplianceUpdatePayload(
  data: IndiaTaxInput,
  registeredForGst: boolean,
  nextRegistrationType: GstRegistrationType,
  nextSlab: GstTurnoverSlab | null,
  userType: string,
  summaryStatus: string,
  current: IndiaTaxCompliance | null
) {
  const currentPan = tryDecrypt(current?.panNumber);
  const currentGstin = tryDecrypt(current?.gstin);

  const panChanged = data.panNumber !== undefined && data.panNumber !== currentPan;
  const gstinChanged = data.gstin !== undefined && data.gstin !== currentGstin;
  const gstTypeChanged = data.gstRegistrationType !== undefined && data.gstRegistrationType !== current?.gstRegistrationType;

  const isCriticalInfoChanged = panChanged || gstinChanged || gstTypeChanged;
  const defaultReviewSection = isBrand(userType) ? "194J_OR_194O_REVIEW" : "194J_REVIEW";

  const updateData: Record<string, unknown> = {
    gstRegistrationType: nextRegistrationType,
    gstTurnoverSlab: nextSlab,
    tdsSection: isCriticalInfoChanged ? defaultReviewSection : (current?.tdsSection ?? defaultReviewSection),
    eInvoiceApplicable: isEInvoiceApplicable(nextSlab),
    status: isCriticalInfoChanged ? summaryStatus : (current?.status ?? summaryStatus),
    submittedAt: new Date(),
    verifiedAt: isCriticalInfoChanged ? null : (current?.verifiedAt ?? null),
    rejectionReason: isCriticalInfoChanged ? null : (current?.rejectionReason ?? null),
  };

  populatePanDetails(updateData, data.panNumber);
  if (registeredForGst) {
    populateRegisteredGstDetails(updateData, data.gstin);
  } else {
    clearGstDetails(updateData);
  }
  populateItrDetails(updateData, data.itrAcknowledgementNumber, data.itrAssessmentYear);

  return updateData;
}

async function _handler_PUT(request: NextRequest) {
try {
const session = await auth();
if (!session?.user?.id) {
throw AppError.unauthorized();
}

const body = await request.json();
const parsed = indiaTaxComplianceInputSchema.safeParse(body);
if (!parsed.success) {
return NextResponse.json(
{
success: false,
message: "Invalid tax compliance payload",
errors: parsed.error.flatten().fieldErrors,
},
{ status: 400 },
);
}

const user = await prisma.user.findUnique({
where: { id: session.user.id },
select: {
id: true,
userType: true,
taxCompliance: true,
influencerProfile: { select: { displayName: true } },
brandProfile: {
select: {
companyName: true,
address: true,
state: true,
pinCode: true,
},
},
},
});

if (!user) {
throw AppError.notFound("User not found");
}

const current = user.taxCompliance;
const data = parsed.data;
const bodyRecord = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

const {
nextRegistrationType,
registeredForGst,
nextPanNumber,
nextGstin,
nextGstinPresent,
} = determineGstAndPanState(data, current, bodyRecord);

await validateTaxComplianceState(
user,
data,
current,
registeredForGst,
nextGstinPresent,
nextPanNumber,
nextGstin
);

const nextPanPresent = Boolean(nextPanNumber || current?.panLast4);
const nextItrPresent = Boolean(
data.itrAcknowledgementNumber || current?.itrAcknowledgementLast4,
);
const nextSlab = data.gstTurnoverSlab ?? toGstTurnoverSlab(current?.gstTurnoverSlab) ?? null;
const summary = getIndiaTaxSummary({
userType: user.userType,
panPresent: nextPanPresent,
gstinPresent: nextGstinPresent,
itrPresent: nextItrPresent,
gstRegistrationType: nextRegistrationType,
...(nextSlab === undefined ? {} : { gstTurnoverSlab: nextSlab }),
profileCompleteForInvoice:
isBrand(user.userType) ? isInvoiceProfileComplete(user) : true,
});

const updateData = buildComplianceUpdatePayload(
  data,
  registeredForGst,
  nextRegistrationType,
  nextSlab,
  user.userType,
  summary.status,
  current
);

const compliance = await prisma.indiaTaxCompliance.upsert({
where: { userId: user.id },
create: {
userId: user.id,
...updateData,
},
update: updateData,
});

await createActivityLog({
userId: user.id,
action: "UPDATE_INDIA_TAX_COMPLIANCE",
entityType: "IndiaTaxCompliance",
entityId: compliance.id,
metadata: {
status: summary.status,
gstRegistrationType: nextRegistrationType,
gstTurnoverSlab: nextSlab,
},
});

return NextResponse.json({
success: true,
message: "India tax compliance updated",
data: {
status: summary.status,
summary,
},
});
} catch (error) {
if (error instanceof AppError) throw error;
logger.error("India tax compliance update failed", error);
return NextResponse.json(
{ success: false, message: "Failed to update India tax compliance" },
{ status: 500 },
);
}
}


// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
export const PUT = apiWrapper(_handler_PUT);
