import { describe, it, expect, vi, beforeEach } from "vitest";
import { encodeCursor, decodeCursor } from "@/lib/search/cursor";
import {
  computeCreatorRankingScore,
  computeCampaignRankingScore,
  buildCreatorSqlRankingExpression,
} from "@/lib/search/ranking";
import {
  getCachedSearchResults,
  setCachedSearchResults,
  invalidateCreatorSearchCache,
  invalidateCampaignSearchCache,
  getCreatorSearchVersion,
  getCampaignSearchVersion,
} from "@/lib/search/cache";
import { getReadClient, getWriteClient } from "@/lib/db-read";
import prisma from "@/lib/db";
import { redis } from "@/lib/redis";

describe("Unit Tests: Creator Discovery & Campaign Search Backend (1M Scale)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. KEYSET CURSOR PAGINATION
  // =========================================================================
  describe("Requirement 4: Keyset Cursor-Based Pagination (Zero Dropped/Duplicate Rows)", () => {
    it("should accurately encode and decode cursor objects to/from base64", () => {
      const original = {
        id: "cm_creator_98765",
        sortValue: 88.75,
      };

      const encoded = encodeCursor(original);
      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);

      const decoded = decodeCursor(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded?.id).toBe(original.id);
      expect(decoded?.sortValue).toBe(original.sortValue);
    });

    it("should support timestamp ISO strings as keyset sort values", () => {
      const nowIso = new Date().toISOString();
      const cursorObj = {
        id: "cm_camp_12345",
        sortValue: nowIso,
      };

      const encoded = encodeCursor(cursorObj);
      const decoded = decodeCursor(encoded);
      expect(decoded?.id).toBe(cursorObj.id);
      expect(decoded?.sortValue).toBe(nowIso);
    });

    it("should return null gracefully for corrupted or invalid cursor strings", () => {
      expect(decodeCursor(undefined)).toBeNull();
      expect(decodeCursor(null)).toBeNull();
      expect(decodeCursor("")).toBeNull();
      expect(decodeCursor("invalid-non-base64!@#$")).toBeNull();
      expect(decodeCursor(Buffer.from("invalid-json-string").toString("base64"))).toBeNull();
      expect(decodeCursor(Buffer.from(JSON.stringify({ onlyId: "123" })).toString("base64"))).toBeNull();
    });
  });

  // =========================================================================
  // 2. COMPOSITE RANKING ENGINE
  // =========================================================================
  describe("Requirement 3: Multi-Factor Composite Ranking Engine", () => {
    it("should rank high-relevance, reputable, active creators significantly above low-tier profiles", () => {
      const eliteCreator = computeCreatorRankingScore({
        textRelevance: 0.95,
        trustScore: 850,
        engagementRate: 5.5,
        completedDeals: 35,
        averageRating: 490,
        isFeatured: true,
      });

      const entryCreator = computeCreatorRankingScore({
        textRelevance: 0.20,
        trustScore: 400,
        engagementRate: 0.8,
        completedDeals: 1,
        averageRating: 250,
        isFeatured: false,
      });

      expect(eliteCreator).toBeGreaterThan(entryCreator);
      expect(eliteCreator).toBeGreaterThanOrEqual(80);
      expect(entryCreator).toBeLessThan(40);
    });

    it("should award a 25% featured priority boost to featured creator profiles", () => {
      const baseFactors = {
        textRelevance: 0.8,
        trustScore: 700,
        engagementRate: 3.5,
        completedDeals: 15,
        averageRating: 450,
      };

      const unfeaturedScore = computeCreatorRankingScore({ ...baseFactors, isFeatured: false });
      const featuredScore = computeCreatorRankingScore({ ...baseFactors, isFeatured: true });

      expect(featuredScore).toBeGreaterThan(unfeaturedScore);
      expect(Math.round(featuredScore / unfeaturedScore * 100) / 100).toBe(1.25);
    });

    it("should calculate campaign ranking with budget weight and recency decay", () => {
      const freshHighBudget = computeCampaignRankingScore({
        textRelevance: 0.9,
        perInfluencerBudgetPaise: 5000000, // ₹50,000
        brandTrustScore: 800,
        createdAt: new Date(), // Today
      });

      const oldLowBudget = computeCampaignRankingScore({
        textRelevance: 0.4,
        perInfluencerBudgetPaise: 500000,  // ₹5,000
        brandTrustScore: 500,
        createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000), // 50 days old
      });

      expect(freshHighBudget).toBeGreaterThan(oldLowBudget);
      expect(freshHighBudget).toBeGreaterThan(70);
    });

    it("should build correct PostgreSQL SQL ranking expression", () => {
      const exprWithSearch = buildCreatorSqlRankingExpression(true);
      expect(exprWithSearch).toContain("ts_rank_cd");
      expect(exprWithSearch).toContain("similarity");
      expect(exprWithSearch).toContain("0.35 *");
      expect(exprWithSearch).toContain("0.25 *");
      expect(exprWithSearch).toContain("isFeatured");

      const exprWithoutSearch = buildCreatorSqlRankingExpression(false);
      expect(exprWithoutSearch).toContain("1.0");
      expect(exprWithoutSearch).not.toContain("ts_rank_cd");
    });
  });

  // =========================================================================
  // 3. SEARCH CACHE WITH ATOMIC O(1) VERSION INVALIDATION
  // =========================================================================
  describe("Requirement 5: Redis Search Cache & Atomic Version Invalidation", () => {
    it("should store and retrieve cached search results with version prefix", async () => {
      vi.spyOn(redis, "get").mockImplementation(async (key) => {
        const k = String(key);
        if (k === "search:creators:version") return "1";
        if (k.startsWith("search:creators:v1:")) {
          return JSON.stringify({ items: [{ id: "c1", displayName: "Aarav" }], hasMore: false });
        }
        return null;
      });
      const setSpy = vi.spyOn(redis, "set").mockResolvedValue("OK");

      const params = { searchTerm: "tech reviewer", limit: 10 };
      await setCachedSearchResults("creators", params, { items: [{ id: "c1", displayName: "Aarav" }] });

      expect(setSpy).toHaveBeenCalled();
      const cached = await getCachedSearchResults<{ items: { id: string }[] }>("creators", params);
      expect(cached).not.toBeNull();
      expect(cached?.items[0]?.id).toBe("c1");
    });

    it("should atomically invalidate creator search cache in O(1) time via version bump", async () => {
      const incrSpy = vi.spyOn(redis, "incr").mockResolvedValueOnce(2);

      await invalidateCreatorSearchCache();

      expect(incrSpy).toHaveBeenCalledWith("search:creators:version");
    });

    it("should atomically invalidate campaign search cache in O(1) time via version bump", async () => {
      const incrSpy = vi.spyOn(redis, "incr").mockResolvedValueOnce(3);

      await invalidateCampaignSearchCache();

      expect(incrSpy).toHaveBeenCalledWith("search:campaigns:version");
    });

    it("should return version 1 fallback when Redis key is empty", async () => {
      vi.spyOn(redis, "get").mockResolvedValueOnce(null);
      const version = await getCreatorSearchVersion();
      expect(version).toBe(1);

      vi.spyOn(redis, "get").mockResolvedValueOnce(null);
      const campVersion = await getCampaignSearchVersion();
      expect(campVersion).toBe(1);
    });
  });

  // =========================================================================
  // 4. READ-REPLICA ROUTING ABSTRACTION
  // =========================================================================
  describe("Requirement 6: Read-Replica Routing Abstraction (1M Scale Read Distribution)", () => {
    it("should fallback safely to primary database client when DATABASE_READ_REPLICA_URL is unset", () => {
      const originalEnv = process.env.DATABASE_READ_REPLICA_URL;
      delete process.env.DATABASE_READ_REPLICA_URL;

      const client = getReadClient();
      expect(client).toBe(prisma);

      const writeClient = getWriteClient();
      expect(writeClient).toBe(prisma);

      if (originalEnv) process.env.DATABASE_READ_REPLICA_URL = originalEnv;
    });
  });
});
