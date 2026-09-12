/**
* KYC Verification Service
* Supports DigiLocker (Aadhaar/PAN) and bank account verification.
* Add KYC_PROVIDER_KEY to .env to activate.
*
* Supported providers: DigiLocker, Surepass, IDfy, Cashfree
* Default: Manual verification (admin reviews uploaded docs)
*/

import { logger } from "./logger";
import prisma from "./db";
import { decrypt } from "./encryption";
import { getErrorMessage } from "./utils";

const KYC_API_KEY = process.env.KYC_API_KEY;
const KYC_PROVIDER = process.env.KYC_PROVIDER || "manual"; // 'digilocker' | 'surepass' | 'idfy' | 'manual'
const KYC_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = KYC_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ==================== TYPES ====================

type KYCStatus = "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";



interface BankVerifyResult {
success: boolean;
nameMatch: boolean;
accountExists: boolean;
beneficiaryName?: string;
error?: string;
}

// ==================== AADHAAR VERIFICATION ====================

/**
* Verify Aadhaar number via DigiLocker/Surepass.
* In manual mode, returns pending status for admin review.
*/
export async function verifyAadhaar(
aadhaarNumber: string,
userId?: string,
): Promise<KYCVerifyResult> {
if (KYC_PROVIDER === "manual" || (!KYC_API_KEY && KYC_PROVIDER !== "digilocker")) {
logger.warn(
"Running in manual mode Aadhaar verification queued for admin review",
);
return {
success: false,
status: "PENDING",
data: { documentNumber: maskDocument(aadhaarNumber, 4) },
error: "Manual KYC requires admin review",
};
}

try {
if (KYC_PROVIDER === "surepass") {
return await surepassVerifyAadhaar(aadhaarNumber);
}

// DigiLocker flow (requires OAuth redirect)
if (KYC_PROVIDER === "digilocker") {
return await digilockerVerifyAadhaar(aadhaarNumber, userId);
}

return {
success: false,
status: "PENDING",
error: `Unknown KYC provider: ${KYC_PROVIDER}`,
};
} catch (error) {
logger.error("Aadhaar verification error", error);
return {
success: false,
status: "PENDING",
error: "Verification service unavailable",
};
}
}

// ==================== PAN VERIFICATION ====================

/**
* Verify PAN card number.
*/
export async function verifyPAN(panNumber: string): Promise<KYCVerifyResult> {
// Basic format validation
const panRegex = /^[A-Z]{5}\d{4}[A-Z]$/;
if (!panRegex.test(panNumber.toUpperCase())) {
return { success: false, status: "REJECTED", error: "Invalid PAN format" };
}

if (KYC_PROVIDER === "manual" || !KYC_API_KEY) {
logger.warn("Manual mode PAN verification queued for admin");
return {
success: false,
status: "PENDING",
data: { documentNumber: maskDocument(panNumber, 4) },
error: "Manual KYC requires admin review",
};
}

try {
if (KYC_PROVIDER === "surepass") {
const res = await fetchWithTimeout("https://kyc-api.surepass.io/api/v1/pan/pan", {
method: "POST",
headers: {
Authorization: `Bearer ${KYC_API_KEY}`,
"Content-Type": "application/json",
},
body: JSON.stringify({ id_number: panNumber.toUpperCase() }),
});

if (!res.ok) {
logger.error("Surepass PAN verification HTTP error", { status: res.status });
return { success: false, status: "PENDING", error: "Verification provider temporarily unavailable" };
}
const data = await res.json();

if (data.success && data.data) {
return {
success: true,
status: "VERIFIED",
data: {
name: data.data.full_name,
documentNumber: maskDocument(panNumber, 4),
isValid: data.data.valid,
},
};
}

return {
success: false,
status: "REJECTED",
error: data.message || "PAN verification failed",
};
}

return {
success: false,
status: "PENDING",
error: "Provider not configured",
};
} catch (error) {
logger.error("PAN verification error", error);
return {
success: false,
status: "PENDING",
error: "Verification service unavailable",
};
}
}

// ==================== GST VERIFICATION ====================

/**
* Verify GST number (for brands).
*/
export async function verifyGST(gstNumber: string): Promise<KYCVerifyResult> {
const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[\dA-Z]$/;
if (!gstRegex.test(gstNumber.toUpperCase())) {
return { success: false, status: "REJECTED", error: "Invalid GST format" };
}

if (KYC_PROVIDER === "manual" || !KYC_API_KEY) {
logger.warn("Manual mode GST verification queued for admin");
return {
success: false,
status: "PENDING",
data: { documentNumber: gstNumber },
error: "Manual KYC requires admin review",
};
}

try {
if (KYC_PROVIDER === "surepass") {
const res = await fetchWithTimeout(
"https://kyc-api.surepass.io/api/v1/corporate/gstin",
{
method: "POST",
headers: {
Authorization: `Bearer ${KYC_API_KEY}`,
"Content-Type": "application/json",
},
body: JSON.stringify({ id_number: gstNumber.toUpperCase() }),
},
);

if (!res.ok) {
logger.error("Surepass GST verification HTTP error", { status: res.status });
return { success: false, status: "PENDING", error: "Verification provider temporarily unavailable" };
}
const data = await res.json();

if (data.success && data.data) {
return {
success: true,
status: "VERIFIED",
data: {
name: data.data.business_name,
address: data.data.address,
documentNumber: gstNumber,
isValid: data.data.valid,
},
};
}

return {
success: false,
status: "REJECTED",
error: data.message || "GST verification failed",
};
}

return {
success: false,
status: "PENDING",
error: "Provider not configured",
};
} catch (error) {
logger.error("GST verification error", error);
return {
success: false,
status: "PENDING",
error: "Verification service unavailable",
};
}
}

// ==================== BANK ACCOUNT VERIFICATION ====================

/**
* Verify bank account using penny drop or name match.
*/
export async function verifyBankAccount(params: {
accountNumber: string;
ifscCode: string;
beneficiaryName: string;
}): Promise<BankVerifyResult> {
if (KYC_PROVIDER === "manual" || !KYC_API_KEY) {
logger.warn("Manual mode bank verification queued for admin");
return {
success: false,
nameMatch: false,
accountExists: false,
beneficiaryName: params.beneficiaryName,
error: "Manual bank verification requires admin review",
};
}

try {
if (KYC_PROVIDER === "surepass") {
const res = await fetchWithTimeout(
"https://kyc-api.surepass.io/api/v1/bank-verification/",
{
method: "POST",
headers: {
Authorization: `Bearer ${KYC_API_KEY}`,
"Content-Type": "application/json",
},
body: JSON.stringify({
id_number: params.accountNumber,
ifsc: params.ifscCode,
ifsc_details: true,
}),
},
);

if (!res.ok) {
logger.error("Surepass Bank validation HTTP error", { status: res.status });
return { success: false, nameMatch: false, accountExists: false, error: "Bank verification service temporarily unavailable" };
}
const data = await res.json();

    if (data.success && data.data) {
      const bankName = String(data.data.full_name || "");
      const nameMatch = hasMatchingNameTokens(bankName, params.beneficiaryName);

      return {
        success: true,
        nameMatch,
        accountExists: data.data.account_exists,
        beneficiaryName: bankName,
      };
    }

return {
success: false,
nameMatch: false,
accountExists: false,
error: data.message,
};
}

return {
success: false,
nameMatch: false,
accountExists: false,
error: "Provider not configured",
};
} catch (error) {
logger.error("Bank verification error", error);
return {
success: false,
nameMatch: false,
accountExists: false,
error: "Service unavailable",
};
}
}

// ==================== PROVIDER-SPECIFIC IMPLEMENTATIONS ====================

// Update KYCVerifyResult to include clientId
interface KYCVerifyResult {
success: boolean;
status: KYCStatus;
data?: {
name?: string;
dob?: string;
address?: string;
documentNumber?: string;
isValid?: boolean;
clientId?: string; // For Surepass Aadhaar OTP flow
};
error?: string;
}

async function surepassVerifyAadhaar(
aadhaarNumber: string,
): Promise<KYCVerifyResult> {
// Step 1: Generate OTP
const otpRes = await fetchWithTimeout(
"https://kyc-api.surepass.io/api/v1/aadhaar-v2/generate-otp",
{
method: "POST",
headers: {
Authorization: `Bearer ${KYC_API_KEY}`,
"Content-Type": "application/json",
},
body: JSON.stringify({ id_number: aadhaarNumber }),
},
);

const otpData = await otpRes.json();

if (!otpData.success) {
return {
success: false,
status: "REJECTED",
error: otpData.message || "Aadhaar OTP failed",
};
}

// Return pending with clientId frontend needs to collect OTP and call verifyAadhaarOTP
return {
success: true,
status: "PENDING",
data: {
documentNumber: maskDocument(aadhaarNumber, 4),
clientId: otpData.data?.client_id, // Include client_id for next step!
},
};
}

function matchDigilockerAadhaar(
profile: { name?: string },
dlAadhaar: string,
aadhaarNumber: string,
dbUser: {
influencerProfile?: { displayName?: string } | null;
brandProfile?: { companyName?: string } | null;
email?: string | null;
} | null
): KYCVerifyResult | null {
const dlLast4 = dlAadhaar.slice(-4);
const userLast4 = aadhaarNumber.slice(-4);

  if (!dlAadhaar || dlAadhaar.length < 4) {
    const dbRaw = String(
      dbUser?.influencerProfile?.displayName ||
      dbUser?.brandProfile?.companyName ||
      dbUser?.email?.split("@")[0] ||
      "",
    );

    const isMatch = hasMatchingNameTokens(String(profile.name || ""), dbRaw);

    if (!isMatch) {
      return {
        success: false,
        status: "REJECTED",
        error: "The name on the connected DigiLocker profile does not match your registered name.",
      };
    }
  } else {
const isMismatch = dlAadhaar.length === 12
? dlAadhaar !== aadhaarNumber
: dlLast4 !== userLast4;

if (isMismatch) {
return {
success: false,
status: "REJECTED",
error: "The provided Aadhaar number does not match the Aadhaar number linked to your DigiLocker profile.",
};
}
}

return null;
}

async function digilockerVerifyAadhaar(
aadhaarNumber: string,
userId?: string,
): Promise<KYCVerifyResult> {
if (!userId) {
return {
success: false,
status: "PENDING",
error: "Please connect your DigiLocker account first",
};
}

try {
const oauth = await prisma.oAuthAccount.findFirst({
where: { userId, provider: "digilocker" },
});

if (!oauth?.accessToken) {
return {
success: false,
status: "PENDING",
error: "Please connect your DigiLocker account first",
};
}

const decryptedAccessToken = decrypt(oauth.accessToken);

const profileRes = await fetchWithTimeout("https://api.digilocker.gov.in/account/profile", {
headers: {
Authorization: `Bearer ${decryptedAccessToken}`,
},
});

const profile = await profileRes.json();

if (!profile || profile.error) {
return {
success: false,
status: "PENDING",
error: profile.error_description || profile.message || "Please connect your DigiLocker account first",
};
}

const rawDlAadhaar = profile.aadhaar || profile.aadhaar_number || profile.uid || profile.extra?.aadhaar;
const dlAadhaar = rawDlAadhaar ? String(rawDlAadhaar).replace(/\D/g, "") : "";

const dbUser = await prisma.user.findUnique({
where: { id: userId },
select: {
influencerProfile: { select: { displayName: true } },
brandProfile: { select: { companyName: true } },
email: true,
},
});

const matchResult = matchDigilockerAadhaar(profile, dlAadhaar, aadhaarNumber, dbUser);
if (matchResult) return matchResult;

return {
success: true,
status: "VERIFIED",
data: {
name: profile.name,
dob: profile.dob,
documentNumber: maskDocument(aadhaarNumber, 4),
isValid: true,
},
};
} catch (error: unknown) {
logger.error("DigiLocker verification error", error);
return {
success: false,
status: "PENDING",
error: getErrorMessage(error) || "Please connect your DigiLocker account first",
};
}
}

/**
* Complete Aadhaar verification after OTP (Surepass).
*/
export async function verifyAadhaarOTP(
clientId: string,
otp: string,
): Promise<KYCVerifyResult> {
if (!KYC_API_KEY) {
return {
success: false,
status: "PENDING",
error: "KYC API key not configured",
};
}

try {
const res = await fetchWithTimeout(
"https://kyc-api.surepass.io/api/v1/aadhaar-v2/submit-otp",
{
method: "POST",
headers: {
Authorization: `Bearer ${KYC_API_KEY}`,
"Content-Type": "application/json",
},
body: JSON.stringify({ client_id: clientId, otp }),
},
);

const data = await res.json();

if (data.success && data.data) {
return {
success: true,
status: "VERIFIED",
data: {
name: data.data.full_name,
dob: data.data.dob,
address: data.data.address?.combined || "",
documentNumber: maskDocument(data.data.aadhaar_number, 4),
isValid: true,
},
};
}

return {
success: false,
status: "REJECTED",
error: data.message || "Aadhaar OTP verification failed",
};
} catch (error) {
logger.error("Aadhaar OTP verification error", error);
return {
success: false,
status: "PENDING",
error: "Verification service unavailable",
};
}
}

// ==================== HELPERS ====================

function tokenizeAndCleanName(name: string): string[] {
  const commonTokens = new Set([
    "kumar", "singh", "devi", "prasad", "sri", "shree", "mr", "mrs", "miss", "dr",
    "shri", "smt", "prof", "ca", "adv", "and", "co", "ltd", "pvt", "private", "limited",
  ]);

  return name
    .toLowerCase()
    .replace(/^(mr|ms|mrs|dr|prof|ca|adv|shri|smt|m\/s)\.?\s+/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !commonTokens.has(t));
}

export function hasMatchingNameTokens(nameA: string, nameB: string): boolean {
  const cleanA = nameA.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const cleanB = nameB.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  if (cleanA === cleanB && cleanA.length >= 3) {
    return true;
  }

  const commonSurnames = new Set([
    "kumar", "singh", "devi", "prasad", "sri", "shree", "shri", "smt", "prof", "ca", "adv",
    "and", "co", "ltd", "pvt", "private", "limited",
  ]);

  const titlesRegex = /^(mr|ms|mrs|dr|prof|ca|adv|shri|smt|m\/s)\.?\s+/i;

  const rawTokensA = nameA
    .toLowerCase()
    .replace(titlesRegex, "")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const rawTokensB = nameB
    .toLowerCase()
    .replace(titlesRegex, "")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  if (rawTokensA.length === 0 || rawTokensB.length === 0) return false;

  const setA = new Set(rawTokensA);
  const setB = new Set(rawTokensB);

  // Distinguishing (non-common) tokens
  const distA = rawTokensA.filter((t) => !commonSurnames.has(t));
  const distB = rawTokensB.filter((t) => !commonSurnames.has(t));

  const matchingDist = distA.filter((t) => setB.has(t));
  const matchingAll = rawTokensA.filter((t) => setB.has(t));

  // Must have at least one distinguishing token match
  if (matchingDist.length === 0) {
    // If all words were common tokens in both (e.g. "Kumar Singh" vs "Kumar Singh")
    if (distA.length === 0 && distB.length === 0) {
      return (
        matchingAll.length >= 2 &&
        matchingAll.length === Math.min(rawTokensA.length, rawTokensB.length)
      );
    }
    return false;
  }

  // Tokens present in one name but not the other
  const nonMatchingA = rawTokensA.filter((t) => !setB.has(t));
  const nonMatchingB = rawTokensB.filter((t) => !setA.has(t));

  // If both names have unshared tokens, there is a conflict (e.g. "Rohan Kumar" vs "Rohan Singh", "Amit Kumar Patel" vs "Amit Singh Patel")
  if (nonMatchingA.length > 0 && nonMatchingB.length > 0) {
    return false;
  }

  // If one name is a subset of the other:
  if (nonMatchingA.length === 0 || nonMatchingB.length === 0) {
    // If at least 2 tokens matched in total (e.g. "Amit Kumar" in "Amit Kumar Sharma", or "Vikram Rathore" in "Vikram Aditya Rathore")
    if (matchingAll.length >= 2) return true;

    // If only 1 token matched overall (e.g. "Rohan" vs "Rohan Kumar"):
    // Dropping a common surname is only allowed when all unshared tokens in the longer name are common surnames/titles
    const longerNonMatching = nonMatchingA.length > 0 ? nonMatchingA : nonMatchingB;
    const allDroppedAreCommon = longerNonMatching.every((t) => commonSurnames.has(t));
    if (allDroppedAreCommon) {
      return true;
    }
  }

  // Fallback for fuzzy multi-token matches where >= 2 distinguishing tokens match
  if (matchingDist.length >= 2) {
    const unionSize = new Set([...rawTokensA, ...rawTokensB]).size;
    const jaccard = matchingAll.length / unionSize;
    if (jaccard >= 0.5) return true;
  }

  return false;
}

function maskDocument(doc: string, visibleDigits: number): string {
if (doc.length <= visibleDigits) return doc;
const masked = "X".repeat(doc.length - visibleDigits);
return masked + doc.slice(-visibleDigits);
}
