/**
 * Pricing Config Service
 *
 * Manages dynamic runtime configuration for the Fair Price Engine and Reach Estimator:
 * - Follower tier factors (nano, micro, mid, macro)
 * - Deliverables and add-on multipliers (stories, usage rights, exclusivity, raw footage)
 * - Market range ratio bounds (minRatio, maxRatio, widenedMinRatio, widenedMaxRatio)
 * - Reach-rate bands for Instagram and YouTube
 *
 * STRICT INVARIANTS:
 * - Immutable versioning: every update creates a new version row ($v + 1$) and marks previous inactive.
 * - Old evaluations stay explainable via getConfigByVersion(version).
 * - Hard bounds validation: rejects unsafe or inverted bounds.
 * - Shift safety guard: requires explicit confirmation if any parameter shifts by > 25%.
 * - Complete audit trail: logs before/after configuration via createAuditLog.
 * - Distributed caching: caches active config in Redis with TTL 300s.
 */

import prisma from "@/lib/db";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import {
  DEFAULT_FAIR_PRICE_CONFIG,
  CreatorFollowerTier,
} from "@/lib/fair-price-engine";
import {
  PLATFORM_REACH_RATE_BANDS,
} from "@/lib/reach-estimator";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const PRICING_CONFIG_CACHE_KEY = "pricing:config:active";
export const PRICING_CONFIG_CACHE_TTL = 300; // 5 minutes

export interface ReachRateBandConfig {
  lowBps: number;
  midBps: number;
  highBps: number;
}

export interface PlatformReachRateBandsConfig {
  INSTAGRAM: {
    REEL: ReachRateBandConfig;
    POST: ReachRateBandConfig;
    STORY: ReachRateBandConfig;
  };
  YOUTUBE: {
    VIDEO: ReachRateBandConfig;
    SHORT: ReachRateBandConfig;
  };
}

export interface StoredPricingConfig {
  tierFactors: Record<CreatorFollowerTier, number>;
  addOnMultipliers: {
    story: number;
    usageRightsPer30d: number;
    exclusivityPerMonth: number;
    rawFootage: number;
  };
  rangeRatios: {
    minRatio: number;
    maxRatio: number;
    widenedMinRatio: number;
    widenedMaxRatio: number;
  };
  reachRateBands: PlatformReachRateBandsConfig;
  staleProfileDaysThreshold?: number | undefined;
}

export interface PricingConfigUpdates {
  tierFactors?: Partial<Record<CreatorFollowerTier, number>> | undefined;
  addOnMultipliers?: Partial<StoredPricingConfig["addOnMultipliers"]> | undefined;
  rangeRatios?: Partial<StoredPricingConfig["rangeRatios"]> | undefined;
  reachRateBands?: {
    INSTAGRAM?: Partial<PlatformReachRateBandsConfig["INSTAGRAM"]> | undefined;
    YOUTUBE?: Partial<PlatformReachRateBandsConfig["YOUTUBE"]> | undefined;
  } | undefined;
  staleProfileDaysThreshold?: number | undefined;
}

export const DEFAULT_STORED_PRICING_CONFIG: StoredPricingConfig = {
  tierFactors: {
    nano: DEFAULT_FAIR_PRICE_CONFIG.tierFactors.nano,
    micro: DEFAULT_FAIR_PRICE_CONFIG.tierFactors.micro,
    mid: DEFAULT_FAIR_PRICE_CONFIG.tierFactors.mid,
    macro: DEFAULT_FAIR_PRICE_CONFIG.tierFactors.macro,
  },
  addOnMultipliers: {
    story: DEFAULT_FAIR_PRICE_CONFIG.addOnMultipliers.story,
    usageRightsPer30d: DEFAULT_FAIR_PRICE_CONFIG.addOnMultipliers.usageRightsPer30d,
    exclusivityPerMonth: DEFAULT_FAIR_PRICE_CONFIG.addOnMultipliers.exclusivityPerMonth,
    rawFootage: DEFAULT_FAIR_PRICE_CONFIG.addOnMultipliers.rawFootage,
  },
  rangeRatios: {
    minRatio: DEFAULT_FAIR_PRICE_CONFIG.rangeRatios.minRatio,
    maxRatio: DEFAULT_FAIR_PRICE_CONFIG.rangeRatios.maxRatio,
    widenedMinRatio: DEFAULT_FAIR_PRICE_CONFIG.rangeRatios.widenedMinRatio,
    widenedMaxRatio: DEFAULT_FAIR_PRICE_CONFIG.rangeRatios.widenedMaxRatio,
  },
  reachRateBands: {
    INSTAGRAM: {
      REEL: {
        lowBps: PLATFORM_REACH_RATE_BANDS.INSTAGRAM.REEL?.lowBps ?? 1200,
        midBps: PLATFORM_REACH_RATE_BANDS.INSTAGRAM.REEL?.midBps ?? 2000,
        highBps: PLATFORM_REACH_RATE_BANDS.INSTAGRAM.REEL?.highBps ?? 3500,
      },
      POST: {
        lowBps: PLATFORM_REACH_RATE_BANDS.INSTAGRAM.POST?.lowBps ?? 600,
        midBps: PLATFORM_REACH_RATE_BANDS.INSTAGRAM.POST?.midBps ?? 1200,
        highBps: PLATFORM_REACH_RATE_BANDS.INSTAGRAM.POST?.highBps ?? 2000,
      },
      STORY: {
        lowBps: PLATFORM_REACH_RATE_BANDS.INSTAGRAM.STORY?.lowBps ?? 300,
        midBps: PLATFORM_REACH_RATE_BANDS.INSTAGRAM.STORY?.midBps ?? 600,
        highBps: PLATFORM_REACH_RATE_BANDS.INSTAGRAM.STORY?.highBps ?? 1000,
      },
    },
    YOUTUBE: {
      VIDEO: {
        lowBps: PLATFORM_REACH_RATE_BANDS.YOUTUBE.VIDEO?.lowBps ?? 800,
        midBps: PLATFORM_REACH_RATE_BANDS.YOUTUBE.VIDEO?.midBps ?? 1600,
        highBps: PLATFORM_REACH_RATE_BANDS.YOUTUBE.VIDEO?.highBps ?? 3000,
      },
      SHORT: {
        lowBps: PLATFORM_REACH_RATE_BANDS.YOUTUBE.SHORT?.lowBps ?? 1500,
        midBps: PLATFORM_REACH_RATE_BANDS.YOUTUBE.SHORT?.midBps ?? 2800,
        highBps: PLATFORM_REACH_RATE_BANDS.YOUTUBE.SHORT?.highBps ?? 5500,
      },
    },
  },
  staleProfileDaysThreshold: DEFAULT_FAIR_PRICE_CONFIG.staleProfileDaysThreshold,
};

// Zod schema for Reach Band validation
const reachBandSchema = z
  .object({
    lowBps: z.number().int().min(100).max(5000), // 1.00% to 50.00%
    midBps: z.number().int().min(200).max(8000), // 2.00% to 80.00%
    highBps: z.number().int().min(300).max(10000), // 3.00% to 100.00%
  })
  .refine((b) => b.lowBps <= b.midBps && b.midBps <= b.highBps, {
    message: "Reach rate band bounds must satisfy: lowBps <= midBps <= highBps",
  });

// Zod schema for Range Ratios validation
const rangeRatiosSchema = z
  .object({
    minRatio: z.number().min(0.5).max(0.99),
    maxRatio: z.number().min(1.01).max(2.0),
    widenedMinRatio: z.number().min(0.4).max(0.95),
    widenedMaxRatio: z.number().min(1.1).max(2.5),
  })
  .refine((r) => r.minRatio < r.maxRatio, {
    message: "minRatio must be less than maxRatio",
  })
  .refine((r) => r.widenedMinRatio < r.minRatio, {
    message: "widenedMinRatio must be less than minRatio",
  })
  .refine((r) => r.widenedMaxRatio > r.maxRatio, {
    message: "widenedMaxRatio must be greater than maxRatio",
  });

// Complete Zod validation schema with hard bounds
export const pricingConfigSchema = z
  .object({
    tierFactors: z
      .object({
        nano: z.number().min(0.5).max(2.5),
        micro: z.number().min(0.5).max(2.5),
        mid: z.number().min(0.5).max(2.5),
        macro: z.number().min(0.5).max(2.5),
      })
      .strict(),
    addOnMultipliers: z
      .object({
        story: z.number().min(0.01).max(1.0),
        usageRightsPer30d: z.number().min(0.01).max(1.0),
        exclusivityPerMonth: z.number().min(0.01).max(1.5),
        rawFootage: z.number().min(0.01).max(1.0),
      })
      .strict(),
    rangeRatios: rangeRatiosSchema,
    reachRateBands: z
      .object({
        INSTAGRAM: z
          .object({
            REEL: reachBandSchema,
            POST: reachBandSchema,
            STORY: reachBandSchema,
          })
          .strict(),
        YOUTUBE: z
          .object({
            VIDEO: reachBandSchema,
            SHORT: reachBandSchema,
          })
          .strict(),
      })
      .strict(),
    staleProfileDaysThreshold: z.number().int().min(7).max(365).optional(),
  })
  .strict();

export interface ChangedFieldDetail {
  field: string;
  oldVal: number;
  newVal: number;
  shiftPercent: number;
}

export interface ShiftDetectionResult {
  requiresConfirmation: boolean;
  maxShift: number;
  changedFields: ChangedFieldDetail[];
}

export interface UpdatePricingConfigParams {
  actorId: string;
  updates: PricingConfigUpdates;
  description?: string | undefined;
  confirmBigShift?: boolean | undefined;
  ipAddress?: string | undefined;
}

export class PricingConfigService {
  /**
   * Retrieves the currently active pricing configuration.
   * Checks Redis cache first (TTL 300s), then DB.
   * If DB has no active configuration, seeds/returns DEFAULT_STORED_PRICING_CONFIG with version 1.
   */
  public static async getActivePricingConfig(): Promise<{
    version: number;
    config: StoredPricingConfig;
    updatedAt?: Date | undefined;
  }> {
    // 1. Redis Cache
    try {
      const cached = await redis.get(PRICING_CONFIG_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.version && parsed?.config) {
          return {
            version: parsed.version,
            config: parsed.config,
            ...(parsed.updatedAt ? { updatedAt: new Date(parsed.updatedAt) } : {}),
          };
        }
      }
    } catch (err) {
      logger.warn("[PricingConfigService] Redis cache lookup failed", { error: err });
    }

    // 2. Database Lookup
    const activeRow = await prisma.pricingConfig.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
    });

    if (activeRow) {
      const config = activeRow.configJson as unknown as StoredPricingConfig;
      const result: {
        version: number;
        config: StoredPricingConfig;
        updatedAt?: Date | undefined;
      } = {
        version: activeRow.version,
        config,
        updatedAt: activeRow.updatedAt,
      };

      try {
        await redis.setex(
          PRICING_CONFIG_CACHE_KEY,
          PRICING_CONFIG_CACHE_TTL,
          JSON.stringify(result)
        );
      } catch (err) {
        logger.warn("[PricingConfigService] Redis setex failed", { error: err });
      }

      return result;
    }

    // 3. Fallback / Seed Default (Version 1)
    const fallback: {
      version: number;
      config: StoredPricingConfig;
      updatedAt?: Date | undefined;
    } = {
      version: 1,
      config: DEFAULT_STORED_PRICING_CONFIG,
    };

    try {
      await redis.setex(
        PRICING_CONFIG_CACHE_KEY,
        PRICING_CONFIG_CACHE_TTL,
        JSON.stringify(fallback)
      );
    } catch (err) {
      logger.warn("[PricingConfigService] Failed to set fallback pricing config in Redis", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return fallback;
  }

  /**
   * Retrieves historical pricing configuration by version.
   * Used for explainability of older PricingEvaluation records.
   */
  public static async getConfigByVersion(
    version: number
  ): Promise<{ version: number; config: StoredPricingConfig } | null> {
    if (version <= 0) return null;

    const row = await prisma.pricingConfig.findUnique({
      where: { version },
    });

    if (row) {
      return {
        version: row.version,
        config: row.configJson as unknown as StoredPricingConfig,
      };
    }

    // If version is 1 and DB is unseeded, return default
    if (version === 1) {
      return {
        version: 1,
        config: DEFAULT_STORED_PRICING_CONFIG,
      };
    }

    return null;
  }

  /**
   * Detects parameter shifts > 25% between current and updated configurations.
   */
  public static detectBigShifts(
    current: StoredPricingConfig,
    merged: StoredPricingConfig
  ): ShiftDetectionResult {
    const changedFields: ChangedFieldDetail[] = [];
    let maxShift = 0;

    const compareNumber = (path: string, oldVal?: number, newVal?: number) => {
      if (typeof oldVal !== "number" || typeof newVal !== "number") return;
      if (oldVal === newVal) return;
      if (oldVal <= 0) return;

      const shift = Math.abs(newVal - oldVal) / oldVal;
      const shiftPercent = Math.round(shift * 10000) / 100; // e.g. 26.5%

      if (shift > 0.25) {
        changedFields.push({
          field: path,
          oldVal,
          newVal,
          shiftPercent,
        });
      }
      if (shift > maxShift) {
        maxShift = shift;
      }
    };

    // 1. Tier factors
    for (const tier of ["nano", "micro", "mid", "macro"] as CreatorFollowerTier[]) {
      compareNumber(`tierFactors.${tier}`, current.tierFactors?.[tier], merged.tierFactors?.[tier]);
    }

    // 2. Add-on multipliers
    for (const key of ["story", "usageRightsPer30d", "exclusivityPerMonth", "rawFootage"] as const) {
      compareNumber(`addOnMultipliers.${key}`, current.addOnMultipliers?.[key], merged.addOnMultipliers?.[key]);
    }

    // 3. Range ratios
    for (const key of ["minRatio", "maxRatio", "widenedMinRatio", "widenedMaxRatio"] as const) {
      compareNumber(`rangeRatios.${key}`, current.rangeRatios?.[key], merged.rangeRatios?.[key]);
    }

    // 4. Reach rate bands
    const instagramCurrent = current.reachRateBands.INSTAGRAM;
    const instagramMerged = merged.reachRateBands.INSTAGRAM;
    for (const fmt of ["REEL", "POST", "STORY"] as const) {
      const curBand = instagramCurrent[fmt];
      const newBand = instagramMerged[fmt];
      if (curBand && newBand) {
        compareNumber(`reachRateBands.INSTAGRAM.${fmt}.lowBps`, curBand.lowBps, newBand.lowBps);
        compareNumber(`reachRateBands.INSTAGRAM.${fmt}.midBps`, curBand.midBps, newBand.midBps);
        compareNumber(`reachRateBands.INSTAGRAM.${fmt}.highBps`, curBand.highBps, newBand.highBps);
      }
    }

    const youtubeCurrent = current.reachRateBands.YOUTUBE;
    const youtubeMerged = merged.reachRateBands.YOUTUBE;
    for (const fmt of ["VIDEO", "SHORT"] as const) {
      const curBand = youtubeCurrent[fmt];
      const newBand = youtubeMerged[fmt];
      if (curBand && newBand) {
        compareNumber(`reachRateBands.YOUTUBE.${fmt}.lowBps`, curBand.lowBps, newBand.lowBps);
        compareNumber(`reachRateBands.YOUTUBE.${fmt}.midBps`, curBand.midBps, newBand.midBps);
        compareNumber(`reachRateBands.YOUTUBE.${fmt}.highBps`, curBand.highBps, newBand.highBps);
      }
    }

    return {
      requiresConfirmation: changedFields.length > 0,
      maxShift,
      changedFields,
    };
  }

  /**
   * Updates pricing configuration with hard-bounds validation, >25% shift guard,
   * atomic version bump, audit logging, and cache invalidation.
   */
  public static async updatePricingConfig(params: UpdatePricingConfigParams): Promise<{
    success: boolean;
    requiresConfirmation?: boolean;
    maxShift?: number;
    changedFields?: ChangedFieldDetail[];
    version?: number;
    config?: StoredPricingConfig;
  }> {
    const { actorId, updates, description, confirmBigShift, ipAddress } = params;

    // 1. Load active config
    const active = await this.getActivePricingConfig();
    const currentConfig = active.config;

    // 2. Deep merge updates onto current active config
    const mergedConfig: StoredPricingConfig = {
      tierFactors: {
        ...currentConfig.tierFactors,
        ...(updates.tierFactors || {}),
      },
      addOnMultipliers: {
        ...currentConfig.addOnMultipliers,
        ...(updates.addOnMultipliers || {}),
      },
      rangeRatios: {
        ...currentConfig.rangeRatios,
        ...(updates.rangeRatios || {}),
      },
      reachRateBands: {
        INSTAGRAM: {
          ...currentConfig.reachRateBands.INSTAGRAM,
          ...(updates.reachRateBands?.INSTAGRAM || {}),
        },
        YOUTUBE: {
          ...currentConfig.reachRateBands.YOUTUBE,
          ...(updates.reachRateBands?.YOUTUBE || {}),
        },
      },
      staleProfileDaysThreshold:
        updates.staleProfileDaysThreshold !== undefined
          ? updates.staleProfileDaysThreshold
          : currentConfig.staleProfileDaysThreshold,
    };

    // 3. Strict Zod validation with hard bounds
    const parseResult = pricingConfigSchema.safeParse(mergedConfig);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw AppError.badRequest(`Pricing config validation failed: ${errorMsg}`);
    }

    const validatedConfig = parseResult.data as StoredPricingConfig;

    // 4. Check for shifts > 25%
    const shiftCheck = this.detectBigShifts(currentConfig, validatedConfig);
    if (shiftCheck.requiresConfirmation && !confirmBigShift) {
      return {
        success: false,
        requiresConfirmation: true,
        maxShift: shiftCheck.maxShift,
        changedFields: shiftCheck.changedFields,
      };
    }

    // 5. Atomic DB Transaction: deactivate existing, bump version, create new row, audit log
    const updatedRecord = await prisma.$transaction(async (tx) => {
      // Find latest version across all rows
      const latest = await tx.pricingConfig.findFirst({
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const nextVersion = (latest?.version ?? 0) + 1;

      // Deactivate all existing rows
      await tx.pricingConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      // Create new active version
      const created = await tx.pricingConfig.create({
        data: {
          version: nextVersion,
          isActive: true,
          configJson: validatedConfig as unknown as Prisma.InputJsonValue,
          description: description || `Pricing configuration bump to v${nextVersion}`,
          updatedById: actorId,
        },
      });

      // Create immutable audit log with before/after state
      await createAuditLog(
        {
          actorId,
          actionType: "PRICING_CONFIG_UPDATE",
          entityType: "PRICING_CONFIG",
          entityId: String(nextVersion),
          beforeJSON: currentConfig as unknown as Record<string, unknown>,
          afterJSON: validatedConfig as unknown as Record<string, unknown>,
          ...(ipAddress ? { ipAddress } : {}),
        },
        tx
      );

      return created;
    });

    // 6. Invalidate Redis Cache
    try {
      await redis.del(PRICING_CONFIG_CACHE_KEY);
    } catch (err) {
      logger.warn("[PricingConfigService] Redis cache invalidation failed", { error: err });
    }

    return {
      success: true,
      version: updatedRecord.version,
      config: validatedConfig,
    };
  }
}
