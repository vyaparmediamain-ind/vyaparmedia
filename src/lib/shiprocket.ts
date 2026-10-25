import crypto from "node:crypto";
import { AppError } from "@/lib/errors";
import { env } from "@/env";
import { withCircuitBreaker } from "@/lib/circuit-breaker";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

const SHIPROCKET_REQUEST_TIMEOUT_MS = 10000;

async function shiprocketFetch(
  url: string,
  init?: RequestInit,
  timeoutMs = SHIPROCKET_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  return withCircuitBreaker(
    "shiprocket:api",
    async () => {
      return fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    },
    { failureThreshold: 5, resetTimeout: 60 },
  );
}

export interface ShiprocketAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pinCode: string;
  country?: string;
}

export interface CreateShiprocketOrderParams {
  dealId: string;
  campaignTitle: string;
  productName: string;
  productValuePaise: number;
  shippingAddress: ShiprocketAddress;
  creatorEmail?: string | undefined;
  pickupLocation?: string | undefined;
  length?: number | undefined;
  breadth?: number | undefined;
  height?: number | undefined;
  weight?: number | undefined; // kg
  pickupPincode?: string | undefined; // brand pickup pincode for rate estimation
  walletBalancePaise?: number | undefined; // brand's wallet balance for pre-flight validation
}

export interface TrackingCheckpoint {
  date: string;
  status: string;
  activity: string;
  location: string;
}

export interface TrackingResult {
  awbCode: string;
  currentStatus: string;
  courierName?: string | undefined;
  deliveredDate?: string | null | undefined;
  scans: TrackingCheckpoint[];
}

export interface CompleteShipmentResult {
  orderId: string;
  shipmentId: string;
  awbCode: string;
  courierName: string;
  labelUrl?: string | undefined;
  manifestUrl?: string | undefined;
  initialStatus: string;
  trackingHistory: TrackingCheckpoint[];
  /** Courier charge billed to brand wallet (paise). */
  courierChargePaise: number;
}

// Redis token cache and single-flight lock constants
const SHIPROCKET_TOKEN_REDIS_KEY = "shiprocket:auth:token";
const SHIPROCKET_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days (Shiprocket tokens valid ~10 days)

// In-memory token cache with concurrency deduplication
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let tokenFetchPromise: Promise<string> | null = null;

const SHIPROCKET_API_BASE = "https://apiv2.shiprocket.in/v1/external";

/**
 * Checks whether Shiprocket live API credentials are configured.
 */
export function isShiprocketConfigured(): boolean {
  const email = process.env.SHIPROCKET_EMAIL ?? env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD ?? env.SHIPROCKET_PASSWORD;
  return Boolean(email && password);
}

/**
 * Clears cached tokens from memory and Redis (useful for test resets and 401 invalidations).
 */
export async function clearCachedShiprocketToken(): Promise<void> {
  cachedToken = null;
  tokenExpiresAt = 0;
  tokenFetchPromise = null;
  try {
    await redis.del(SHIPROCKET_TOKEN_REDIS_KEY);
  } catch (err) {
    logger.warn("[Shiprocket] Failed to delete token from Redis", { error: err });
  }
}

/**
 * Authenticates with Shiprocket API and returns a valid Bearer token.
 * Tokens are valid for 10 days; we cache in Redis and memory for 7 days.
 * Deduplicates in-flight requests using single-flight promises to prevent concurrent cold-start race conditions.
 */
export async function getShiprocketToken(): Promise<string> {
  const email = process.env.SHIPROCKET_EMAIL ?? env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD ?? env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    throw AppError.badRequest("Shiprocket credentials are not configured in environment variables");
  }

  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  // 1. Check Redis cache
  try {
    const redisToken = await redis.get(SHIPROCKET_TOKEN_REDIS_KEY);
    if (redisToken) {
      const ttl = await redis.ttl(SHIPROCKET_TOKEN_REDIS_KEY);
      if (ttl > 60) {
        cachedToken = redisToken;
        tokenExpiresAt = Date.now() + ttl * 1000;
        return cachedToken;
      }
    }
  } catch (redisErr) {
    // If Redis fails, fail-open to fetch from API
    logger.warn("[Shiprocket] Failed to read token from Redis, falling back to direct login", { error: redisErr });
  }

  // 2. Single-flight deduplication to avoid login storms during cold starts
  if (tokenFetchPromise) {
    return tokenFetchPromise;
  }

  tokenFetchPromise = (async () => {
    try {
      // Double check Redis in case a parallel request just cached it
      try {
        const redisToken = await redis.get(SHIPROCKET_TOKEN_REDIS_KEY);
        if (redisToken) {
          const ttl = await redis.ttl(SHIPROCKET_TOKEN_REDIS_KEY);
          if (ttl > 60) {
            cachedToken = redisToken;
            tokenExpiresAt = Date.now() + ttl * 1000;
            return cachedToken;
          }
        }
      } catch (err) {
        logger.debug("Failed to read Shiprocket token from Redis cache, falling back to direct login", { error: err });
      }

      const response = await shiprocketFetch(`${SHIPROCKET_API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw AppError.gatewayError("Shiprocket authentication failed with logistics partner");
      }

      const data = await response.json();
      if (!data.token) {
        throw AppError.gatewayError("Shiprocket authentication response did not include a valid token");
      }

      cachedToken = String(data.token);
      tokenExpiresAt = Date.now() + SHIPROCKET_TOKEN_TTL_SECONDS * 1000;

      // Cache token in Redis
      try {
        await redis.set(SHIPROCKET_TOKEN_REDIS_KEY, cachedToken, "EX", SHIPROCKET_TOKEN_TTL_SECONDS);
      } catch (setErr) {
        logger.warn("[Shiprocket] Failed to write token to Redis", { error: setErr });
      }

      return cachedToken;
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      throw AppError.gatewayError("Shiprocket authentication error with logistics provider");
    } finally {
      tokenFetchPromise = null;
    }
  })();

  return tokenFetchPromise;
}

/**
 * Executes an authenticated request to Shiprocket with Bearer token injection.
 * If 401 Unauthorized occurs, invalidates cache and retries once with a fresh token.
 */
export async function shiprocketAuthenticatedFetch(
  url: string,
  init?: RequestInit,
  timeoutMs = SHIPROCKET_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const token = await getShiprocketToken();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const res = await shiprocketFetch(url, { ...init, headers }, timeoutMs);

  if (res.status === 401) {
    logger.warn("[Shiprocket] 401 Unauthorized encountered. Invalidating token and retrying once.");
    await clearCachedShiprocketToken();
    const freshToken = await getShiprocketToken();
    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set("Authorization", `Bearer ${freshToken}`);
    return shiprocketFetch(url, { ...init, headers: retryHeaders }, timeoutMs);
  }

  return res;
}

const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const PHONE_CLEAN_REGEX = /\D/g;

/**
 * Validates shipping address requirements for logistics partners.
 * Ensures complete recipient name, street address, 10-digit mobile number,
 * and valid 6-digit Indian postal code.
 */
export function validateShippingAddress(address: ShiprocketAddress): void {
  if (!address || !address.line1?.trim()) {
    throw AppError.shippingAddressRequired("Creator shipping address line 1 is required before product dispatch.");
  }
  if (!address.fullName?.trim()) {
    throw AppError.shippingAddressRequired("Recipient full name is required for shipping.");
  }
  const cleanPin = address.pinCode ? address.pinCode.trim() : "";
  if (!cleanPin || !PINCODE_REGEX.test(cleanPin)) {
    throw AppError.shippingAddressRequired("A valid 6-digit delivery pincode is required for shipping.");
  }
  const digitsOnlyPhone = address.phone ? address.phone.replace(PHONE_CLEAN_REGEX, "") : "";
  if (!digitsOnlyPhone || digitsOnlyPhone.length < 10) {
    throw AppError.shippingAddressRequired("A valid 10-digit recipient phone number is required for delivery.");
  }
}

/**
 * Creates an adhoc order in Shiprocket.
 * Uses deterministic order_id (VM-DEAL-<dealId>) to guarantee idempotency across retries.
 * If order was already created, detects duplicate and reuses existing order/shipment.
 */
async function createAdhocOrder(
  token: string,
  params: CreateShiprocketOrderParams,
): Promise<{ orderId: string; shipmentId: string; status: string }> {
  const productPriceRupees = Math.max(1, Math.round((params.productValuePaise || 10000) / 100));
  // Deterministic order_id prevents duplicate orders on network or worker retries
  const orderRef = `VM-DEAL-${params.dealId}`;

  const body = {
    order_id: orderRef,
    order_date: new Date().toISOString().slice(0, 19).replace("T", " "),
    pickup_location: params.pickupLocation || env.SHIPROCKET_PICKUP_LOCATION || "Primary",
    billing_customer_name: params.shippingAddress.fullName,
    billing_last_name: "",
    billing_address: params.shippingAddress.line1,
    billing_address_2: params.shippingAddress.line2 || "",
    billing_city: params.shippingAddress.city,
    billing_pincode: params.shippingAddress.pinCode,
    billing_state: params.shippingAddress.state,
    billing_country: params.shippingAddress.country || "India",
    billing_email: params.creatorEmail || "creator@reachout.platform",
    billing_phone: params.shippingAddress.phone,
    shipping_is_billing: true,
    order_items: [
      {
        name: (params.productName || "Campaign Product Sample").slice(0, 100),
        sku: `SKU-${params.dealId.slice(-6).toUpperCase()}`,
        units: 1,
        selling_price: productPriceRupees,
        discount: 0,
        tax: 0,
        country_of_origin: "India",
      },
    ],
    payment_method: "Prepaid",
    sub_total: productPriceRupees,
    length: Math.max(1, params.length || 10),
    breadth: Math.max(1, params.breadth || 10),
    height: Math.max(1, params.height || 10),
    weight: Math.max(0.1, params.weight || 0.5),
  };

  const response = await shiprocketFetch(`${SHIPROCKET_API_BASE}/orders/create/adhoc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    // Idempotency: If Shiprocket returns 422 indicating duplicate order, inspect and reuse
    const isDuplicate =
      response.status === 422 &&
      /already (been )?taken|already exists|duplicate/i.test(errorText);

    if (isDuplicate) {
      try {
        const queryUrl = `${SHIPROCKET_API_BASE}/orders/show?order_id=${encodeURIComponent(orderRef)}`;
        const showRes = await shiprocketAuthenticatedFetch(queryUrl);
        if (showRes.ok) {
          const showData = await showRes.json();
          const existingOrder = showData.data || showData;
          const shipments = existingOrder.shipments || [];
          const existingShipmentId =
            shipments[0]?.id ||
            existingOrder.shipment_id ||
            existingOrder.id ||
            orderRef;

          return {
            orderId: orderRef,
            shipmentId: String(existingShipmentId),
            status: existingOrder.status || "EXISTING",
          };
        }
      } catch (lookupErr) {
        logger.warn("[Shiprocket] Failed to lookup existing duplicate order", { error: lookupErr });
      }
    }

    if (/not serviceable|serviceable/i.test(errorText)) {
      throw AppError.shippingNonServiceable();
    }
    if (/address|pincode|postcode|phone/i.test(errorText)) {
      throw AppError.shippingAddressRequired();
    }

    // Mask raw provider details/stack traces; never expose vendor JSON to users
    throw AppError.badRequest("Courier shipment could not be initiated with the logistics partner. Please verify shipping details.");
  }

  const data = await response.json();
  const orderId = String(data.order_id || data.id || orderRef);
  const shipmentId = String(data.shipment_id || orderId);

  return {
    orderId,
    shipmentId,
    status: data.status || "NEW",
  };
}

/**
 * Assigns courier & generates AWB in Shiprocket.
 */
async function assignAwb(
  token: string,
  shipmentId: string,
): Promise<{ awbCode: string; courierName: string; courierId?: number }> {
  const response = await shiprocketFetch(`${SHIPROCKET_API_BASE}/courier/assign/awb`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      shipment_id: shipmentId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    if (/not serviceable|serviceable/i.test(errorText)) {
      throw AppError.shippingNonServiceable();
    }
    throw AppError.badRequest("Failed to assign courier partner for this shipment. Please try again.");
  }

  const data = await response.json();
  const responseData = data.response?.data || data;
  const awbCode = responseData.awb_code || responseData.awb;
  const courierName = responseData.courier_name || "Shiprocket Partner Courier";

  if (!awbCode) {
    throw AppError.badRequest("Failed to generate AWB code from courier partner");
  }

  return {
    awbCode: String(awbCode),
    courierName: String(courierName),
    courierId: responseData.courier_id,
  };
}

/**
 * Generates shipping label PDF URL in Shiprocket.
 */
async function generateLabel(token: string, shipmentId: string): Promise<string | null> {
  try {
    const response = await shiprocketFetch(`${SHIPROCKET_API_BASE}/courier/generate/label`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        shipment_id: [shipmentId],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.label_url || data.label_created || null;
  } catch {
    return null;
  }
}

/**
 * Generates manifest PDF URL in Shiprocket.
 */
async function generateManifest(token: string, shipmentId: string): Promise<string | null> {
  try {
    const response = await shiprocketFetch(`${SHIPROCKET_API_BASE}/manifests/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        shipment_id: [shipmentId],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.manifest_url || null;
  } catch {
    return null;
  }
}

/**
 * Fetches the recommended courier rate for a shipment from Shiprocket.
 * Returns estimated courier charge in paise (rounded to nearest rupee * 100).
 * Throws AppError.shippingNonServiceable if destination pincode is not serviceable by any courier partner.
 */
export async function getShippingRate(
  token: string,
  params: {
    pickupPincode: string;
    deliveryPincode: string;
    weight: number; // kg
    cod: boolean;
  },
): Promise<number> {
  const url = new URL(`${SHIPROCKET_API_BASE}/courier/serviceability/`);
  url.searchParams.set("pickup_postcode", params.pickupPincode);
  url.searchParams.set("delivery_postcode", params.deliveryPincode);
  url.searchParams.set("weight", String(Math.max(0.1, params.weight)));
  url.searchParams.set("cod", params.cod ? "1" : "0");

  const response = await shiprocketAuthenticatedFetch(url.toString());

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    if (/serviceable/i.test(errorText)) {
      throw AppError.shippingNonServiceable();
    }
    throw AppError.shippingNonServiceable("Unable to confirm courier serviceability for this destination pincode.");
  }

  const data = await response.json();
  const couriers = data.data?.available_courier_companies;
  if (!Array.isArray(couriers) || couriers.length === 0) {
    throw AppError.shippingNonServiceable();
  }

  const recommended = couriers[0];
  const chargeRupees = Number(recommended.rate || recommended.freight_charge || 0);
  return Math.round(chargeRupees * 100); // convert to paise
}

/**
 * Unified method to create order, assign courier AWB, and generate label.
 * Also fetches actual courier rate and returns as courierChargePaise for wallet billing.
 * If credentials are not configured:
 *  - In PRODUCTION: Throws AppError to prevent silent mock shipping and false billing.
 *  - In DEV/TEST: Runs high-fidelity mock simulation with explicit warning logs.
 */
export async function createCompleteShipment(
  params: CreateShiprocketOrderParams,
): Promise<CompleteShipmentResult> {
  // Validate address and 6-digit Indian pincode upfront
  validateShippingAddress(params.shippingAddress);

  // Mock mode for local dev / testing
  if (!isShiprocketConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw AppError.internal(
        "Shiprocket shipping credentials (SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD) are not configured in production environment. Cannot dispatch real shipments.",
      );
    }

    console.warn(
      `[Shiprocket Warning] SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD are not configured. Generating simulated mock shipment for deal: ${params.dealId} (dev/test only). No physical shipment will be dispatched.`,
    );

    const mockOrderNum = Math.floor(100000 + Math.random() * 900000);
    const mockAwb = `SRDEL${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const nowIso = new Date().toISOString();
    const mockChargeRupees = 80 + Math.floor(Math.random() * 70); // ~₹80–₹150 simulated

    return {
      orderId: `SR-ORD-${params.dealId.slice(-6).toUpperCase()}-${mockOrderNum}`,
      shipmentId: `SR-SHIP-${mockOrderNum}`,
      awbCode: mockAwb,
      courierName: "Delhivery Surface",
      labelUrl: `https://apiv2.shiprocket.in/sample-label/${mockAwb}.pdf`,
      manifestUrl: `https://apiv2.shiprocket.in/sample-manifest/${mockAwb}.pdf`,
      initialStatus: "PICKUP_SCHEDULED",
      courierChargePaise: mockChargeRupees * 100,
      trackingHistory: [
        {
          date: nowIso,
          status: "PICKUP_SCHEDULED",
          activity: "Shipment manifested and pickup scheduled with courier partner",
          location: params.shippingAddress.city || "Origin Hub",
        },
      ],
    };
  }

  const token = await getShiprocketToken();

  // Validate courier serviceability and fetch rate before booking shipment
  const courierChargePaise = await getShippingRate(token, {
    pickupPincode: params.pickupPincode || env.SHIPROCKET_PICKUP_PINCODE || "110001",
    deliveryPincode: params.shippingAddress.pinCode,
    weight: Math.max(0.1, params.weight || 0.5),
    cod: false,
  });

  // Pre-flight check: ensure brand has enough wallet balance BEFORE booking in Shiprocket
  if (
    courierChargePaise > 0 &&
    typeof params.walletBalancePaise === "number" &&
    params.walletBalancePaise < courierChargePaise
  ) {
    const shortfallRupees = ((courierChargePaise - params.walletBalancePaise) / 100).toFixed(2);
    throw AppError.badRequest(
      `Insufficient wallet balance for shipping charge (₹${(courierChargePaise / 100).toFixed(2)}). Please deposit ₹${shortfallRupees} more before creating shipment.`,
    );
  }

  const order = await createAdhocOrder(token, params);
  const awb = await assignAwb(token, order.shipmentId);
  const labelUrl = await generateLabel(token, order.shipmentId);
  const manifestUrl = await generateManifest(token, order.shipmentId);

  const initialCheckpoint: TrackingCheckpoint = {
    date: new Date().toISOString(),
    status: "PICKUP_SCHEDULED",
    activity: `AWB generated with ${awb.courierName}. Pickup request generated.`,
    location: params.shippingAddress.city || "Origin Warehouse",
  };

  return {
    orderId: order.orderId,
    shipmentId: order.shipmentId,
    awbCode: awb.awbCode,
    courierName: awb.courierName,
    labelUrl: labelUrl || undefined,
    manifestUrl: manifestUrl || undefined,
    initialStatus: "PICKUP_SCHEDULED",
    courierChargePaise,
    trackingHistory: [initialCheckpoint],
  };
}

/**
 * Tracks shipment by AWB code via Shiprocket Tracking API.
 * If credentials are not configured or AWB is explicitly a mock ("MOCK*"), provides dynamic simulation.
 * Does NOT hijack real "SRDEL" AWBs when Shiprocket is configured.
 */
export async function trackShipment(
  awbCode: string,
  currentStoredStatus?: string,
): Promise<TrackingResult> {
  const cleanAwb = awbCode.trim();

  // Handle mock / simulated tracking:
  // - If Shiprocket credentials are NOT configured (dev/test environment), use simulation.
  // - Or if the AWB is explicitly marked as simulated (starts with "MOCK").
  // Note: We do NOT hijack AWBs starting with "SRDEL" when Shiprocket is configured,
  // because real Delhivery shipments via Shiprocket can carry an SRDEL prefix.
  const isExplicitMockAwb = cleanAwb.startsWith("MOCK");
  if (!isShiprocketConfigured() || isExplicitMockAwb) {
    const isDelivered = currentStoredStatus === "DELIVERED";
    const now = new Date();
    const mockDateStr = now.toISOString();

    const scans: TrackingCheckpoint[] = [
      {
        date: new Date(now.getTime() - 86400000 * 2).toISOString(),
        status: "PICKUP_SCHEDULED",
        activity: "Shipment manifested and pickup scheduled",
        location: "Origin Warehouse",
      },
      {
        date: new Date(now.getTime() - 86400000).toISOString(),
        status: "IN_TRANSIT",
        activity: "Package in transit to destination hub",
        location: "Central Sorting Facility",
      },
      {
        date: mockDateStr,
        status: isDelivered ? "DELIVERED" : "OUT_FOR_DELIVERY",
        activity: isDelivered
          ? "Package delivered to creator and signed"
          : "Out for delivery with delivery executive",
        location: "Destination Hub",
      },
    ];

    return {
      awbCode: cleanAwb,
      currentStatus: isDelivered ? "DELIVERED" : "OUT_FOR_DELIVERY",
      courierName: "Delhivery Surface (Simulated)",
      deliveredDate: isDelivered ? mockDateStr : null,
      scans,
    };
  }

  const token = await getShiprocketToken();
  const response = await shiprocketFetch(`${SHIPROCKET_API_BASE}/courier/track/awb/${encodeURIComponent(cleanAwb)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw AppError.badRequest(`Shiprocket tracking request failed with status ${response.status}`);
  }

  const data = await response.json();
  const trackingData = data.tracking_data || data;
  const currentStatus = String(trackingData.track_status || trackingData.shipment_track?.[0]?.current_status || "IN_TRANSIT").toUpperCase();
  const courierName = trackingData.shipment_track?.[0]?.courier_name || trackingData.courier_name || "Courier Partner";

  const rawScans = trackingData.shipment_track_activities || trackingData.scans || [];
  const scans: TrackingCheckpoint[] = Array.isArray(rawScans)
    ? rawScans.map((s: Record<string, unknown>) => ({
        date: String(s.date || s.time || new Date().toISOString()),
        status: String(s.status || s.activity || "IN_TRANSIT"),
        activity: String(s.activity || s["sr-status-label"] || s.status || ""),
        location: String(s.location || s.city || ""),
      }))
    : [];

  const deliveredDate = currentStatus.includes("DELIVERED") ? new Date().toISOString() : null;

  return {
    awbCode: cleanAwb,
    currentStatus,
    courierName,
    deliveredDate,
    scans,
  };
}

/**
 * Validates Shiprocket tracking webhook secret.
 * In production: If SHIPROCKET_WEBHOOK_SECRET is missing, all requests are strictly rejected (fail-closed).
 * In non-production: If missing, logs a warning and permits requests for development convenience.
 * Timing-safe comparison is used when validating headers.
 */
export function verifyWebhookSecret(authHeader: string | null): boolean {
  const secret = process.env.SHIPROCKET_WEBHOOK_SECRET ?? env.SHIPROCKET_WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[Shiprocket Webhook] REJECTED: SHIPROCKET_WEBHOOK_SECRET is not configured in production environment.",
      );
      return false;
    }
    console.warn(
      "[Shiprocket Webhook] Warning: SHIPROCKET_WEBHOOK_SECRET is not configured. Allowing in non-production mode.",
    );
    return true;
  }

  if (!authHeader) {
    return false;
  }

  const cleanHeader = authHeader.trim();
  const candidate = cleanHeader.startsWith("Bearer ")
    ? cleanHeader.slice(7).trim()
    : cleanHeader;

  const secretBuffer = Buffer.from(secret, "utf-8");
  const candidateBuffer = Buffer.from(candidate, "utf-8");

  if (secretBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(secretBuffer, candidateBuffer);
}
