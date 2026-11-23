import { z } from "zod";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { createActivityLog } from "@/lib/audit";
import { acquireDistributedLock, releaseDistributedLock } from "@/lib/lock";
import { redis } from "@/lib/redis";
import {
  releaseTransferHold,
  refundPayment,
  reverseTransfer,
  fetchPaymentTransfers,
} from "@/lib/razorpay";
import { sendWithdrawalEmail } from "@/lib/email";
import { checkAndAwardBadges } from "@/lib/gamification-engine";
import { checkChallengeProgress } from "@/lib/weekly-challenges";
import { DealService } from "@/services/deal.service";
import { AppError } from "@/lib/errors";

/**
 * Job Topic Definition
 */
export interface JobTopicDefinition<T = unknown> {
  topic: string;
  category: "time-critical" | "scheduled" | "best-effort";
  payloadSchema: z.ZodSchema<T>;
  isMoneyImpacting: boolean;
  requiresAdminApproval: boolean;
  isManualOnly?: boolean;
  runbookNote?: string;
  maxReplays: number;
  idempotencyKeyFn: (payload: T) => string;
  handler?: (
    payload: T,
    ctx?: { dlqId?: string; adminUserId?: string }
  ) => Promise<{
    success: boolean;
    skippedDuplicate?: boolean;
    result?: unknown;
  }>;
}

// Zod schemas for all payload types
export const EscrowReleaseMissingTransferPayloadSchema = z
  .object({
    dealId: z.string().min(1),
    paymentHoldId: z.string().min(1),
    paymentId: z.string().nullable().optional(),
    amount: z.number().int().positive().optional(),
  })
  .passthrough();

export const EscrowReleaseGatewayFailedPayloadSchema = z
  .object({
    dealId: z.string().min(1),
    paymentHoldId: z.string().min(1),
    transferId: z.string().min(1),
    amount: z.number().int().positive().optional(),
  })
  .passthrough();

export const DisputeGatewayRefundPayloadSchema = z
  .object({
    dealId: z.string().min(1),
    paymentId: z.string().min(1),
    amount: z.number().int().positive(),
    refundPercentage: z.number().optional(),
  })
  .passthrough();

export const WalletDebtDistributionGapPayloadSchema = z
  .object({
    walletId: z.string().min(1),
    userId: z.string().min(1),
    remainingDebtPaid: z.number().int().positive(),
    debtPaid: z.number().int().nonnegative().optional(),
    dealId: z.string().nullable().optional(),
  })
  .passthrough();

export const ShippingUnbilledReconcilePayloadSchema = z
  .object({
    dealId: z.string().min(1),
    brandUserId: z.string().optional(),
    awbCode: z.string().min(1),
    courierChargePaise: z.number().int().positive(),
    chargeDisplay: z.string().optional(),
  })
  .passthrough();

export const RouteCancelRefundFailedPayloadSchema = z
  .object({
    dealId: z.string().min(1),
    paymentHoldId: z.string().optional(),
    paymentId: z.string().optional(),
    amount: z.number().int().positive().optional(),
    reason: z.string().optional(),
  })
  .passthrough();

export const RouteCancelReverseFailedPayloadSchema = z
  .object({
    dealId: z.string().min(1),
    paymentHoldId: z.string().optional(),
    transferId: z.string().min(1),
    amount: z.number().int().positive().optional(),
    reason: z.string().optional(),
  })
  .passthrough();

export const ReconciliationGatewayMismatchPayloadSchema = z
  .object({
    paymentId: z.string().min(1),
    amount: z.number().int().optional(),
    gatewayAmount: z.number().int().optional(),
    ledgerAmount: z.number().int().optional(),
    reason: z.string().optional(),
  })
  .passthrough();

export const EmailWithdrawalPayloadSchema = z
  .object({
    withdrawalId: z.string().min(1),
    topic: z.string().optional(),
    category: z.string().optional(),
    deduplicationId: z.string().optional(),
  })
  .passthrough();

export const GamificationBadgesPayloadSchema = z
  .object({
    userId: z.string().min(1),
    action: z.string().optional(),
    topic: z.string().optional(),
    category: z.string().optional(),
    deduplicationId: z.string().optional(),
  })
  .passthrough();

export const GamificationChallengePayloadSchema = z
  .object({
    userId: z.string().min(1),
    action: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
    topic: z.string().optional(),
    category: z.string().optional(),
    deduplicationId: z.string().optional(),
  })
  .passthrough();

export const AutoApproveTimeoutPayloadSchema = z
  .object({
    topic: z.string().optional(),
    category: z.string().optional(),
    deduplicationId: z.string().optional(),
  })
  .passthrough();

export const TestDeliberateFailurePayloadSchema = z
  .object({
    metadata: z.record(z.string(), z.unknown()).optional(),
    topic: z.string().optional(),
    category: z.string().optional(),
    deduplicationId: z.string().optional(),
  })
  .passthrough();

/**
 * Registry of all known topics and their handling metadata
 */
export const JOB_TOPICS_REGISTRY: Record<string, JobTopicDefinition<any>> = {
  // 1. payment.escrow_release_missing_transfer
  "payment.escrow_release_missing_transfer": {
    topic: "payment.escrow_release_missing_transfer",
    category: "time-critical",
    payloadSchema: EscrowReleaseMissingTransferPayloadSchema,
    isMoneyImpacting: true,
    requiresAdminApproval: true,
    maxReplays: 3,
    idempotencyKeyFn: (p) => `dlq:topic:escrow_missing:${p.dealId}:${p.paymentHoldId}`,
    handler: async (payload, ctx) => {
      const lockKey = `lock:dlq:escrow:${payload.dealId}`;
      const token = await acquireDistributedLock(lockKey, 60);
      if (!token) {
        throw new Error(`Could not acquire distributed lock for escrow release on deal ${payload.dealId}`);
      }

      try {
        const hold = await prisma.paymentHold.findUnique({
          where: { id: payload.paymentHoldId },
        });

        if (!hold) {
          throw AppError.notFound("PaymentHold not found");
        }

        if (hold.status === "RELEASED") {
          return { success: true, skippedDuplicate: true, result: { reason: "PaymentHold already RELEASED" } };
        }

        let transferId = (await redis.get(`rzp:route:transfer:${payload.dealId}`)) || "";
        if (!transferId && hold.razorpayPaymentId) {
          const transfers = await fetchPaymentTransfers(hold.razorpayPaymentId);
          if (transfers[0]?.id) {
            transferId = transfers[0].id;
            await redis.set(`rzp:route:transfer:${payload.dealId}`, transferId, "EX", 86400 * 30);
          }
        }

        if (!transferId) {
          throw new Error("Razorpay Route transfer ID is still missing; manual investigation needed.");
        }

        await releaseTransferHold(transferId);

        await prisma.paymentHold.update({
          where: { id: hold.id },
          data: { status: "RELEASED", releasedAt: new Date() },
        });

        if (ctx?.adminUserId) {
          await createActivityLog({
            userId: ctx.adminUserId,
            action: "DLQ_REPLAY_ESCROW_RELEASE_SUCCESS",
            entityType: "PAYMENT_HOLD",
            entityId: hold.id,
            metadata: { dealId: payload.dealId, transferId },
          });
        }

        return { success: true, skippedDuplicate: false, result: { transferId, status: "RELEASED" } };
      } finally {
        await releaseDistributedLock(lockKey, token);
      }
    },
  },

  // 2. payment.escrow_release_gateway_failed
  "payment.escrow_release_gateway_failed": {
    topic: "payment.escrow_release_gateway_failed",
    category: "time-critical",
    payloadSchema: EscrowReleaseGatewayFailedPayloadSchema,
    isMoneyImpacting: true,
    requiresAdminApproval: true,
    maxReplays: 3,
    idempotencyKeyFn: (p) => `dlq:topic:escrow_failed:${p.dealId}:${p.transferId}`,
    handler: async (payload, ctx) => {
      const lockKey = `lock:dlq:escrow:${payload.dealId}`;
      const token = await acquireDistributedLock(lockKey, 60);
      if (!token) {
        throw new Error(`Could not acquire distributed lock for escrow release on deal ${payload.dealId}`);
      }

      try {
        const hold = await prisma.paymentHold.findUnique({
          where: { id: payload.paymentHoldId },
        });

        if (!hold) {
          throw AppError.notFound("PaymentHold not found");
        }

        if (hold.status === "RELEASED") {
          return { success: true, skippedDuplicate: true, result: { reason: "PaymentHold already RELEASED" } };
        }

        await releaseTransferHold(payload.transferId);

        await prisma.paymentHold.update({
          where: { id: hold.id },
          data: { status: "RELEASED", releasedAt: new Date() },
        });

        if (ctx?.adminUserId) {
          await createActivityLog({
            userId: ctx.adminUserId,
            action: "DLQ_REPLAY_GATEWAY_RELEASE_SUCCESS",
            entityType: "PAYMENT_HOLD",
            entityId: hold.id,
            metadata: { dealId: payload.dealId, transferId: payload.transferId },
          });
        }

        return { success: true, skippedDuplicate: false, result: { transferId: payload.transferId, status: "RELEASED" } };
      } finally {
        await releaseDistributedLock(lockKey, token);
      }
    },
  },

  // 3. dispute.gateway_refund
  "dispute.gateway_refund": {
    topic: "dispute.gateway_refund",
    category: "time-critical",
    payloadSchema: DisputeGatewayRefundPayloadSchema,
    isMoneyImpacting: true,
    requiresAdminApproval: true,
    maxReplays: 3,
    idempotencyKeyFn: (p) => `dlq:topic:dispute_refund:${p.dealId}:${p.paymentId}`,
    handler: async (payload, ctx) => {
      const lockKey = `lock:dlq:dispute_refund:${payload.dealId}`;
      const token = await acquireDistributedLock(lockKey, 60);
      if (!token) {
        throw new Error(`Could not acquire lock for dispute refund on deal ${payload.dealId}`);
      }

      try {
        const existingTx = await prisma.transaction.findFirst({
          where: {
            dealId: payload.dealId,
            razorpayPaymentId: payload.paymentId,
            type: "REFUND",
          },
        });

        if (existingTx) {
          return {
            success: true,
            skippedDuplicate: true,
            result: { reason: "Refund transaction already recorded", transactionId: existingTx.id },
          };
        }

        const deal = await prisma.deal.findUnique({
          where: { id: payload.dealId },
          include: { brand: { include: { user: { include: { wallet: true } } } } },
        });

        const walletId = deal?.brand?.user?.wallet?.id;
        if (!walletId) {
          throw AppError.notFound("Brand wallet not found for deal");
        }

        const refundRes = await refundPayment({
          paymentId: payload.paymentId,
          amount: payload.amount,
          notes: {
            dealId: payload.dealId,
            refundPercentage: String(payload.refundPercentage ?? 100),
            source: "DLQ_REPLAY",
          },
        });

        const newTx = await prisma.transaction.create({
          data: {
            walletId,
            dealId: payload.dealId,
            amount: payload.amount,
            type: "REFUND",
            status: "COMPLETED",
            razorpayPaymentId: payload.paymentId,
            description: `Gateway refund replayed from DLQ for deal ${payload.dealId}`,
            metadata: {
              refundId: (refundRes as any)?.id || null,
              replayedAt: new Date().toISOString(),
              source: "DLQ_REPLAY",
            },
          },
        });

        if (ctx?.adminUserId) {
          await createActivityLog({
            userId: ctx.adminUserId,
            action: "DLQ_REPLAY_DISPUTE_REFUND_SUCCESS",
            entityType: "TRANSACTION",
            entityId: newTx.id,
            metadata: { dealId: payload.dealId, paymentId: payload.paymentId, amount: payload.amount },
          });
        }

        return { success: true, skippedDuplicate: false, result: { transactionId: newTx.id, refundRes } };
      } finally {
        await releaseDistributedLock(lockKey, token);
      }
    },
  },

  // 4. wallet.debt_distribution_gap
  "wallet.debt_distribution_gap": {
    topic: "wallet.debt_distribution_gap",
    category: "time-critical",
    payloadSchema: WalletDebtDistributionGapPayloadSchema,
    isMoneyImpacting: true,
    requiresAdminApproval: true,
    maxReplays: 3,
    idempotencyKeyFn: (p) => `dlq:topic:debt_gap:${p.walletId}:${p.remainingDebtPaid}`,
    handler: async (payload, ctx) => {
      const lockKey = `lock:dlq:wallet_debt:${payload.walletId}`;
      const token = await acquireDistributedLock(lockKey, 60);
      if (!token) {
        throw new Error(`Could not acquire lock for wallet debt reconciliation on wallet ${payload.walletId}`);
      }

      try {
        const wallet = await prisma.wallet.findUnique({
          where: { id: payload.walletId },
        });

        if (!wallet) {
          throw AppError.notFound("Wallet not found");
        }

        // Check pending claims that need distribution
        const pendingClaims = await prisma.debtClaim.findMany({
          where: {
            debtorWalletId: payload.walletId,
            status: "PENDING",
            amount: { gt: 0 },
          },
          orderBy: { createdAt: "asc" },
        });

        if (pendingClaims.length === 0) {
          return {
            success: true,
            skippedDuplicate: true,
            result: { reason: "No pending claims found for debtor wallet" },
          };
        }

        let remainingToDistribute = payload.remainingDebtPaid;
        const updatedClaimIds: string[] = [];

        await prisma.$transaction(async (tx) => {
          for (const claim of pendingClaims) {
            if (remainingToDistribute <= 0) break;

            const allocation = Math.min(remainingToDistribute, claim.amount);
            const newAmount = claim.amount - allocation;
            const newStatus = newAmount === 0 ? "RECOVERED" : "PENDING";

            await tx.debtClaim.update({
              where: { id: claim.id },
              data: {
                amount: newAmount,
                status: newStatus as any,
              },
            });

            const creditorWallet = await tx.wallet.upsert({
              where: { userId: claim.creditorUserId },
              create: { userId: claim.creditorUserId, balance: allocation, pendingBalance: 0 },
              update: { balance: { increment: allocation } },
            });

            await tx.transaction.create({
              data: {
                walletId: creditorWallet.id,
                dealId: claim.dealId,
                amount: allocation,
                type: "REFUND",
                status: "COMPLETED",
                description: `Debt recovery distribution via DLQ for claim ${claim.id}`,
                metadata: { claimId: claim.id, debtorWalletId: payload.walletId, source: "DLQ_REPLAY" },
              },
            });

            remainingToDistribute -= allocation;
            updatedClaimIds.push(claim.id);
          }
        });

        if (ctx?.adminUserId) {
          await createActivityLog({
            userId: ctx.adminUserId,
            action: "DLQ_REPLAY_DEBT_DISTRIBUTION_SUCCESS",
            entityType: "WALLET",
            entityId: payload.walletId,
            metadata: {
              allocated: payload.remainingDebtPaid - remainingToDistribute,
              unallocated: remainingToDistribute,
              updatedClaimIds,
            },
          });
        }

        return {
          success: true,
          skippedDuplicate: false,
          result: { updatedClaimIds, distributed: payload.remainingDebtPaid - remainingToDistribute },
        };
      } finally {
        await releaseDistributedLock(lockKey, token);
      }
    },
  },

  // 5. shipping.unbilled_shipment_reconcile
  "shipping.unbilled_shipment_reconcile": {
    topic: "shipping.unbilled_shipment_reconcile",
    category: "time-critical",
    payloadSchema: ShippingUnbilledReconcilePayloadSchema,
    isMoneyImpacting: true,
    requiresAdminApproval: true,
    maxReplays: 3,
    idempotencyKeyFn: (p) => `dlq:topic:unbilled_shipment:${p.dealId}:${p.awbCode}`,
    handler: async (payload, ctx) => {
      const lockKey = `lock:dlq:shipping:${payload.dealId}`;
      const token = await acquireDistributedLock(lockKey, 60);
      if (!token) {
        throw new Error(`Could not acquire lock for shipping reconciliation on deal ${payload.dealId}`);
      }

      try {
        const deal = await prisma.deal.findUnique({
          where: { id: payload.dealId },
          include: {
            brand: {
              include: {
                user: {
                  include: { wallet: true },
                },
              },
            },
          },
        });

        if (!deal || !deal.brand?.user?.wallet) {
          throw AppError.notFound("Deal or brand wallet not found");
        }

        const brandWallet = deal.brand.user.wallet;

        // Check if transaction already recorded for this awbCode
        const existingTx = await prisma.transaction.findFirst({
          where: {
            dealId: payload.dealId,
            type: "DEBIT",
            description: { contains: payload.awbCode },
          },
        });

        if (existingTx) {
          return {
            success: true,
            skippedDuplicate: true,
            result: { reason: "Shipping charge already debited", transactionId: existingTx.id },
          };
        }

        const newTx = await prisma.$transaction(async (tx) => {
          await tx.wallet.update({
            where: { id: brandWallet.id },
            data: { balance: { decrement: payload.courierChargePaise } },
          });

          return tx.transaction.create({
            data: {
              walletId: brandWallet.id,
              dealId: payload.dealId,
              amount: payload.courierChargePaise,
              type: "DEBIT",
              status: "COMPLETED",
              description: `Courier charge for AWB ${payload.awbCode} replayed from DLQ`,
              metadata: {
                awbCode: payload.awbCode,
                source: "DLQ_REPLAY",
              },
            },
          });
        });

        if (ctx?.adminUserId) {
          await createActivityLog({
            userId: ctx.adminUserId,
            action: "DLQ_REPLAY_SHIPPING_RECONCILE_SUCCESS",
            entityType: "TRANSACTION",
            entityId: newTx.id,
            metadata: { dealId: payload.dealId, awbCode: payload.awbCode, amount: payload.courierChargePaise },
          });
        }

        return { success: true, skippedDuplicate: false, result: { transactionId: newTx.id } };
      } finally {
        await releaseDistributedLock(lockKey, token);
      }
    },
  },

  // 6. payment.route_cancel_refund_failed
  "payment.route_cancel_refund_failed": {
    topic: "payment.route_cancel_refund_failed",
    category: "time-critical",
    payloadSchema: RouteCancelRefundFailedPayloadSchema,
    isMoneyImpacting: true,
    requiresAdminApproval: true,
    maxReplays: 3,
    idempotencyKeyFn: (p) => `dlq:topic:cancel_refund:${p.dealId}`,
    handler: async (payload, ctx) => {
      const lockKey = `lock:dlq:cancel_refund:${payload.dealId}`;
      const token = await acquireDistributedLock(lockKey, 60);
      if (!token) {
        throw new Error(`Could not acquire lock for cancel refund on deal ${payload.dealId}`);
      }

      try {
        const hold = payload.paymentHoldId
          ? await prisma.paymentHold.findUnique({ where: { id: payload.paymentHoldId } })
          : await prisma.paymentHold.findUnique({ where: { dealId: payload.dealId } });

        const paymentId = payload.paymentId || hold?.razorpayPaymentId;
        const amount = payload.amount || hold?.amount;

        if (!paymentId || !amount) {
          throw new Error("Missing paymentId or amount to perform route cancel refund");
        }

        const existingTx = await prisma.transaction.findFirst({
          where: {
            dealId: payload.dealId,
            razorpayPaymentId: paymentId,
            type: "REFUND",
          },
        });

        if (existingTx) {
          return { success: true, skippedDuplicate: true, result: { reason: "Refund already processed" } };
        }

        const refundRes = await refundPayment({
          paymentId,
          amount,
          notes: { dealId: payload.dealId, reason: payload.reason || "Deal cancelled", source: "DLQ_REPLAY" },
        });

        if (ctx?.adminUserId) {
          await createActivityLog({
            userId: ctx.adminUserId,
            action: "DLQ_REPLAY_CANCEL_REFUND_SUCCESS",
            entityType: "DEAL",
            entityId: payload.dealId,
            metadata: { paymentId, amount },
          });
        }

        return { success: true, skippedDuplicate: false, result: { refundRes } };
      } finally {
        await releaseDistributedLock(lockKey, token);
      }
    },
  },

  // 7. payment.route_cancel_reverse_failed
  "payment.route_cancel_reverse_failed": {
    topic: "payment.route_cancel_reverse_failed",
    category: "time-critical",
    payloadSchema: RouteCancelReverseFailedPayloadSchema,
    isMoneyImpacting: true,
    requiresAdminApproval: true,
    maxReplays: 3,
    idempotencyKeyFn: (p) => `dlq:topic:cancel_reverse:${p.dealId}:${p.transferId}`,
    handler: async (payload, ctx) => {
      const lockKey = `lock:dlq:cancel_reverse:${payload.dealId}`;
      const token = await acquireDistributedLock(lockKey, 60);
      if (!token) {
        throw new Error(`Could not acquire lock for cancel reverse on deal ${payload.dealId}`);
      }

      try {
        const hold = payload.paymentHoldId
          ? await prisma.paymentHold.findUnique({ where: { id: payload.paymentHoldId } })
          : await prisma.paymentHold.findUnique({ where: { dealId: payload.dealId } });

        const amount = payload.amount || hold?.amount;
        if (!amount) {
          throw new Error("Missing amount to perform route cancel reverse");
        }

        const reverseRes = await reverseTransfer({
          transferId: payload.transferId,
          amount,
          notes: { dealId: payload.dealId, reason: payload.reason || "Deal cancelled", source: "DLQ_REPLAY" },
        });

        if (ctx?.adminUserId) {
          await createActivityLog({
            userId: ctx.adminUserId,
            action: "DLQ_REPLAY_CANCEL_REVERSE_SUCCESS",
            entityType: "DEAL",
            entityId: payload.dealId,
            metadata: { transferId: payload.transferId, amount },
          });
        }

        return { success: true, skippedDuplicate: false, result: { reverseRes } };
      } finally {
        await releaseDistributedLock(lockKey, token);
      }
    },
  },

  // 8. reconciliation.gateway_mismatch
  "reconciliation.gateway_mismatch": {
    topic: "reconciliation.gateway_mismatch",
    category: "time-critical",
    payloadSchema: ReconciliationGatewayMismatchPayloadSchema,
    isMoneyImpacting: true,
    requiresAdminApproval: true,
    isManualOnly: true,
    runbookNote:
      "Gateway payment mismatch indicates a discrepancy between Razorpay and internal ledger. Manual investigation required: verify bank statement, inspect Razorpay dashboard for chargebacks or reversals, and execute manual ledger adjustment if approved.",
    maxReplays: 0,
    idempotencyKeyFn: (p) => `dlq:topic:recon_mismatch:${p.paymentId}`,
    handler: async (_payload) => {
      throw new Error(
        "reconciliation.gateway_mismatch is manual-only and cannot be auto-replayed. Refer to runbook for resolution."
      );
    },
  },

  // 9. email.withdrawal
  "email.withdrawal": {
    topic: "email.withdrawal",
    category: "best-effort",
    payloadSchema: EmailWithdrawalPayloadSchema,
    isMoneyImpacting: false,
    requiresAdminApproval: false,
    maxReplays: 5,
    idempotencyKeyFn: (p) => `dlq:topic:email_withdrawal:${p.withdrawalId}`,
    handler: async (payload) => {
      const withdrawal = await prisma.withdrawal.findUnique({
        where: { id: payload.withdrawalId },
        include: { wallet: { include: { user: { select: { email: true } } } } },
      });

      if (withdrawal?.wallet.user.email) {
        await sendWithdrawalEmail(
          withdrawal.wallet.user.email,
          withdrawal.amount,
          withdrawal.status === "COMPLETED" ? "success" : "failed"
        );
        return { success: true, result: { sentTo: withdrawal.wallet.user.email } };
      }
      return { success: true, skippedDuplicate: true, result: { reason: "No email address found" } };
    },
  },

  // 10. gamification.evaluate_badges
  "gamification.evaluate_badges": {
    topic: "gamification.evaluate_badges",
    category: "best-effort",
    payloadSchema: GamificationBadgesPayloadSchema,
    isMoneyImpacting: false,
    requiresAdminApproval: false,
    maxReplays: 5,
    idempotencyKeyFn: (p) => `dlq:topic:badges:${p.userId}:${p.action || "LOGIN"}`,
    handler: async (payload) => {
      const trigger = (payload.action as Parameters<typeof checkAndAwardBadges>[1]) || "LOGIN";
      await checkAndAwardBadges(payload.userId, trigger);
      return { success: true, result: { userId: payload.userId, trigger } };
    },
  },

  // 11. gamification.evaluate_challenge
  "gamification.evaluate_challenge": {
    topic: "gamification.evaluate_challenge",
    category: "best-effort",
    payloadSchema: GamificationChallengePayloadSchema,
    isMoneyImpacting: false,
    requiresAdminApproval: false,
    maxReplays: 5,
    idempotencyKeyFn: (p) => `dlq:topic:challenge:${p.userId}:${p.action}`,
    handler: async (payload) => {
      const metricValue = typeof payload.metadata?.metricValue === "number" ? payload.metadata.metricValue : 1;
      await checkChallengeProgress(payload.userId, payload.action as Parameters<typeof checkChallengeProgress>[1], metricValue);
      return { success: true, result: { userId: payload.userId, action: payload.action } };
    },
  },

  // 12. deal.auto_approve_timeout / cron.auto_approve_timeout
  "deal.auto_approve_timeout": {
    topic: "deal.auto_approve_timeout",
    category: "scheduled",
    payloadSchema: AutoApproveTimeoutPayloadSchema,
    isMoneyImpacting: false,
    requiresAdminApproval: false,
    maxReplays: 5,
    idempotencyKeyFn: () => `dlq:topic:auto_approve:${Date.now()}`,
    handler: async () => {
      const result = await DealService.autoApproveExpiredContent();
      return { success: true, result };
    },
  },
  "cron.auto_approve_timeout": {
    topic: "cron.auto_approve_timeout",
    category: "scheduled",
    payloadSchema: AutoApproveTimeoutPayloadSchema,
    isMoneyImpacting: false,
    requiresAdminApproval: false,
    maxReplays: 5,
    idempotencyKeyFn: () => `dlq:topic:auto_approve:${Date.now()}`,
    handler: async () => {
      const result = await DealService.autoApproveExpiredContent();
      return { success: true, result };
    },
  },

  // 13. test.deliberate_failure
  "test.deliberate_failure": {
    topic: "test.deliberate_failure",
    category: "best-effort",
    payloadSchema: TestDeliberateFailurePayloadSchema,
    isMoneyImpacting: false,
    requiresAdminApproval: false,
    maxReplays: 0,
    idempotencyKeyFn: () => `dlq:topic:test_failure:${Date.now()}`,
    handler: async (payload) => {
      throw new Error(`Deliberate failure triggered for test: ${payload.metadata?.reason || "Testing DLQ"}`);
    },
  },
};

export type JobTopicName = keyof typeof JOB_TOPICS_REGISTRY;

export function getTopicDefinition(topic: string): JobTopicDefinition<any> | undefined {
  return JOB_TOPICS_REGISTRY[topic];
}

export async function executeJobTopicHandler(
  topic: string,
  payload: unknown,
  ctx?: { dlqId?: string; adminUserId?: string }
): Promise<{ success: boolean; skippedDuplicate?: boolean; result?: unknown }> {
  const def = getTopicDefinition(topic);
  if (!def) {
    logger.critical("Unknown job topic encountered in DLQ/Consumer dispatcher", { topic });
    throw new Error(`Unknown job topic: ${topic}`);
  }

  if (def.isManualOnly) {
    logger.warn("Attempted automated execution of manual-only job topic", { topic, runbook: def.runbookNote });
    throw new Error(`Job topic ${topic} is marked manual-only: ${def.runbookNote || "No automated replay available"}`);
  }

  const parsed = def.payloadSchema.parse(payload);

  if (!def.handler) {
    logger.critical("Job topic definition missing handler implementation", { topic });
    throw new Error(`Handler missing for job topic: ${topic}`);
  }

  return await def.handler(parsed, ctx);
}
