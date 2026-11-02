import { describe, it, expect } from "vitest";
import { formatAuditLogDetails, humanizeString, formatCurrencyPaise } from "@/lib/audit-formatters";

describe("audit-formatters", () => {
  it("formats humanizeString correctly", () => {
    expect(humanizeString("SECURITY_LEDGER_ALERT")).toBe("Security ledger alert");
    expect(humanizeString("camelCaseWord")).toBe("Camel case word");
    expect(humanizeString("")).toBe("");
  });

  it("formats formatCurrencyPaise correctly", () => {
    expect(formatCurrencyPaise(10000)).toContain("100");
  });

  it("formats LOGIN with email in afterJSON", () => {
    const text = formatAuditLogDetails({
      actionType: "LOGIN",
      entityType: "USER",
      afterJSON: { email: "admin@test.vyaparmedia.in" },
    });
    expect(text).toBe("Signed in with admin@test.vyaparmedia.in");
  });

  it("formats LOGIN without email", () => {
    const text = formatAuditLogDetails({
      actionType: "LOGIN",
      entityType: "USER",
      afterJSON: {},
    });
    expect(text).toBe("User signed in successfully");
  });

  it("formats SECURITY_LEDGER_ALERT with reason and drift", () => {
    const text = formatAuditLogDetails({
      actionType: "SECURITY_LEDGER_ALERT",
      entityType: "USER",
      afterJSON: {
        reason: "Total ledger sum does not match stored balance",
        drift: 192000,
      },
    });
    expect(text).toContain("Total ledger sum does not match stored balance");
    expect(text).toContain("Drift:");
  });

  it("formats SECURITY_LEDGER_ALERT from reconciliation summary", () => {
    const text = formatAuditLogDetails({
      actionType: "SECURITY_LEDGER_ALERT",
      entityType: "LEDGER",
      afterJSON: {
        reason: "Daily ledger vs stored balances mismatch",
        summary: {
          ledgerToWalletDriftPaise: 19810000,
        },
      },
    });
    expect(text).toContain("Daily ledger vs stored balances mismatch");
    expect(text).toContain("Drift:");
  });

  it("formats FRAUD_APPEAL_RESOLVED with approval and notes", () => {
    const text = formatAuditLogDetails({
      actionType: "FRAUD_APPEAL_RESOLVED",
      entityType: "USER",
      afterJSON: {
        decision: "APPROVE_APPEAL",
        notes: "Fraud flag cleared via admin appeal review",
      },
    });
    expect(text).toBe("Fraud appeal Approved — Fraud flag cleared via admin appeal review");
  });

  it("formats DEAL_STATUS_TRANSITION with from and to state", () => {
    const text = formatAuditLogDetails({
      actionType: "DEAL_STATUS_TRANSITION",
      entityType: "DEAL",
      afterJSON: {
        fromState: "PENDING_SIGNATURE",
        toState: "PAYMENT_HELD",
        reason: "Brand escrow deposit confirmed",
      },
    });
    expect(text).toBe("Status changed from Pending signature to Payment held (Brand escrow deposit confirmed)");
  });

  it("formats CONTRACT_SIGNED", () => {
    const text = formatAuditLogDetails({
      actionType: "CONTRACT_SIGNED",
      entityType: "USER",
      afterJSON: {
        role: "BRAND",
        isFullySigned: true,
      },
    });
    expect(text).toBe("Contract signed by Brand (Fully executed)");
  });

  it("handles fallback to reason string when unknown actionType is passed", () => {
    const text = formatAuditLogDetails({
      actionType: "UNKNOWN_CUSTOM_ACTION",
      afterJSON: {
        reason: "Custom operation performed by admin",
      },
    });
    expect(text).toBe("Custom operation performed by admin");
  });

  it("handles empty null objects without crashing", () => {
    const text = formatAuditLogDetails({
      actionType: "SOME_ACTION",
      beforeJSON: null,
      afterJSON: null,
    });
    expect(text).toBe("No changes recorded");
  });
});

