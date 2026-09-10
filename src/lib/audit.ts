import prisma from "./db";
import { Prisma } from "@prisma/client";
import { logger, maskPII } from "./logger";

export enum ActivityAction {
  // Auth Events
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  REGISTER = "REGISTER",
  PASSWORD_RESET = "PASSWORD_RESET",
  TWO_FACTOR_ENABLED = "TWO_FACTOR_ENABLED",
  TWO_FACTOR_DISABLED = "TWO_FACTOR_DISABLED",
  // Campaign Events
  CAMPAIGN_CREATE = "CAMPAIGN_CREATE",
  CREATE_CAMPAIGN = "CREATE_CAMPAIGN",
  CAMPAIGN_UPDATE = "CAMPAIGN_UPDATE",
  ACTIVATE_CAMPAIGN = "ACTIVATE_CAMPAIGN",
  CAMPAIGN_PAUSE = "CAMPAIGN_PAUSE",
  CAMPAIGN_CANCEL = "CAMPAIGN_CANCEL",
  CANCEL_CAMPAIGN = "CANCEL_CAMPAIGN",
  // Application Events
  APPLICATION_SUBMIT = "APPLICATION_SUBMIT",
  SUBMIT_APPLICATION = "SUBMIT_APPLICATION",
  APPLICATION_ACCEPT = "APPLICATION_ACCEPT",
  ACCEPT_APPLICATION = "ACCEPT_APPLICATION",
  APPLICATION_REJECT = "APPLICATION_REJECT",
  REJECT_APPLICATION = "REJECT_APPLICATION",
  // Deal Events
  DEAL_CREATE = "DEAL_CREATE",
  DEAL_UPDATE = "DEAL_UPDATE",
  DEAL_SIGN = "DEAL_SIGN",
  CONTRACT_SIGNED = "CONTRACT_SIGNED",
  DEAL_CANCEL = "DEAL_CANCEL",
  CANCEL_DEAL = "CANCEL_DEAL",
  REJECT_DEAL_INVITE = "REJECT_DEAL_INVITE",
  DEAL_COMPLETE = "DEAL_COMPLETE",
  POST_STATUS_CHANGE = "POST_STATUS_CHANGE",
  // Payment Events
  PAYMENT_INITIATED = "PAYMENT_INITIATED",
  PAYMENT_COMPLETED = "PAYMENT_COMPLETED",
  PAYMENT_REFUNDED = "PAYMENT_REFUNDED",
  WITHDRAWAL_REQUESTED = "WITHDRAWAL_REQUESTED",
  PAYOUT_HELD_DUE_TO_VIOLATION = "PAYOUT_HELD_DUE_TO_VIOLATION",
  // Dispute Events
  DISPUTE_RAISED = "DISPUTE_RAISED",
  DISPUTE_RESOLVED = "DISPUTE_RESOLVED",
  DISPUTE_RESOLUTION = "DISPUTE_RESOLUTION",
  // Review Events
  REVIEW_SUBMITTED = "REVIEW_SUBMITTED",
  // Profile Events
  PROFILE_UPDATE = "PROFILE_UPDATE",
  CONTACT_CHANGED = "CONTACT_CHANGED",
  ACCOUNT_DELETION = "ACCOUNT_DELETION",
  UPDATE_INDIA_TAX_COMPLIANCE = "UPDATE_INDIA_TAX_COMPLIANCE",
  KYC_SUBMITTED = "KYC_SUBMITTED",
  KYC_APPROVED = "KYC_APPROVED",
  KYC_REJECTED = "KYC_REJECTED",
  DRS_UPDATE = "DRS_UPDATE",
  // Security Events
  SECURITY_ALERT = "SECURITY_ALERT",
  SECURITY_LEDGER_ALERT = "SECURITY_LEDGER_ALERT",
  SECURITY_LEDGER_AUTO_CORRECTED = "SECURITY_LEDGER_AUTO_CORRECTED",
  ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED",
  ACCOUNT_BANNED = "ACCOUNT_BANNED",
  ACCOUNT_ACTIVATED = "ACCOUNT_ACTIVATED",
  TRUST_ADJUSTED = "TRUST_ADJUSTED",
  VERIFICATION_UPDATED = "VERIFICATION_UPDATED",
  TEMP_SUSPENSION = "TEMP_SUSPENSION",
  PERMANENT_BAN = "PERMANENT_BAN",
  XP_AWARDED = "XP_AWARDED",
  CHALLENGE_COMPLETED = "CHALLENGE_COMPLETED",
}

export interface ActivityLogParams {
  userId: string;
  action: ActivityAction | string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function createActivityLog(
  params: ActivityLogParams,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;

  if (!params.userId || !params.action) {
    logger.warn("[Audit] createActivityLog called with missing required fields", { params });
    return;
  }

  const normalizedAction = params.action.toString();
  const normalizedEntityType = (params.entityType || "USER").toUpperCase();
  const maskedMetadata = params.metadata
    ? (maskPII(params.metadata) as Prisma.InputJsonValue)
    : ({} as Prisma.InputJsonValue);

  const data: Prisma.ActivityLogUncheckedCreateInput = {
    userId: params.userId,
    action: normalizedAction,
    metadata: maskedMetadata,
  };

  if (params.entityType !== undefined) data.entityType = params.entityType;
  if (params.entityId !== undefined) data.entityId = params.entityId;
  if (params.ipAddress !== undefined) data.ipAddress = params.ipAddress;

  const activityPromise = client.activityLog.create({ data });

  // Concurrently write to AuditLog so all system and user activities are visible in the Admin Audit Logs panel
  const auditPromise = client.auditLog.create({
    data: {
      actorId: params.userId,
      actionType: params.action.toString(),
      entityType: normalizedEntityType,
      entityId: params.entityId || params.userId,
      afterJSON: maskedMetadata ?? Prisma.JsonNull,
      ipAddress: params.ipAddress ?? null,
    },
  }).catch((err) => {
    logger.warn("[Audit] Failed to mirror activity to AuditLog", { error: err });
    return null;
  });

  const [activity] = await Promise.all([activityPromise, auditPromise]);
  return activity;
}

export interface AuditLogParams {
  actorId: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  beforeJSON?: Record<string, unknown> | null;
  afterJSON?: Record<string, unknown> | null;
  ipAddress?: string;
}

export async function createAuditLog(
  params: AuditLogParams,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;

  if (!params.actorId || !params.actionType || !params.entityType) {
    logger.warn("[Audit] createAuditLog called with missing required fields", { params });
    return;
  }

  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorId: params.actorId,
    actionType: params.actionType,
    entityType: params.entityType.toUpperCase(),
    entityId: params.entityId || params.actorId,
    beforeJSON: params.beforeJSON ? (maskPII(params.beforeJSON) as Prisma.InputJsonValue) : Prisma.JsonNull,
    afterJSON: params.afterJSON ? (maskPII(params.afterJSON) as Prisma.InputJsonValue) : Prisma.JsonNull,
  };

  if (params.ipAddress !== undefined) data.ipAddress = params.ipAddress;

  return client.auditLog.create({ data });
}
