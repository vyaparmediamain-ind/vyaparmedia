import { describe, it, expect } from "vitest";
import {
  getUserFriendlyErrorMessage,
  formatUserError,
} from "@/lib/user-messages";
import { AppError, ApiErrorCode } from "@/lib/errors";
import { ApiClientError } from "@/lib/api-client/errors";
import {
  MIN_WITHDRAWAL_AMOUNT_RUPEES,
  MAX_WITHDRAWAL_AMOUNT_RUPEES,
} from "@/constants/wallet";
import fs from "node:fs";
import path from "node:path";

describe("Audit P9 — User Messages & Error Sanitization Regressions", () => {
  describe("P0-MSG-01: Technical Leak Prevention & Human Intelligibility", () => {
    it("preserves standard user-facing English sentences containing 'select'", () => {
      const res = getUserFriendlyErrorMessage("Please select an option from the list.");
      expect(res.message).toBe("Please select an option from the list.");
      expect(res.actionType).toBe("RETRY");
    });

    it("preserves user-facing English sentences containing 'update' and 'set'", () => {
      const res = getUserFriendlyErrorMessage("Please update profile and set password.");
      expect(res.message).toBe("Please update profile and set password.");
      expect(res.actionType).toBe("RETRY");
    });

    it("scrubs raw SQL queries into polite generic error", () => {
      const res = getUserFriendlyErrorMessage('SELECT id, email FROM "users" WHERE id = 1');
      expect(res.message).not.toContain("SELECT");
      expect(res.message).not.toContain("users");
      expect(res.message).toBe("Something went wrong while processing your request. Please try again shortly.");
    });

    it("scrubs raw SQL UPDATE queries with assignment", () => {
      const res = getUserFriendlyErrorMessage("UPDATE users SET password = 'abc' WHERE id = 1");
      expect(res.message).not.toContain("UPDATE");
      expect(res.message).not.toContain("password");
      expect(res.message).toBe("Something went wrong while processing your request. Please try again shortly.");
    });
  });

  describe("P0-MSG-02: Payment Gateway Ambiguity Handling", () => {
    it("maps GATEWAY_AMBIGUOUS code cleanly to timeout advice with Check History action", () => {
      const clientErr = new ApiClientError("GATEWAY_AMBIGUOUS", 502, "GATEWAY_AMBIGUOUS");
      const res = getUserFriendlyErrorMessage(clientErr);
      expect(res.message).toBe(
        "The payment gateway is taking longer than expected to confirm. Please check your transaction history before initiating a new request."
      );
      expect(res.actionText).toBe("Check History");
      expect(res.actionType).toBe("REFRESH");
    });

    it("maps raw string 'GATEWAY_AMBIGUOUS' cleanly to timeout advice", () => {
      const res = getUserFriendlyErrorMessage("GATEWAY_AMBIGUOUS");
      expect(res.message).toContain("taking longer than expected to confirm");
      expect(res.actionText).toBe("Check History");
    });

    it("verifies payment.service.ts throws AppError.gatewayAmbiguous", () => {
      const paymentServicePath = path.resolve(process.cwd(), "src/services/payment.service.ts");
      const content = fs.readFileSync(paymentServicePath, "utf-8");
      expect(content).toContain("throw AppError.gatewayAmbiguous(");
      expect(content).not.toContain('throw AppError.badRequest(`GATEWAY_AMBIGUOUS`);');
    });
  });

  describe("P0-MSG-03: Verification Route Error Scrubbing", () => {
    it("scrubs internal database hostnames from unhandled exceptions", () => {
      const rawError = "PrismaClientInitializationError: Can't reach database server at db.supabase.co:5432";
      const sanitized = formatUserError(rawError);
      expect(sanitized).not.toContain("supabase");
      expect(sanitized).not.toContain("5432");
      expect(sanitized).toBe("Something went wrong while processing your request. Please try again shortly.");
    });

    it("verifies verification/route.ts catch block delegates to ApiResponse.error", () => {
      const routePath = path.resolve(process.cwd(), "src/app/api/verification/route.ts");
      const content = fs.readFileSync(routePath, "utf-8");
      expect(content).toContain("return ApiResponse.error(message, 500);");
      expect(content).not.toContain("return NextResponse.json(\n      { error: message },\n      { status: 500 },\n    );");
    });
  });

  describe("P1-MSG-04: Credential vs Session Expiry Disambiguation", () => {
    it("maps raw INVALID_CREDENTIALS code to polite credential message with RETRY action", () => {
      const err = new ApiClientError("INVALID_CREDENTIALS", 401, "INVALID_CREDENTIALS");
      const res = getUserFriendlyErrorMessage(err);
      expect(res.message).toBe("Incorrect email or password. Please verify your credentials and try again.");
      expect(res.actionText).toBe("Try Again");
      expect(res.actionType).toBe("RETRY");
    });

    it("preserves specific credential rejection message without claiming session expired", () => {
      const err = new ApiClientError("Invalid email or password", 401, "INVALID_CREDENTIALS");
      const res = getUserFriendlyErrorMessage(err);
      expect(res.message).toBe("Invalid email or password");
      expect(res.actionText).toBe("Try Again");
      expect(res.actionType).toBe("RETRY");
    });

    it("maps SESSION_EXPIRED or 401 without credential rejection to sign in with LOGIN action", () => {
      const err = new ApiClientError("jwt expired", 401, "SESSION_EXPIRED");
      const res = getUserFriendlyErrorMessage(err);
      expect(res.message).toBe("Your session has expired. Please sign in again to continue.");
      expect(res.actionText).toBe("Sign In");
      expect(res.actionType).toBe("LOGIN");
    });

    it("maps INVALID_OTP to OTP expired message with Resend Code action", () => {
      const err = new ApiClientError("The OTP is invalid", 400, "INVALID_OTP");
      const res = getUserFriendlyErrorMessage(err);
      expect(res.message).toContain("OTP entered is incorrect or has expired");
      expect(res.actionText).toBe("Resend Code");
      expect(res.actionType).toBe("RETRY");
    });
  });

  describe("P1-MSG-06 & P1-MSG-07: Keyword Isolation", () => {
    it("does not map LocalStorage quota errors to file upload errors", () => {
      const res = getUserFriendlyErrorMessage("LocalStorage quota exceeded");
      expect(res.message).not.toContain("File upload failed");
    });

    it("does not map form validation on beneficiary name to penny-drop failure", () => {
      const res = getUserFriendlyErrorMessage("Beneficiary name must be at least 3 characters");
      expect(res.message).not.toContain("couldn't verify this bank account");
      expect(res.message).toBe("Beneficiary name must be at least 3 characters");
    });

    it("maps BANK_LIMIT_REACHED to maximum linked accounts message", () => {
      const err = new ApiClientError("bank limit reached", 400, "BANK_LIMIT_REACHED");
      const res = getUserFriendlyErrorMessage(err);
      expect(res.message).toContain("maximum limit of 5 linked bank accounts");
      expect(res.actionText).toBe("Manage Accounts");
      expect(res.actionType).toBe("REFRESH");
    });

    it("maps BANK_LOCKED_PENDING_PAYOUT to active withdrawal processing message", () => {
      const err = new ApiClientError("payout in flight", 400, "BANK_LOCKED_PENDING_PAYOUT");
      const res = getUserFriendlyErrorMessage(err);
      expect(res.message).toContain("cannot be removed while a withdrawal is currently processing");
      expect(res.actionText).toBe("View Payouts");
      expect(res.actionType).toBe("REFRESH");
    });
  });

  describe("P1-MSG-08: Rate Limit Redis Security-Critical Outage", () => {
    it("provides AppError.serviceUnavailable with status 503 and SERVICE_UNAVAILABLE code", () => {
      const err = AppError.serviceUnavailable();
      expect(err.statusCode).toBe(503);
      expect(err.errorCode).toBe(ApiErrorCode.SERVICE_UNAVAILABLE);
      expect(err.message).toContain("temporarily unavailable");
    });

    it("verifies rate-limit.ts throws AppError.serviceUnavailable on securityCritical failure", () => {
      const rateLimitPath = path.resolve(process.cwd(), "src/lib/rate-limit.ts");
      const content = fs.readFileSync(rateLimitPath, "utf-8");
      expect(content).toContain("throw AppError.serviceUnavailable(");
    });
  });

  describe("P2-MSG-11: Root Error Boundary Politeness", () => {
    it("verifies error.tsx displays polite copy and not robotic Application Exception", () => {
      const errorPath = path.resolve(process.cwd(), "src/app/error.tsx");
      const content = fs.readFileSync(errorPath, "utf-8");
      expect(content).toContain("Something went wrong on this page");
      expect(content).not.toContain("Application Exception");
    });

    it("verifies global-error.tsx displays polite copy and not System Malfunction", () => {
      const globalErrorPath = path.resolve(process.cwd(), "src/app/global-error.tsx");
      const content = fs.readFileSync(globalErrorPath, "utf-8");
      expect(content).toContain("Something went wrong");
      expect(content).not.toContain("System Malfunction");
      expect(content).not.toContain("Digest: {error.digest}");
    });
  });

  describe("P2-MSG-12: ApiResponse Helper Sanitization", () => {
    it("verifies api-wrapper.ts sanitizes all ApiResponse error responses", () => {
      const apiWrapperPath = path.resolve(process.cwd(), "src/lib/api-wrapper.ts");
      const content = fs.readFileSync(apiWrapperPath, "utf-8");
      expect(content).toContain("forbidden: (message = \"Forbidden\") => {");
      expect(content).toContain("formatUserError(message, \"You do not have permission to perform this action.\")");
      expect(content).toContain("unauthorized: (message = \"Unauthorized\") => {");
      expect(content).toContain("formatUserError(message, \"Authentication required. Please sign in.\")");
      expect(content).toContain("notFound: (message = \"Resource not found\") => {");
      expect(content).toContain("formatUserError(message, \"The requested resource was not found.\")");
      expect(content).toContain("conflict: (message = \"Resource already exists\") => {");
      expect(content).toContain("formatUserError(message, \"Resource already exists.\")");
      expect(content).toContain("tooManyRequests: (message = \"Too Many Requests\", retryAfter?: number) => {");
      expect(content).toContain("formatUserError(message, \"Too many requests. Please wait a moment before trying again.\")");
    });
  });

  describe("P2-MSG-14: Dynamic Withdrawal Limit Interpolation", () => {
    it("dynamically interpolates configured withdrawal minimum and maximum rupees", () => {
      const res = getUserFriendlyErrorMessage("minimum withdrawal amount violated");
      const expectedMin = MIN_WITHDRAWAL_AMOUNT_RUPEES.toLocaleString("en-IN");
      const expectedMax = MAX_WITHDRAWAL_AMOUNT_RUPEES.toLocaleString("en-IN");
      expect(res.message).toBe(`Withdrawal must be between ₹${expectedMin} and ₹${expectedMax} per transaction.`);
      expect(res.actionText).toBe("Adjust Amount");
      expect(res.actionType).toBe("RETRY");
    });
  });
});
