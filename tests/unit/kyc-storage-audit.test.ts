import { describe, it, expect } from "vitest";
import { maskPII, maskPIIPrimitive } from "@/lib/logger-common";
import { scrubPiiString, scrubPiiObject } from "@/lib/sentry-sanitizer";

describe("KYC-AUDIT-01: PII Logging Sanitization & KYC Storage Security", () => {
  it("redacts Indian PAN, Aadhaar, and IFSC from log strings", () => {
    const raw = "Processing KYC for PAN ABCDE1234F and Aadhaar 2345 6789 0123 with IFSC HDFC0001234";
    const masked = maskPIIPrimitive(raw);

    expect(masked).not.toContain("ABCDE1234F");
    expect(masked).not.toContain("2345 6789 0123");
    expect(masked).not.toContain("HDFC0001234");
    expect(masked).toContain("[REDACTED_PAN]");
    expect(masked).toContain("[REDACTED_AADHAAR]");
    expect(masked).toContain("[REDACTED_IFSC]");
  });

  it("redacts sensitive object keys including ifsc, account, and pan in maskPII", () => {
    const data = {
      user: "Priya",
      ifsc: "SBIN0001234",
      accountNumber: "123456789012",
      pan: "ABCDE1234F",
      aadhaarNumber: "123456789012",
    };

    const masked = maskPII(data) as Record<string, unknown>;
    expect(masked.ifsc).toBe("[REDACTED]");
    expect(masked.accountNumber).toBe("[REDACTED]");
    expect(masked.pan).toBe("[REDACTED]");
    expect(masked.aadhaarNumber).toBe("[REDACTED]");
  });

  it("scrubs IFSC and financial PII in Sentry event sanitizer", () => {
    const errorMsg = "Error verifying IFSC HDFC0001234 with bank account 987654321012";
    const scrubbed = scrubPiiString(errorMsg);

    expect(scrubbed).not.toContain("HDFC0001234");
    expect(scrubbed).not.toContain("987654321012");
    expect(scrubbed).toContain("[REDACTED_IFSC]");
    expect(scrubbed).toContain("[REDACTED_ACCOUNT]");

    const eventObj = {
      extra: {
        ifscCode: "HDFC0001234",
        safeNote: "general failure",
      },
    };
    const scrubbedObj = scrubPiiObject(eventObj);
    expect(scrubbedObj.extra.ifscCode).toBe("[REDACTED]");
    expect(scrubbedObj.extra.safeNote).toBe("general failure");
  });
});
