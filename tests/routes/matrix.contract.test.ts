import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { makeSession } from "../utils/auth";
import { auth } from "@/lib/auth";
import { RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { POST as pricingEvaluatePost } from "@/app/api/pricing/evaluate/route";
import { GET as ipBlacklistGet } from "@/app/api/admin/ip-blacklist/route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimit: vi.fn().mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Math.floor(Date.now() / 1000) + 60,
    }),
    checkRateLimit: vi.fn().mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Math.floor(Date.now() / 1000) + 60,
    }),
    checkTieredRateLimit: vi.fn().mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Math.floor(Date.now() / 1000) + 60,
      userLimit: 100,
      userRemaining: 99,
      ipLimit: 200,
      ipRemaining: 199,
      tier: "TIER_VERIFIED",
    }),
  };
});

vi.mock("@/services/fair-price.service", () => ({
  FairPriceService: {
    verifyRelationshipOrOwnership: vi.fn().mockResolvedValue(true),
    checkBrandDailyEvaluationQuota: vi.fn().mockResolvedValue(true),
    evaluateInfluencer: vi.fn().mockResolvedValue({
      evaluation: {
        basePaise: 500000,
        minPaise: 400000,
        maxPaise: 600000,
        expectedViews: 10000,
        viewStatistic: "MEDIAN",
        confidence: "HIGH",
        dataQuality: "VERIFIED",
        flags: [],
        explanation: "Fair price calculated from verified deliverables",
        engineVersion: "2.0",
      },
      inputsHash: "hash_test_123",
      cached: false,
      comparison: { marketMedianPaise: 480000 },
    }),
  },
}));

vi.mock("@/lib/feature-flags", () => ({
  assertFeatureEnabled: vi.fn().mockResolvedValue(true),
  FEATURE_FLAGS: { FAIR_PRICE: "fair_price" },
}));

vi.mock("@/lib/authz", () => ({
  resolveActor: vi.fn().mockResolvedValue({
    id: "usr_brand_1",
    role: "BRAND",
    isActiveAdmin: false,
  }),
}));

vi.mock("@/lib/blacklist", () => ({
  banIp: vi.fn().mockResolvedValue(true),
  unbanIp: vi.fn().mockResolvedValue(true),
  getBanDetails: vi.fn().mockResolvedValue({ banned: false }),
  listBannedIps: vi.fn().mockResolvedValue([]),
  isIpBanned: vi.fn().mockResolvedValue(false),
}));

// Standard ApiResponse Zod Schema
const apiResponseSchema = z.union([
  z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: z.unknown().optional(),
    error: z.string().optional(),
    requestId: z.string().optional(),
  }),
  z.object({
    error: z.string(),
    message: z.string().optional(),
    requestId: z.string().optional(),
    details: z.unknown().optional(),
  }),
  z.object({
    status: z.string().optional(),
    ip: z.string().optional(),
    total: z.number().optional(),
    bannedIps: z.array(z.unknown()).optional(),
  }),
]);

describe("Route Contract Matrix Tests (Requirement 1)", () => {
  const rootDir = process.cwd();
  const manifestPath = path.join(rootDir, "docs/audit/routes.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Manifest Contract Integrity Across All Routes", () => {
    it("every route with declared rateBucket maps to a valid RATE_LIMIT_CONFIGS key", () => {
      const validBuckets = new Set(Object.keys(RATE_LIMIT_CONFIGS));
      // Manifest also records aliases like RATE_LIMIT_CONFIGS.REPORTS or API_DEFAULT or CUSTOM
      validBuckets.add("API_DEFAULT");
      validBuckets.add("REPORTS");
      validBuckets.add("RATE_LIMIT_CONFIGS.REPORTS");
      validBuckets.add("CUSTOM");

      for (const route of manifest.apiRoutes) {
        for (const [method, opt] of Object.entries(route.authOptions || {})) {
          const entry = opt as { rateBucket?: string | null };
          if (entry.rateBucket) {
            const cleanBucket = entry.rateBucket.replace("RATE_LIMIT_CONFIGS.", "");
            expect(
              validBuckets.has(cleanBucket) || validBuckets.has(entry.rateBucket),
              `Route ${method} ${route.path} references unknown rateBucket '${entry.rateBucket}'`
            ).toBe(true);
          }
        }
      }
    });

    it("verifies auth requirements match route prefix conventions", () => {
      for (const route of manifest.apiRoutes) {
        // All /api/admin/* routes MUST require auth
        if (route.path.startsWith("/api/admin/")) {
          for (const [method, opt] of Object.entries(route.authOptions || {})) {
            const entry = opt as { requireAuth?: boolean; requireAdmin?: boolean; requirePermission?: string };
            const isProtected = Boolean(entry.requireAuth || entry.requireAdmin || entry.requirePermission);
            expect(
              isProtected,
              `Admin route ${method} ${route.path} is missing auth protection`
            ).toBe(true);
          }
        }
      }
    });
  });

  describe("Matrix Invariant 1: Unauthenticated Requests yield 401", () => {
    it("rejects unauthenticated request on requireAuth route with 401", async () => {
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/pricing/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ influencerId: "inf_123" }),
      });

      const res = await pricingEvaluatePost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
      expect(apiResponseSchema.safeParse(json).success).toBe(true);
    });
  });

  describe("Matrix Invariant 2: Role Authorization and Suspended Admin Rejection", () => {
    it("rejects non-admin role accessing admin route with 403", async () => {
      const brandSession = makeSession("BRAND");
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(brandSession);

      const req = new NextRequest("http://localhost:3000/api/admin/ip-blacklist", {
        method: "GET",
      });

      const res = await ipBlacklistGet(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error || json.message).toBeDefined();
    });

    it("rejects suspended admin accessing admin route with 403", async () => {
      const suspendedAdmin = makeSession("ADMIN", { status: "SUSPENDED" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(suspendedAdmin);

      const req = new NextRequest("http://localhost:3000/api/admin/ip-blacklist", {
        method: "GET",
      });

      const res = await ipBlacklistGet(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toBe("Forbidden");
      expect(json.message).toContain("suspended");
    });
  });

  describe("Matrix Invariant 3: Payload Size Limit (413 Payload Too Large)", () => {
    it("rejects request exceeding maxBodySize with 413 and Payload Too Large error", async () => {
      const session = makeSession("BRAND");
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      // Route defines maxBodySize: 32KB (32768 bytes)
      const oversizedContent = "A".repeat(40 * 1024);
      const req = new NextRequest("http://localhost:3000/api/pricing/evaluate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": (40 * 1024).toString(),
        },
        body: JSON.stringify({ data: oversizedContent }),
      });

      const res = await pricingEvaluatePost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(413);

      const json = await res.json();
      expect(json.error).toBe("Payload Too Large");
      expect(json.requestId).toBeDefined();
    });
  });

  describe("Matrix Invariant 4: CSRF Cross-Site Mutation Defense", () => {
    it("rejects mutating request with sec-fetch-site: cross-site with 403", async () => {
      const session = makeSession("BRAND");
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/pricing/evaluate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
          origin: "https://evil-attacker.com",
        },
        body: JSON.stringify({ influencerId: "inf_123" }),
      });

      const res = await pricingEvaluatePost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toContain("Forbidden");
    });
  });

  describe("Matrix Invariant 5: Strict Schema Validation (Unknown Keys Rejected with 400)", () => {
    it("rejects payload containing unexpected keys with 400 Zod Validation Error", async () => {
      const session = makeSession("BRAND");
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/pricing/evaluate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          influencerId: "inf_123",
          maliciousInjectedKey: "hacked",
        }),
      });

      const res = await pricingEvaluatePost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Validation Error");
      expect(json.details).toBeDefined();
    });

    it("rejects payload missing required fields with 400 Zod Validation Error", async () => {
      const session = makeSession("BRAND");
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/pricing/evaluate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const res = await pricingEvaluatePost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Validation Error");
    });
  });

  describe("Matrix Invariant 6: Rate Limit Headers and 429 when Exhausted", () => {
    it("returns 429 Too Many Requests with retry headers when rate limit exhausted", async () => {
      const session = makeSession("BRAND");
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const { checkRateLimit } = await import("@/lib/rate-limit");
      (checkRateLimit as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Math.floor(Date.now() / 1000) + 30,
      });

      const req = new NextRequest("http://localhost:3000/api/pricing/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ influencerId: "inf_123" }),
      });

      const res = await pricingEvaluatePost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(429);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.message).toContain("Too many requests");
    });
  });

  describe("Matrix Invariant 7: Response Envelope Shape & Traceability", () => {
    it("attaches x-request-id and matches ApiResponse envelope schema on success", async () => {
      const session = makeSession("BRAND");
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const req = new NextRequest("http://localhost:3000/api/pricing/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ influencerId: "inf_123" }),
      });

      const res = await pricingEvaluatePost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      expect(res.headers.get("x-request-id")).toBeDefined();

      const json = await res.json();
      const parseResult = apiResponseSchema.safeParse(json);
      expect(parseResult.success).toBe(true);
      expect(json.data.basePaise).toBe(500000);
    });
  });
});
