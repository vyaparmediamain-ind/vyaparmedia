import prisma from "../db";
import { logger } from "../logger";
import {
  TRUST_SCORE_REVIEW_THRESHOLD,
  RAPID_FIRE_WITHDRAWAL_WINDOW_SECONDS,
  RAPID_FIRE_WITHDRAWAL_MAX_COUNT,
  NEW_ACCOUNT_AGE_DAYS_THRESHOLD,
  NEW_ACCOUNT_LARGE_WITHDRAWAL_THRESHOLD_PAISE,
} from "@/constants";
import { FraudCheckResult, FraudFlag, PaymentCheckParams } from "./types";
import {
checkWithdrawalVelocityAndLimits,
checkDuplicatePayoutAccounts,
checkMultipleBankAccounts,
} from "./application";

import { getTrustRuleWeights } from "../trust-rules";
import { hasMatchingNameTokens } from "../kyc";
import { redis } from "../redis";

export async function checkPaymentFraud(
  params: PaymentCheckParams,
): Promise<FraudCheckResult> {
  const flags: FraudFlag[] = [];
  let riskScore = 0;

  // Fetch dynamic table-driven rule weights
  const ruleWeights = await getTrustRuleWeights();

  riskScore += await checkWithdrawalVelocityAndLimits(params.userId, params.amount, flags);
  riskScore += await checkDuplicatePayoutAccounts(params.userId, params.bankAccount, params.upiId, flags);
  riskScore += await checkMultipleBankAccounts(params.userId, params.bankAccount, flags);

  // Rule 4: Rapid-fire withdrawals in a 10-minute window
  const recent10mWithdrawals = await prisma.withdrawal.count({
    where: {
      wallet: { userId: params.userId },
      status: { notIn: ["FAILED", "REVERSED"] },
      createdAt: { gte: new Date(Date.now() - RAPID_FIRE_WITHDRAWAL_WINDOW_SECONDS * 1000) },
    },
  });
  if (recent10mWithdrawals >= RAPID_FIRE_WITHDRAWAL_MAX_COUNT) {
    const rapidFireWeight = ruleWeights["FRAUD_RAPID_FIRE_WITHDRAWAL"] ?? 40;
    flags.push({
      rule: "RAPID_FIRE_WITHDRAWAL",
      severity: "HIGH",
      description: `${recent10mWithdrawals} withdrawal attempts detected in the last ${RAPID_FIRE_WITHDRAWAL_WINDOW_SECONDS / 60} minutes`,
    });
    riskScore += rapidFireWeight;
  }

  // Rule 5: Bank account holder name vs verified KYC name mismatch
  if (params.bankAccountName) {
    const [verifiedDoc, user, latestBank] = await Promise.all([
      prisma.verificationDocument.findFirst({
        where: { userId: params.userId, status: "VERIFIED" },
        select: { metadata: true },
        orderBy: { verifiedAt: "desc" },
      }),
      prisma.user.findUnique({
        where: { id: params.userId },
        select: {
          createdAt: true,
          trustScore: true,
          influencerProfile: { select: { displayName: true } },
          brandProfile: { select: { companyName: true } },
        },
      }),
      prisma.bankAccount.findFirst({
        where: { userId: params.userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    const docMeta = (verifiedDoc?.metadata as Record<string, unknown>) || {};
    const kycName =
      (typeof docMeta.fullName === "string" ? docMeta.fullName : null) ||
      (typeof docMeta.name === "string" ? docMeta.name : null) ||
      (typeof docMeta.verifiedName === "string" ? docMeta.verifiedName : null) ||
      user?.influencerProfile?.displayName ||
      user?.brandProfile?.companyName;

    if (kycName && !hasMatchingNameTokens(params.bankAccountName, kycName)) {
      const mismatchWeight = ruleWeights["FRAUD_BANK_NAME_KYC_MISMATCH"] ?? 45;
      flags.push({
        rule: "BANK_NAME_KYC_MISMATCH",
        severity: "HIGH",
        description: `Bank account holder name "${params.bankAccountName}" does not match verified KYC/profile name "${kycName}"`,
      });
      riskScore += mismatchWeight;
    }

    if (user) {
      const userAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const bankAgeDays = latestBank
        ? Math.floor((Date.now() - latestBank.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : Infinity;
      const accountAgeDays = Math.min(userAgeDays, bankAgeDays);

      if (accountAgeDays < NEW_ACCOUNT_AGE_DAYS_THRESHOLD && params.amount > NEW_ACCOUNT_LARGE_WITHDRAWAL_THRESHOLD_PAISE) {
        const newAccountWeight = ruleWeights["FRAUD_LARGE_WITHDRAWAL_NEW_ACCOUNT"] ?? 55;
        flags.push({
          rule: "LARGE_WITHDRAWAL_NEW_ACCOUNT",
          severity: "HIGH",
          description: `Large withdrawal from account or recently added bank account less than ${NEW_ACCOUNT_AGE_DAYS_THRESHOLD} days old`,
        });
        riskScore += newAccountWeight;
      }

      if (user.trustScore < TRUST_SCORE_REVIEW_THRESHOLD) {
        const lowTrustWeight = ruleWeights["FRAUD_LOW_TRUST_SCORE_WITHDRAWAL"] ?? 50;
        flags.push({
          rule: "LOW_TRUST_SCORE_WITHDRAWAL",
          severity: "HIGH",
          description: `Trust score ${user.trustScore} below threshold`,
        });
        riskScore += lowTrustWeight;
      }
    }
  } else {
    // Check user age & trust score if bankAccountName wasn't provided
    const [user, latestBank] = await Promise.all([
      prisma.user.findUnique({
        where: { id: params.userId },
        select: { createdAt: true, trustScore: true },
      }),
      prisma.bankAccount.findFirst({
        where: { userId: params.userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    if (user) {
      const userAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const bankAgeDays = latestBank
        ? Math.floor((Date.now() - latestBank.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : Infinity;
      const accountAgeDays = Math.min(userAgeDays, bankAgeDays);

      if (accountAgeDays < NEW_ACCOUNT_AGE_DAYS_THRESHOLD && params.amount > NEW_ACCOUNT_LARGE_WITHDRAWAL_THRESHOLD_PAISE) {
        const newAccountWeight = ruleWeights["FRAUD_LARGE_WITHDRAWAL_NEW_ACCOUNT"] ?? 55;
        flags.push({
          rule: "LARGE_WITHDRAWAL_NEW_ACCOUNT",
          severity: "HIGH",
          description: `Large withdrawal from account or recently added bank account less than ${NEW_ACCOUNT_AGE_DAYS_THRESHOLD} days old`,
        });
        riskScore += newAccountWeight;
      }

      if (user.trustScore < TRUST_SCORE_REVIEW_THRESHOLD) {
        const lowTrustWeight = ruleWeights["FRAUD_LOW_TRUST_SCORE_WITHDRAWAL"] ?? 50;
        flags.push({
          rule: "LOW_TRUST_SCORE_WITHDRAWAL",
          severity: "HIGH",
          description: `Trust score ${user.trustScore} below threshold`,
        });
        riskScore += lowTrustWeight;
      }
    }
  }

  // Rule 6: Device Fingerprint Multi-Account Clustering
  if (params.deviceFingerprint && redis) {
    try {
      const deviceKey = `device_users:${params.deviceFingerprint}`;
      await redis.sadd(deviceKey, params.userId);
      await redis.expire(deviceKey, 30 * 24 * 60 * 60); // 30 days
      const userCount = await redis.scard(deviceKey);
      if (userCount > 1) {
        const deviceClusterWeight = ruleWeights["FRAUD_DEVICE_FINGERPRINT_CLUSTERING"] ?? 50;
        flags.push({
          rule: "DEVICE_FINGERPRINT_CLUSTERING",
          severity: "CRITICAL",
          description: `Device fingerprint associated with ${userCount} distinct user accounts`,
        });
        riskScore += deviceClusterWeight;
      }
    } catch (err) {
      logger.warn("Redis device clustering check error", { error: String(err) });
    }
  }

  // Rule 7: IP Address Cluster
  if (params.ipAddress && params.ipAddress !== "127.0.0.1" && params.ipAddress !== "::1" && redis) {
    try {
      const ipKey = `ip_users:${params.ipAddress}`;
      await redis.sadd(ipKey, params.userId);
      await redis.expire(ipKey, 7 * 24 * 60 * 60); // 7 days
      const ipUserCount = await redis.scard(ipKey);
      if (ipUserCount >= 4) {
        flags.push({
          rule: "IP_CLUSTER_MULTIPLE_ACCOUNTS",
          severity: "HIGH",
          description: `IP address associated with ${ipUserCount} distinct accounts`,
        });
        riskScore += 35;
      }
    } catch (err) {
      logger.warn("Redis IP clustering check error", { error: String(err) });
    }
  }

  // Determine action based on dynamic table-driven thresholds
  const reviewThreshold = ruleWeights["FRAUD_REVIEW_THRESHOLD"] ?? 40;
  const blockThreshold = ruleWeights["FRAUD_BLOCK_THRESHOLD"] ?? 70;

  let action: FraudCheckResult["action"] = "ALLOW";
  if (riskScore >= blockThreshold) action = "BLOCK";
  else if (riskScore >= reviewThreshold) action = "REVIEW";
  else if (riskScore >= 20) action = "FLAG";

  return {
    passed: action === "ALLOW" || action === "FLAG",
    flags,
    riskScore,
    action,
  };
}

export {
  type PostVerificationFetchResult,
  fetchInstagramPostDataDetailed,
  fetchInstagramPostData,
  fetchYouTubePostDataDetailed,
  fetchYouTubePostData,
} from "./post-fetcher";
export { runVerificationRules } from "./social";
