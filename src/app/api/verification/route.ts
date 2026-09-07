import { apiWrapper } from "@/lib/api-wrapper";
/**
* Verification API Route
*/

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { DocumentType } from "@prisma/client";
import { logger } from "@/lib/logger";
import { uploadFile } from "@/lib/storage";
import {
getUserVerificationTier,
getTierDescription,
TIER_LIMITS,
} from "@/lib/verification-tiers";
import {
verifyAadhaar,
verifyAadhaarOTP,
verifyPAN,
verifyGST,
verifyBankAccount,
hasMatchingNameTokens,
} from "@/lib/kyc";
import { checkRateLimit } from "@/lib/rate-limit";
import { bytesToAscii } from "@/lib/utils";
import { z } from "zod";

const aadhaarSchema = z.object({
action: z.literal("VERIFY_AADHAAR"),
aadhaarNumber: z.string().regex(/^\d{12}$/),
}).strip();
const aadhaarOtpSchema = z.object({
action: z.literal("VERIFY_AADHAAR_OTP"),
clientId: z.string().min(1).max(128),
otp: z.string().regex(/^\d{6}$/),
}).strip();
const panSchema = z.object({
action: z.literal("VERIFY_PAN"),
panNumber: z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/),
}).strip();
const gstSchema = z.object({
action: z.literal("VERIFY_GST"),
gstNumber: z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[\dA-Z]$/),
}).strip();
const bankSchema = z.object({
action: z.literal("VERIFY_BANK"),
accountNumber: z.string().regex(/^\d{9,18}$/),
ifscCode: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
beneficiaryName: z.string().trim().min(2).max(100),
}).strip();
const verificationActionSchema = z.discriminatedUnion("action", [
aadhaarSchema,
aadhaarOtpSchema,
panSchema,
gstSchema,
bankSchema,
]);

const VALID_DOC_TYPES = [
"PAN_CARD",
"AADHAAR",
"GST_CERTIFICATE",
"CIN_CERTIFICATE",
"BANK_STATEMENT",
"SELFIE",
"MSME_CERTIFICATE",
"STARTUP_CERTIFICATE",
] as const;

const ALLOWED_VERIFICATION_MIME_TYPES = [
"image/jpeg",
"image/png",
"image/webp",
"image/heic",
"application/pdf",
] as const;

const MAX_VERIFICATION_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function detectVerificationMimeFromMagicBytes(bytes: Uint8Array): string | null {
if (bytes.length < 12) return null;

// PDF: %PDF
if (
bytes[0] === 0x25 &&
bytes[1] === 0x50 &&
bytes[2] === 0x44 &&
bytes[3] === 0x46
) {
return "application/pdf";
}

// JPEG: FF D8 FF
if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
return "image/jpeg";
}

// PNG
if (
bytes[0] === 0x89 &&
bytes[1] === 0x50 &&
bytes[2] === 0x4e &&
bytes[3] === 0x47
) {
return "image/png";
}

// WEBP: RIFF....WEBP
if (
bytesToAscii(bytes.slice(0, 4)) === "RIFF" &&
bytesToAscii(bytes.slice(8, 12)) === "WEBP"
) {
return "image/webp";
}

// HEIC/HEIF
if (bytesToAscii(bytes.slice(4, 8)) === "ftyp") {
const brand = bytesToAscii(bytes.slice(8, 12)).toLowerCase();
if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
return "image/heic";
}
}

return null;
}

function isAllowedVerificationExtension(
mimeType: string,
extension: string,
): boolean {
const map: Record<string, string[]> = {
"image/jpeg": ["jpg", "jpeg"],
"image/png": ["png"],
"image/webp": ["webp"],
"image/heic": ["heic", "heif"],
"application/pdf": ["pdf"],
};

return (map[mimeType] || []).includes(extension);
}

// GET - Get verification status and documents
function calculateTierLimit(userType: "BRAND" | "INFLUENCER", tier: number): number | null {
if (userType === "INFLUENCER") {
if (tier >= 2) return null;
if (tier === 1) return TIER_LIMITS.TIER_1_MAX_MONTHLY;
return 0;
}
if (tier === 3) return null;
if (tier === 2) return TIER_LIMITS.TIER_2_MAX_MONTHLY;
if (tier === 1) return TIER_LIMITS.TIER_1_MAX_MONTHLY;
return 0;
}

async function _handler_GET() {
try {
const session = await auth();

if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const [user, documents] = await Promise.all([
prisma.user.findUnique({
where: { id: session.user.id },
select: {
verificationLevel: true,
emailVerified: true,
phoneVerified: true,
trustScore: true,
userType: true,
},
}),
prisma.verificationDocument.findMany({
where: { userId: session.user.id },
take: 20,
orderBy: { createdAt: "desc" },
}),
]);

const userType = (user?.userType || "INFLUENCER") as "BRAND" | "INFLUENCER";
const tier = await getUserVerificationTier(session.user.id, userType);
const tierLimit = calculateTierLimit(userType, tier);

return NextResponse.json({
verificationLevel: user?.verificationLevel,
trustScore: user?.trustScore ?? 600,
emailVerified: user?.emailVerified,
phoneVerified: user?.phoneVerified,
userType,
documents,
tier,
tierLimit,
tierDescription: getTierDescription(tier, userType),
});
} catch (error) {
logger.error("Verification fetch error", error);
return NextResponse.json(
{ error: "Failed to fetch verification status" },
{ status: 500 },
);
}
}

async function handleVerifyAadhaar(userId: string, aadhaarNumber: string) {
const result = await verifyAadhaar(aadhaarNumber, userId);
if (result.success && result.status === "VERIFIED") {
await prisma.user.update({
where: { id: userId },
data: { verificationLevel: "IDENTITY" },
});
}
return result;
}

async function handleVerifyAadhaarOtp(userId: string, clientId: string, otp: string) {
const result = await verifyAadhaarOTP(clientId, otp);
if (result.success && result.status === "VERIFIED") {
const user = await prisma.user.findUnique({
where: { id: userId },
select: {
influencerProfile: { select: { displayName: true } },
brandProfile: { select: { companyName: true } },
email: true,
},
});
const registeredName =
user?.influencerProfile?.displayName ||
user?.brandProfile?.companyName ||
user?.email?.split("@")[0] ||
"";
const returnedName = result.data?.name || "";
if (returnedName && registeredName && !hasMatchingNameTokens(returnedName, registeredName)) {
return {
success: false,
status: "REJECTED" as const,
error: "The name on the verified Aadhaar does not match your registered profile name.",
};
}
await prisma.user.update({
where: { id: userId },
data: { verificationLevel: "IDENTITY" },
});
}
return result;
}

async function handleVerifyPan(userId: string, panNumber: string) {
const result = await verifyPAN(panNumber);
if (result.success && result.status === "VERIFIED") {
const user = await prisma.user.findUnique({
where: { id: userId },
select: {
influencerProfile: { select: { displayName: true } },
brandProfile: { select: { companyName: true } },
email: true,
},
});
const registeredName =
user?.influencerProfile?.displayName ||
user?.brandProfile?.companyName ||
user?.email?.split("@")[0] ||
"";
const returnedName = result.data?.name || "";
if (returnedName && registeredName && !hasMatchingNameTokens(returnedName, registeredName)) {
return {
success: false,
status: "REJECTED" as const,
error: "The name on the verified PAN card does not match your registered profile name.",
};
}
await prisma.user.update({
where: { id: userId },
data: { verificationLevel: "IDENTITY" },
});
}
return result;
}

async function handleVerifyGst(userId: string, gstNumber: string) {
const result = await verifyGST(gstNumber);
if (result.success && result.status === "VERIFIED") {
const user = await prisma.user.findUnique({
where: { id: userId },
select: {
influencerProfile: { select: { displayName: true } },
brandProfile: { select: { companyName: true } },
email: true,
},
});
const registeredName =
user?.brandProfile?.companyName ||
user?.influencerProfile?.displayName ||
user?.email?.split("@")[0] ||
"";
const returnedName = result.data?.name || "";
if (returnedName && registeredName && !hasMatchingNameTokens(returnedName, registeredName)) {
return {
success: false,
status: "REJECTED" as const,
error: "The business name on the verified GST does not match your registered company name.",
};
}
await prisma.user.update({
where: { id: userId },
data: { verificationLevel: "IDENTITY" },
});
}
return result;
}

// PUT - Perform verification actions (Aadhaar OTP, PAN, GST, Bank, etc.)
async function _handler_PUT(request: NextRequest) {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const limit = await checkRateLimit(session.user.id, "AUTH");
if (!limit.success) {
return NextResponse.json({ error: "Too many verification requests" }, { status: 429 });
}

const parsed = verificationActionSchema.safeParse(await request.json().catch(() => null));
if (!parsed.success) {
return NextResponse.json(
{ error: "Invalid verification request", details: parsed.error.flatten().fieldErrors },
{ status: 400 },
);
}
const body = parsed.data;
const userId = session.user.id;

let result;
switch (body.action) {
case "VERIFY_AADHAAR":
result = await handleVerifyAadhaar(userId, body.aadhaarNumber);
break;
case "VERIFY_AADHAAR_OTP":
result = await handleVerifyAadhaarOtp(userId, body.clientId, body.otp);
break;
case "VERIFY_PAN":
result = await handleVerifyPan(userId, body.panNumber);
break;
case "VERIFY_GST":
result = await handleVerifyGst(userId, body.gstNumber);
break;
case "VERIFY_BANK":
result = await verifyBankAccount({
accountNumber: body.accountNumber,
ifscCode: body.ifscCode,
beneficiaryName: body.beneficiaryName,
});
break;
}

return NextResponse.json(result);
} catch (error) {
logger.error("Verification action error", error);
return NextResponse.json(
{ error: "Failed to perform verification action" },
{ status: 500 },
);
}
}

// POST - Upload a document (Real File Upload)
async function _handler_POST(request: NextRequest) {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const limit = await checkRateLimit(session.user.id, "UPLOAD");
if (!limit.success) {
return NextResponse.json(
{ error: "Upload rate limit exceeded. Maximum 10 uploads per hour." },
{ status: 429 },
);
}

const formData = await request.formData();
const file = formData.get("file") as File | null;
const type = formData.get("type") as string | null;

if (!file || !type) {
return NextResponse.json(
{ error: "File and type are required" },
{ status: 400 },
);
}

if (file.size <= 0) {
return NextResponse.json(
{ error: "Empty file is not allowed" },
{ status: 400 },
);
}

if (file.size > MAX_VERIFICATION_FILE_SIZE) {
return NextResponse.json(
{ error: "File too large. Maximum allowed size is 10MB." },
{ status: 400 },
);
}

const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
const blockedExts = ["exe", "dll", "php", "sh", "bat", "js", "html"];
if (blockedExts.includes(fileExt)) {
return NextResponse.json(
{ error: "Unsupported file extension." },
{ status: 400 },
);
}

if (!(ALLOWED_VERIFICATION_MIME_TYPES as readonly string[]).includes(file.type)) {
return NextResponse.json(
{ error: "Unsupported file type for verification." },
{ status: 415 },
);
}

const arrayBuffer = await file.arrayBuffer();
const fileBytes = new Uint8Array(arrayBuffer.slice(0, 16));
const detectedMime = detectVerificationMimeFromMagicBytes(fileBytes);
if (!detectedMime || detectedMime !== file.type) {
return NextResponse.json(
{ error: "File signature mismatch. Upload rejected." },
{ status: 400 },
);
}

if (!isAllowedVerificationExtension(file.type, fileExt)) {
return NextResponse.json(
{ error: "File extension does not match file content." },
{ status: 400 },
);
}

// Validate Document Type
if (!(VALID_DOC_TYPES as readonly string[]).includes(type)) {
return NextResponse.json(
{ error: "Invalid document type" },
{ status: 400 },
);
}

// Check for existing pending/verified document
const existing = await prisma.verificationDocument.findFirst({
where: {
userId: session.user.id,
type: type as DocumentType,
status: { in: ["PENDING", "VERIFIED"] },
},
});

if (existing) {
return NextResponse.json(
{ error: `Document of type ${type} is already ${existing.status}` },
{ status: 400 },
);
}

// Upload to Storage
const buffer = Buffer.from(arrayBuffer);

const uploadRes = await uploadFile(
buffer,
file.name,
"verification",
file.type,
);

if (!uploadRes.success || !uploadRes.url) {
logger.error("File upload failed", { error: uploadRes.error });
return NextResponse.json(
{ error: "Failed to upload file to storage" },
{ status: 500 },
);
}

// Create DB record
const document = await prisma.verificationDocument.create({
data: {
userId: session.user.id,
type: type as DocumentType,
documentUrl: uploadRes.url,
status: "PENDING",
metadata: {
originalName: file.name,
size: file.size,
mimeType: file.type,
},
},
});

return NextResponse.json({
success: true,
document,
message: "Document uploaded successfully. Verification pending.",
});
} catch (error) {
logger.error("Verification upload error", error);
return NextResponse.json(
{ error: "Failed to process upload" },
{ status: 500 },
);
}
}


// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
export const POST = apiWrapper(_handler_POST);
export const PUT = apiWrapper(_handler_PUT);
