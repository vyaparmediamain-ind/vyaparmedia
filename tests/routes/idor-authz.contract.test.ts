import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeSession } from "../utils/auth";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock requireActiveAdmin
vi.mock("@/lib/admin-auth", () => ({
  requireActiveAdmin: vi.fn(async (user: { userType?: string; status?: string }) => {
    if (user?.userType !== "ADMIN") {
      throw AppError.forbidden("Admin access required");
    }
    if (user?.status === "SUSPENDED" || user?.status === "BANNED") {
      throw AppError.forbidden("Account is suspended");
    }
    return true;
  }),
}));

// Mock rate limiting
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
    checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
  };
});

// Mock idempotency
vi.mock("@/lib/idempotency", () => ({
  claimIdempotencyKey: vi.fn().mockResolvedValue({ isDuplicate: false }),
  releaseIdempotencyKey: vi.fn().mockResolvedValue(true),
  saveIdempotencyResponse: vi.fn().mockResolvedValue(true),
}));

// Mock Deal DB / Cache
vi.mock("@/lib/cache", () => ({
  cache: vi.fn(async (_key: string, fetcher: () => Promise<unknown>) => fetcher()),
}));

vi.mock("@/lib/db", () => {
  const mockDeal = {
    id: "deal_123",
    brand: { id: "bp_1", userId: "usr_brand_owner" },
    influencer: { id: "ip_1", userId: "usr_influencer_owner" },
    campaign: { id: "camp_1", title: "Festive Promo" },
    shippingAddress: { city: "Bengaluru", state: "Karnataka", pinCode: "560001" },
  };

  return {
    default: {
      deal: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          if (where.id === "deal_123") return mockDeal;
          return null;
        }),
      },
    },
  };
});

// Mock CampaignService
vi.mock("@/services/campaign.service", () => ({
  CampaignService: {
    getCampaignById: vi.fn(async (id: string, userId: string, userType: string) => {
      if (id !== "camp_123") return null;
      if (userType === "ADMIN" || userId === "usr_brand_owner") {
        return {
          id: "camp_123",
          title: "Diwali Special",
          brandId: "bp_1",
          userId: "usr_brand_owner",
        };
      }
      // IDOR: Another user accessing an unowned campaign returns null (404)
      return null;
    }),
  },
}));

// Mock ApplicationService
vi.mock("@/services/application.service", () => ({
  ApplicationService: {
    acceptApplication: vi.fn(async (userId: string, _applicationId: string) => {
      if (userId !== "usr_brand_owner") {
        // IDOR: Throws not authorized which maps to 404
        throw AppError.notFound("Application not found");
      }
      return { id: "deal_from_app", status: "INITIATED" };
    }),
  },
}));

// Mock AdminCampaignService
vi.mock("@/services/admin-campaign.service", () => ({
  AdminCampaignService: {
    getAdminCampaignDetails: vi.fn(async (id: string) => ({
      id,
      title: "Admin View Campaign",
      budgetPaise: 1000000,
    })),
  },
}));

// Mock FairPriceService
vi.mock("@/services/fair-price.service", () => ({
  FairPriceService: {
    verifyRelationshipOrOwnership: vi.fn(async (actor: { id: string; isActiveAdmin?: boolean }, influencerId: string) => {
      if (actor.isActiveAdmin) return;
      if (influencerId !== "inf_own_123") {
        throw AppError.notFound("Influencer profile not found");
      }
    }),
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
        explanation: "Fair price calculated",
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
  resolveActor: vi.fn(async (session: { user?: { id: string; userType: string; status?: string } }) => ({
    id: session?.user?.id ?? "anonymous",
    role: session?.user?.userType ?? "ANONYMOUS",
    isActiveAdmin: session?.user?.userType === "ADMIN" && session?.user?.status !== "SUSPENDED",
  })),
}));

// Import real route handlers
import { GET as dealGet } from "@/app/api/deals/[id]/route";
import { GET as campaignGet } from "@/app/api/campaigns/[id]/route";
import { POST as applicationAcceptPost } from "@/app/api/applications/[id]/accept/route";
import { POST as pricingEvaluatePost } from "@/app/api/pricing/evaluate/route";
import { GET as adminCampaignGet } from "@/app/api/admin/campaigns/[id]/route";

describe("Object-Level Authorization & IDOR Contract Tests (Requirement 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Deal IDOR Protection (/api/deals/[id])", () => {
    it("denies access (403) when an unrelated user attempts to view another user's deal", async () => {
      const unrelatedUser = makeSession("BRAND", { id: "usr_attacker" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(unrelatedUser);

      const req = new NextRequest("http://localhost:3000/api/deals/deal_123");
      const res = await dealGet(req, { params: Promise.resolve({ id: "deal_123" }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("allows deal participant (owner brand) to access deal", async () => {
      const ownerSession = makeSession("BRAND", { id: "usr_brand_owner" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession);

      const req = new NextRequest("http://localhost:3000/api/deals/deal_123");
      const res = await dealGet(req, { params: Promise.resolve({ id: "deal_123" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.deal.id).toBe("deal_123");
    });

    it("allows active admin via requireActiveAdmin to access any deal", async () => {
      const adminSession = makeSession("ADMIN", { id: "usr_active_admin", status: "ACTIVE" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);

      const req = new NextRequest("http://localhost:3000/api/deals/deal_123");
      const res = await dealGet(req, { params: Promise.resolve({ id: "deal_123" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.deal.id).toBe("deal_123");
    });

    it("denies access to suspended admin attempting to view deal", async () => {
      const suspendedAdmin = makeSession("ADMIN", { id: "usr_suspended_admin", status: "SUSPENDED" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(suspendedAdmin);

      const req = new NextRequest("http://localhost:3000/api/deals/deal_123");
      const res = await dealGet(req, { params: Promise.resolve({ id: "deal_123" }) });

      expect(res.status).toBe(403);
    });
  });

  describe("Campaign IDOR Protection (/api/campaigns/[id])", () => {
    it("returns 404 (never confirming existence) when unrelated user requests another's campaign", async () => {
      const unrelatedUser = makeSession("BRAND", { id: "usr_attacker" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(unrelatedUser);

      const req = new NextRequest("http://localhost:3000/api/campaigns/camp_123");
      const res = await campaignGet(req, { params: Promise.resolve({ id: "camp_123" }) });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.message).toBe("Campaign not found");
    });

    it("allows campaign owner brand to view campaign", async () => {
      const ownerSession = makeSession("BRAND", { id: "usr_brand_owner" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ownerSession);

      const req = new NextRequest("http://localhost:3000/api/campaigns/camp_123");
      const res = await campaignGet(req, { params: Promise.resolve({ id: "camp_123" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.campaign.id).toBe("camp_123");
    });

    it("allows active admin to view campaign", async () => {
      const adminSession = makeSession("ADMIN", { id: "usr_admin", status: "ACTIVE" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);

      const req = new NextRequest("http://localhost:3000/api/campaigns/camp_123");
      const res = await campaignGet(req, { params: Promise.resolve({ id: "camp_123" }) });

      expect(res.status).toBe(200);
    });

    it("denies suspended admin attempting to view campaign", async () => {
      const suspendedAdmin = makeSession("ADMIN", { id: "usr_suspended_admin", status: "SUSPENDED" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(suspendedAdmin);

      const req = new NextRequest("http://localhost:3000/api/campaigns/camp_123");
      const res = await campaignGet(req, { params: Promise.resolve({ id: "camp_123" }) });

      expect(res.status).toBe(403);
    });
  });

  describe("Application Acceptance IDOR Protection (/api/applications/[id]/accept)", () => {
    it("returns 404 when unrelated brand attempts to accept another brand's application", async () => {
      const attackerBrand = makeSession("BRAND", { id: "usr_attacker" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(attackerBrand);

      const req = new NextRequest("http://localhost:3000/api/applications/app_123/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customRate: 50000 }),
      });

      const res = await applicationAcceptPost(req, { params: Promise.resolve({ id: "app_123" }) });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.message).toContain("not found");
    });

    it("allows authorized campaign owner brand to accept application", async () => {
      const ownerBrand = makeSession("BRAND", { id: "usr_brand_owner" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ownerBrand);

      const req = new NextRequest("http://localhost:3000/api/applications/app_123/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customRate: 50000 }),
      });

      const res = await applicationAcceptPost(req, { params: Promise.resolve({ id: "app_123" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("deal_from_app");
    });
  });

  describe("Pricing Evaluation IDOR (/api/pricing/evaluate)", () => {
    it("returns 404 when influencer tries to evaluate another influencer's private pricing metrics", async () => {
      const attackerInfluencer = makeSession("INFLUENCER", { id: "usr_influencer_attacker" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(attackerInfluencer);

      const req = new NextRequest("http://localhost:3000/api/pricing/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ influencerId: "inf_victim_target" }),
      });

      const res = await pricingEvaluatePost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.message || json.error).toContain("Influencer profile not found");
    });

    it("allows influencer to evaluate their own profile", async () => {
      const ownerInfluencer = makeSession("INFLUENCER", { id: "usr_influencer_owner" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(ownerInfluencer);

      const req = new NextRequest("http://localhost:3000/api/pricing/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ influencerId: "inf_own_123" }),
      });

      const res = await pricingEvaluatePost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.basePaise).toBe(500000);
    });

    it("allows active admin to evaluate any influencer profile", async () => {
      const adminSession = makeSession("ADMIN", { id: "usr_admin", status: "ACTIVE" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(adminSession);

      const req = new NextRequest("http://localhost:3000/api/pricing/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ influencerId: "inf_victim_target" }),
      });

      const res = await pricingEvaluatePost(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
    });
  });

  describe("Admin Object Access (/api/admin/campaigns/[id])", () => {
    it("denies non-admin (403)", async () => {
      const brandSession = makeSession("BRAND");
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(brandSession);

      const req = new NextRequest("http://localhost:3000/api/admin/campaigns/camp_123");
      const res = await adminCampaignGet(req, { params: Promise.resolve({ id: "camp_123" }) });

      expect(res.status).toBe(403);
    });

    it("denies suspended admin (403)", async () => {
      const suspendedAdmin = makeSession("ADMIN", { status: "SUSPENDED" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(suspendedAdmin);

      const req = new NextRequest("http://localhost:3000/api/admin/campaigns/camp_123");
      const res = await adminCampaignGet(req, { params: Promise.resolve({ id: "camp_123" }) });

      expect(res.status).toBe(403);
    });

    it("allows active admin", async () => {
      const activeAdmin = makeSession("ADMIN", { status: "ACTIVE" });
      (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(activeAdmin);

      const req = new NextRequest("http://localhost:3000/api/admin/campaigns/camp_123");
      const res = await adminCampaignGet(req, { params: Promise.resolve({ id: "camp_123" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("camp_123");
    });
  });
});
