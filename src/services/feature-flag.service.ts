import prisma from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import {
  type FeatureFlagKey,
  type FeatureFlagRecord,
  getFeatureFlagRecord,
  invalidateFeatureFlagCache,
} from "@/lib/feature-flags";

export interface UpdateFeatureFlagInput {
  enabled?: boolean | undefined;
  rolloutPercent?: number | undefined;
  allowRoles?: string[] | undefined;
  description?: string | undefined;
}

export class FeatureFlagService {
  /**
   * Fetches all registered feature flags from the database ordered by key.
   */
  static async getAllFlags(): Promise<FeatureFlagRecord[]> {
    try {
      const records = await prisma.featureFlag.findMany({
        orderBy: { key: "asc" },
      });

      return records.map((r) => ({
        key: r.key,
        enabled: r.enabled,
        rolloutPercent: r.rolloutPercent,
        allowRoles: r.allowRoles,
        description: r.description,
        updatedById: r.updatedById,
        updatedAt: r.updatedAt,
      }));
    } catch (err) {
      logger.error("[FeatureFlagService] Failed to fetch all feature flags", { error: err });
      throw AppError.internal("Failed to retrieve feature flag registry.");
    }
  }

  /**
   * Fetches a single feature flag by key with caching.
   */
  static async getFlag(key: FeatureFlagKey): Promise<FeatureFlagRecord | null> {
    return getFeatureFlagRecord(key);
  }

  /**
   * Updates a feature flag, records an immutable audit log with before/after state,
   * and immediately invalidates both in-memory and Redis caches.
   */
  static async updateFlag(
    key: FeatureFlagKey,
    updates: UpdateFeatureFlagInput,
    actorId: string,
    ipAddress?: string,
  ): Promise<FeatureFlagRecord> {
    if (!actorId) {
      throw AppError.unauthorized("Authentication required to modify feature flags");
    }

    const before = await prisma.featureFlag.findUnique({
      where: { key },
    });

    if (!before) {
      throw AppError.notFound(`Feature flag '${key}' does not exist.`);
    }

    const updateData: {
      enabled?: boolean;
      rolloutPercent?: number;
      allowRoles?: string[];
      description?: string;
      updatedById: string;
    } = {
      updatedById: actorId,
    };

    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
    if (updates.rolloutPercent !== undefined) {
      if (updates.rolloutPercent < 0 || updates.rolloutPercent > 100) {
        throw AppError.badRequest("rolloutPercent must be an integer between 0 and 100");
      }
      updateData.rolloutPercent = updates.rolloutPercent;
    }
    if (updates.allowRoles !== undefined) {
      updateData.allowRoles = updates.allowRoles.map((r) => r.trim().toUpperCase());
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description.trim();
    }

    const updated = await prisma.featureFlag.update({
      where: { key },
      data: updateData,
    });

    // Invalidate caches immediately
    await invalidateFeatureFlagCache(key);

    // Record immutable audit log
    const auditPayload: Parameters<typeof createAuditLog>[0] = {
      actorId,
      actionType: "FEATURE_FLAG_UPDATED",
      entityType: "FEATURE_FLAG",
      entityId: key,
      beforeJSON: {
        key: before.key,
        enabled: before.enabled,
        rolloutPercent: before.rolloutPercent,
        allowRoles: before.allowRoles,
        description: before.description,
        updatedById: before.updatedById,
        updatedAt: before.updatedAt,
      },
      afterJSON: {
        key: updated.key,
        enabled: updated.enabled,
        rolloutPercent: updated.rolloutPercent,
        allowRoles: updated.allowRoles,
        description: updated.description,
        updatedById: updated.updatedById,
        updatedAt: updated.updatedAt,
      },
    };
    if (ipAddress) {
      auditPayload.ipAddress = ipAddress;
    }

    await createAuditLog(auditPayload).catch((auditErr) => {
      logger.warn("[FeatureFlagService] Failed to record audit log for flag update", {
        key,
        error: auditErr instanceof Error ? auditErr.message : String(auditErr),
      });
    });

    logger.info(`[FeatureFlagService] Flag '${key}' updated by ${actorId}: enabled=${updated.enabled}, rollout=${updated.rolloutPercent}%`);

    return {
      key: updated.key,
      enabled: updated.enabled,
      rolloutPercent: updated.rolloutPercent,
      allowRoles: updated.allowRoles,
      description: updated.description,
      updatedById: updated.updatedById,
      updatedAt: updated.updatedAt,
    };
  }
}
