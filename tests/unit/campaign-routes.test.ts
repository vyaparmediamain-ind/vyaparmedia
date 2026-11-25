import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCampaignsRoute } from "@/app/api/campaigns/route";
import { CampaignService } from "@/services/campaign.service";
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/services/campaign.service", () => ({
  CampaignService: {
    listCampaigns: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkTieredRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Campaigns Route Handlers Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated on GET /api/campaigns", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);

    const req = new NextRequest("http://localhost:3000/api/campaigns?page=1&limit=10");
    const res = await getCampaignsRoute(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error || json.message).toBeTruthy();
  });

  it("filters campaigns with owner scope when authenticated as brand", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "brand_owner_99", userType: "BRAND" },
    } as any);
    vi.mocked(CampaignService.listCampaigns).mockResolvedValueOnce({
      campaigns: [
        {
          id: "camp_mine_1",
          title: "Winter Launch",
          brandId: "brand_owner_99",
          status: "ACTIVE",
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    } as any);

    const req = new NextRequest("http://localhost:3000/api/campaigns?scope=mine");
    const res = await getCampaignsRoute(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(CampaignService.listCampaigns).toHaveBeenCalledWith(
      "brand_owner_99",
      "BRAND",
      expect.objectContaining({
        ownerOnly: true,
      })
    );
  });
});
