import redis from "./redis";
import prisma from "./db";
import { logger } from "./logger";
import { createActivityLog } from "./audit";

export interface RegistrationGateConfig {
  requireReferral: boolean;
  masterInviteCode: string;
  updatedAt?: string | undefined;
  updatedBy?: string | undefined;
}

const REDIS_KEY_REQUIRE_REFERRAL = "platform:config:require_referral";
const REDIS_KEY_MASTER_CODE = "platform:config:master_invite_code";
const DB_RULE_KEY_REQUIRE_REFERRAL = "REGISTRATION_REQUIRE_REFERRAL";
const DB_RULE_KEY_MASTER_CODE = "REGISTRATION_MASTER_INVITE_CODE";
export const DEFAULT_MASTER_INVITE_CODE = "VIPBETA";

// In-memory cache for ultra-fast checks (10 sec TTL)
let memoryCache: { config: RegistrationGateConfig; expiresAt: number } | null = null;

export function isMasterInviteCode(code: string | undefined | null, masterInviteCode: string): boolean {
  if (!code || !masterInviteCode) return false;
  return code.trim().toUpperCase() === masterInviteCode.trim().toUpperCase();
}

export async function getRegistrationGateConfig(): Promise<RegistrationGateConfig> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.config;
  }

  try {
    // 1. Try Redis first (sub-millisecond)
    const [cachedRequire, cachedMaster] = await Promise.all([
      redis.get(REDIS_KEY_REQUIRE_REFERRAL).catch(() => null),
      redis.get(REDIS_KEY_MASTER_CODE).catch(() => null),
    ]);

    if (cachedRequire !== null) {
      const config: RegistrationGateConfig = {
        requireReferral: cachedRequire === "true" || cachedRequire === "1",
        masterInviteCode: cachedMaster || DEFAULT_MASTER_INVITE_CODE,
      };
      memoryCache = { config, expiresAt: now + 10000 };
      return config;
    }
  } catch (err) {
    logger.warn("[RegistrationGate] Redis read failed, falling back to DB:", { error: String(err) });
  }

  // 2. Fallback to Database TrustRuleConfig table
  try {
    const rules = await prisma.trustRuleConfig.findMany({
      where: {
        ruleKey: { in: [DB_RULE_KEY_REQUIRE_REFERRAL, DB_RULE_KEY_MASTER_CODE] },
      },
    });

    const requireRule = rules.find((r) => r.ruleKey === DB_RULE_KEY_REQUIRE_REFERRAL);
    const masterRule = rules.find((r) => r.ruleKey === DB_RULE_KEY_MASTER_CODE);

    const config: RegistrationGateConfig = {
      requireReferral: requireRule ? requireRule.isActive : false,
      masterInviteCode: masterRule?.description || DEFAULT_MASTER_INVITE_CODE,
      updatedAt: requireRule?.updatedAt?.toISOString(),
    };

    // Repopulate Redis asynchronously
    try {
      await Promise.all([
        redis.set(REDIS_KEY_REQUIRE_REFERRAL, config.requireReferral ? "true" : "false", "EX", 86400 * 30),
        redis.set(REDIS_KEY_MASTER_CODE, config.masterInviteCode, "EX", 86400 * 30),
      ]);
    } catch (_err: unknown) {
    // Handled fallback: ignore Redis write error on rate limit tracking
    void _err;
  }

    memoryCache = { config, expiresAt: now + 10000 };
    return config;
  } catch (dbErr) {
    logger.error("[RegistrationGate] Database read failed:", { error: String(dbErr) });
    const fallback: RegistrationGateConfig = {
      requireReferral: false,
      masterInviteCode: DEFAULT_MASTER_INVITE_CODE,
    };
    return fallback;
  }
}

export async function setRegistrationGateConfig(params: {
  requireReferral: boolean;
  masterInviteCode?: string | undefined;
  adminUserId?: string | undefined;
  adminEmail?: string | undefined;
  reason?: string | undefined;
}): Promise<RegistrationGateConfig> {
  const masterCode = (params.masterInviteCode?.trim().toUpperCase() || DEFAULT_MASTER_INVITE_CODE);

  // 1. Update Database TrustRuleConfig
  await prisma.$transaction(async (tx) => {
    await tx.trustRuleConfig.upsert({
      where: { ruleKey: DB_RULE_KEY_REQUIRE_REFERRAL },
      create: {
        ruleKey: DB_RULE_KEY_REQUIRE_REFERRAL,
        category: "SYSTEM",
        weight: 1,
        description: "Enforce referral/invite code during registration (Beta Invite-Only Mode)",
        isActive: params.requireReferral,
      },
      update: {
        isActive: params.requireReferral,
        description: "Enforce referral/invite code during registration (Beta Invite-Only Mode)",
      },
    });

    await tx.trustRuleConfig.upsert({
      where: { ruleKey: DB_RULE_KEY_MASTER_CODE },
      create: {
        ruleKey: DB_RULE_KEY_MASTER_CODE,
        category: "SYSTEM",
        weight: 0,
        description: masterCode,
        isActive: true,
      },
      update: {
        description: masterCode,
      },
    });
  });

  // 2. Update Redis
  try {
    await Promise.all([
      redis.set(REDIS_KEY_REQUIRE_REFERRAL, params.requireReferral ? "true" : "false", "EX", 86400 * 30),
      redis.set(REDIS_KEY_MASTER_CODE, masterCode, "EX", 86400 * 30),
    ]);
  } catch (err) {
    logger.warn("[RegistrationGate] Failed to sync Redis:", { error: String(err) });
  }

  // 3. Clear memory cache
  const updatedConfig: RegistrationGateConfig = {
    requireReferral: params.requireReferral,
    masterInviteCode: masterCode,
    updatedAt: new Date().toISOString(),
    updatedBy: params.adminEmail || params.adminUserId,
  };
  memoryCache = { config: updatedConfig, expiresAt: Date.now() + 10000 };

  // 4. Record Activity Log for Admin Audit
  if (params.adminUserId) {
    await createActivityLog({
      userId: params.adminUserId,
      action: "REGISTRATION_GATE_TOGGLED",
      entityType: "SYSTEM",
      entityId: "REGISTRATION_GATE",
      metadata: {
        adminEmail: params.adminEmail,
        requireReferral: params.requireReferral,
        masterInviteCode: masterCode,
        reason: params.reason || "Admin updated registration referral policy",
        timestamp: new Date().toISOString(),
      },
    }).catch((err) => {
      logger.warn("[RegistrationGate] Failed to record activity log:", { error: String(err) });
    });
  }

  return updatedConfig;
}
