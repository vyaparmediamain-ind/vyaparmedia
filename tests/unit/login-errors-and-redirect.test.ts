import { describe, it, expect } from "vitest";
import { getSessionMessage, resolveSafeCallbackUrl } from "@/app/login/page";

describe("O3-T6 / O3-T8: Login Error Messaging & Safe Callback URL Guard", () => {
  describe("O3-T6: NextAuth error code translation to user-friendly messages", () => {
    const errorCodes = [
      "OAuthAccountNotLinked",
      "OAuthAccountNotRegistered",
      "AccessDenied",
      "Configuration",
      "EmailNotVerified",
      "Verification",
      "CredentialsSignin",
    ] as const;

    it("maps all required NextAuth error codes to polite Hinglish-neutral messages without leaking raw codes", () => {
      for (const code of errorCodes) {
        const msg = getSessionMessage(false, null, code);
        expect(msg).toBeTruthy();
        expect(msg).not.toContain(code);
        expect(msg).not.toContain("{");
        expect(msg).not.toContain("ERR_");
      }
    });

    it("specifically returns appropriate guidance for OAuthAccountNotLinked and EmailNotVerified", () => {
      const notLinkedMsg = getSessionMessage(false, null, "OAuthAccountNotLinked");
      expect(notLinkedMsg).toMatch(/associated with another login method/i);

      const emailNotVerifiedMsg = getSessionMessage(false, null, "EmailNotVerified");
      expect(emailNotVerifiedMsg).toMatch(/email.*not been verified/i);

      const notRegisteredMsg = getSessionMessage(false, null, "OAuthAccountNotRegistered");
      expect(notRegisteredMsg).toMatch(/create an account/i);
    });

    it("falls back to generic clean message for unknown error codes without exposing raw error text", () => {
      const fallbackMsg = getSessionMessage(false, null, "SomeInternalUnknownDatabaseDumpErrorCode");
      expect(fallbackMsg).toBe("Unable to sign in. Please check your credentials or try again.");
      expect(fallbackMsg).not.toContain("SomeInternalUnknownDatabaseDumpErrorCode");
    });
  });

  describe("O3-T8: Open-redirect prevention in resolveSafeCallbackUrl", () => {
    it("permits safe relative callback URLs", () => {
      expect(resolveSafeCallbackUrl("/dashboard")).toBe("/dashboard");
      expect(resolveSafeCallbackUrl("/dashboard/deals/deal_123?tab=messages")).toBe("/dashboard/deals/deal_123?tab=messages");
      expect(resolveSafeCallbackUrl("/creator/profile")).toBe("/creator/profile");
    });

    it("rejects literal backslash and protocol-relative slash URLs", () => {
      expect(resolveSafeCallbackUrl("\\evil.com")).toBe("/dashboard");
      expect(resolveSafeCallbackUrl("/\\evil.com")).toBe("/dashboard");
      expect(resolveSafeCallbackUrl("//evil.com")).toBe("/dashboard");
      expect(resolveSafeCallbackUrl("//evil.com/dashboard")).toBe("/dashboard");
    });

    it("rejects URL-encoded backslash (%5c) and double slashes (%2f%2f)", () => {
      expect(resolveSafeCallbackUrl("%5c%5cevil.com")).toBe("/dashboard");
      expect(resolveSafeCallbackUrl("/%5cevil.com")).toBe("/dashboard");
      expect(resolveSafeCallbackUrl("%2f%2fevil.com")).toBe("/dashboard");
      expect(resolveSafeCallbackUrl("/%2f%2fevil.com")).toBe("/dashboard");
    });

    it("rejects double-encoded variants (%255c, %252f%252f)", () => {
      expect(resolveSafeCallbackUrl("%255c%255cevil.com")).toBe("/dashboard");
      expect(resolveSafeCallbackUrl("%252f%252fevil.com")).toBe("/dashboard");
    });

    it("rejects external absolute origins", () => {
      expect(resolveSafeCallbackUrl("https://evil.com/phishing")).toBe("/dashboard");
      expect(resolveSafeCallbackUrl("http://evil.com")).toBe("/dashboard");
      expect(resolveSafeCallbackUrl("javascript:alert(1)")).toBe("/dashboard");
    });

    it("falls back to /dashboard on invalid or null/empty inputs", () => {
      expect(resolveSafeCallbackUrl(null)).toBe("/dashboard");
      expect(resolveSafeCallbackUrl(undefined)).toBe("/dashboard");
      expect(resolveSafeCallbackUrl("")).toBe("/dashboard");
    });
  });
});
