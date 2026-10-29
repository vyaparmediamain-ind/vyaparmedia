import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ApiErrorCode, AppError } from "@/lib/errors";
import { statusConfig } from "@/components/dashboard/deals/DealDetailHelpers";
import { MIN_WITHDRAWAL_AMOUNT_PAISE, MAX_WITHDRAWAL_AMOUNT_PAISE } from "@/constants/wallet";
import { withdrawalSchema } from "@/lib/validations";
import { runContractAudit } from "../../scripts/audit-contract";

describe("Phase 8 Full-Stack API Contract Suite (P8-CON-01 through P8-CON-10)", () => {
  it("P8-CON-01: ensures wallet top-up standardizes on integer paise and rejects unit magnification", () => {
    const routePath = path.join(process.cwd(), "src/app/api/wallet/add-funds/route.ts");
    const routeContent = fs.readFileSync(routePath, "utf-8");

    expect(routeContent).toContain("min(10000");
    expect(routeContent).toContain("max(50000000");
    expect(routeContent).toContain("amountInPaise = (parsed.data.amountPaise ?? parsed.data.amount)!");
    expect(routeContent).not.toContain("parsed.data.amount * 100");

    const clientPath = path.join(process.cwd(), "src/lib/api-client/wallet.ts");
    const clientContent = fs.readFileSync(clientPath, "utf-8");
    expect(clientContent).toContain("{ amount: amountPaise, amountPaise }");
  });

  it("P8-CON-02: ensures notification preferences accepts both PATCH and POST without 405", () => {
    const routePath = path.join(process.cwd(), "src/app/api/notifications/preferences/route.ts");
    const content = fs.readFileSync(routePath, "utf-8");

    expect(content).toContain("export const PATCH");
    expect(content).toContain("export const POST = PATCH");
  });

  it("P8-CON-03: ensures india-tax compliance accepts both PUT and POST without 405", () => {
    const routePath = path.join(process.cwd(), "src/app/api/compliance/india-tax/route.ts");
    const content = fs.readFileSync(routePath, "utf-8");

    expect(content).toContain("export const PUT = apiWrapper(_handler_PUT)");
    expect(content).toContain("export const POST = apiWrapper(_handler_PUT)");
  });

  it("P8-CON-04: ensures dead client call sites are eliminated from apiClient.messages", () => {
    const clientPath = path.join(process.cwd(), "src/lib/api-client/messages.ts");
    const content = fs.readFileSync(clientPath, "utf-8");

    // Must not call non-existent /api/messages/:id routes
    expect(content).not.toContain("getById");
    expect(content).not.toContain("/api/messages/${encodeURIComponent(id)}");

    const audit = runContractAudit();
    expect(audit.deadCalls).toHaveLength(0);
  });

  it("P8-CON-05: ensures withdrawal initiation returns database withdrawal ID (no phantom ID fallback)", () => {
    const servicePath = path.join(process.cwd(), "src/services/payment.service.ts");
    const content = fs.readFileSync(servicePath, "utf-8");

    expect(content).toContain("id: withdrawal.w.id, withdrawalId: withdrawal.w.id, status: payout.status");
    expect(content).toContain("id: withdrawal.w.id, withdrawalId: withdrawal.w.id, status: \"PENDING_REVIEW\"");
  });

  it("P8-CON-06: ensures ApiResponse emits unified error envelope with both message and error fields", () => {
    const wrapperPath = path.join(process.cwd(), "src/lib/api-wrapper.ts");
    const content = fs.readFileSync(wrapperPath, "utf-8");

    expect(content).toContain("error: safeMessage");
    expect(content).toContain("forbidden: (message = \"Forbidden\") =>");
    expect(content).toContain("NextResponse.json({ success: false, message, error: message }, { status: 403 })");
    expect(content).toContain("NextResponse.json({ success: false, message, error: message }, { status: 401 })");
    expect(content).toContain("NextResponse.json({ success: false, message, error: message }, { status: 404 })");
    expect(content).toContain("NextResponse.json({ success: false, message, error: message }, { status: 409 })");
  });

  it("P8-CON-07: ensures ApiErrorCode enum contains all codes referenced by client user-messages and AppError has helpers", () => {
    expect(ApiErrorCode.RATE_LIMIT).toBe("RATE_LIMIT");
    expect(ApiErrorCode.GATEWAY_TIMEOUT).toBe("GATEWAY_TIMEOUT");
    expect(ApiErrorCode.GATEWAY_AMBIGUOUS).toBe("GATEWAY_AMBIGUOUS");
    expect(ApiErrorCode.FILE_TOO_LARGE).toBe("FILE_TOO_LARGE");

    const rateLimitErr = AppError.rateLimit();
    expect(rateLimitErr.statusCode).toBe(429);
    expect(rateLimitErr.errorCode).toBe(ApiErrorCode.RATE_LIMIT);

    const gatewayTimeoutErr = AppError.gatewayTimeout();
    expect(gatewayTimeoutErr.statusCode).toBe(504);
    expect(gatewayTimeoutErr.errorCode).toBe(ApiErrorCode.GATEWAY_TIMEOUT);
  });

  it("P8-CON-08: ensures wallet constants and withdrawalSchema align on financial limits", () => {
    expect(MIN_WITHDRAWAL_AMOUNT_PAISE).toBeGreaterThanOrEqual(10000);
    expect(MAX_WITHDRAWAL_AMOUNT_PAISE).toBe(50_000_000);

    const validParsed = withdrawalSchema.safeParse({
      amount: 50000,
      bankAccountId: "bank_123",
    });
    expect(validParsed.success).toBe(true);

    const invalidTooSmall = withdrawalSchema.safeParse({
      amount: 100,
      bankAccountId: "bank_123",
    });
    expect(invalidTooSmall.success).toBe(false);
  });

  it("P8-CON-09: ensures DealDetailHelpers statusConfig exhaustively covers all 13 DealStatus enum members", () => {
    const requiredStatuses = [
      "PENDING_SIGNATURE",
      "PAYMENT_PENDING",
      "PAYMENT_HELD",
      "ACTIVE",
      "CONTENT_SUBMITTED",
      "REVISION_REQUESTED",
      "CONTENT_APPROVED",
      "POSTED",
      "VERIFICATION_PENDING",
      "VERIFIED",
      "COMPLETED",
      "DISPUTED",
      "CANCELLED",
    ] as const;

    for (const status of requiredStatuses) {
      expect(statusConfig[status], `Missing label for deal status ${status}`).toBeDefined();
      expect(statusConfig[status].label).toBeTruthy();
      expect(statusConfig[status].color).toBeTruthy();
    }
  });

  it("P8-CON-10: ensures client HTTP requests disable stale caching via default cache no-store", () => {
    const httpPath = path.join(process.cwd(), "src/lib/api-client/http.ts");
    const content = fs.readFileSync(httpPath, "utf-8");

    expect(content).toContain('cache: "no-store"');
  });
});
