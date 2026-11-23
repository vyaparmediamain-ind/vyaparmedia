import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PricingConfigService,
  pricingConfigSchema,
  DEFAULT_STORED_PRICING_CONFIG,
  StoredPricingConfig,
} from "@/services/pricing-config.service";
import prisma from "@/lib/db";
import { redis } from "@/lib/redis";
import * as auditModule from "@/lib/audit";

// Mock Redis
const mockRedisStore = new Map<string, string>();
vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(async (key: string) => mockRedisStore.get(key) ?? null),
    setex: vi.fn(async (key: string, _ttl: number, val: string) => {
      mockRedisStore.set(key, val);
      return "OK";
    }),
    del: vi.fn(async (key: string) => {
      mockRedisStore.delete(key);
      return 1;
    }),
  },
}));

// Mock Audit Log
vi.spyOn(auditModule, "createAuditLog").mockImplementation(vi.fn().mockResolvedValue({} as any));

// Mock Prisma
vi.mock("@/lib/db", () => {
  const configs: any[] = [];
  return {
    default: {
      pricingConfig: {
        findFirst: vi.fn(async ({ where, orderBy }: any) => {
          let list = [...configs];
          if (where?.isActive !== undefined) {
            list = list.filter((c) => c.isActive === where.isActive);
          }
          if (orderBy?.version === "desc") {
            list.sort((a, b) => b.version - a.version);
          }
          return list[0] ?? null;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          return configs.find((c) => c.version === where.version) ?? null;
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          let count = 0;
          for (const c of configs) {
            if (where?.isActive !== undefined && c.isActive === where.isActive) {
              Object.assign(c, data);
              count++;
            }
          }
          return { count };
        }),
        create: vi.fn(async ({ data }: any) => {
          const row = {
            id: `cfg-${data.version}`,
            version: data.version,
            isActive: data.isActive ?? true,
            configJson: data.configJson,
            description: data.description,
            updatedById: data.updatedById,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          configs.push(row);
          return row;
        }),
      },
      $transaction: vi.fn(async (callback: any) => {
        return callback(prisma);
      }),
    },
  };
});

describe("PricingConfigService", () => {
  beforeEach(() => {
    mockRedisStore.clear();
    vi.clearAllMocks();
  });

  describe("1. Hard Bounds Schema Validation", () => {
    it("validates the default configuration successfully", () => {
      const parsed = pricingConfigSchema.safeParse(DEFAULT_STORED_PRICING_CONFIG);
      expect(parsed.success).toBe(true);
    });

    it("rejects out-of-bound tier factors (< 0.50 or > 2.50)", () => {
      const invalidLow = {
        ...DEFAULT_STORED_PRICING_CONFIG,
        tierFactors: { ...DEFAULT_STORED_PRICING_CONFIG.tierFactors, nano: 0.4 },
      };
      expect(pricingConfigSchema.safeParse(invalidLow).success).toBe(false);

      const invalidHigh = {
        ...DEFAULT_STORED_PRICING_CONFIG,
        tierFactors: { ...DEFAULT_STORED_PRICING_CONFIG.tierFactors, macro: 2.6 },
      };
      expect(pricingConfigSchema.safeParse(invalidHigh).success).toBe(false);
    });

    it("rejects inverted range ratios (minRatio >= maxRatio)", () => {
      const inverted = {
        ...DEFAULT_STORED_PRICING_CONFIG,
        rangeRatios: {
          minRatio: 1.1,
          maxRatio: 0.9,
          widenedMinRatio: 0.7,
          widenedMaxRatio: 1.3,
        },
      };
      expect(pricingConfigSchema.safeParse(inverted).success).toBe(false);
    });

    it("rejects invalid widened bounds (widenedMinRatio >= minRatio)", () => {
      const invalidWidened = {
        ...DEFAULT_STORED_PRICING_CONFIG,
        rangeRatios: {
          minRatio: 0.85,
          maxRatio: 1.2,
          widenedMinRatio: 0.9, // Higher than minRatio
          widenedMaxRatio: 1.35,
        },
      };
      expect(pricingConfigSchema.safeParse(invalidWidened).success).toBe(false);
    });

    it("rejects reach bands where lowBps > midBps or midBps > highBps", () => {
      const invalidBands = {
        ...DEFAULT_STORED_PRICING_CONFIG,
        reachRateBands: {
          ...DEFAULT_STORED_PRICING_CONFIG.reachRateBands,
          INSTAGRAM: {
            ...DEFAULT_STORED_PRICING_CONFIG.reachRateBands.INSTAGRAM,
            REEL: { lowBps: 2500, midBps: 2000, highBps: 3500 }, // low > mid
          },
        },
      };
      expect(pricingConfigSchema.safeParse(invalidBands).success).toBe(false);
    });
  });

  describe("2. Shift Detection (> 25% Guard)", () => {
    it("detects no big shift when changes are within 25%", () => {
      const current = DEFAULT_STORED_PRICING_CONFIG;
      const merged: StoredPricingConfig = {
        ...current,
        tierFactors: {
          ...current.tierFactors,
          nano: 1.25, // 1.15 -> 1.25 (+8.7%)
        },
      };

      const result = PricingConfigService.detectBigShifts(current, merged);
      expect(result.requiresConfirmation).toBe(false);
      expect(result.changedFields).toHaveLength(0);
    });

    it("detects big shift when parameter moves > 25%", () => {
      const current = DEFAULT_STORED_PRICING_CONFIG;
      const merged: StoredPricingConfig = {
        ...current,
        tierFactors: {
          ...current.tierFactors,
          nano: 1.6, // 1.15 -> 1.60 (+39.1%)
        },
      };

      const result = PricingConfigService.detectBigShifts(current, merged);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.changedFields).toHaveLength(1);
      expect(result.changedFields[0]?.field).toBe("tierFactors.nano");
      expect(result.changedFields[0]?.shiftPercent).toBeGreaterThan(25);
    });
  });

  describe("3. Update Workflow, Version Bumps & Audit Trail", () => {
    it("returns requiresConfirmation when shift > 25% and confirmBigShift is false", async () => {
      const updateResult = await PricingConfigService.updatePricingConfig({
        actorId: "admin-1",
        updates: {
          tierFactors: {
            nano: 1.6, // Shift > 25%
          },
        },
        confirmBigShift: false,
      });

      expect(updateResult.success).toBe(false);
      expect(updateResult.requiresConfirmation).toBe(true);
      expect(updateResult.changedFields).toBeDefined();
    });

    it("successfully creates version bump, deactivates old, and logs audit trail when confirmed", async () => {
      const updateResult = await PricingConfigService.updatePricingConfig({
        actorId: "admin-1",
        updates: {
          tierFactors: {
            nano: 1.6,
          },
        },
        confirmBigShift: true,
        description: "Promote nano creators premium",
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.version).toBe(1);
      expect(updateResult.config?.tierFactors.nano).toBe(1.6);

      // Verify audit log call
      expect(auditModule.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "admin-1",
          actionType: "PRICING_CONFIG_UPDATE",
          entityType: "PRICING_CONFIG",
          entityId: "1",
        }),
        expect.anything()
      );

      // Verify second bump increments to v2
      const secondUpdate = await PricingConfigService.updatePricingConfig({
        actorId: "admin-2",
        updates: {
          addOnMultipliers: {
            story: 0.18,
          },
        },
        confirmBigShift: true,
      });

      expect(secondUpdate.success).toBe(true);
      expect(secondUpdate.version).toBe(2);
    });
  });

  describe("4. Explainability & Historical Retrieval", () => {
    it("retrieves historical configuration by stored version", async () => {
      const v1 = await PricingConfigService.getConfigByVersion(1);
      expect(v1).not.toBeNull();
      expect(v1?.version).toBe(1);

      const invalidVersion = await PricingConfigService.getConfigByVersion(999);
      expect(invalidVersion).toBeNull();
    });
  });
});
