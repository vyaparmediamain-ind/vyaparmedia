import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { DEAL_TRANSITION_MATRIX } from "@/lib/deal-state-machine";
import { checkDealCancellationEligibility } from "@/lib/action-eligibility";

describe("Phase 5 Logic, State Machine & Concurrency Remediation (P5-LOGIC-01 through P5-LOGIC-10)", () => {
  it("P5-LOGIC-01: ensures transitionDealState executes before releaseTransferHold in processDealCompletion", () => {
    const paymentServicePath = path.join(process.cwd(), "src/services/payment.service.ts");
    const content = fs.readFileSync(paymentServicePath, "utf-8");

    const transitionIndex = content.indexOf('toState: "COMPLETED"');
    const releaseHoldIndex = content.indexOf("await releaseTransferHold(transferId)");

    expect(transitionIndex).toBeGreaterThan(0);
    expect(releaseHoldIndex).toBeGreaterThan(0);
    expect(transitionIndex).toBeLessThan(releaseHoldIndex);
  });

  it("P5-LOGIC-02: ensures checkAndBlockLatePost transitions late posts to DISPUTED instead of PAYMENT_PENDING", () => {
    const paymentServicePath = path.join(process.cwd(), "src/services/payment.service.ts");
    const content = fs.readFileSync(paymentServicePath, "utf-8");

    const fnStart = content.indexOf("checkAndBlockLatePost");
    const fnEnd = content.indexOf("TWO-PHASE COMPLETION PATTERN", fnStart);
    const fnBody = content.substring(fnStart, fnEnd);

    expect(fnBody).not.toContain('status: "PAYMENT_PENDING"');
    expect(fnBody).toContain('status: "DISPUTED"');
  });

  it("P5-LOGIC-03: ensures approveDeliverableVerification and rejectDeliverableVerification exist in admin actions", () => {
    const adminActionsPath = path.join(process.cwd(), "src/app/admin/actions.ts");
    const content = fs.readFileSync(adminActionsPath, "utf-8");

    expect(content).toMatch(/export async function approveDeliverableVerification/);
    expect(content).toMatch(/export async function rejectDeliverableVerification/);
    expect(content).toMatch(/toState:\s*"VERIFIED"/);
  });

  it("P5-LOGIC-04: ensures dispute withdrawal guards where status is DISPUTED and transition matrix allows PAYMENT_HELD from DISPUTED", () => {
    const disputeServicePath = path.join(process.cwd(), "src/services/dispute.service.ts");
    const content = fs.readFileSync(disputeServicePath, "utf-8");

    expect(content).toMatch(/where:\s*\{\s*id:\s*dispute\.dealId,\s*status:\s*"DISPUTED"\s*\}/);

    const disputedTransitions = DEAL_TRANSITION_MATRIX.DISPUTED;
    const canExitToPaymentHeld = disputedTransitions.some((rule) => rule.to === "PAYMENT_HELD");
    expect(canExitToPaymentHeld).toBe(true);

    const disputeActionsPath = path.join(process.cwd(), "src/lib/dispute-mediator/actions.ts");
    const mediatorContent = fs.readFileSync(disputeActionsPath, "utf-8");
    expect(mediatorContent).not.toMatch(/previousStatus\s*=\s*dispute\.dealStatusAtCreation\s*\|\|\s*"PAYMENT_PENDING"/);
  });

  it("P5-LOGIC-05: ensures checkDealCancellationEligibility disallows cancellation on POSTED and VERIFIED deals", () => {
    const postedCheck = checkDealCancellationEligibility(
      { status: "POSTED", hasActiveDispute: false },
      true,
    );
    expect(postedCheck.allowed).toBe(false);
    expect(postedCheck.reason).toContain("cannot be cancelled once content has been published");

    const verifiedCheck = checkDealCancellationEligibility(
      { status: "VERIFIED", hasActiveDispute: false },
      true,
    );
    expect(verifiedCheck.allowed).toBe(false);

    const verificationPendingCheck = checkDealCancellationEligibility(
      { status: "VERIFICATION_PENDING", hasActiveDispute: false },
      true,
    );
    expect(verificationPendingCheck.allowed).toBe(false);
  });

  it("P5-LOGIC-06: ensures createApplication validates proposedRate against campaign totalBudget", () => {
    const applicationCreatePath = path.join(process.cwd(), "src/services/application/create.ts");
    const content = fs.readFileSync(applicationCreatePath, "utf-8");

    expect(content).toMatch(/data\.proposedRate\s*>\s*campaign\.totalBudget/);
  });

  it("P5-LOGIC-07: ensures BlockService guards application creation and direct invites", () => {
    const applicationCreatePath = path.join(process.cwd(), "src/services/application/create.ts");
    const appContent = fs.readFileSync(applicationCreatePath, "utf-8");
    expect(appContent).toMatch(/BlockService\.isBlocked/);

    const campaignCreatePath = path.join(process.cwd(), "src/services/campaign/create.ts");
    const campContent = fs.readFileSync(campaignCreatePath, "utf-8");
    expect(campContent).toMatch(/BlockService\.isBlocked/);
  });

  it("P5-LOGIC-08: ensures processReferralReward blocks Sybil self-referral with matching PAN or Bank Account hashes", () => {
    const referralEnginePath = path.join(process.cwd(), "src/lib/referral-engine.ts");
    const content = fs.readFileSync(referralEnginePath, "utf-8");

    expect(content).toMatch(/panNumberHash/);
    expect(content).toMatch(/accountNumberHash/);
    expect(content).toMatch(/Sybil self-referral attempt detected and blocked/);
  });

  it("P5-LOGIC-09: ensures deal cancellation persists DeadLetterJob upon Route refund failure", () => {
    const cancelRoutePath = path.join(process.cwd(), "src/app/api/deals/[id]/cancel/route.ts");
    const content = fs.readFileSync(cancelRoutePath, "utf-8");

    expect(content).toMatch(/topic:\s*"payment\.route_cancel_refund_failed"/);
    expect(content).toMatch(/prisma\.deadLetterJob\.create/);
  });

  it("P5-LOGIC-10: ensures expire-signatures cron includes expired PAYMENT_PENDING deals", () => {
    const expireCronPath = path.join(process.cwd(), "src/app/api/cron/expire-signatures/route.ts");
    const content = fs.readFileSync(expireCronPath, "utf-8");

    expect(content).toMatch(/status:\s*"PAYMENT_PENDING"/);
    expect(content).toMatch(/Deal funding deadline expired/);
  });
});
