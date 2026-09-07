import { AppError, ApiErrorCode } from "@/lib/errors";
/**
* Razorpay SDK Wrapper
* Handles all Razorpay payment operations
*/

import Razorpay from "razorpay";
import crypto from "node:crypto";
import { logger } from "./logger";
import { withCircuitBreaker } from "./circuit-breaker";
import { redis } from "./redis";

// Lazy-initialize Razorpay instance (fails at call-time, not import-time)
let _razorpay: Razorpay | null = null;

function getRazorpayCredentials(): { keyId: string; keySecret: string } {
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
throw AppError.internal("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables are required",);
}

return { keyId, keySecret };
}

function isFuzzyNameMatch(submittedName: string, registeredName: string | null): boolean {
  if (!registeredName) return false;
  
  const clean = (s: string) => s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

  const cSubmitted = clean(submittedName);
  const cRegistered = clean(registeredName);

  if (cSubmitted === cRegistered) return true;

  if (cSubmitted.includes(cRegistered) || cRegistered.includes(cSubmitted)) return true;

  return false;
}

function getRazorpay(): Razorpay {
if (!_razorpay) {
const { keyId, keySecret } = getRazorpayCredentials();
_razorpay = new Razorpay({
key_id: keyId,
key_secret: keySecret,
});
}
return _razorpay;
}


interface PayoutParams {
accountNumber: string;
ifscCode: string;
beneficiaryName: string;
amount: number; // In paise
purpose?: string;
referenceId: string;
userId?: string;
upiId?: string;
}

interface RefundParams {
paymentId: string;
amount: number; // In paise
speed?: "normal" | "optimum";
notes?: Record<string, string>;
}

/**
* Calculate total amount with fees.
* @param dealAmount - Deal amount in paise
* @param customPlatformFeePercent - Optional override for the platform fee %.
* When provided (e.g. from level-based or referral-based discounts),
* this value is used instead of the PLATFORM_FEE_PERCENTAGE env var.
*/
export function calculateTotalAmount(
dealAmount: number,
customPlatformFeePercent?: number,
productHandlingFee = 0,
): {
dealAmount: number;
platformFee: number;
gatewayFee: number;
totalAmount: number;
influencerReceives: number;
platformFeePercent: number;
} {
const platformFeePercent =
customPlatformFeePercent ?? (Number(process.env.PLATFORM_FEE_PERCENTAGE) || 10);
const gatewayFeePercent = Number(process.env.GATEWAY_FEE_PERCENTAGE) || 2;

const safeProductHandlingFee = Math.max(0, Math.round(productHandlingFee || 0));
const platformFee =
Math.round((dealAmount * platformFeePercent) / 100) +
safeProductHandlingFee;
const gatewayFee = Math.round(
((dealAmount + platformFee) * gatewayFeePercent) / 100,
);
const totalAmount = dealAmount + platformFee + gatewayFee;
// Business Reasoning:
// The influencer is guaranteed to receive 100% of the rate they applied for or negotiated.
// Any platform fees (including discounts, level benefits) and gateway transactional fees
// are borne by the brand on top of the deal amount. This provides full payout predictability
// for the creator. Future fee structure updates (e.g. splitting fees) should maintain
// this separation or adjust both sides transparently.
const influencerReceives = dealAmount;

return {
dealAmount,
platformFee,
gatewayFee,
totalAmount,
influencerReceives,
platformFeePercent,
};
}

/**
* Create a standard order (for adding funds)
*/
export async function createOrder(params: {
amount: number;
currency?: string;
receipt: string;
notes?: Record<string, string>;
}) {
// notes: Razorpay SDK accepts IMap<string | number>, our params use Record<string, string>
// We spread into a compatible object explicitly to avoid the need for `as any`
const orderPayload = {
amount: params.amount,
currency: params.currency ?? "INR",
receipt: params.receipt,
...(params.notes
? { notes: params.notes as Record<string, string | number> }
: {}),
};
const order = await withCircuitBreaker<{ id: string; amount: string | number; currency: string; receipt?: string; status: string }>("razorpay:createOrder", async () => {
return getRazorpay().orders.create(orderPayload);
});

return {
orderId: order.id,
amount: typeof order.amount === "string" ? Number.parseInt(order.amount, 10) : order.amount,
currency: order.currency,
receipt: order.receipt,
status: order.status,
};
}


/**
* Refund a payment (full or partial)
*/
export async function refundPayment(params: RefundParams) {
const refund = await withCircuitBreaker("razorpay:refundPayment", async () => {
return getRazorpay().payments.refund(params.paymentId, {
amount: params.amount,
speed: params.speed || "normal",
notes: params.notes,
});
});

return {
refundId: refund.id,
paymentId: refund.payment_id,
amount: refund.amount,
status: refund.status,
};
}

/**
* Create a payout to influencer's bank account
* Uses RazorpayX API directly for payouts.
* Caches Contact and Fund Account IDs in Redis to avoid duplicate creation.
*/
async function searchExistingContact(params: PayoutParams, authHeader: string): Promise<string | null> {
const refId = params.userId || params.referenceId;
if (!refId) return null;
try {
const searchRes = await fetch(`https://api.razorpay.com/v1/contacts?reference_id=${encodeURIComponent(refId)}`, {
method: "GET",
headers: { Authorization: `Basic ${authHeader}` },
});
if (searchRes.ok) {
const list = await searchRes.json();
const items = list?.items;
if (Array.isArray(items) && items.length > 0) {
const existingContact = items.find((c: { name?: string; active?: boolean; id?: string }) => c.name?.toLowerCase() === params.beneficiaryName.toLowerCase() && c.active);
if (existingContact?.id) return existingContact.id;
}
}
} catch (err) {
logger.warn("Razorpay contact lookup query failed, fallback to creation", { error: String(err) });
}
return null;
}

async function createRazorpayContact(params: PayoutParams, authHeader: string): Promise<string> {
const contactRes = await fetch("https://api.razorpay.com/v1/contacts", {
method: "POST",
headers: {
Authorization: `Basic ${authHeader}`,
"Content-Type": "application/json",
},
body: JSON.stringify({
name: params.beneficiaryName,
type: "vendor",
reference_id: params.userId || params.referenceId,
}),
});
const contact = await contactRes.json();

if (contact.error || !contact.id) {
throw AppError.badRequest(contact.error?.description || "Failed to create Razorpay contact");
}
return contact.id;
}

async function searchExistingFundAccount(
contactId: string,
authHeader: string,
isUpiPayout: boolean,
params: PayoutParams,
): Promise<string | null> {
try {
const searchRes = await fetch(`https://api.razorpay.com/v1/fund_accounts?contact_id=${encodeURIComponent(contactId)}`, {
method: "GET",
headers: { Authorization: `Basic ${authHeader}` },
});
if (searchRes.ok) {
const list = await searchRes.json();
const items = list?.items;
if (Array.isArray(items) && items.length > 0) {
const existingFund = items.find((f: { account_type?: string; vpa?: { address?: string }; active?: boolean; bank_account?: { account_number?: string }; id?: string }) =>
isUpiPayout
? f.account_type === "vpa" && f.vpa?.address === params.upiId && f.active
: f.account_type === "bank_account" && f.bank_account?.account_number === params.accountNumber && f.active
);
if (existingFund?.id) return existingFund.id;
}
}
} catch (err) {
logger.warn("Razorpay fund account lookup query failed, fallback to creation", { error: String(err) });
}
return null;
}

async function createRazorpayFundAccount(
contactId: string,
authHeader: string,
isUpiPayout: boolean,
params: PayoutParams,
): Promise<string> {
const fundAccountRes = await fetch(
"https://api.razorpay.com/v1/fund_accounts",
{
method: "POST",
headers: {
Authorization: `Basic ${authHeader}`,
"Content-Type": "application/json",
},
body: JSON.stringify({
contact_id: contactId,
account_type: isUpiPayout ? "vpa" : "bank_account",
...(isUpiPayout
? {
vpa: {
address: params.upiId,
},
}
: {
bank_account: {
name: params.beneficiaryName,
ifsc: params.ifscCode,
account_number: params.accountNumber,
},
}),
}),
},
);
const fundAccount = await fundAccountRes.json();

if (fundAccount.error || !fundAccount.id) {
throw AppError.badRequest(fundAccount.error?.description || "Failed to create Razorpay fund account");
}
return fundAccount.id;
}

/**
* Create a payout to influencer's bank account
* Uses RazorpayX API directly for payouts.
* Caches Contact and Fund Account IDs in Redis to avoid duplicate creation.
*/
async function resolveOrCreateRazorpayContact(
params: PayoutParams,
authHeader: string,
contactCacheKey: string
): Promise<string> {
let contactId: string | null = null;

try {
contactId = await redis.get(contactCacheKey);
} catch { /* Redis miss is non-fatal */ }

if (!contactId) {
contactId = await searchExistingContact(params, authHeader);
if (contactId) {
try { await redis.set(contactCacheKey, contactId, "EX", 86400 * 30); } catch { /* non-fatal */ }
}
}

if (!contactId) {
contactId = await createRazorpayContact(params, authHeader);
try { await redis.set(contactCacheKey, contactId, "EX", 86400 * 30); } catch { /* non-fatal */ }
}

return contactId;
}

async function resolveOrCreateRazorpayFundAccount(
params: PayoutParams,
contactId: string,
authHeader: string,
fundCacheKey: string,
isUpiPayout: boolean
): Promise<string> {
let fundAccountId: string | null = null;

try {
fundAccountId = await redis.get(fundCacheKey);
} catch { /* Redis miss is non-fatal */ }

if (!fundAccountId) {
fundAccountId = await searchExistingFundAccount(contactId, authHeader, isUpiPayout, params);
if (fundAccountId) {
try { await redis.set(fundCacheKey, fundAccountId, "EX", 86400 * 30); } catch { /* non-fatal */ }
}
}

if (!fundAccountId) {
fundAccountId = await createRazorpayFundAccount(contactId, authHeader, isUpiPayout, params);
try { await redis.set(fundCacheKey, fundAccountId, "EX", 86400 * 30); } catch { /* non-fatal */ }
}

return fundAccountId;
}

export async function createPayout(params: PayoutParams) {
const { keyId, keySecret } = getRazorpayCredentials();
const accountNumber = process.env.RAZORPAY_ACCOUNT_NUMBER;

if (!accountNumber) {
throw AppError.badRequest("RAZORPAY_ACCOUNT_NUMBER is required for RazorpayX payouts");
}

const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
const isUpiPayout = params.accountNumber === "UPI_PAYOUT" && params.ifscCode === "UPI00000000";

// Cache keys based on stable bank details to avoid duplicate Razorpay entities
const upiSuffix = params.upiId || "";
const contactSource = `${params.beneficiaryName}:${params.accountNumber}:${params.ifscCode}:${upiSuffix}`;
const contactHash = crypto.createHash("sha256").update(contactSource).digest("hex");
const contactCacheKey = `rzp:contact:${contactHash}`;

const upiHash = crypto.createHash("sha256").update(params.upiId || "").digest("hex");
const bankSource = `${params.accountNumber}:${params.ifscCode}`;
const bankHash = crypto.createHash("sha256").update(bankSource).digest("hex");
const fundCacheKey = isUpiPayout
? `rzp:fund:upi:${upiHash}`
: `rzp:fund:${bankHash}`;

// Step 1: Resolve or create Contact
const contactId = await resolveOrCreateRazorpayContact(params, authHeader, contactCacheKey);

// Step 2: Resolve or create Fund Account
const fundAccountId = await resolveOrCreateRazorpayFundAccount(params, contactId, authHeader, fundCacheKey, isUpiPayout);

// Step 3: Create payout (always new idempotency via X-Payout-Idempotency header)
const payoutRes = await withCircuitBreaker("razorpay:createPayout", async () => {
return fetch("https://api.razorpay.com/v1/payouts", {
method: "POST",
headers: {
Authorization: `Basic ${authHeader}`,
"Content-Type": "application/json",
"X-Payout-Idempotency": params.referenceId,
},
body: JSON.stringify({
account_number: accountNumber,
fund_account_id: fundAccountId,
amount: params.amount,
currency: "INR",
mode: isUpiPayout ? "UPI" : "IMPS",
purpose: params.purpose || "payout",
queue_if_low_balance: true,
reference_id: params.referenceId,
}),
});
});
  const payout = await payoutRes.json();

  if (payout.error || !payoutRes.ok) {
    const errorDescription = payout.error?.description || "Payout creation failed";
    throw new AppError(errorDescription, payoutRes.status, ApiErrorCode.GATEWAY_ERROR);
  }

return {
payoutId: payout.id,
amount: payout.amount,
status: payout.status,
utr: payout.utr,
};
}

export async function getPayout(payoutId: string) {
const { keyId, keySecret } = getRazorpayCredentials();
const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

const res = await fetch(`https://api.razorpay.com/v1/payouts/${encodeURIComponent(payoutId)}`, {
method: "GET",
headers: {
Authorization: `Basic ${authHeader}`,
},
});

if (!res.ok) {
throw AppError.badRequest(`Failed to fetch payout status: ${res.statusText}`);
}

const payout = await res.json();
return {
payoutId: payout.id,
amount: payout.amount,
status: payout.status,
utr: payout.utr,
};
}

import { isWebhookProcessed } from "./idempotency";

/**
* Verify Razorpay webhook signature
*/
function verifyWebhookSignature(
body: string,
signature: string,
secret: string = process.env.RAZORPAY_WEBHOOK_SECRET!,
): boolean {
if (!secret || !signature) return false;
if (!/^[a-f0-9]{64}$/i.test(signature)) return false;

const expectedSignature = crypto
.createHmac("sha256", secret)
.update(body)
.digest("hex");

const sigBuffer = Buffer.from(signature, "hex");
const expectedBuffer = Buffer.from(expectedSignature, "hex");

if (sigBuffer.length !== expectedBuffer.length) return false;

return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
* Securely process a webhook event with signature verification and replay protection.
*/
export async function processSecureWebhook(
rawBody: string,
signature: string,
eventId: string,
eventType: string
): Promise<{ isValid: boolean; isDuplicate: boolean; eventKey: string }> {
// 1. Verify Signature
const isValid = verifyWebhookSignature(rawBody, signature);
if (!isValid) {
logger.warn("[ Razorpay Webhook] Invalid signature detected", { eventId, eventType });
return { isValid: false, isDuplicate: false, eventKey: "" };
}

// Razorpay doesn't guarantee every payload has a stable entity id for idempotency.
// Prefer explicit event id and fallback to a deterministic hash of event + payload.
const eventKey =
eventId?.trim() ||
crypto
.createHash("sha256")
.update(`${eventType}:${rawBody}`)
.digest("hex");

// 2. Check for Replay Attack / Duplicates
const isDuplicate = await isWebhookProcessed(eventKey);
if (isDuplicate) {
logger.info("[ Razorpay Webhook] Duplicate event ignored", {
eventId,
eventKey,
eventType,
});
return { isValid: true, isDuplicate: true, eventKey };
}

return { isValid: true, isDuplicate: false, eventKey };
}


/**
* Verify payment signature (for frontend callback)
*/
export function verifyPaymentSignature(params: {
orderId: string;
paymentId: string;
signature: string;
}): boolean {
const text = `${params.orderId}|${params.paymentId}`;
const expectedSignature = crypto
.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
.update(text)
.digest("hex");

const sigBuffer = Buffer.from(params.signature);
const expectedBuffer = Buffer.from(expectedSignature);

// timingSafeEqual throws if lengths differ check first
if (sigBuffer.length !== expectedBuffer.length) return false;

return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
* Get payment details
*/
export async function getPayment(paymentId: string) {
  return await getRazorpay().payments.fetch(paymentId);
}

/**
 * Capture a Razorpay payment authorization.
 * Must be called before paying the influencer on card-funded deals
 * when the dispute is resolved in the influencer's favor.
 */
export async function capturePayment(paymentId: string, amount: number): Promise<void> {
  await getRazorpay().payments.capture(paymentId, amount, "INR");
}

/**
* Get order details
*/
export async function getOrder(orderId: string) {
return await getRazorpay().orders.fetch(orderId);
}


export default getRazorpay;

// ==================== FUND ACCOUNT VALIDATION (Penny-Drop) ====================

interface FundAccountValidationResult {
  /** Razorpay fund_account_id for this bank account */
  fundAccountId: string;
  /** Razorpay validation id — can be used to poll status */
  validationId: string;
  /** Registered account holder name returned by bank */
  registeredName: string | null;
  /** Whether the account passed validation */
  isValid: boolean;
}

/**
 * Validate bank account ownership via Razorpay Fund Account Validation API.
 *
 * Flow:
 *   1. Create a Razorpay Contact for this user
 *   2. Attach a Fund Account (bank/UPI) to that contact
 *   3. Trigger Fund Account Validation (₹1 penny-drop)
 *   4. Return registeredName from bank for name-match against KYC
 *
 * Reference: https://razorpay.com/docs/payments/fund-account-validation/
 */
export async function validateFundAccount(params: {
  userId: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
}): Promise<FundAccountValidationResult> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const baseUrl = "https://api.razorpay.com/v1";

  async function razorpayPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { description: res.statusText } }));
      const description = (err as { error?: { description?: string } })?.error?.description ?? res.statusText;
      throw AppError.internal(`Razorpay FAV error: ${description}`);
    }
    return res.json() as Promise<T>;
  }

  // Step 1: Create contact
  const contact = await razorpayPost<{ id: string }>("/contacts", {
    name: params.accountHolderName,
    type: "employee",
    reference_id: params.userId,
  });

  // Step 2: Create fund account linked to contact
  const fundAccount = await razorpayPost<{ id: string }>("/fund_accounts", {
    contact_id: contact.id,
    account_type: "bank_account",
    bank_account: {
      name: params.accountHolderName,
      ifsc: params.ifscCode,
      account_number: params.accountNumber,
    },
  });

  // Step 3: Trigger fund account validation (penny-drop)
  const validation = await razorpayPost<{
    id: string;
    fund_account_id: string;
    results?: {
      account_status?: string;
      registered_name?: string;
    };
  }>("/fund_accounts/validations", {
    account_number: process.env.RAZORPAY_ACCOUNT_NUMBER, // Platform payout account
    fund_account: { id: fundAccount.id },
    amount: 100, // Re 1 in paise
    currency: "INR",
    description: "Bank account ownership verification",
    receipt: `fav_${params.userId}_${Date.now()}`,
    notes: { purpose: "bank_verification", user_id: params.userId },
  });

  const registeredName = validation.results?.registered_name ?? null;
  const accountStatus = validation.results?.account_status ?? "unknown";
  let isValid = accountStatus === "active";

  if (isValid && registeredName) {
    isValid = isFuzzyNameMatch(params.accountHolderName, registeredName);
  }

  logger.info("Fund account validation completed", {
    userId: params.userId,
    fundAccountId: fundAccount.id,
    validationId: validation.id,
    accountStatus,
    registeredName,
  });

  return {
    fundAccountId: fundAccount.id,
    validationId: validation.id,
    registeredName,
    isValid,
  };
}
