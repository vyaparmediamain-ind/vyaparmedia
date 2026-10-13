import { describe, it, expect } from "vitest";
import {
  getUserFriendlyErrorMessage,
  formatUserError,
  USER_SUCCESS_MESSAGES,
} from "@/lib/user-messages";
import { ApiClientError } from "@/lib/api-client/errors";

describe("User-Facing Message Architecture & Error Sanitization", () => {
  describe("Technical Leak Prevention & Scrubbing", () => {
    it("scrubs raw Prisma unique constraint errors (P2002)", () => {
      const error = new Error("Unique constraint failed on the fields: (`email`) (PrismaClientKnownRequestError P2002)");
      const res = getUserFriendlyErrorMessage(error);
      expect(res.message).not.toContain("P2002");
      expect(res.message).not.toContain("Prisma");
      expect(res.message).not.toContain("constraint");
      expect(res.message).toContain("already exists");
    });

    it("scrubs raw SQL queries and column/table names", () => {
      const error = new Error('SELECT * FROM "wallets" WHERE "balance_paise" < 0 failed with column not found');
      const res = getUserFriendlyErrorMessage(error);
      expect(res.message).not.toContain("SELECT");
      expect(res.message).not.toContain("wallets");
      expect(res.message).not.toContain("balance_paise");
      expect(res.message).toBe("Something went wrong while processing your request. Please try again shortly.");
      expect(res.actionType).toBe("RETRY");
    });

    it("scrubs stack traces and node_modules references", () => {
      const error = new Error(
        "Error: write ECONNRESET\n    at TCP.onStreamRead (node:internal/stream_base_commons:217:20)\n    at Module._compile (node_modules/next/dist/server/require.js:120:10)"
      );
      const res = getUserFriendlyErrorMessage(error);
      expect(res.message).not.toContain("ECONNRESET");
      expect(res.message).not.toContain("node_modules");
      expect(res.message).not.toContain("TCP.onStreamRead");
      expect(res.actionType).toBeDefined();
    });

    it("scrubs internal Postgres database identifiers", () => {
      const error = new Error("PostgreSQL 57P01: terminating connection due to administrator command");
      const res = getUserFriendlyErrorMessage(error);
      expect(res.message).not.toContain("PostgreSQL");
      expect(res.message).not.toContain("57P01");
      expect(res.message).toBe("Something went wrong while processing your request. Please try again shortly.");
    });
  });

  describe("HTTP Status & Exception Mapping", () => {
    it("maps 0 / failed to fetch to connection error with RETRY action", () => {
      const clientErr = new ApiClientError("Failed to fetch", 0, "NETWORK_ERROR");
      const res = getUserFriendlyErrorMessage(clientErr);
      expect(res.message).toContain("Unable to connect right now");
      expect(res.actionType).toBe("RETRY");
      expect(res.actionText).toBe("Try Again");
    });

    it("maps 401 Unauthorized to session expiration with LOGIN action", () => {
      const clientErr = new ApiClientError("JWT expired", 401, "UNAUTHORIZED");
      const res = getUserFriendlyErrorMessage(clientErr);
      expect(res.message).toContain("Your session has expired");
      expect(res.actionType).toBe("LOGIN");
      expect(res.actionText).toBe("Sign In");
    });

    it("maps 403 Forbidden to permission error with SUPPORT action", () => {
      const clientErr = new ApiClientError("Forbidden: insufficient role", 403, "FORBIDDEN");
      const res = getUserFriendlyErrorMessage(clientErr);
      expect(res.message).toContain("permission to perform this action");
      expect(res.actionType).toBe("SUPPORT");
      expect(res.actionText).toBe("Contact Support");
    });

    it("maps 429 Rate Limit to polite wait message with RETRY action", () => {
      const clientErr = new ApiClientError("Rate limit exceeded. Tier: free", 429, "RATE_LIMITED");
      const res = getUserFriendlyErrorMessage(clientErr);
      expect(res.message).toContain("Too many attempts");
      expect(res.message).not.toContain("Tier: free");
      expect(res.actionType).toBe("RETRY");
      expect(res.actionText).toBe("Wait & Retry");
    });

    it("maps 404 Not Found to polite item missing message with REFRESH action", () => {
      const clientErr = new ApiClientError("Resource not found", 404, "NOT_FOUND");
      const res = getUserFriendlyErrorMessage(clientErr);
      expect(res.message).toContain("requested item could not be found");
      expect(res.actionType).toBe("REFRESH");
      expect(res.actionText).toBe("Refresh Page");
    });
  });

  describe("Business Logic & Financial Mappings", () => {
    it("maps insufficient wallet balance error with action", () => {
      const error = new Error("INSUFFICIENT_BALANCE: required 50000 paise but had 10000 paise");
      const res = getUserFriendlyErrorMessage(error);
      expect(res.message).toContain("available balance is insufficient");
      expect(res.message).not.toContain("paise");
      expect(res.actionType).toBe("REFRESH");
      expect(res.actionText).toBe("View Wallet");
    });

    it("maps invalid OTP verification error", () => {
      const error = new Error("Invalid or expired OTP code entered");
      const res = getUserFriendlyErrorMessage(error);
      expect(res.message).toContain("OTP entered is incorrect or has expired");
      expect(res.actionType).toBe("RETRY");
      expect(res.actionText).toBe("Resend Code");
    });

    it("maps file upload size limits politely", () => {
      const error = new Error("File exceeds maximum upload limit of 15MB: upload failed");
      const res = getUserFriendlyErrorMessage(error);
      expect(res.message).toContain("File upload failed");
      expect(res.actionType).toBe("RETRY");
      expect(res.actionText).toBe("Select File");
    });

    it("maps deal state machine conflicts gracefully", () => {
      const error = new Error("Invalid transition: cannot transition deal from DISPUTED to COMPLETED");
      const res = getUserFriendlyErrorMessage(error);
      expect(res.message).toContain("This deal state has updated or this action is no longer permitted");
      expect(res.actionType).toBe("REFRESH");
      expect(res.actionText).toBe("Refresh Deal");
    });
  });

  describe("formatUserError helper", () => {
    it("returns formatted string from an Error instance", () => {
      const err = new Error("Failed to fetch");
      const str = formatUserError(err);
      expect(typeof str).toBe("string");
      expect(str).toContain("Unable to connect");
    });

    it("returns formatted string from an ApiClientError", () => {
      const err = new ApiClientError("Unauthorized access", 401);
      const str = formatUserError(err);
      expect(str).toContain("Your session has expired");
    });

    it("handles null and undefined with fallback", () => {
      expect(formatUserError(null)).toBe("An unexpected error occurred. Please try again.");
      expect(formatUserError(undefined, "Custom fallback")).toBe("Custom fallback");
    });

    it("safely extracts message from plain string and scrubs leaks", () => {
      const str = formatUserError("PrismaClientKnownRequestError: Table 'users' does not exist");
      expect(str).not.toContain("Prisma");
      expect(str).not.toContain("users");
      expect(str).toBe("The requested item could not be found or may have been updated.");
    });
  });

  describe("USER_SUCCESS_MESSAGES catalog", () => {
    it("provides specific settlement timeline for withdrawals", () => {
      expect(USER_SUCCESS_MESSAGES.WITHDRAWAL_REQUESTED).toContain("2-3 business days");
    });

    it("provides penny-drop verification notice for bank accounts", () => {
      expect(USER_SUCCESS_MESSAGES.BANK_ACCOUNT_ADDED).toContain("penny-drop");
    });

    it("provides clear feedback for offers, reports, and security actions", () => {
      expect(USER_SUCCESS_MESSAGES.OFFER_SENT).toBe("Offer sent successfully.");
      expect(USER_SUCCESS_MESSAGES.REPORT_SUBMITTED).toContain("24 hours");
      expect(USER_SUCCESS_MESSAGES.TWO_FACTOR_ENABLED).toContain("Two-factor authentication is now active");
    });
  });

  describe("Audit P9 Regression: Table-Driven Tests for Wrong Mappings Found", () => {
    const wrongMappingCases = [
      {
        scenario: "P0-MSG-01: English phrase containing 'select ... from' must not be scrubbed as SQL injection",
        input: "Please select a category from the list.",
        expectedMessage: "Please select a category from the list.",
        failureReason: "Nuked by TECHNICAL_LEAK_PATTERNS /\\bselect\\b.*\\bfrom\\b/i into generic 500 error",
      },
      {
        scenario: "P0-MSG-01: English phrase containing 'update ... set' must not be scrubbed as SQL injection",
        input: "Please update your profile and set a payout method.",
        expectedMessage: "Please update your profile and set a payout method.",
        failureReason: "Nuked by TECHNICAL_LEAK_PATTERNS /\\bupdate\\b.*\\bset\\b/i into generic 500 error",
      },
      {
        scenario: "P0-MSG-01: English phrase containing 'constraint' must not be scrubbed as database constraint",
        input: "Your budget constraint cannot exceed the wallet balance.",
        expectedMessage: "Your budget constraint cannot exceed the wallet balance.",
        failureReason: "Nuked by TECHNICAL_LEAK_PATTERNS /\\bconstraint\\b/i into generic 500 error",
      },
      {
        scenario: "P0-MSG-01: English phrase containing 'stack' must not be scrubbed as call stack trace",
        input: "Mention your tech stack in the proposal.",
        expectedMessage: "Mention your tech stack in the proposal.",
        failureReason: "Nuked by TECHNICAL_LEAK_PATTERNS /\\bstack\\b/i into generic 500 error",
      },
      {
        scenario: "P0-MSG-01: English phrase containing 'table' must not be scrubbed as database table leak",
        input: "Please choose a table number.",
        expectedMessage: "Please choose a table number.",
        failureReason: "Nuked by TECHNICAL_LEAK_PATTERNS /\\btable\\s+\"?...\"?/i into generic 500 error",
      },
      {
        scenario: "P0-MSG-02: PaymentService GATEWAY_AMBIGUOUS must map to friendly pending gateway message with Check History",
        input: new ApiClientError("GATEWAY_AMBIGUOUS", 400, "BAD_REQUEST"),
        expectedMessage: "The payment gateway is taking longer than expected to confirm. Please check your transaction history before initiating a new request.",
        expectedAction: "Check History",
        failureReason: "Regex /\\bgateway ambiguous\\b/ expects space; fails on underscore, leaking raw string",
      },
      {
        scenario: "P1-MSG-04: Status 401 with wrong credentials must NOT say 'Your session has expired'",
        input: new ApiClientError("Invalid email or password", 401, "INVALID_CREDENTIALS"),
        expectedMessage: "Invalid email or password",
        failureReason: "Status 401 unconditionally maps to 'Your session has expired'",
      },
      {
        scenario: "P1-MSG-05: Status 409 deal state conflict must NOT say 'This entry already exists'",
        input: new ApiClientError("Deal state conflict: terminal state", 409, "DEAL_STATE_CONFLICT"),
        expectedMessage: "This deal state has updated or this action is no longer permitted. Please refresh the deal details.",
        failureReason: "Status 409 Duplicate rule shadows Rule 14 Deal Transition rule",
      },
      {
        scenario: "P1-MSG-06: Beneficiary name length validation must NOT say 'We couldn\\'t verify this bank account'",
        input: "Beneficiary name must be at least 2 characters",
        expectedMessage: "Beneficiary name must be at least 2 characters",
        failureReason: "Greedy keyword 'beneficiary' in Rule 12 rewrites length validation into penny-drop failure",
      },
      {
        scenario: "P1-MSG-07: LocalStorage quota message must NOT say 'File upload failed'",
        input: "LocalStorage quota exceeded",
        expectedMessage: "LocalStorage quota exceeded",
        failureReason: "Greedy keyword 'storage' in Rule 13 rewrites browser storage into file upload error",
      },
    ];

    it.each(wrongMappingCases)("$scenario", ({ input, expectedMessage, expectedAction, failureReason }) => {
      const res = getUserFriendlyErrorMessage(input);
      // Demonstrates the failure in unpatched code:
      expect(
        res.message,
        `Mapping bug: ${failureReason} (Actual: "${res.message}")`
      ).toBe(expectedMessage);

      if (expectedAction) {
        expect(res.actionText).toBe(expectedAction);
      }
    });
  });
});
