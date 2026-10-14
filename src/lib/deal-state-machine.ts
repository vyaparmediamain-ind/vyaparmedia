import { DealStatus, Prisma } from "@prisma/client";
import prisma from "./db";
import { AppError } from "./errors";
import { logger } from "./logger";
import { createActivityLog } from "./audit";
import { creditInfluencerPayoutWithTax, recordPlatformFeeRevenue } from "./deal-settlement";

export type DealActorRole = "BRAND" | "INFLUENCER" | "ADMIN" | "SYSTEM";

export interface DealActor {
  userId: string;
  role: DealActorRole;
}

export type FinancialEffect = "LOCK_ESCROW" | "RELEASE_ESCROW" | "REFUND_ESCROW" | "NONE";

export interface StateTransitionRule {
  to: DealStatus;
  allowedRoles: DealActorRole[];
  financialEffect?: FinancialEffect;
  requiresReason?: boolean;
}

/**
 * Declarative Deal State Transition Matrix (Matrix as Data)
 * Defines every valid status edge, authorized roles, and financial side-effects.
 */
export const DEAL_TRANSITION_MATRIX: Record<DealStatus, StateTransitionRule[]> = {
  PENDING_SIGNATURE: [
    { to: "ACTIVE", allowedRoles: ["BRAND", "INFLUENCER", "SYSTEM", "ADMIN"], financialEffect: "NONE" },
    { to: "PAYMENT_PENDING", allowedRoles: ["BRAND", "INFLUENCER", "SYSTEM", "ADMIN"], financialEffect: "NONE" },
    { to: "PAYMENT_HELD", allowedRoles: ["SYSTEM", "BRAND", "ADMIN"], financialEffect: "LOCK_ESCROW" },
    { to: "CANCELLED", allowedRoles: ["BRAND", "INFLUENCER", "ADMIN"], financialEffect: "REFUND_ESCROW" },
  ],
  PAYMENT_PENDING: [
    { to: "PAYMENT_HELD", allowedRoles: ["SYSTEM", "BRAND", "ADMIN"], financialEffect: "LOCK_ESCROW" },
    { to: "ACTIVE", allowedRoles: ["SYSTEM", "BRAND", "ADMIN"], financialEffect: "LOCK_ESCROW" },
    { to: "CANCELLED", allowedRoles: ["BRAND", "ADMIN", "SYSTEM"], financialEffect: "NONE" },
  ],
  PAYMENT_HELD: [
    { to: "ACTIVE", allowedRoles: ["SYSTEM", "BRAND", "ADMIN"], financialEffect: "NONE" },
    { to: "CONTENT_SUBMITTED", allowedRoles: ["INFLUENCER", "ADMIN"], financialEffect: "NONE" },
    { to: "CANCELLED", allowedRoles: ["BRAND", "ADMIN"], financialEffect: "REFUND_ESCROW" },
    { to: "DISPUTED", allowedRoles: ["BRAND", "INFLUENCER", "ADMIN"], financialEffect: "NONE", requiresReason: true },
  ],
  ACTIVE: [
    { to: "CONTENT_SUBMITTED", allowedRoles: ["INFLUENCER", "ADMIN"], financialEffect: "NONE" },
    { to: "DISPUTED", allowedRoles: ["BRAND", "INFLUENCER", "ADMIN"], financialEffect: "NONE", requiresReason: true },
    { to: "CANCELLED", allowedRoles: ["BRAND", "ADMIN"], financialEffect: "REFUND_ESCROW" },
  ],
  CONTENT_SUBMITTED: [
    { to: "CONTENT_APPROVED", allowedRoles: ["BRAND", "SYSTEM", "ADMIN"], financialEffect: "NONE" },
    { to: "REVISION_REQUESTED", allowedRoles: ["BRAND", "ADMIN"], financialEffect: "NONE", requiresReason: true },
    { to: "DISPUTED", allowedRoles: ["BRAND", "INFLUENCER", "ADMIN"], financialEffect: "NONE", requiresReason: true },
    { to: "CANCELLED", allowedRoles: ["BRAND", "ADMIN"], financialEffect: "REFUND_ESCROW" },
  ],
  REVISION_REQUESTED: [
    { to: "CONTENT_SUBMITTED", allowedRoles: ["INFLUENCER", "ADMIN"], financialEffect: "NONE" },
    { to: "DISPUTED", allowedRoles: ["BRAND", "INFLUENCER", "ADMIN"], financialEffect: "NONE", requiresReason: true },
    { to: "CANCELLED", allowedRoles: ["BRAND", "ADMIN"], financialEffect: "REFUND_ESCROW" },
  ],
  CONTENT_APPROVED: [
    { to: "POSTED", allowedRoles: ["INFLUENCER", "ADMIN"], financialEffect: "NONE" },
    { to: "VERIFIED", allowedRoles: ["INFLUENCER", "SYSTEM", "ADMIN", "BRAND"], financialEffect: "NONE" },
    { to: "VERIFICATION_PENDING", allowedRoles: ["INFLUENCER", "SYSTEM", "ADMIN"], financialEffect: "NONE" },
    { to: "COMPLETED", allowedRoles: ["SYSTEM", "ADMIN", "BRAND"], financialEffect: "RELEASE_ESCROW" },
    { to: "DISPUTED", allowedRoles: ["BRAND", "INFLUENCER", "ADMIN", "SYSTEM"], financialEffect: "NONE", requiresReason: true },
    { to: "CANCELLED", allowedRoles: ["BRAND", "ADMIN"], financialEffect: "REFUND_ESCROW" },
  ],
  POSTED: [
    { to: "VERIFICATION_PENDING", allowedRoles: ["INFLUENCER", "SYSTEM", "ADMIN"], financialEffect: "NONE" },
    { to: "VERIFIED", allowedRoles: ["SYSTEM", "ADMIN", "BRAND"], financialEffect: "NONE" },
    { to: "COMPLETED", allowedRoles: ["SYSTEM", "ADMIN", "BRAND"], financialEffect: "RELEASE_ESCROW" },
    { to: "DISPUTED", allowedRoles: ["BRAND", "INFLUENCER", "ADMIN", "SYSTEM"], financialEffect: "NONE", requiresReason: true },
  ],
  VERIFICATION_PENDING: [
    { to: "VERIFIED", allowedRoles: ["SYSTEM", "ADMIN", "BRAND"], financialEffect: "NONE" },
    { to: "POSTED", allowedRoles: ["SYSTEM", "ADMIN"], financialEffect: "NONE" },
    { to: "DISPUTED", allowedRoles: ["BRAND", "INFLUENCER", "ADMIN", "SYSTEM"], financialEffect: "NONE", requiresReason: true },
  ],
  VERIFIED: [
    { to: "COMPLETED", allowedRoles: ["SYSTEM", "ADMIN", "BRAND"], financialEffect: "RELEASE_ESCROW" },
    { to: "DISPUTED", allowedRoles: ["BRAND", "INFLUENCER", "ADMIN", "SYSTEM"], financialEffect: "NONE", requiresReason: true },
  ],
  DISPUTED: [
    { to: "COMPLETED", allowedRoles: ["ADMIN"], financialEffect: "RELEASE_ESCROW" },
    { to: "CANCELLED", allowedRoles: ["ADMIN"], financialEffect: "REFUND_ESCROW" },
    // Dispute restore transitions (dismissed by mediator or withdrawn by raising party via system arbitration)
    { to: "ACTIVE", allowedRoles: ["ADMIN", "SYSTEM"], financialEffect: "NONE" },
    { to: "PAYMENT_HELD", allowedRoles: ["ADMIN", "SYSTEM"], financialEffect: "NONE" },
    { to: "CONTENT_SUBMITTED", allowedRoles: ["ADMIN", "SYSTEM"], financialEffect: "NONE" },
    { to: "REVISION_REQUESTED", allowedRoles: ["ADMIN", "SYSTEM"], financialEffect: "NONE" },
    { to: "CONTENT_APPROVED", allowedRoles: ["ADMIN", "SYSTEM"], financialEffect: "NONE" },
    { to: "POSTED", allowedRoles: ["ADMIN", "SYSTEM"], financialEffect: "NONE" },
    { to: "VERIFICATION_PENDING", allowedRoles: ["ADMIN", "SYSTEM"], financialEffect: "NONE" },
    { to: "VERIFIED", allowedRoles: ["ADMIN", "SYSTEM"], financialEffect: "NONE" },
  ],
  // Terminal States — No transitions permitted out of COMPLETED or CANCELLED
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Returns true if the deal status has locked/held escrow active.
 */
export function isEscrowLockedStatus(status: DealStatus): boolean {
  return [
    "PAYMENT_HELD",
    "ACTIVE",
    "CONTENT_SUBMITTED",
    "REVISION_REQUESTED",
    "CONTENT_APPROVED",
    "POSTED",
    "VERIFICATION_PENDING",
    "VERIFIED",
  ].includes(status);
}

/**
 * Returns true if the deal status allows filing a dispute according to DEAL_TRANSITION_MATRIX.
 */
export function isDisputeAllowedStatus(status: DealStatus): boolean {
  const transitions = DEAL_TRANSITION_MATRIX[status] || [];
  return transitions.some((t) => t.to === "DISPUTED");
}

/**
 * Checks whether an actor role is authorized to trigger a specific state transition.
 */
export function canRoleTransition(
  fromState: DealStatus,
  toState: DealStatus,
  role: DealActorRole,
): boolean {
  const transitions = DEAL_TRANSITION_MATRIX[fromState] || [];
  const rule = transitions.find((t) => t.to === toState);
  return !!rule && rule.allowedRoles.includes(role);
}

/**
 * Returns all configured transition rules available from the given state.
 */
export function getAllowedTransitions(fromState: DealStatus): StateTransitionRule[] {
  return DEAL_TRANSITION_MATRIX[fromState] || [];
}

/**
 * Checks whether a state transition is possible (optionally verifying role authorization).
 */
export function canTransition(
  fromState: DealStatus,
  toState: DealStatus,
  role?: DealActorRole,
): boolean {
  if (role) {
    return canRoleTransition(fromState, toState, role);
  }
  const transitions = DEAL_TRANSITION_MATRIX[fromState] || [];
  return transitions.some((t) => t.to === toState);
}


export interface DealTransitionParams {
  dealId: string;
  fromState?: DealStatus | undefined;
  toState: DealStatus;
  actor: DealActor;
  reason?: string | undefined;
  financialHandler?: ((tx: Prisma.TransactionClient, deal: Record<string, unknown>) => Promise<void>) | undefined;
  metadata?: Record<string, unknown> | undefined;
  tx?: Prisma.TransactionClient | undefined;
}

export interface DealTransitionResult {
  success: boolean;
  dealId: string;
  fromState: DealStatus;
  toState: DealStatus;
  financialEffect: FinancialEffect;
  transitionedAt: Date;
}

/**
 * Central State Machine Coordinator
 * All deal status changes across the platform must route through this function.
 * Enforces valid transition edges, role permissions, atomic financial coupling, and audit logging.
 */
export async function transitionDealState(
  params: DealTransitionParams,
): Promise<DealTransitionResult> {
  const { dealId, fromState, toState, actor, reason, financialHandler, metadata, tx: existingTx } = params;

  const executeInsideTx = async (tx: Prisma.TransactionClient): Promise<DealTransitionResult> => {
    // 1. Lock the Deal row to serialize concurrent transition attempts
    await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${dealId} FOR UPDATE`;

    const deal = await tx.deal.findUnique({
      where: { id: dealId },
      include: {
        campaign: { select: { id: true, brandId: true, totalBudget: true, fundedAmount: true } },
        influencer: { select: { id: true, userId: true } },
        brand: { select: { id: true, userId: true } },
      },
    });

    if (!deal) {
      throw AppError.notFound(`Deal with ID ${dealId} not found`);
    }

    const currentState = deal.status;

    // 2. Terminal-State Guard: If already in terminal state, reject transition
    if (["COMPLETED", "CANCELLED"].includes(currentState)) {
      throw AppError.badRequest(
        `TERMINAL_STATE_LOCKED: Deal is already in terminal state ${currentState} and cannot transition to ${toState}.`,
      );
    }

    // 3. Optional Expected fromState Guard
    if (fromState && currentState !== fromState) {
      throw AppError.badRequest(
        `STATE_MISMATCH: Expected deal to be in state ${fromState}, but current state is ${currentState}.`,
      );
    }

    // 4. Validate transition rule from the transition matrix
    const allowedTransitions = DEAL_TRANSITION_MATRIX[currentState] || [];
    const transitionRule = allowedTransitions.find((rule) => rule.to === toState);

    if (!transitionRule) {
      throw AppError.badRequest(
        `INVALID_DEAL_TRANSITION: Transition from '${currentState}' to '${toState}' is not permitted in the deal lifecycle state machine.`,
      );
    }

    // 5. Check role-based permission
    if (!transitionRule.allowedRoles.includes(actor.role)) {
      throw AppError.forbidden(
        `TRANSITION_NOT_PERMITTED_FOR_ROLE: Role '${actor.role}' is not authorized to transition deal from '${currentState}' to '${toState}'. Allowed roles: [${transitionRule.allowedRoles.join(", ")}].`,
      );
    }

    // 6. Reason requirement check
    if (transitionRule.requiresReason && (!reason || reason.trim().length === 0)) {
      throw AppError.badRequest(
        `REASON_REQUIRED: A valid explanation reason is mandatory when transitioning from '${currentState}' to '${toState}'.`,
      );
    }

    const financialEffect = transitionRule.financialEffect || "NONE";

    // 7. Atomic Financial Side-Effect Execution
    if (financialHandler) {
      await financialHandler(tx, deal);
    } else if (financialEffect === "LOCK_ESCROW") {
      const brandUserId = deal.brand?.userId;
      if (brandUserId && deal.totalAmount > 0) {
        const updateCount = await tx.wallet.updateMany({
          where: {
            userId: brandUserId,
            balance: { gte: deal.totalAmount },
            isFrozen: false,
          },
          data: {
            balance: { decrement: deal.totalAmount },
            pendingBalance: { increment: deal.totalAmount },
          },
        });

        if (updateCount.count === 0) {
          throw AppError.badRequest(
            "INSUFFICIENT_FUNDS_FOR_ESCROW: Brand wallet has insufficient balance or is frozen to lock escrow.",
          );
        }

        const brandWallet = await tx.wallet.findUniqueOrThrow({ where: { userId: brandUserId } });
        await tx.transaction.create({
          data: {
            walletId: brandWallet.id,
            dealId: deal.id,
            type: "DEBIT",
            amount: deal.totalAmount,
            status: "COMPLETED",
            description: `Escrow funds locked for deal: ${deal.id}`,
            metadata: {
              action: "ESCROW_LOCK",
              dealId: deal.id,
              financialEffect: "LOCK_ESCROW",
            },
          },
        });
      }
    } else if (financialEffect === "RELEASE_ESCROW") {
      const brandUserId = deal.brand?.userId;
      const influencerUserId = deal.influencer?.userId;
      if (deal.totalAmount > 0 && brandUserId && influencerUserId) {
        const brandWallet = await tx.wallet.findUnique({ where: { userId: brandUserId } });
        if (brandWallet && brandWallet.pendingBalance >= deal.totalAmount) {
          const releaseCount = await tx.wallet.updateMany({
            where: { id: brandWallet.id, pendingBalance: { gte: deal.totalAmount } },
            data: {
              pendingBalance: { decrement: deal.totalAmount },
              totalSpent: { increment: deal.totalAmount },
            },
          });
          if (releaseCount.count === 0) {
            throw AppError.badRequest(
              "INSUFFICIENT_PENDING_ESCROW: Brand wallet pending escrow is insufficient to release payout.",
            );
          }
        }

        const influencerPayout = deal.influencerPayout ?? deal.amount;
        const isDirectGatewaySettlement = Boolean(
          metadata?.routeEscrowReleased || metadata?.directGatewaySettlement,
        );
        await creditInfluencerPayoutWithTax(tx, {
          userId: influencerUserId,
          dealId: deal.id,
          grossPayout: influencerPayout,
          description: isDirectGatewaySettlement
            ? `Direct gateway settlement released for completed deal: ${deal.id}`
            : `Payout released for completed deal: ${deal.id}`,
          metadata: {
            action: "ESCROW_RELEASE",
            dealId: deal.id,
            financialEffect: "RELEASE_ESCROW",
            balanceImpact: !isDirectGatewaySettlement,
            directGatewaySettlement: isDirectGatewaySettlement,
          },
          balanceImpact: !isDirectGatewaySettlement,
        });

        await recordPlatformFeeRevenue(tx, {
          brandUserId,
          deal,
          source: "deal_state_machine",
        });
      }
    } else if (financialEffect === "REFUND_ESCROW") {
      const brandUserId = deal.brand?.userId;
      if (brandUserId && deal.totalAmount > 0) {
        const brandWallet = await tx.wallet.findUnique({ where: { userId: brandUserId } });
        if (brandWallet && brandWallet.pendingBalance >= deal.totalAmount) {
          const refundCount = await tx.wallet.updateMany({
            where: { id: brandWallet.id, pendingBalance: { gte: deal.totalAmount } },
            data: {
              pendingBalance: { decrement: deal.totalAmount },
              balance: { increment: deal.totalAmount },
            },
          });

          if (refundCount.count === 0) {
            throw AppError.badRequest(
              "INSUFFICIENT_PENDING_ESCROW: Brand wallet pending escrow is insufficient to refund.",
            );
          }

          await tx.transaction.create({
            data: {
              walletId: brandWallet.id,
              dealId: deal.id,
              type: "CREDIT",
              amount: deal.totalAmount,
              status: "COMPLETED",
              description: `Escrow refunded to brand for deal: ${deal.id}`,
              metadata: {
                action: "ESCROW_REFUND",
                dealId: deal.id,
                financialEffect: "REFUND_ESCROW",
              },
            },
          });
        }
      }
    }

    const now = new Date();

    // 8. Atomically update the Deal status
    const updateData: Prisma.DealUpdateInput = {
      status: toState,
    };

    if (toState === "ACTIVE" && !deal.startedAt) {
      updateData.startedAt = now;
    } else if (toState === "CONTENT_APPROVED") {
      updateData.approvedAt = now;
    } else if (toState === "POSTED") {
      updateData.postedAt = now;
    } else if (toState === "VERIFIED") {
      updateData.verifiedAt = now;
    } else if (toState === "COMPLETED") {
      updateData.completedAt = now;
    }

    await tx.deal.update({
      where: { id: dealId },
      data: updateData,
    });

    // 9. Record Immutable Audit Log
    // If actor is SYSTEM and actor.userId is a pseudo-id like "SYSTEM_PAYMENT",
    // fallback to deal.influencer.userId or deal.brand.userId so the ActivityLog_userId FK constraint is satisfied.
    let logUserId = actor.userId;
    if (actor.role === "SYSTEM" && (!logUserId || logUserId.startsWith("SYSTEM"))) {
      logUserId = deal.influencer.userId || deal.brand?.userId || actor.userId;
    }

    await createActivityLog(
      {
        userId: logUserId,
        action: "DEAL_STATUS_TRANSITION",
        entityType: "Deal",
        entityId: dealId,
        metadata: {
          fromState: currentState,
          toState,
          actorRole: actor.role,
          actorUserId: actor.userId,
          financialEffect,
          reason: reason || null,
          ...(metadata || {}),
        },
      },
      tx,
    );

    logger.info("Deal state machine transition completed", {
      dealId,
      fromState: currentState,
      toState,
      actorRole: actor.role,
      financialEffect,
    });

    return {
      success: true,
      dealId,
      fromState: currentState,
      toState,
      financialEffect,
      transitionedAt: now,
    };
  };

  if (existingTx) {
    return executeInsideTx(existingTx);
  }

  return prisma.$transaction(executeInsideTx, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10000,
    timeout: 25000,
  });
}
