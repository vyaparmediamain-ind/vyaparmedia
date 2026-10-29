import { AppError, ApiErrorCode, toError } from "@/lib/errors";
/**
* Razorpay SDK Wrapper
* Handles all Razorpay payment operations
*/

import Razorpay from "razorpay";
import crypto from "node:crypto";
import { logger } from "./logger";
import { withCircuitBreaker } from "./circuit-breaker";
import { redis } from "./redis";
import {
  DEFAULT_BRAND_PLATFORM_FEE_PERCENT,
  DEFAULT_GATEWAY_FEE_PERCENT,
  GST_STANDARD_RATE,
  GST_DEAL_EXEMPT_THRESHOLD_PAISE,
} from "@/constants";
import { razorpayApiDurationMs, razorpayApiErrorsTotal } from "./metrics";

/**
 * Instrument external Razorpay gateway calls with Prometheus latency histograms and error counters.
 */
export async function instrumentRazorpayCall<T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    razorpayApiDurationMs.observe({ operation, status: "success" }, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    razorpayApiDurationMs.observe({ operation, status: "error" }, duration);
    const errorType = error instanceof AppError ? error.errorCode : "UNKNOWN_ERROR";
    razorpayApiErrorsTotal.inc({ operation, error_type: String(errorType) });
    throw error;
  }
}

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

  if (!cSubmitted || !cRegistered) return false;
  if (cSubmitted === cRegistered) return true;

  // Only allow substring matching if both names have significant length (>= 4 chars)
  if (cSubmitted.length >= 4 && cRegistered.length >= 4) {
    if (cSubmitted.includes(cRegistered) || cRegistered.includes(cSubmitted)) return true;
  }

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
gstAmount: number;
gstPercent: number;
gatewayFee: number;
totalAmount: number;
influencerReceives: number;
platformFeePercent: number;
} {
  const platformFeePercent =
    customPlatformFeePercent ??
    (Number(process.env.PLATFORM_FEE_PERCENTAGE) || DEFAULT_BRAND_PLATFORM_FEE_PERCENT);
  const gatewayFeePercent =
    Number(process.env.GATEWAY_FEE_PERCENTAGE) || DEFAULT_GATEWAY_FEE_PERCENT;

const safeProductHandlingFee = Math.max(0, Math.round(productHandlingFee || 0));
const platformFee =
Math.round((dealAmount * platformFeePercent) / 100) +
safeProductHandlingFee;

// Automated Deal-Tier GST Rule:
// Deals up to ₹1,500 (150,000 paise) attract 0% GST (Zero Tax Starter).
// Deals above ₹1,500 (i.e. >= ₹1,501 / 150,100 paise) automatically attract 18% GST on the platform fee.
const isGstApplicable = dealAmount > GST_DEAL_EXEMPT_THRESHOLD_PAISE;
const gstPercent = isGstApplicable ? Math.round(GST_STANDARD_RATE * 100) : 0;
const gstAmount = isGstApplicable ? Math.round(platformFee * GST_STANDARD_RATE) : 0;

const gatewayFee = Math.round(
((dealAmount + platformFee + gstAmount) * gatewayFeePercent) / 100,
);
const totalAmount = dealAmount + platformFee + gstAmount + gatewayFee;
// Business Reasoning:
// The influencer is guaranteed to receive 100% of the rate they applied for or negotiated.
// Any platform fees (including discounts, level benefits), applicable GST on fees, and gateway
// transactional fees are borne by the brand on top of the deal amount. This provides full payout
// predictability for the creator.
const influencerReceives = dealAmount;

return {
dealAmount,
platformFee,
gstAmount,
gstPercent,
gatewayFee,
totalAmount,
influencerReceives,
platformFeePercent,
};
}

export interface RouteTransferItem {
  account: string; // Razorpay Linked Account ID (e.g. "acc_XXXXX")
  amount: number; // in paise
  currency?: string; // default "INR"
  on_hold?: boolean; // true holds payout in escrow; false settles directly
  on_hold_until?: number; // optional unix timestamp
  notes?: Record<string, string>;
  linked_account_notes?: string[];
}

export interface CreateLinkedAccountParams {
  userId: string;
  email: string;
  phone?: string | undefined;
  legalBusinessName: string;
  contactName?: string | undefined;
  accountNumber?: string | undefined;
  ifscCode?: string | undefined;
  beneficiaryName?: string | undefined;
  accountType?: ("savings" | "current") | undefined;
}

export interface LinkedAccountResult {
  accountId: string;
  status: string;
  email: string;
}

/**
* Create a standard order or Route split order (for direct escrow funding)
*/
export async function createOrder(params: {
  amount: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
  transfers?: RouteTransferItem[];
}) {
  // notes: Razorpay SDK accepts IMap<string | number>, our params use Record<string, string>
  const orderPayload: Record<string, unknown> = {
    amount: params.amount,
    currency: params.currency ?? "INR",
    receipt: params.receipt,
    ...(params.notes
      ? { notes: params.notes as Record<string, string | number> }
      : {}),
    ...(params.transfers && params.transfers.length > 0
      ? {
          transfers: params.transfers.map((t) => ({
            account: t.account,
            amount: t.amount,
            currency: t.currency ?? "INR",
            on_hold: t.on_hold !== undefined ? t.on_hold : true,
            ...(t.on_hold_until ? { on_hold_until: t.on_hold_until } : {}),
            ...(t.notes ? { notes: t.notes } : {}),
            ...(t.linked_account_notes ? { linked_account_notes: t.linked_account_notes } : {}),
          })),
        }
      : {}),
  };

  const { keyId, keySecret } = getRazorpayCredentials();
  if (
    process.env.NODE_ENV !== "production" &&
    (keyId === "rzp_test_placeholder" || keySecret === "placeholder_secret" || keyId.includes("placeholder"))
  ) {
    logger.warn(`[Razorpay Sandbox] Simulating order creation for ${params.receipt} in dev/test environment`);
    const mockOrderId = `order_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      orderId: mockOrderId,
      amount: params.amount,
      currency: params.currency ?? "INR",
      receipt: params.receipt,
      status: "created",
      transfers: params.transfers?.map((t) => ({
        id: `trf_sim_${Date.now()}`,
        account: t.account,
        amount: t.amount,
        on_hold: t.on_hold !== false,
      })),
    };
  }

  const order = await withCircuitBreaker<{
    id: string;
    amount: string | number;
    currency: string;
    receipt?: string;
    status: string;
    transfers?: Array<{ id: string; account: string; amount: number; on_hold: boolean }>;
  }>("razorpay:createOrder", async () => {
    type RazorpayOrderResult = {
      id: string;
      amount: string | number;
      currency: string;
      receipt?: string;
      status: string;
      transfers?: Array<{ id: string; account: string; amount: number; on_hold: boolean }>;
    };
    return (getRazorpay().orders as unknown as { create: (payload: unknown) => Promise<RazorpayOrderResult> }).create(orderPayload);
  });

  return {
    orderId: order.id,
    amount: typeof order.amount === "string" ? Number.parseInt(order.amount, 10) : order.amount,
    currency: order.currency,
    receipt: order.receipt,
    status: order.status,
    transfers: order.transfers,
  };
}

/**
 * Create a Razorpay Route Linked Account for a creator/vendor.
 * Complies with RBI Payment Aggregator regulations by onboarding creators as sub-merchants.
 */
export async function createLinkedAccount(
  params: CreateLinkedAccountParams
): Promise<LinkedAccountResult> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const body: Record<string, unknown> = {
    email: params.email,
    phone: params.phone || "9999999999",
    legal_business_name: params.legalBusinessName || "Creator Partner",
    customer_facing_business_name: params.legalBusinessName || "Creator Partner",
    business_type: "individual",
    contact_name: params.contactName || params.legalBusinessName || "Creator Partner",
    profile: {
      category: "services",
      subcategory: "marketing_advertising_services",
      description: "Influencer marketing and content creation services",
    },
    notes: {
      user_id: params.userId,
      platform: "VyaparMedia",
    },
  };

  if (params.accountNumber && params.ifscCode) {
    body.settlement_accounts = [
      {
        beneficiary_name: params.beneficiaryName || params.legalBusinessName,
        account_number: params.accountNumber,
        ifsc_code: params.ifscCode,
        account_type: params.accountType || "savings",
      },
    ];
  }

  const result = await withCircuitBreaker<LinkedAccountResult>(
    "razorpay:createLinkedAccount",
    async () => {
      const res = await fetchWithTimeout(
        "https://api.razorpay.com/v2/accounts",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        10000
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        const errDesc = data.error?.description || res.statusText || "Failed to create linked account";
        logger.warn("Razorpay v2/accounts returned error; using fallback or sandbox", {
          error: errDesc,
          userId: params.userId,
        });

        // If in development or using test keys, generate a deterministic sandbox account id
        if (process.env.NODE_ENV !== "production" || keyId.startsWith("rzp_test_")) {
          const deterministicId = `acc_route_${crypto.createHash("sha256").update(params.userId).digest("hex").slice(0, 14)}`;
          return {
            accountId: deterministicId,
            status: "active",
            email: params.email,
          };
        }
        throw new AppError(errDesc, res.status, ApiErrorCode.GATEWAY_ERROR);
      }

      return {
        accountId: data.id,
        status: data.status || "created",
        email: data.email || params.email,
      };
    }
  );

  // Cache in Redis for fast repeated deal funding
  try {
    await redis.set(`rzp:route:account:${params.userId}`, result.accountId, "EX", 86400 * 30);
  } catch {
    /* non-fatal */
  }

  return result;
}

/**
 * Resolve an existing linked account from Redis/DB or create one on Razorpay Route.
 */
export async function getOrCreateLinkedAccount(
  userId: string,
  userFallback?: {
    email: string;
    name: string;
    phone?: string | undefined;
    accountNumber?: string | undefined;
    ifscCode?: string | undefined;
  } | undefined
): Promise<string> {
  const cacheKey = `rzp:route:account:${userId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return cached;
  } catch {
    /* non-fatal */
  }

  const linked = await createLinkedAccount({
    userId,
    email: userFallback?.email || `creator_${userId}@vyaparmedia.in`,
    phone: userFallback?.phone,
    legalBusinessName: userFallback?.name || "Vyapar Creator",
    accountNumber: userFallback?.accountNumber,
    ifscCode: userFallback?.ifscCode,
  });

  return linked.accountId;
}

export interface LinkedAccountDetails {
  id: string;
  status: string;
  email?: string;
  activated: boolean;
  live?: boolean;
  notes?: Record<string, string>;
}

/**
 * Fetch a linked account from Razorpay Route API (GET /v2/accounts/:id)
 */
export async function fetchLinkedAccount(accountId: string): Promise<LinkedAccountDetails> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  if (
    accountId.startsWith("acc_route_") ||
    accountId.startsWith("acc_sandbox_") ||
    process.env.NODE_ENV !== "production" ||
    keyId.startsWith("rzp_test_")
  ) {
    return {
      id: accountId,
      status: "activated",
      activated: true,
      live: false,
    };
  }

  return await withCircuitBreaker("razorpay:fetchLinkedAccount", async () => {
    const res = await fetchWithTimeout(
      `https://api.razorpay.com/v2/accounts/${encodeURIComponent(accountId)}`,
      {
        method: "GET",
        headers: { Authorization: `Basic ${authHeader}` },
      },
      10000
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const desc = (err as { error?: { description?: string } })?.error?.description || res.statusText;
      throw new AppError(`Failed to fetch linked account: ${desc}`, res.status, ApiErrorCode.GATEWAY_ERROR);
    }

    const data = await res.json();
    const status = data.status || "created";
    const activated = status === "activated";

    return {
      id: data.id || accountId,
      status,
      email: data.email,
      activated,
      live: data.live ?? false,
      notes: data.notes,
    };
  });
}

/**
 * Check whether a creator's linked account is active and KYC-approved for payouts.
 * Caches in Redis for 5 minutes.
 */
export async function checkLinkedAccountActivation(
  accountId: string
): Promise<{ isActivated: boolean; status: string; reason?: string | undefined }> {
  const isTestMode =
    process.env.NODE_ENV !== "production" ||
    (process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") ?? false);

  // In test/development mode only, allow synthetic mock IDs
  if (isTestMode) {
    if (
      accountId.startsWith("acc_route_") ||
      accountId.startsWith("acc_sandbox_") ||
      process.env.NODE_ENV !== "production"
    ) {
      return { isActivated: true, status: "activated" };
    }
  }

  // In live production, reject synthetic test account IDs
  if (accountId.startsWith("acc_route_") || accountId.startsWith("acc_sandbox_")) {
    return {
      isActivated: false,
      status: "rejected",
      reason: "Synthetic test account IDs cannot be used in live production.",
    };
  }

  const cacheKey = `rzp:route:account_activation:${accountId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { isActivated: boolean; status: string; reason?: string };
      return parsed;
    }
  } catch {
    /* non-fatal */
  }

  try {
    const account = await fetchLinkedAccount(accountId);
    const result = {
      isActivated: account.activated || account.status === "activated",
      status: account.status,
      reason:
        account.status === "activated"
          ? undefined
          : `Creator linked payout account status is '${account.status}'. Payouts require KYC activation with the payment gateway.`,
    };

    try {
      await redis.set(cacheKey, JSON.stringify(result), "EX", 300);
    } catch {
      /* non-fatal */
    }

    return result;
  } catch (err) {
    logger.warn("Could not verify linked account activation from gateway", { accountId, error: toError(err) });
    return {
      isActivated: false,
      status: "unknown",
      reason: "Could not reach gateway verification. Please retry shortly.",
    };
  }
}

/**
 * Fetch all transfers associated with a payment.
 * Used for reconciliation or when a transfer ID was not cached during order creation.
 */
export async function fetchPaymentTransfers(paymentId: string): Promise<Array<{
  id: string;
  entity: string;
  account: string;
  amount: number;
  currency: string;
  on_hold: boolean;
  status: string;
  notes?: Record<string, string>;
}>> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  if (paymentId.startsWith("pay_sandbox_") || paymentId.startsWith("sim_")) {
    return [
      {
        id: `trf_sandbox_${paymentId}`,
        entity: "transfer",
        account: "acc_route_sandbox",
        amount: 10000,
        currency: "INR",
        on_hold: true,
        status: "created",
      },
    ];
  }

  return await withCircuitBreaker("razorpay:fetchPaymentTransfers", async () => {
    const res = await fetchWithTimeout(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/transfers`,
      {
        method: "GET",
        headers: { Authorization: `Basic ${authHeader}` },
      },
      10000
    );

    if (!res.ok) {
      logger.warn("Failed to fetch payment transfers from Razorpay", { paymentId, status: res.status });
      return [];
    }

    const data = await res.json().catch(() => ({}));
    return (data.items as Array<{
      id: string;
      entity: string;
      account: string;
      amount: number;
      currency: string;
      on_hold: boolean;
      status: string;
      notes?: Record<string, string>;
    }>) || [];
  });
}

/**
 * Release an Escrow Hold on a Razorpay Route transfer.
 * Called when a deal deliverable is approved / verified.
 * Releases the funds held in Razorpay's RBI-regulated Escrow so they settle directly to the creator.
 */
export async function releaseTransferHold(
  transferId: string
): Promise<{ success: boolean; transferId: string; status?: string }> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  return await withCircuitBreaker("razorpay:releaseTransferHold", async () => {
    if (transferId.startsWith("trf_sandbox_") || transferId.startsWith("sim_")) {
      logger.info("Sandbox transfer hold release simulated", { transferId });
      return { success: true, transferId, status: "settled" };
    }

    const res = await fetchWithTimeout(
      `https://api.razorpay.com/v1/transfers/${encodeURIComponent(transferId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          on_hold: false,
          on_hold_until: null,
        }),
      },
      10000
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      const errorDesc = (data.error?.description as string) || res.statusText || "Failed to release transfer hold";

      // Idempotency: if already released, settled, or not on hold, return success
      const errLower = typeof errorDesc === "string" ? errorDesc.toLowerCase() : "";
      if (
        errLower.includes("already") ||
        errLower.includes("not on hold") ||
        errLower.includes("processed") ||
        errLower.includes("settled")
      ) {
        logger.info("Transfer hold was already released on Razorpay Route (idempotent)", {
          transferId,
          error: errorDesc,
        });
        return { success: true, transferId, status: "processed" };
      }

      logger.error("Failed to release Razorpay Route transfer hold", { transferId, error: errorDesc });
      throw new AppError(errorDesc, res.status || 502, ApiErrorCode.GATEWAY_ERROR);
    }

    logger.info("Razorpay Route transfer hold released successfully", {
      transferId,
      status: data.status,
    });

    return {
      success: true,
      transferId: data.id || transferId,
      status: data.status,
    };
  });
}

/**
 * Reverse a Route transfer back to platform nodal account.
 * Used when a deal is cancelled, disputed, or refunded to the brand.
 */
export async function reverseTransfer(params: {
  transferId: string;
  amount?: number;
  notes?: Record<string, string>;
}): Promise<{ success: boolean; reversalId?: string; transferId: string; amount?: number }> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  return await withCircuitBreaker("razorpay:reverseTransfer", async () => {
    if (params.transferId.startsWith("trf_sandbox_") || params.transferId.startsWith("sim_")) {
      logger.info("Sandbox transfer reversal simulated", { transferId: params.transferId });
      return {
        success: true,
        reversalId: `rev_sandbox_${Date.now()}`,
        transferId: params.transferId,
        amount: params.amount,
      };
    }

    const res = await fetchWithTimeout(
      `https://api.razorpay.com/v1/transfers/${encodeURIComponent(params.transferId)}/reversals`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(params.amount ? { amount: params.amount } : {}),
          ...(params.notes ? { notes: params.notes } : {}),
        }),
      },
      10000
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      const errorDesc = data.error?.description || "Failed to reverse transfer";
      logger.error("Failed to reverse Razorpay Route transfer", {
        transferId: params.transferId,
        error: errorDesc,
      });
      throw new AppError(errorDesc, res.status, ApiErrorCode.GATEWAY_ERROR);
    }

    logger.info("Razorpay Route transfer reversed successfully", {
      transferId: params.transferId,
      reversalId: data.id,
    });

    return {
      success: true,
      reversalId: data.id,
      transferId: params.transferId,
      amount: data.amount,
    };
  });
}

/**
 * Fetch transfer status from Razorpay Route.
 */
export async function fetchTransfer(transferId: string): Promise<{
  id: string;
  entity: string;
  account: string;
  amount: number;
  currency: string;
  on_hold: boolean;
  settlement_status?: string;
}> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  return await withCircuitBreaker("razorpay:fetchTransfer", async () => {
    const res = await fetchWithTimeout(
      `https://api.razorpay.com/v1/transfers/${encodeURIComponent(transferId)}`,
      {
        method: "GET",
        headers: { Authorization: `Basic ${authHeader}` },
      },
      10000
    );

    if (!res.ok) {
      throw AppError.badRequest(`Failed to fetch transfer: ${res.statusText}`);
    }
    return await res.json();
  });
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
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const signal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : undefined;

  if (signal) {
    return await fetch(url, { ...options, signal });
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function searchExistingContact(params: PayoutParams, authHeader: string): Promise<string | null> {
const refId = params.userId || params.referenceId;
if (!refId) return null;
try {
const searchRes = await fetchWithTimeout(`https://api.razorpay.com/v1/contacts?reference_id=${encodeURIComponent(refId)}`, {
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
const contactRes = await fetchWithTimeout("https://api.razorpay.com/v1/contacts", {
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
const searchRes = await fetchWithTimeout(`https://api.razorpay.com/v1/fund_accounts?contact_id=${encodeURIComponent(contactId)}`, {
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
const fundAccountRes = await fetchWithTimeout(
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

  // Fast fail early if circuit breaker is currently OPEN to avoid hanging on contact/fund account fetches
  const isCircuitOpen = await redis.get("cb:open:razorpay:createPayout");
  if (isCircuitOpen) {
    logger.warn("[CircuitBreaker] FAST FAIL: Razorpay payout circuit is currently OPEN.");
    throw AppError.badRequest("Service unavailable for 'razorpay:createPayout'. Circuit is OPEN.");
  }

  // Step 1: Resolve or create Contact
  const contactId = await resolveOrCreateRazorpayContact(params, authHeader, contactCacheKey);

  // Step 2: Resolve or create Fund Account
  const fundAccountId = await resolveOrCreateRazorpayFundAccount(params, contactId, authHeader, fundCacheKey, isUpiPayout);

  // Step 3: Create payout (always new idempotency via X-Payout-Idempotency header)
const payout = await withCircuitBreaker("razorpay:createPayout", async () => {
  const res = await fetchWithTimeout("https://api.razorpay.com/v1/payouts", {
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
  }, 10000);

  const data = await res.json();
  if (data.error || !res.ok) {
    const errorDescription = data.error?.description || "Payout creation failed";
    throw new AppError(errorDescription, res.status, ApiErrorCode.GATEWAY_ERROR);
  }
  return data;
});

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

  return await withCircuitBreaker("razorpay:getPayout", async () => {
    const res = await fetchWithTimeout(
      `https://api.razorpay.com/v1/payouts/${encodeURIComponent(payoutId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${authHeader}`,
        },
      },
      10000
    );

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
  });
}

import { isWebhookProcessed } from "./idempotency";

/**
* Verify Razorpay webhook signature
*/
export function verifyWebhookSignature(
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
  if (
    process.env.NODE_ENV !== "production" &&
    (params?.orderId?.startsWith("order_sim_") || params?.paymentId?.startsWith("pay_sim_"))
  ) {
    logger.info("[Razorpay Dev] Auto-verifying simulated payment signature in development mode");
    return true;
  }
  if (!process.env.RAZORPAY_KEY_SECRET || !params?.signature || !params?.orderId || !params?.paymentId) {
    return false;
  }
  const text = `${params.orderId}|${params.paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
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
  if (
    process.env.NODE_ENV !== "production" &&
    (paymentId.startsWith("pay_sim_") || paymentId.startsWith("pay_sandbox_"))
  ) {
    const matchedOrderId = paymentId.includes("_order_")
      ? paymentId.split("_order_")[1]
      : `order_sim_${paymentId.slice(8)}`;
    return {
      id: paymentId,
      entity: "payment",
      order_id: matchedOrderId,
      amount: 10000,
      currency: "INR",
      status: "captured",
      method: "upi",
    } as unknown as Awaited<ReturnType<ReturnType<typeof getRazorpay>["payments"]["fetch"]>>;
  }
  return await getRazorpay().payments.fetch(paymentId);
}

/**
 * Capture a Razorpay payment authorization.
 * Must be called before paying the influencer on card-funded deals
 * when the dispute is resolved in the influencer's favor.
 */
export async function capturePayment(paymentId: string, amount: number): Promise<void> {
  if (
    process.env.NODE_ENV !== "production" &&
    (paymentId.startsWith("pay_sim_") || paymentId.startsWith("pay_sandbox_"))
  ) {
    return;
  }
  await getRazorpay().payments.capture(paymentId, amount, "INR");
}

/**
* Get order details
*/
export async function getOrder(orderId: string) {
  if (
    process.env.NODE_ENV !== "production" &&
    (orderId.startsWith("order_sim_") || orderId.startsWith("order_sandbox_"))
  ) {
    return {
      id: orderId,
      entity: "order",
      amount: 10000,
      currency: "INR",
      status: "paid",
    } as unknown as Awaited<ReturnType<ReturnType<typeof getRazorpay>["orders"]["fetch"]>>;
  }
return await getRazorpay().orders.fetch(orderId);
}


export default getRazorpay;

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

  return await withCircuitBreaker("razorpay:validateFundAccount", async () => {
    async function razorpayPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
      const res = await fetchWithTimeout(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(body),
      }, 10000);
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
  });
}

/**
 * Query RazorpayX for a payout by deterministic reference_id (TP-04).
 * Used during payout reconciliation when a payout submission timed out (5xx or timeout)
 * so we don't blindly re-credit the wallet if Razorpay successfully processed the payout.
 * Reference: https://razorpay.com/docs/x/payouts/fetch/
 */
export async function fetchPayoutByReferenceId(referenceId: string): Promise<{
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  utr?: string;
  reference_id?: string;
  failure_reason?: string;
} | null> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  if (process.env.NODE_ENV !== "production" || keyId.startsWith("rzp_test_")) {
    if (referenceId.includes("sandbox") || referenceId.includes("sim")) {
      return null;
    }
  }

  return await withCircuitBreaker("razorpay:fetchPayoutByReferenceId", async () => {
    const res = await fetchWithTimeout(
      `https://api.razorpay.com/v1/payouts?reference_id=${encodeURIComponent(referenceId)}`,
      {
        method: "GET",
        headers: { Authorization: `Basic ${authHeader}` },
      },
      10000,
    );

    if (!res.ok) {
      if (res.status === 404) return null;
      logger.warn("Failed to query payout by reference_id from Razorpay", { referenceId, status: res.status });
      return null;
    }

    const data = await res.json().catch(() => ({}));
    const items = data?.items;
    if (Array.isArray(items) && items.length > 0) {
      const match = items.find((p: { reference_id?: string }) => p.reference_id === referenceId) || items[0];
      return match || null;
    }
    return null;
  });
}

/**
 * Fetch payments from Razorpay Payments API with count/skip pagination (max 100 per page).
 * Used for daily IST settlement reconciliation against the transaction ledger.
 * Reference: https://razorpay.com/docs/api/payments/#fetch-all-payments
 */
export async function fetchRazorpayPayments(params: {
  from: number; // Unix timestamp in seconds
  to: number;   // Unix timestamp in seconds
  count?: number; // max 100
  skip?: number;
}): Promise<Array<{
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id?: string;
  created_at: number;
}>> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const count = Math.min(Math.max(1, params.count ?? 100), 100);
  const skip = Math.max(0, params.skip ?? 0);

  if (process.env.NODE_ENV !== "production" || keyId.startsWith("rzp_test_")) {
    return [];
  }

  return await withCircuitBreaker("razorpay:fetchRazorpayPayments", async () => {
    const res = await fetchWithTimeout(
      `https://api.razorpay.com/v1/payments?from=${params.from}&to=${params.to}&count=${count}&skip=${skip}`,
      {
        method: "GET",
        headers: { Authorization: `Basic ${authHeader}` },
      },
      10000,
    );

    if (!res.ok) {
      logger.warn("Failed to fetch payments from Razorpay", { status: res.status });
      return [];
    }

    const data = await res.json().catch(() => ({}));
    return (data?.items as Array<{
      id: string;
      entity: string;
      amount: number;
      currency: string;
      status: string;
      order_id?: string;
      created_at: number;
    }>) || [];
  });
}

/**
 * Fetch account balance from RazorpayX API.
 * Alerts when balance is low to prevent payouts queueing.
 * Reference: https://razorpay.com/docs/x/account/
 */
export async function fetchRazorpayXBalance(accountNumber?: string): Promise<{
  balance: number; // In paise
  currency: string;
}> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const accNum = accountNumber || process.env.RAZORPAY_ACCOUNT_NUMBER;
  if (!accNum) {
    return { balance: 0, currency: "INR" };
  }

  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  if (process.env.NODE_ENV !== "production" || keyId.startsWith("rzp_test_")) {
    return { balance: 100000000, currency: "INR" }; // 10 Lakh test sandbox balance
  }

  return await withCircuitBreaker("razorpay:fetchRazorpayXBalance", async () => {
    const res = await fetchWithTimeout(
      `https://api.razorpay.com/v1/banking/accounts/${encodeURIComponent(accNum)}/balances`,
      {
        method: "GET",
        headers: { Authorization: `Basic ${authHeader}` },
      },
      10000,
    );

    if (!res.ok) {
      logger.warn("Failed to fetch RazorpayX balance", { status: res.status });
      return { balance: 0, currency: "INR" };
    }

    const data = await res.json().catch(() => ({}));
    return {
      balance: typeof data?.balance === "number" ? data.balance : 0,
      currency: data?.currency || "INR",
    };
  });
}
