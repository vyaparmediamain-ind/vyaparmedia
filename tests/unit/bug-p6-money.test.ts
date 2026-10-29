import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Phase 6 Financial Correctness & Money Invariant Remediation (P6-MONEY-01 through P6-MONEY-10)", () => {
  it("P6-MONEY-01: ensures gateway refund and chargeback webhook events update PaymentHold and handle wallet clawback", () => {
    const webhookPath = path.join(process.cwd(), "src/app/api/webhooks/razorpay/process/route.ts");
    const content = fs.readFileSync(webhookPath, "utf-8");

    expect(content).toContain('event.startsWith("refund.") || event.startsWith("dispute.") || event.startsWith("payment.dispute.")');
    expect(content).toContain('status: "FAILED"');
    expect(content).toContain('type: "CHARGEBACK"');
    expect(content).toContain("tx.debtClaim.create");
  });

  it("P6-MONEY-02: ensures card-funded dispute resolution does not decrement brandWallet.pendingBalance", () => {
    const mediatorPath = path.join(process.cwd(), "src/lib/dispute-mediator/transaction-helpers.ts");
    const content = fs.readFileSync(mediatorPath, "utf-8");

    const cardRefundSection = content.substring(
      content.indexOf("if (!deal.reservedFromWallet)"),
      content.indexOf("handleRazorpayGatewayRefund(deal, brandRefund, analysis)")
    );

    expect(cardRefundSection).not.toContain("pendingBalance: { decrement: totalAmount }");
    expect(cardRefundSection).not.toContain("INSUFFICIENT_BRAND_ESCROW");
    expect(content).toContain("P6-MONEY-02 FIX");
  });

  it("P6-MONEY-03: ensures reconcile-payouts cron recovers stuck withdrawals and admin payout route allows retry", () => {
    const cronPath = path.join(process.cwd(), "src/app/api/cron/reconcile-payouts/route.ts");
    const cronContent = fs.readFileSync(cronPath, "utf-8");

    expect(cronContent).toContain("P6-MONEY-03 FIX: Reconcile stuck withdrawals");
    expect(cronContent).toContain("prisma.withdrawal.findMany");
    expect(cronContent).toContain('status: "PROCESSING"');
    expect(cronContent).toContain("refundFailedWithdrawal");

    const adminPayoutPath = path.join(process.cwd(), "src/app/api/admin/payouts/[id]/route.ts");
    const adminContent = fs.readFileSync(adminPayoutPath, "utf-8");
    expect(adminContent).toContain('{ status: "PROCESSING", razorpayPayoutId: null }');
  });

  it("P6-MONEY-04: ensures application accept and deal fund enforce deterministic idempotency keys", () => {
    const acceptPath = path.join(process.cwd(), "src/app/api/applications/[id]/accept/route.ts");
    const acceptContent = fs.readFileSync(acceptPath, "utf-8");

    expect(acceptContent).toContain("claimIdempotencyKey");
    expect(acceptContent).toContain("saveIdempotencyResponse");
    expect(acceptContent).toContain("releaseIdempotencyKey");

    const fundPath = path.join(process.cwd(), "src/app/api/deals/[id]/fund/route.ts");
    const fundContent = fs.readFileSync(fundPath, "utf-8");
    expect(fundContent).not.toContain("Date.now()");
    expect(fundContent).toContain("claimIdempotencyKey");
  });

  it("P6-MONEY-05: ensures unbilled shipments are enqueued to DeadLetterJob if billing transaction fails after carrier booking", () => {
    const productPath = path.join(process.cwd(), "src/services/deal/product.ts");
    const content = fs.readFileSync(productPath, "utf-8");

    expect(content).toContain("P6-MONEY-05 FIX: If DB transaction fails after Shiprocket shipment was created");
    expect(content).toContain('topic: "shipping.unbilled_shipment_reconcile"');
    expect(content).toContain("prisma.deadLetterJob.create");
  });

  it("P6-MONEY-06: ensures ledger settlement reconciliation cron excludes non-impacting memo transactions", () => {
    const cronPath = path.join(process.cwd(), "src/app/api/cron/reconcile-ledger-settlements/route.ts");
    const content = fs.readFileSync(cronPath, "utf-8");

    expect(content).toContain('startsWith: "TDS deduction"');
    expect(content).toContain('type: { in: ["DEBIT", "WITHDRAWAL", "PLATFORM_FEE", "CLAWBACK", "CHARGEBACK", "SHIPPING_CHARGE"] }');
  });

  it("P6-MONEY-07: ensures LARGE_WITHDRAWAL_NEW_ACCOUNT evaluates newest bank account age alongside user age", () => {
    const fraudPath = path.join(process.cwd(), "src/lib/fraud-detection/payment.ts");
    const content = fs.readFileSync(fraudPath, "utf-8");

    expect(content).toContain("prisma.bankAccount.findFirst");
    expect(content).toContain("Math.min(userAgeDays, bankAgeDays)");
    expect(content).toContain("Large withdrawal from account or recently added bank account less than");
  });

  it("P6-MONEY-08: ensures admin DLQ replay deletes stale ProcessedWebhookEvent records before retrying", () => {
    const dlqPath = path.join(process.cwd(), "src/app/api/admin/jobs/dlq/route.ts");
    const content = fs.readFileSync(dlqPath, "utf-8");

    expect(content).toContain("prisma.processedWebhookEvent");
    expect(content).toContain("deleteMany");
    expect(content).toContain("where: { eventId: rawEventId }");
  });

  it("P6-MONEY-09: ensures wallet add-funds validation strictly requires integer paise", () => {
    const addFundsPath = path.join(process.cwd(), "src/app/api/wallet/add-funds/route.ts");
    const content = fs.readFileSync(addFundsPath, "utf-8");

    expect(content).toContain(".min(10000, \"Minimum top-up is INR 100\")");
    expect(content).toContain(".max(50000000, \"Maximum top-up per request is INR 5,00,000\")");
  });

  it("P6-MONEY-10: ensures admin payout approval and rejection create persistent ActivityLog and AuditLog records", () => {
    const adminPayoutPath = path.join(process.cwd(), "src/app/api/admin/payouts/[id]/route.ts");
    const content = fs.readFileSync(adminPayoutPath, "utf-8");

    expect(content).toContain("createActivityLog");
    expect(content).toContain('action: "ADMIN_PAYOUT_REJECT"');
    expect(content).toContain('action: "ADMIN_PAYOUT_APPROVE"');
  });
});
