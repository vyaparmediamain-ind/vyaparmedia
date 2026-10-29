import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { getSecureClientIp } from "@/lib/ip";
import { safeJsonLd } from "@/lib/json-ld";
import { normalizeUnicodeDigits, detectContactLeak } from "@/lib/contact-leak-detector";
import { checkMessageForContacts } from "@/lib/contact-filter";

describe("Phase 7 Platform Security Remediation Suite (P7-SEC-01 through P7-SEC-13)", () => {
  it("P7-SEC-01: enables defense-in-depth Row Level Security across sensitive entities", () => {
    const migrationPath = path.join(
      process.cwd(),
      "prisma/migrations/20261011020000_enable_defense_in_depth_rls_all_tables/migration.sql"
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const content = fs.readFileSync(migrationPath, "utf-8");

    const requiredTables = [
      "Message",
      "Notification",
      "Deal",
      "VerificationDocument",
      "IndiaTaxCompliance",
      "BankAccount",
    ];

    for (const table of requiredTables) {
      expect(content).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    }

    expect(content).toContain('CREATE POLICY "message_select_participants_or_service" ON "Message"');
    expect(content).toContain('CREATE POLICY "notification_select_owner_or_service" ON "Notification"');
    expect(content).toContain('CREATE POLICY "deal_select_parties_or_service" ON "Deal"');
    expect(content).toContain('CREATE POLICY "bank_account_select_owner_or_service" ON "BankAccount"');
  });

  it("P7-SEC-02: protects JSON-LD structured data against script breakout XSS", () => {
    const creatorPath = path.join(process.cwd(), "src/app/creator/[username]/page.tsx");
    const brandPath = path.join(process.cwd(), "src/app/brand/[id]/page.tsx");
    const blogPath = path.join(process.cwd(), "src/app/blog/page.tsx");

    const creatorContent = fs.readFileSync(creatorPath, "utf-8");
    const brandContent = fs.readFileSync(brandPath, "utf-8");
    const blogContent = fs.readFileSync(blogPath, "utf-8");

    // All must use safeJsonLd helper that escapes '<'
    expect(creatorContent).toContain("safeJsonLd");
    expect(brandContent).toContain("safeJsonLd");
    expect(blogContent).toContain("safeJsonLd");

    // Functional verification of the safeJsonLd escaping logic
    const maliciousBio = '</script><script>alert("xss")</script>';
    const sanitized = safeJsonLd({ description: maliciousBio });
    expect(sanitized).not.toContain("</script>");
    expect(sanitized).toContain("\\u003c/script>");
  });

  it("P7-SEC-03: enforces Aadhaar Act 2016 statutory masking (stores only last 4 digits)", () => {
    const routePath = path.join(process.cwd(), "src/app/api/verification/route.ts");
    const content = fs.readFileSync(routePath, "utf-8");

    expect(content).toContain("P7-SEC-03 FIX: Aadhaar Act 2016 Section 29 compliance");
    expect(content).toContain("`XXXXXXXX${cleanAadhaar.slice(-4)}`");
    // Raw Aadhaar should never be passed to encryptSensitiveData
    expect(content).not.toContain("encryptSensitiveData(cleanAadhaar)");
  });

  it("P7-SEC-04: resolves client IP with hop precedence (x-vercel-forwarded-for over forged leftmost)", () => {
    // 1. x-vercel-forwarded-for takes precedence over spoofed x-forwarded-for
    const vercelReq = new Request("https://vyaparmedia.in/api/test", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.195",
        "x-forwarded-for": "198.51.100.1, 10.0.0.1",
      },
    });
    expect(getSecureClientIp(vercelReq)).toBe("203.0.113.195");

    // 2. x-forwarded-for uses rightmost hop to prevent client spoofing
    const spoofedReq = new Request("https://vyaparmedia.in/api/test", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 203.0.113.50",
      },
    });
    expect(getSecureClientIp(spoofedReq)).toBe("203.0.113.50");
  });

  it("P7-SEC-05: prevents open redirect via backslash bypass", () => {
    const loginPath = path.join(process.cwd(), "src/app/login/page.tsx");
    const content = fs.readFileSync(loginPath, "utf-8");

    expect(content).toContain("resolveSafeCallbackUrl");
    expect(content).toContain('rawCallbackUrl.includes("\\\\")');

    // Simulate safe callback URL resolution logic in login page
    function resolveSafeCallbackUrl(raw: string | null | undefined): string {
      if (!raw || typeof raw !== "string") return "/dashboard";
      if (raw.includes("\\") || raw.startsWith("//")) return "/dashboard";
      if (raw.startsWith("/")) {
        try {
          const origin = "https://vyaparmedia.in";
          const parsed = new URL(raw, origin);
          if (parsed.origin !== origin) return "/dashboard";
          return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        } catch {
          return "/dashboard";
        }
      }
      return "/dashboard";
    }

    expect(resolveSafeCallbackUrl("/\\attacker.com")).toBe("/dashboard");
    expect(resolveSafeCallbackUrl("\\\\attacker.com")).toBe("/dashboard");
    expect(resolveSafeCallbackUrl("//attacker.com")).toBe("/dashboard");
    expect(resolveSafeCallbackUrl("/campaigns/123")).toBe("/campaigns/123");
  });

  it("P7-SEC-06: binds ContentLength policy to S3 Presigned URLs", () => {
    const storagePath = path.join(process.cwd(), "src/lib/storage.ts");
    const routePath = path.join(process.cwd(), "src/app/api/upload/presign/route.ts");

    const storageContent = fs.readFileSync(storagePath, "utf-8");
    const routeContent = fs.readFileSync(routePath, "utf-8");

    expect(storageContent).toContain("ContentLength: fileSize");
    expect(storageContent).toContain("createUploadPresignedUrl");
    expect(routeContent).toContain("createUploadPresignedUrl(fileName, folder, fileType, 900, fileSize, session.user.id)");
  });

  it("P7-SEC-07: restricts middleware auth route matcher bypass to public NextAuth endpoints only", () => {
    const middlewarePath = path.join(process.cwd(), "src/middleware.ts");
    const content = fs.readFileSync(middlewarePath, "utf-8");

    expect(content).toContain("api/auth/(?:session|providers|csrf|callback)");
    expect(content).not.toContain('"/(api/auth)(.*)"');
  });

  it("P7-SEC-08: guards dev OTP response echo behind development environment flag", () => {
    const otpRoutePath = path.join(process.cwd(), "src/app/api/auth/verify-otp/route.ts");
    const content = fs.readFileSync(otpRoutePath, "utf-8");

    expect(content).toContain('process.env.NODE_ENV === "development" && process.env.ENABLE_DEV_OTP_ECHO === "true"');
  });

  it("P7-SEC-09: isolates 2FA disable verification purpose to 2fa_disable", () => {
    const disable2faPath = path.join(process.cwd(), "src/app/api/user/2fa/disable/route.ts");
    const content = fs.readFileSync(disable2faPath, "utf-8");

    expect(content).toContain('purpose: "2fa_disable"');
    expect(content).not.toContain('purpose: "phone_verification"');
  });

  it("P7-SEC-10: detects disintermediation attempts with Devanagari digits and Hindi/Hinglish number words", () => {
    // 1. Devanagari digit normalization
    const devanagariPhone = "९८७६५४३२१०";
    const normalized = normalizeUnicodeDigits(devanagariPhone);
    expect(normalized).toBe("9876543210");

    // 2. Leak detection with Devanagari numbers
    const leakResult = detectContactLeak("Mera number hai ९८७६५४३२१० call karo");
    expect(leakResult.hasLeak).toBe(true);
    expect(leakResult.detectedTypes).toContain("Phone Number");

    // 3. Leak detection with Hindi number words
    const hindiWordLeak = detectContactLeak("call me on nau aath saat chhe paanch chaar teen do ek shunya");
    expect(hindiWordLeak.hasLeak).toBe(true);
    expect(hindiWordLeak.detectedTypes).toContain("Phone Number");

    // 4. Contact filter leak check
    const filterResult = checkMessageForContacts("contact me: ९८७६५४३२१०");
    expect(filterResult.hasContactInfo).toBe(true);
  });

  it("P7-SEC-11: fixes crypto randomInt 6-digit upper bound so 999999 is reachable", () => {
    const smsPath = path.join(process.cwd(), "src/lib/sms.ts");
    const utilsPath = path.join(process.cwd(), "src/lib/utils.ts");
    const emailOtpPath = path.join(process.cwd(), "src/app/api/auth/verify-email-otp/route.ts");

    const smsContent = fs.readFileSync(smsPath, "utf-8");
    const utilsContent = fs.readFileSync(utilsPath, "utf-8");
    const emailOtpContent = fs.readFileSync(emailOtpPath, "utf-8");

    expect(smsContent).toContain("randomInt(100000, 1000000)");
    expect(utilsContent).toContain("randomInt(100000, 1000000)");
    expect(emailOtpContent).toContain("randomInt(100000, 1000000)");
  });

  it("P7-SEC-12: prevents user enumeration by ensuring uniform password reset responses", () => {
    const resetPath = path.join(process.cwd(), "src/app/api/auth/reset-password/route.ts");
    const content = fs.readFileSync(resetPath, "utf-8");

    // Response must not leak whether the email was sent or account exists
    expect(content).not.toContain("response.emailSent");
    expect(content).toContain("If an account exists, a reset link has been sent.");
  });

  it("P7-SEC-13: restricts QStash mock signature bypass strictly to test environments", () => {
    const qstashPath = path.join(process.cwd(), "src/lib/qstash-guard.ts");
    const content = fs.readFileSync(qstashPath, "utf-8");

    expect(content).toContain('process.env.NODE_ENV === "test"');
    // Must not bypass validation in production even if SKIP_ENV_VALIDATION is passed
    expect(content).not.toContain('process.env.SKIP_ENV_VALIDATION === "true"');
  });
});
