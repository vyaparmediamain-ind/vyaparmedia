import { apiWrapper, ApiResponse } from "@/lib/api-wrapper";
import { AppError } from "@/lib/errors";
/**
* Verification API Route
*/

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { DocumentType, Prisma } from "@prisma/client";
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
assertNoDuplicateDocument,
invalidateUserKYCCache,
checkUserKYCRateLimit,
checkAadhaarOtpRateLimit,
checkAadhaarOtpVerifyLimit,
} from "@/lib/kyc";
import { checkRateLimit } from "@/lib/rate-limit";
import { bytesToAscii } from "@/lib/utils";
import { createActivityLog, ActivityAction } from "@/lib/audit";
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
  const otpGenLimit = await checkAadhaarOtpRateLimit(userId);
  if (!otpGenLimit.allowed) {
    return {
      success: false,
      status: "REJECTED" as const,
      error: "Daily Aadhaar OTP generation limit reached (3 attempts/day). Please try again tomorrow.",
    };
  }

  const cleanAadhaar = aadhaarNumber.replace(/[\s-]/g, "");
  const { hash } = await assertNoDuplicateDocument(cleanAadhaar, "AADHAAR", userId);
  const result = await verifyAadhaar(cleanAadhaar, userId);
  if (result.success && result.status === "VERIFIED") {
    // P7-SEC-03 FIX: Aadhaar Act 2016 Section 29 compliance - store masked Aadhaar only
    const maskedAadhaar = `XXXXXXXX${cleanAadhaar.slice(-4)}`;
    await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        select: { verificationLevel: true },
      });
      const newLevel = currentUser?.verificationLevel === "FULL" ? "FULL" : "IDENTITY";

      await tx.user.update({
        where: { id: userId },
        data: { verificationLevel: newLevel },
      });

      const doc = await tx.verificationDocument.upsert({
        where: {
          userId_type: { userId, type: "AADHAAR" },
        },
        create: {
          userId,
          type: "AADHAAR",
          documentUrl: "VERIFIED_ONLINE",
          documentNumber: maskedAadhaar,
          documentNumberHash: hash,
          status: "VERIFIED",
          verifiedAt: new Date(),
          metadata: (result.data as Prisma.InputJsonValue) || {},
        },
        update: {
          documentNumber: maskedAadhaar,
          documentNumberHash: hash,
          status: "VERIFIED",
          verifiedAt: new Date(),
          metadata: (result.data as Prisma.InputJsonValue) || {},
        },
      });

      await createActivityLog({
        userId,
        action: ActivityAction.KYC_APPROVED,
        entityType: "VerificationDocument",
        entityId: doc.id,
        metadata: { type: "AADHAAR", newLevel },
      }, tx);
    });
    await invalidateUserKYCCache(userId);
  }
  return result;
}

async function handleVerifyAadhaarOtp(userId: string, clientId: string, otp: string) {
  const otpVerifyLimit = await checkAadhaarOtpVerifyLimit(clientId);
  if (!otpVerifyLimit.allowed) {
    return {
      success: false,
      status: "REJECTED" as const,
      error: "Maximum OTP verification attempts exceeded for this session. Please request a new OTP.",
    };
  }

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
      const maskedAadhaar = result.data?.documentNumber || "XXXXXXXX0000";
      await prisma.verificationDocument.upsert({
        where: { userId_type: { userId, type: "AADHAAR" } },
        create: {
          userId,
          type: "AADHAAR",
          documentUrl: "VERIFIED_ONLINE",
          documentNumber: maskedAadhaar,
          documentNumberHash: `aadhaar_otp_${clientId}`,
          status: "PENDING",
          rejectionReason: `Name mismatch detected between Aadhaar (${returnedName}) and profile (${registeredName}). Submitted for admin manual review.`,
          metadata: (result.data as Prisma.InputJsonValue) || {},
        },
        update: {
          documentNumber: maskedAadhaar,
          status: "PENDING",
          rejectionReason: `Name mismatch detected between Aadhaar (${returnedName}) and profile (${registeredName}). Submitted for admin manual review.`,
          metadata: (result.data as Prisma.InputJsonValue) || {},
        },
      });
      await invalidateUserKYCCache(userId);
      return {
        success: true,
        status: "PENDING" as const,
        message: `Name mismatch detected between Aadhaar (${returnedName}) and profile (${registeredName}). Your document has been submitted for manual review by our verification team.`,
        data: result.data,
      };
    }
    const maskedAadhaar = result.data?.documentNumber || "XXXXXXXX0000";
    await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        select: { verificationLevel: true },
      });
      const newLevel = currentUser?.verificationLevel === "FULL" ? "FULL" : "IDENTITY";

      await tx.user.update({
        where: { id: userId },
        data: { verificationLevel: newLevel },
      });

      const doc = await tx.verificationDocument.upsert({
        where: { userId_type: { userId, type: "AADHAAR" } },
        create: {
          userId,
          type: "AADHAAR",
          documentUrl: "VERIFIED_ONLINE",
          documentNumber: maskedAadhaar,
          documentNumberHash: `aadhaar_otp_${clientId}`,
          status: "VERIFIED",
          verifiedAt: new Date(),
          metadata: (result.data as Prisma.InputJsonValue) || {},
        },
        update: {
          documentNumber: maskedAadhaar,
          documentNumberHash: `aadhaar_otp_${clientId}`,
          status: "VERIFIED",
          verifiedAt: new Date(),
          metadata: (result.data as Prisma.InputJsonValue) || {},
        },
      });

      await createActivityLog({
        userId,
        action: ActivityAction.KYC_APPROVED,
        entityType: "VerificationDocument",
        entityId: doc.id,
        metadata: { type: "AADHAAR", newLevel },
      }, tx);
    });
    await invalidateUserKYCCache(userId);
  }
  return result;
}

async function handleVerifyPan(userId: string, panNumber: string) {
  const cleanPAN = panNumber.toUpperCase().trim();
  const { hash, encrypted } = await assertNoDuplicateDocument(cleanPAN, "PAN_CARD", userId);
  const result = await verifyPAN(cleanPAN, userId);
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
      await prisma.verificationDocument.upsert({
        where: { userId_type: { userId, type: "PAN_CARD" } },
        create: {
          userId,
          type: "PAN_CARD",
          documentUrl: "VERIFIED_ONLINE",
          documentNumber: encrypted,
          documentNumberHash: hash,
          status: "PENDING",
          rejectionReason: `Name mismatch detected between PAN card (${returnedName}) and profile (${registeredName}). Submitted for admin manual review.`,
          metadata: (result.data as Prisma.InputJsonValue) || {},
        },
        update: {
          documentNumber: encrypted,
          documentNumberHash: hash,
          status: "PENDING",
          rejectionReason: `Name mismatch detected between PAN card (${returnedName}) and profile (${registeredName}). Submitted for admin manual review.`,
          metadata: (result.data as Prisma.InputJsonValue) || {},
        },
      });
      await invalidateUserKYCCache(userId);
      return {
        success: true,
        status: "PENDING" as const,
        message: `Name mismatch detected between PAN card (${returnedName}) and profile (${registeredName}). Your PAN has been submitted for manual review by our verification team.`,
        data: result.data,
      };
    }
    await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        select: { verificationLevel: true },
      });
      const newLevel = currentUser?.verificationLevel === "FULL" ? "FULL" : "IDENTITY";

      await tx.user.update({
        where: { id: userId },
        data: { verificationLevel: newLevel },
      });

      const doc = await tx.verificationDocument.upsert({
        where: {
          userId_type: { userId, type: "PAN_CARD" },
        },
        create: {
          userId,
          type: "PAN_CARD",
          documentUrl: "VERIFIED_ONLINE",
          documentNumber: encrypted,
          documentNumberHash: hash,
          status: "VERIFIED",
          verifiedAt: new Date(),
          metadata: (result.data as Prisma.InputJsonValue) || {},
        },
        update: {
          documentNumber: encrypted,
          documentNumberHash: hash,
          status: "VERIFIED",
          verifiedAt: new Date(),
          metadata: (result.data as Prisma.InputJsonValue) || {},
        },
      });

      // Also update tax compliance if exists
      await tx.indiaTaxCompliance.updateMany({
        where: { userId },
        data: {
          panNumber: encrypted,
          panLast4: cleanPAN.slice(-4),
          panNumberHash: hash,
          status: "VERIFIED",
          verifiedAt: new Date(),
        },
      });

      await createActivityLog({
        userId,
        action: ActivityAction.KYC_APPROVED,
        entityType: "VerificationDocument",
        entityId: doc.id,
        metadata: { type: "PAN_CARD", newLevel },
      }, tx);
    });

    await invalidateUserKYCCache(userId);
  }
  return result;
}

async function handleVerifyGst(userId: string, gstNumber: string) {
  const cleanGST = gstNumber.toUpperCase().trim();
  const { hash, encrypted } = await assertNoDuplicateDocument(cleanGST, "GST_CERTIFICATE", userId);
  const result = await verifyGST(cleanGST, userId);
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
      await prisma.verificationDocument.upsert({
        where: { userId_type: { userId, type: "GST_CERTIFICATE" } },
        create: {
          userId,
          type: "GST_CERTIFICATE",
          documentUrl: "VERIFIED_ONLINE",
          documentNumber: encrypted,
          documentNumberHash: hash,
          status: "PENDING",
          rejectionReason: `Business name mismatch detected between GST (${returnedName}) and company profile (${registeredName}). Submitted for admin manual review.`,
          metadata: (result.data as Prisma.InputJsonValue) || {},
        },
        update: {
          documentNumber: encrypted,
          documentNumberHash: hash,
          status: "PENDING",
          rejectionReason: `Business name mismatch detected between GST (${returnedName}) and company profile (${registeredName}). Submitted for admin manual review.`,
          metadata: (result.data as Prisma.InputJsonValue) || {},
        },
      });
      await invalidateUserKYCCache(userId);
      return {
        success: true,
        status: "PENDING" as const,
        message: `Business name mismatch detected between GST (${returnedName}) and company profile (${registeredName}). Your GST certificate has been submitted for manual review by our verification team.`,
        data: result.data,
      };
    }
    await prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        select: { verificationLevel: true },
      });
      const newLevel = currentUser?.verificationLevel === "FULL" ? "FULL" : "IDENTITY";

      await tx.user.update({
        where: { id: userId },
        data: { verificationLevel: newLevel },
      });

      const doc = await tx.verificationDocument.upsert({
        where: {
          userId_type: { userId, type: "GST_CERTIFICATE" },
        },
        create: {
          userId,
          type: "GST_CERTIFICATE",
          documentUrl: "VERIFIED_ONLINE",
          documentNumber: encrypted,
          documentNumberHash: hash,
          status: "VERIFIED",
          verifiedAt: new Date(),
          metadata: (result.data as Prisma.InputJsonValue) || {},
        },
        update: {
          documentNumber: encrypted,
          documentNumberHash: hash,
          status: "VERIFIED",
          verifiedAt: new Date(),
          metadata: (result.data as Prisma.InputJsonValue) || {},
        },
      });

      await createActivityLog({
        userId,
        action: ActivityAction.KYC_APPROVED,
        entityType: "VerificationDocument",
        entityId: doc.id,
        metadata: { type: "GST_CERTIFICATE", newLevel },
      }, tx);
    });

    await invalidateUserKYCCache(userId);
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

const kycRateCheck = await checkUserKYCRateLimit(userId);
if (!kycRateCheck.allowed) {
  return NextResponse.json(
    {
      error: "Daily verification attempt limit reached (5 attempts/day). Please wait 24 hours before trying again.",
      code: "RATE_LIMIT_EXCEEDED",
    },
    { status: 429 },
  );
}

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
        result = await verifyBankAccount(
          body.accountNumber,
          body.ifscCode,
          body.beneficiaryName,
        );
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

// Aadhaar Act 2016 Section 29(4) & Regulation 16: Raw physical Aadhaar images must not be collected or stored.
if (type === "AADHAAR") {
return NextResponse.json(
{
error:
"Direct upload of physical Aadhaar card images is prohibited under Section 29(4) of the Aadhaar Act, 2016. Please use paperless DigiLocker or OTP verification, or upload an alternate government photo ID.",
},
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

    const docNumber = formData.get("documentNumber") as string | null;
    let documentNumber: string | null = null;
    let documentNumberHash: string | null = null;
    if (docNumber && docNumber.trim()) {
      const { hash, encrypted } = await assertNoDuplicateDocument(
        docNumber.trim(),
        type as DocumentType,
        session.user.id,
      );
      documentNumber = encrypted;
      documentNumberHash = hash;
    }

    // Create or update DB record
    const document = await prisma.verificationDocument.upsert({
      where: {
        userId_type: {
          userId: session.user.id,
          type: type as DocumentType,
        },
      },
      create: {
        userId: session.user.id,
        type: type as DocumentType,
        documentUrl: uploadRes.url,
        documentNumber,
        documentNumberHash,
        status: "PENDING",
        metadata: {
          originalName: file.name,
          size: file.size,
          mimeType: file.type,
        },
      },
      update: {
        documentUrl: uploadRes.url,
        documentNumber,
        documentNumberHash,
        status: "PENDING",
        rejectionReason: null,
        metadata: {
          originalName: file.name,
          size: file.size,
          mimeType: file.type,
        },
      },
    });

    await invalidateUserKYCCache(session.user.id);

    return NextResponse.json({
      success: true,
      document,
      message: "Document uploaded successfully. Verification pending.",
    });
  } catch (error) {
    logger.error("Verification upload error", error);
    if (error instanceof AppError) {
      return ApiResponse.error(error.message, error.statusCode);
    }
    const message = error instanceof Error ? error.message : "Failed to process document upload. Please try again.";
    return ApiResponse.error(message, 500);
  }
}


// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
export const POST = apiWrapper(_handler_POST, {
  maxBodySize: 10 * 1024 * 1024,
});
export const PUT = apiWrapper(_handler_PUT);
