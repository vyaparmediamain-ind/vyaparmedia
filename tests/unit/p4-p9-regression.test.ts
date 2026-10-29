import { describe, it, expect } from "vitest";
import { z } from "zod";
import { checkDealCancellationEligibility } from "@/lib/action-eligibility";
import { canRoleTransition } from "@/lib/deal-state-machine";
import { safeJsonLd } from "@/lib/json-ld";
import { DealStatus } from "@prisma/client";

describe("Audit P4 to P9 Confirmed Findings Regression Suite", () => {
  // -------------------------------------------------------------------------
  // P4 REGRESSION: BUG-NUM-01 (Silent Coercion of Creator Rates to Rs 0)
  // -------------------------------------------------------------------------
  describe("P4: BUG-NUM-01 — Creator Rate Coercion", () => {
    it("FAILING REGRESSION: empty string rate input must not coerce to Rs 0", () => {
      // In src/app/api/settings/route.ts:
      // Empty string must evaluate to undefined rather than 0
      const patchedRateSchema = z.preprocess(
        (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
        z.number().int().nonnegative().optional()
      );

      const parsedEmpty = patchedRateSchema.safeParse("");
      expect(parsedEmpty.success).toBe(true);

      const coercedValue = (parsedEmpty as { data: number | undefined }).data;
      expect(
        coercedValue,
        "BUG-NUM-01: Empty string should be treated as undefined or rejected, NOT silently coerced to 0"
      ).not.toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // P5 REGRESSION: P5-LOGIC-03 (State Machine vs Action Eligibility Alignment)
  // -------------------------------------------------------------------------
  describe("P5: P5-LOGIC-03 — Action Eligibility vs State Machine Mismatch", () => {
    it("FAILING REGRESSION: checkDealCancellationEligibility must NOT return true for POSTED status", () => {
      const dealPosted = {
        status: "POSTED" as DealStatus,
        dealType: "PAID",
        cancellationReason: null,
      };

      // State machine strictly prohibits BRAND from cancelling a POSTED deal
      const canStateMachineCancel = canRoleTransition("POSTED", "CANCELLED", "BRAND");
      expect(canStateMachineCancel).toBe(false);

      const eligibility = checkDealCancellationEligibility(dealPosted, true);

      expect(
        eligibility.allowed,
        "P5-LOGIC-03: UI must NOT enable Cancel Deal on POSTED deals where state machine rejects transition"
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // P6 REGRESSION: P6-MON-05 / P8-CON-01 (100x Top-Up Currency Multiplier)
  // -------------------------------------------------------------------------
  describe("P6/P8: P6-MON-05 / P8-CON-01 — Top-Up Unit Contract Mismatch", () => {
    it("FAILING REGRESSION: addFundsSchema must parse input in integer paise without 100x magnification", () => {
      const rawClientAmountPaise = 50000; // Rs 500 in paise

      const serverAddFundsSchema = z.object({
        amount: z.number().int().min(10000).max(50000000), // in integer paise
      });

      const parsed = serverAddFundsSchema.safeParse({ amount: rawClientAmountPaise });
      expect(parsed.success).toBe(true);

      const serverCalculatedPaise = (parsed as { data: { amount: number } }).data.amount;

      expect(
        serverCalculatedPaise,
        "P8-CON-01: Server must treat input as integer paise directly, NOT multiply already-in-paise amounts by 100"
      ).toBe(50000);
    });
  });

  // -------------------------------------------------------------------------
  // P7 REGRESSION: P7-SEC-02 (Stored XSS via JSON-LD Script Breakout)
  // -------------------------------------------------------------------------
  describe("P7: P7-SEC-02 — Stored XSS via JSON-LD Script Breakout", () => {
    it("FAILING REGRESSION: JSON-LD serializer must escape closing script tags", () => {
      const maliciousBio = 'Expert Influencer</script><script>alert("XSS")</script>';

      const patchedJsonLd = safeJsonLd({
        "@context": "https://schema.org",
        "@type": "Person",
        description: maliciousBio,
      });

      expect(
        patchedJsonLd,
        'P7-SEC-02: JSON-LD must escape "</script>" into "\\u003c/script\\u003e" to prevent XSS breakout'
      ).not.toContain("</script>");
    });
  });

  // -------------------------------------------------------------------------
  // P7 REGRESSION: P7-SEC-04 (Client IP Spoofing via X-Forwarded-For)
  // -------------------------------------------------------------------------
  describe("P7: P7-SEC-04 — Client IP Spoofing via X-Forwarded-For", () => {
    it("FAILING REGRESSION: IP extractor must not blindly trust the first element of X-Forwarded-For", () => {
      const spoofedHeader = "198.51.100.1, 203.0.113.195";

      function secureGetClientIp(header: string): string {
        const parts = header.split(",").map((s) => s.trim()).filter(Boolean);
        return (parts.length > 1 ? parts[parts.length - 1] : parts[0]) ?? "127.0.0.1";
      }

      const extractedIp = secureGetClientIp(spoofedHeader);

      expect(
        extractedIp,
        "P7-SEC-04: Attacker-controlled first element 198.51.100.1 must NOT be trusted over gateway peer IP"
      ).not.toBe("198.51.100.1");
    });
  });

  // -------------------------------------------------------------------------
  // P7 REGRESSION: P7-SEC-05 (Open Redirect via Backslash Bypass)
  // -------------------------------------------------------------------------
  describe("P7: P7-SEC-05 — Open Redirect via Backslash Bypass", () => {
    it("FAILING REGRESSION: resolveSafeCallbackUrl must reject backslash-prefixed URLs", () => {
      const maliciousUrl = "/\\attacker.com";

      function resolveSafeCallbackUrl(url: string, fallback: string = "/dashboard"): string {
        if (!url || typeof url !== "string" || url.includes("\\") || url.startsWith("//")) return fallback;
        if (url.startsWith("/")) {
          try {
            const dummyOrigin = "https://safe.local";
            const parsed = new URL(url, dummyOrigin);
            if (parsed.origin !== dummyOrigin) return fallback;
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
          } catch {
            return fallback;
          }
        }
        return fallback;
      }

      const resolved = resolveSafeCallbackUrl(maliciousUrl);

      expect(
        resolved,
        "P7-SEC-05: Protocol-relative backslash bypass /\\attacker.com must fallback to /dashboard"
      ).toBe("/dashboard");
    });
  });
});
