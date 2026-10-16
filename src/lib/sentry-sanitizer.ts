/**
 * Comprehensive Financial PII & Sensitive Identifier Sanitizer for Sentry Events
 * Enforces compliance with India's Digital Personal Data Protection Act (DPDPA), 2023.
 * Scrubs Indian PAN, Aadhaar, bank accounts, IFSC, mobile numbers, emails, JWTs,
 * Bearer tokens, URL access_token queries, and Razorpay transaction/account IDs.
 */

const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi;
const IFSC_REGEX = /\b[A-Z]{4}0[A-Z0-9]{6}\b/gi;
const INDIAN_PHONE_REGEX = /(?:\+91[\s-]?|\b)[6-9]\d{9}\b/g;
const AADHAAR_REGEX = /\b\d{4}[\s-]\d{4}[\s-]\d{4}\b/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const UPI_ID_REGEX = /\b[a-zA-Z0-9.\-_]{2,64}@(?!gmail|yahoo|outlook|hotmail|icloud|proton|example)[a-zA-Z]{3,30}\b/g;
const BANK_ACCOUNT_REGEX = /\b\d{9,18}\b/g;
const JWT_REGEX = /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g;
const BEARER_REGEX = /\bBearer\s+[^\s,;]+/gi;
const ACCESS_TOKEN_QUERY_REGEX = /(?:access_token|refresh_token|id_token|auth_token)=[^&\s]+/gi;
const RAZORPAY_KEY_REGEX = /\brzp_(?:live|test)_[a-zA-Z0-9]+\b/g;
const RAZORPAY_PAYMENT_REGEX = /\bpay_[a-zA-Z0-9]{14,}\b/g;
const RAZORPAY_ORDER_REGEX = /\border_[a-zA-Z0-9]{14,}\b/g;
const RAZORPAY_PAYOUT_REGEX = /\bpout_[a-zA-Z0-9]{14,}\b/g;

export function scrubPiiString(str: string): string {
  if (!str || typeof str !== "string") return str;
  return str
    .replace(RAZORPAY_KEY_REGEX, "[REDACTED_RAZORPAY_KEY]")
    .replace(RAZORPAY_PAYMENT_REGEX, "[REDACTED_PAYMENT_ID]")
    .replace(RAZORPAY_ORDER_REGEX, "[REDACTED_ORDER_ID]")
    .replace(RAZORPAY_PAYOUT_REGEX, "[REDACTED_PAYOUT_ID]")
    .replace(JWT_REGEX, "[REDACTED_JWT]")
    .replace(BEARER_REGEX, "Bearer [REDACTED_TOKEN]")
    .replace(ACCESS_TOKEN_QUERY_REGEX, "access_token=[REDACTED]")
    .replace(PAN_REGEX, "[REDACTED_PAN]")
    .replace(IFSC_REGEX, "[REDACTED_IFSC]")
    .replace(AADHAAR_REGEX, "[REDACTED_AADHAAR]")
    .replace(EMAIL_REGEX, "[REDACTED_EMAIL]")
    .replace(UPI_ID_REGEX, "[REDACTED_UPI]")
    .replace(INDIAN_PHONE_REGEX, "[REDACTED_PHONE]")
    .replace(BANK_ACCOUNT_REGEX, "[REDACTED_ACCOUNT]");
}

export function scrubPiiObject<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (typeof val === "string") {
    return scrubPiiString(val) as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map((item) => scrubPiiObject(item)) as unknown as T;
  }
  if (typeof val === "object") {
    const record = val as Record<string, unknown>;

    // If this object represents a Sentry Event, delegate to full event sanitizer
    if ("user" in record || "request" in record || "breadcrumbs" in record || "exception" in record) {
      return scrubSentryEvent(record) as T;
    }

    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (
        /pan|aadhaar|account|phone|mobile|bank|upi|secret|password|token|ifsc|email|authorization|cookie|session|jwt|key|credential/i.test(key) &&
        typeof value === "string"
      ) {
        copy[key] = "[REDACTED]";
      } else {
        copy[key] = scrubPiiObject(value);
      }
    }
    return copy as T;
  }
  return val;
}

export interface SentryEventLike {
  user?: { id?: string; email?: string; username?: string; ip_address?: string; [key: string]: unknown };
  request?: {
    url?: string;
    query_string?: string;
    headers?: Record<string, string>;
    data?: unknown;
    [key: string]: unknown;
  };
  breadcrumbs?: Array<{
    category?: string;
    message?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  message?: string;
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Full Sentry Event beforeSend Sanitizer
 * - Ensures user context contains ONLY user.id (strips email, username, ip_address)
 * - Sanitizes request headers (authorization, cookies, tokens) and query strings
 * - Scrubs breadcrumb messages and URLs
 * - Recursively redacts extra data and error messages
 */
export function scrubSentryEvent<T extends SentryEventLike>(event: T): T {
  if (!event || typeof event !== "object") return event;

  const copy = { ...event };

  // 1. User Context: retain only user.id for privacy
  if (copy.user && typeof copy.user === "object") {
    copy.user = copy.user.id !== undefined ? { id: copy.user.id } : {};
  }

  // 2. Request Context
  if (copy.request && typeof copy.request === "object") {
    const req = { ...copy.request };
    if (req.url) {
      req.url = scrubPiiString(req.url);
    }
    if (req.query_string) {
      req.query_string = scrubPiiString(req.query_string);
    }
    if (req.headers && typeof req.headers === "object") {
      const sanitizedHeaders: Record<string, string> = {};
      for (const [headerKey, headerVal] of Object.entries(req.headers)) {
        if (/authorization|cookie|session|token|key|secret|auth/i.test(headerKey)) {
          sanitizedHeaders[headerKey] = "[REDACTED]";
        } else {
          sanitizedHeaders[headerKey] = scrubPiiString(headerVal);
        }
      }
      req.headers = sanitizedHeaders;
    }
    if (req.data) {
      req.data = scrubPiiObject(req.data);
    }
    copy.request = req;
  }

  // 3. Breadcrumbs
  if (Array.isArray(copy.breadcrumbs)) {
    copy.breadcrumbs = copy.breadcrumbs.map((b) => {
      if (!b || typeof b !== "object") return b;
      const bCopy = { ...b };
      if (bCopy.message) {
        bCopy.message = scrubPiiString(bCopy.message);
      }
      if (bCopy.data && typeof bCopy.data === "object") {
        const dataCopy: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(bCopy.data)) {
          if (typeof v === "string") {
            dataCopy[k] = scrubPiiString(v);
          } else {
            dataCopy[k] = scrubPiiObject(v);
          }
        }
        bCopy.data = dataCopy;
      }
      return bCopy;
    });
  }

  // 4. Message & Extras
  if (copy.message) {
    copy.message = scrubPiiString(copy.message);
  }
  if (copy.extra && typeof copy.extra === "object") {
    copy.extra = scrubPiiObject(copy.extra);
  }

  return copy;
}
