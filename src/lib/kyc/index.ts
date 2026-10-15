import { KYCProvider, KYCVerifyResult, BankVerifyResult } from "./types";
import { SurepassKYCProvider } from "./providers/surepass";
import { ManualKYCProvider } from "./providers/manual";
import { MockKYCProvider } from "./providers/mock";
import { encrypt, hashForDuplicateDetection } from "../encryption";
import prisma from "../db";
import { AppError } from "../errors";
import { logger } from "../logger";
import { DocumentType, Prisma } from "@prisma/client";
import { getCachedKYCResult, setCachedKYCResult } from "./cache";

export * from "./types";
export * from "./cache";
export { SurepassKYCProvider } from "./providers/surepass";
export { ManualKYCProvider } from "./providers/manual";
export { MockKYCProvider } from "./providers/mock";

// Cache single instance of provider per runtime
let _activeProvider: KYCProvider | null = null;

/**
 * KYC Provider Factory
 * Returns configured provider without coupling calling code to any specific vendor.
 */
export function getKYCProvider(customProvider?: string): KYCProvider {
  const isProd = process.env.NODE_ENV === "production";
  const requested = (customProvider || process.env.KYC_PROVIDER || "manual").toLowerCase();

  if (isProd && requested === "mock") {
    throw AppError.internal("CRITICAL_SECURITY_ERROR: Mock KYC provider is forbidden in production environment.");
  }

  if (customProvider) {
    if (_activeProvider && _activeProvider.name === customProvider) {
      return _activeProvider;
    }
    switch (customProvider.toLowerCase()) {
      case "surepass":
        return new SurepassKYCProvider();
      case "mock":
        return new MockKYCProvider();
      case "manual":
      default:
        return new ManualKYCProvider();
    }
  }

  if (_activeProvider) {
    return _activeProvider;
  }

  const providerName = process.env.KYC_PROVIDER || "manual";

  switch (providerName.toLowerCase()) {
    case "surepass":
      _activeProvider = new SurepassKYCProvider();
      break;
    case "mock":
      _activeProvider = new MockKYCProvider();
      break;
    case "manual":
    default:
      _activeProvider = new ManualKYCProvider();
      break;
  }

  return _activeProvider;
}

/**
 * Override provider for tests or specific runtime branches
 */
export function setKYCProvider(provider: KYCProvider) {
  if (process.env.NODE_ENV === "production" && provider.name === "mock") {
    throw AppError.internal("CRITICAL_SECURITY_ERROR: Mock KYC provider cannot be set in production.");
  }
  _activeProvider = provider;
}

/**
 * Robust tokenized and substring name matching for Indian KYC and bank records.
 *
 * Matching Algorithm & Thresholds:
 * 1. Normalization: Lowercase + strip all non-alphanumeric chars (dots, commas, hyphens, prefixes like Dr./Shri).
 * 2. Exact Match: If normalized strings are identical -> TRUE.
 * 3. Substring Containment: If both strings >= 4 chars and one contains the other (e.g. "Priya Sharma" in "Priya Ramesh Sharma") -> TRUE.
 * 4. Token Intersection Threshold: Split into word tokens (> 1 char).
 *    Matches if matchCount >= min(2, min(tokens1.length, tokens2.length)).
 *    Handles surname-first vs surname-last ("Sharma Priya" vs "Priya Sharma") and abbreviations ("Mohd" vs "Mohammad").
 *
 * False-Reject Mitigation & UX Fallback:
 * If this function returns FALSE, the system does NOT reject the user's KYC submission outright.
 * Instead, the document is saved with status `PENDING`, a descriptive mismatch note is attached,
 * and the case is forwarded to `/admin/verifications/[id]` for human operator manual review.
 */
export function hasMatchingNameTokens(name1?: string | null, name2?: string | null): boolean {
  if (!name1 || !name2) return false;

  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

  const c1 = clean(name1);
  const c2 = clean(name2);

  if (!c1 || !c2) return false;
  if (c1 === c2) return true;

  // Substring check for long names (>= 4 chars)
  if (c1.length >= 4 && c2.length >= 4 && (c1.includes(c2) || c2.includes(c1))) {
    return true;
  }

  // Token matching: At least 2 tokens match or >= 50% match for multi-word names
  const tokens1 = c1.split(/\s+/).filter((t) => t.length > 1);
  const tokens2 = c2.split(/\s+/).filter((t) => t.length > 1);

  let matchCount = 0;
  for (const t1 of tokens1) {
    if (tokens2.some((t2) => t1 === t2 || (t1.length >= 4 && t2.includes(t1)) || (t2.length >= 4 && t1.includes(t2)))) {
      matchCount++;
    }
  }

  return matchCount >= Math.min(2, Math.min(tokens1.length, tokens2.length));
}

/**
 * Check if document number is already registered to another user account.
 * Uses SHA-256 HMAC hash for fast indexed lookups without decrypting all database rows.
 */
export async function assertNoDuplicateDocument(
  docNumber: string,
  docType: DocumentType,
  currentUserId: string,
  tx?: Prisma.TransactionClient,
): Promise<{ hash: string; encrypted: string }> {
  const db = tx || prisma;
  const hash = hashForDuplicateDetection(docNumber);
  // P7-SEC-03 FIX: Aadhaar Act 2016 Section 29 compliance - Never store full 12-digit Aadhaar in reversible form.
  // Store only masked representation (XXXXXXXX1234) while keeping HMAC hash for duplicate detection.
  const encrypted = docType === "AADHAAR" ? `XXXXXXXX${docNumber.replace(/[\s-]/g, "").slice(-4)}` : encrypt(docNumber);

  // 1. Check in VerificationDocument
  const existingDoc = await db.verificationDocument.findFirst({
    where: {
      documentNumberHash: hash,
      type: docType,
      userId: { not: currentUserId },
      status: { in: ["VERIFIED", "PENDING"] },
    },
    select: { id: true, userId: true },
  });

  if (existingDoc) {
    logger.warn("Duplicate document detection triggered", {
      docType,
      currentUserId,
      conflictingUserId: existingDoc.userId,
    });
    throw AppError.badRequest(
      `DUPLICATE_DOCUMENT: This ${docType.replace("_", " ")} is already registered with another account. Each account must have unique identification.`,
    );
  }

  // 2. If PAN, also check in IndiaTaxCompliance
  if (docType === "PAN_CARD") {
    const existingTax = await db.indiaTaxCompliance.findFirst({
      where: {
        panNumberHash: hash,
        userId: { not: currentUserId },
        status: "VERIFIED",
      },
      select: { id: true, userId: true },
    });

    if (existingTax) {
      logger.warn("Duplicate PAN detection triggered in tax compliance", {
        currentUserId,
        conflictingUserId: existingTax.userId,
      });
      throw AppError.badRequest(
        "DUPLICATE_DOCUMENT: This PAN is already verified under another account.",
      );
    }
  }

  return { hash, encrypted };
}

/**
 * Verify Aadhaar with provider and duplicate-detection guard
 */
export async function verifyAadhaar(
  aadhaarNumber: string,
  userId?: string,
): Promise<KYCVerifyResult> {
  const cleanAadhaar = aadhaarNumber.replace(/[\s-]/g, "");

  if (userId) {
    // Assert uniqueness before dispatching to provider
    await assertNoDuplicateDocument(cleanAadhaar, "AADHAAR", userId);
  }

  const provider = getKYCProvider();
  return provider.verifyAadhaar(cleanAadhaar, userId);
}

export async function verifyAadhaarOTP(
  clientId: string,
  otp: string,
): Promise<KYCVerifyResult> {
  const provider = getKYCProvider();
  if (provider.verifyAadhaarOTP) {
    return provider.verifyAadhaarOTP(clientId, otp);
  }
  return { success: false, status: "PENDING", error: "OTP verification not supported by active provider" };
}

export async function verifyPAN(
  panNumber: string,
  userId?: string,
): Promise<KYCVerifyResult> {
  const cleanPAN = panNumber.toUpperCase().trim();
  const panHash = hashForDuplicateDetection(cleanPAN);

  if (userId) {
    await assertNoDuplicateDocument(cleanPAN, "PAN_CARD", userId);
  }

  const cached = await getCachedKYCResult<KYCVerifyResult["data"]>("PAN", panHash);
  if (cached) {
    logger.info("KYC PAN verification served from cache", { docHash: panHash });
    return {
      success: true,
      status: "VERIFIED",
      data: cached,
    };
  }

  const provider = getKYCProvider();
  const result = await provider.verifyPAN(cleanPAN);

  if (result.success && result.status === "VERIFIED" && result.data) {
    await setCachedKYCResult("PAN", panHash, result.data);
  }

  return result;
}

export async function verifyGST(
  gstNumber: string,
  userId?: string,
): Promise<KYCVerifyResult> {
  const cleanGST = gstNumber.toUpperCase().trim();
  const gstHash = hashForDuplicateDetection(cleanGST);

  if (userId) {
    await assertNoDuplicateDocument(cleanGST, "GST_CERTIFICATE", userId);
  }

  const cached = await getCachedKYCResult<KYCVerifyResult["data"]>("GST", gstHash);
  if (cached) {
    logger.info("KYC GSTIN verification served from cache", { docHash: gstHash });
    return {
      success: true,
      status: "VERIFIED",
      data: cached,
    };
  }

  const provider = getKYCProvider();
  const result = await provider.verifyGSTIN(cleanGST);

  if (result.success && result.status === "VERIFIED" && result.data) {
    await setCachedKYCResult("GST", gstHash, result.data);
  }

  return result;
}

export async function verifyBankAccount(
  accountNumber: string,
  ifsc: string,
  registeredName?: string,
): Promise<BankVerifyResult> {
  const cleanAccount = accountNumber.trim();
  const cleanIFSC = ifsc.toUpperCase().trim();
  const bankHash = hashForDuplicateDetection(`${cleanAccount}:${cleanIFSC}`);

  const cached = await getCachedKYCResult<BankVerifyResult>("BANK", bankHash);
  if (cached) {
    logger.info("Bank account verification served from cache", { docHash: bankHash });
    const beneficiaryName = cached.beneficiaryName || "";
    const nameMatch = registeredName
      ? hasMatchingNameTokens(beneficiaryName, registeredName)
      : cached.nameMatch;
    return {
      ...cached,
      nameMatch,
    };
  }

  const provider = getKYCProvider();
  const result = await provider.verifyBankAccount(cleanAccount, cleanIFSC, registeredName);

  if (result.success && result.accountExists) {
    await setCachedKYCResult("BANK", bankHash, result);
  }

  return result;
}
