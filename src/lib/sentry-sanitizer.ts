/**
 * Indian Financial PII & Sensitive Identifier Sanitizer for Sentry Events
 * Enforces compliance with India's Digital Personal Data Protection Act (DPDPA), 2023.
 * Scrubs Indian PAN numbers, Aadhaar cards, 10-digit mobile numbers, bank accounts, and UPI IDs.
 */

const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi;
const IFSC_REGEX = /\b[A-Z]{4}0[A-Z0-9]{6}\b/gi;
const INDIAN_PHONE_REGEX = /(?:\b\+?91[\s-]?)?\b[6-9]\d{9}\b/g;
const AADHAAR_REGEX = /\b\d{4}[\s-]\d{4}[\s-]\d{4}\b/g;
const UPI_ID_REGEX = /\b[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}\b/g;
const BANK_ACCOUNT_REGEX = /\b\d{9,18}\b/g;

export function scrubPiiString(str: string): string {
  if (!str || typeof str !== "string") return str;
  return str
    .replace(PAN_REGEX, "[REDACTED_PAN]")
    .replace(IFSC_REGEX, "[REDACTED_IFSC]")
    .replace(INDIAN_PHONE_REGEX, "[REDACTED_PHONE]")
    .replace(AADHAAR_REGEX, "[REDACTED_AADHAAR]")
    .replace(UPI_ID_REGEX, "[REDACTED_UPI]")
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
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(val)) {
      if (
        /pan|aadhaar|account|phone|mobile|bank|upi|secret|password|token|ifsc/i.test(key) &&
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
