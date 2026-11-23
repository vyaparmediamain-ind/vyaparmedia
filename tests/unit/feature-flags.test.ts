import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  FEATURE_FLAGS,
  computeRolloutBucket,
  isRoleAllowed,
  evaluateFeatureFlag,
  isFeatureEnabled,
  assertFeatureEnabled,
  invalidateFeatureFlagCache,
  _resetMemoryCache,
  type FeatureFlagRecord,
} from "@/lib/feature-flags";
import { FeatureFlagService } from "@/services/feature-flag.service";
import { checkFeatureFlagMutationEligibility } from "@/lib/action-eligibility";
import { AppError } from "@/lib/errors";

// Mock dependencies
const mockRedisStore = new Map<string, string>();
vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(async (key: string) => mockRedisStore.get(key) ?? null),
    setex: vi.fn(async (key: string, _ttl: number, val: string) => {
      mockRedisStore.set(key, val);
      return "OK";
    }),
    del: vi.fn(async (...keys: string[]) => {
      for (const k of keys) mockRedisStore.delete(k);
      return keys.length;
    }),
    keys: vi.fn(async (_pattern: string) => Array.from(mockRedisStore.keys())),
  },
}));

const mockAuditLogs: Array<Record<string, unknown>> = [];
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(async (params: Record<string, unknown>) => {
    mockAuditLogs.push(params);
    return { id: "audit_123", ...params };
  }),
}));

const mockDbFlags = new Map<string, FeatureFlagRecord>();
vi.mock("@/lib/db", () => ({
  default: {
    featureFlag: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
        return mockDbFlags.get(where.key) ?? null;
      }),
      findMany: vi.fn(async () => {
        return Array.from(mockDbFlags.values());
      }),
      update: vi.fn(async ({ where, data }: { where: { key: string }; data: Partial<FeatureFlagRecord> }) => {
        const existing = mockDbFlags.get(where.key);
        if (!existing) throw new Error("Flag not found");
        const updated = { ...existing, ...data, updatedAt: new Date() };
        mockDbFlags.set(where.key, updated);
        return updated;
      }),
    },
  },
}));

describe("Feature Flags Architecture & Rollout Engine", () => {
  beforeEach(() => {
    _resetMemoryCache();
    mockRedisStore.clear();
    mockAuditLogs.length = 0;
    mockDbFlags.clear();
    vi.clearAllMocks();
  });

  describe("1. Key Typing & Registry Completeness", () => {
    it("contains all 9 required canonical feature flags", () => {
      const expectedKeys = [
        "creator_metrics",
        "fair_price",
        "fair_price_public_badge",
        "instagram_insights",
        "telemetry_anonymous",
        "telemetry_identified",
        "campaign_hub",
        "branded_reports",
        "report_verification",
      ];

      expect(Object.values(FEATURE_FLAGS)).toEqual(expect.arrayContaining(expectedKeys));
      expect(Object.values(FEATURE_FLAGS).length).toBe(9);
    });

    it("ensures all keys are non-empty lower_snake_case strings", () => {
      for (const key of Object.values(FEATURE_FLAGS)) {
        expect(typeof key).toBe("string");
        expect(key.length).toBeGreaterThan(0);
        expect(key).toMatch(/^[a-z_]+$/);
      }
    });
  });

  describe("2. Pure Rollout & Deterministic Hashing", () => {
    it("produces deterministic buckets for the same userId and key across invocations", () => {
      const bucket1 = computeRolloutBucket("user_abc_123", "fair_price");
      const bucket2 = computeRolloutBucket("user_abc_123", "fair_price");
      const bucket3 = computeRolloutBucket("user_abc_123", "fair_price");

      expect(bucket1).toBe(bucket2);
      expect(bucket2).toBe(bucket3);
      expect(bucket1).toBeGreaterThanOrEqual(0);
      expect(bucket1).toBeLessThan(100);
    });

    it("evaluates boundaries: 0% rollout is always disabled even if enabled=true", () => {
      const flag: FeatureFlagRecord = {
        key: "fair_price",
        enabled: true,
        rolloutPercent: 0,
        allowRoles: [],
        description: "Test flag",
      };

      expect(evaluateFeatureFlag(flag, { userId: "user_1" })).toBe(false);
      expect(evaluateFeatureFlag(flag, { userId: "user_2" })).toBe(false);
      expect(evaluateFeatureFlag(flag, { userId: "user_999" })).toBe(false);
    });

    it("evaluates boundaries: 100% rollout is enabled for any user", () => {
      const flag: FeatureFlagRecord = {
        key: "fair_price",
        enabled: true,
        rolloutPercent: 100,
        allowRoles: [],
        description: "Test flag",
      };

      expect(evaluateFeatureFlag(flag, { userId: "user_1" })).toBe(true);
      expect(evaluateFeatureFlag(flag, { userId: "user_2" })).toBe(true);
      expect(evaluateFeatureFlag(flag)).toBe(true);
    });

    it("fails closed for unidentified/anonymous users during fractional rollouts", () => {
      const flag: FeatureFlagRecord = {
        key: "creator_metrics",
        enabled: true,
        rolloutPercent: 50,
        allowRoles: [],
        description: "Gradual rollout",
      };

      // When userId is missing in fractional rollout, fail closed
      expect(evaluateFeatureFlag(flag)).toBe(false);
      expect(evaluateFeatureFlag(flag, { userId: null })).toBe(false);
      expect(evaluateFeatureFlag(flag, { userId: "" })).toBe(false);
    });

    it("distributes users across buckets according to percentage threshold", () => {
      const flag: FeatureFlagRecord = {
        key: "telemetry_identified",
        enabled: true,
        rolloutPercent: 50,
        allowRoles: [],
        description: "50% rollout",
      };

      let enabledCount = 0;
      const totalUsers = 1000;

      for (let i = 0; i < totalUsers; i++) {
        if (evaluateFeatureFlag(flag, { userId: `test_user_id_${i}` })) {
          enabledCount++;
        }
      }

      // 50% rollout with 1000 users should be approximately 500 (within 40% - 60% standard deviation)
      expect(enabledCount).toBeGreaterThan(420);
      expect(enabledCount).toBeLessThan(580);
    });
  });

  describe("3. Role Allow-List Enforcement", () => {
    it("allows any role when allowRoles is empty or contains wildcard", () => {
      expect(isRoleAllowed("INFLUENCER", [])).toBe(true);
      expect(isRoleAllowed("BRAND", [])).toBe(true);
      expect(isRoleAllowed(undefined, [])).toBe(true);
      expect(isRoleAllowed("INFLUENCER", ["*"])).toBe(true);
    });

    it("restricts access strictly to permitted roles (case-insensitive)", () => {
      const permitted = ["ADMIN", "BRAND"];

      expect(isRoleAllowed("ADMIN", permitted)).toBe(true);
      expect(isRoleAllowed("admin", permitted)).toBe(true);
      expect(isRoleAllowed("Brand", permitted)).toBe(true);
      expect(isRoleAllowed("INFLUENCER", permitted)).toBe(false);
      expect(isRoleAllowed("SCOUT", permitted)).toBe(false);
      expect(isRoleAllowed(undefined, permitted)).toBe(false);
      expect(isRoleAllowed(null, permitted)).toBe(false);
    });

    it("rejects user when flag is enabled but role is not allowed", () => {
      const flag: FeatureFlagRecord = {
        key: "branded_reports",
        enabled: true,
        rolloutPercent: 100,
        allowRoles: ["ADMIN", "BRAND"],
        description: "Reports for brands only",
      };

      expect(evaluateFeatureFlag(flag, { role: "BRAND", userId: "u1" })).toBe(true);
      expect(evaluateFeatureFlag(flag, { role: "INFLUENCER", userId: "u2" })).toBe(false);
      expect(evaluateFeatureFlag(flag, { role: undefined, userId: "u3" })).toBe(false);
    });
  });

  describe("4. Fail-Closed Resilience & Assertion", () => {
    it("returns false (fail-closed) when flag record does not exist in database", async () => {
      const enabled = await isFeatureEnabled("fair_price", { userId: "user_1" });
      expect(enabled).toBe(false);
    });

    it("returns false (fail-closed) when database throws an exception", async () => {
      const prismaMock = (await import("@/lib/db")).default;
      vi.mocked(prismaMock.featureFlag.findUnique).mockRejectedValueOnce(new Error("DB Connection timeout"));

      const enabled = await isFeatureEnabled("fair_price", { userId: "user_1" });
      expect(enabled).toBe(false);
    });

    it("assertFeatureEnabled throws AppError 403 when flag is disabled", async () => {
      mockDbFlags.set("campaign_hub", {
        key: "campaign_hub",
        enabled: false,
        rolloutPercent: 100,
        allowRoles: [],
        description: "Disabled flag",
      });

      await expect(assertFeatureEnabled("campaign_hub")).rejects.toThrow(AppError);
      await expect(assertFeatureEnabled("campaign_hub")).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("assertFeatureEnabled resolves cleanly when flag is enabled", async () => {
      mockDbFlags.set("campaign_hub", {
        key: "campaign_hub",
        enabled: true,
        rolloutPercent: 100,
        allowRoles: [],
        description: "Enabled flag",
      });

      await expect(assertFeatureEnabled("campaign_hub")).resolves.toBeUndefined();
    });
  });

  describe("5. Caching & Invalidation Architecture", () => {
    it("reads from in-process memory cache on subsequent calls within TTL", async () => {
      mockDbFlags.set("instagram_insights", {
        key: "instagram_insights",
        enabled: true,
        rolloutPercent: 100,
        allowRoles: [],
        description: "Insights",
      });

      const prismaMock = (await import("@/lib/db")).default;

      // 1st call -> hits DB and populates memory and Redis
      const first = await isFeatureEnabled("instagram_insights");
      expect(first).toBe(true);
      expect(prismaMock.featureFlag.findUnique).toHaveBeenCalledTimes(1);

      // 2nd call -> served from in-process memory cache without hitting DB
      const second = await isFeatureEnabled("instagram_insights");
      expect(second).toBe(true);
      expect(prismaMock.featureFlag.findUnique).toHaveBeenCalledTimes(1);
    });

    it("invalidates cache immediately when invalidateFeatureFlagCache is called", async () => {
      mockDbFlags.set("report_verification", {
        key: "report_verification",
        enabled: true,
        rolloutPercent: 100,
        allowRoles: [],
        description: "Verifications",
      });

      const prismaMock = (await import("@/lib/db")).default;

      await isFeatureEnabled("report_verification");
      expect(prismaMock.featureFlag.findUnique).toHaveBeenCalledTimes(1);

      // Invalidate
      await invalidateFeatureFlagCache("report_verification");

      // Next read hits DB again
      await isFeatureEnabled("report_verification");
      expect(prismaMock.featureFlag.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe("6. Service Layer & Audit Logging", () => {
    it("records before and after JSON in AuditLog when flag is updated", async () => {
      mockDbFlags.set("fair_price", {
        key: "fair_price",
        enabled: false,
        rolloutPercent: 0,
        allowRoles: ["ADMIN"],
        description: "Old description",
      });

      const updated = await FeatureFlagService.updateFlag(
        "fair_price",
        {
          enabled: true,
          rolloutPercent: 50,
          allowRoles: ["ADMIN", "BRAND"],
          description: "New description",
        },
        "admin_user_999",
        "127.0.0.1",
      );

      expect(updated.enabled).toBe(true);
      expect(updated.rolloutPercent).toBe(50);
      expect(updated.allowRoles).toEqual(["ADMIN", "BRAND"]);

      expect(mockAuditLogs.length).toBe(1);
      const audit = mockAuditLogs[0];
      expect(audit?.actorId).toBe("admin_user_999");
      expect(audit?.actionType).toBe("FEATURE_FLAG_UPDATED");
      expect(audit?.entityType).toBe("FEATURE_FLAG");
      expect(audit?.entityId).toBe("fair_price");

      const before = audit?.beforeJSON as Record<string, unknown>;
      const after = audit?.afterJSON as Record<string, unknown>;

      expect(before?.enabled).toBe(false);
      expect(before?.rolloutPercent).toBe(0);
      expect(after?.enabled).toBe(true);
      expect(after?.rolloutPercent).toBe(50);
    });

    it("validates rolloutPercent bounds in service layer", async () => {
      mockDbFlags.set("fair_price", {
        key: "fair_price",
        enabled: false,
        rolloutPercent: 0,
        allowRoles: [],
        description: "Test",
      });

      await expect(
        FeatureFlagService.updateFlag("fair_price", { rolloutPercent: 150 }, "admin_1"),
      ).rejects.toThrow(AppError);

      await expect(
        FeatureFlagService.updateFlag("fair_price", { rolloutPercent: -5 }, "admin_1"),
      ).rejects.toThrow(AppError);
    });
  });

  describe("7. Action-Button Rule Eligibility Predicate", () => {
    it("denies mutation if user is not an admin", () => {
      const eligibility = checkFeatureFlagMutationEligibility({
        isAdmin: false,
      });

      expect(eligibility.allowed).toBe(false);
      expect(eligibility.reason).toContain("Admin privileges required");
    });

    it("denies mutation while a save request is in-flight", () => {
      const eligibility = checkFeatureFlagMutationEligibility({
        isAdmin: true,
        isSaving: true,
      });

      expect(eligibility.allowed).toBe(false);
      expect(eligibility.reason).toContain("Saving feature flag");
    });

    it("allows mutation when user is active admin and idle", () => {
      const eligibility = checkFeatureFlagMutationEligibility({
        isAdmin: true,
        isSaving: false,
      });

      expect(eligibility.allowed).toBe(true);
    });
  });
});
