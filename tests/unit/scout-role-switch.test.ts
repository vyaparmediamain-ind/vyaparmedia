import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/db";
import { POST } from "@/app/api/user/switch-role/route";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/audit", () => ({
  createActivityLog: vi.fn().mockResolvedValue({ id: "audit_123" }),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    del: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock("@/lib/db", () => {
  const dbMock: any = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    scoutProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    influencerProfile: {
      create: vi.fn(),
    },
    brandProfile: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => cb(dbMock)),
  };
  return {
    default: dbMock,
  };
});

describe("Scout Role Conversion API (switch-role)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);

    const req = new NextRequest("http://localhost:3000/api/user/switch-role", {
      method: "POST",
      body: JSON.stringify({ targetRole: "INFLUENCER" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects conversion if user is not a SCOUT", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user_brand_1", userType: "BRAND" },
    } as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user_brand_1",
      userType: "BRAND",
      scoutProfile: null,
      influencerProfile: null,
      brandProfile: { id: "bp_1", companyName: "Test Brand" },
    } as any);

    const req = new NextRequest("http://localhost:3000/api/user/switch-role", {
      method: "POST",
      body: JSON.stringify({ targetRole: "INFLUENCER" }),
    });

    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain("Only Campus Partner (Scout) accounts can convert");
  });

  it("converts SCOUT to INFLUENCER while preserving ScoutProfile and referral network", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "scout_user_1", userType: "SCOUT" },
    } as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "scout_user_1",
      email: "amit@campus.ac.in",
      userType: "SCOUT",
      scoutProfile: {
        id: "scout_p_1",
        scoutCode: "SCOUT-AMIT",
        fullName: "Amit Kumar",
        city: "New Delhi",
        state: "Delhi",
        royaltyPercent: 1.0,
      },
      influencerProfile: null,
      brandProfile: null,
    } as any);

    const req = new NextRequest("http://localhost:3000/api/user/switch-role", {
      method: "POST",
      body: JSON.stringify({ targetRole: "INFLUENCER" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.targetRole).toBe("INFLUENCER");

    // Verify user update called
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "scout_user_1" },
        data: { userType: "INFLUENCER" },
      })
    );

    // Verify influencer profile created with scout details
    expect(prisma.influencerProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "scout_user_1",
          displayName: "Amit Kumar",
          city: "New Delhi",
        }),
      })
    );
  });

  it("converts SCOUT to BRAND while preserving ScoutProfile", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "scout_user_1", userType: "SCOUT" },
    } as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "scout_user_1",
      email: "amit@campus.ac.in",
      userType: "SCOUT",
      scoutProfile: {
        id: "scout_p_1",
        scoutCode: "SCOUT-AMIT",
        fullName: "Amit Kumar",
        city: "New Delhi",
        state: "Delhi",
        royaltyPercent: 1.0,
        panNumber: "ABCDE1234F",
      },
      influencerProfile: null,
      brandProfile: null,
    } as any);

    const req = new NextRequest("http://localhost:3000/api/user/switch-role", {
      method: "POST",
      body: JSON.stringify({ targetRole: "BRAND" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.targetRole).toBe("BRAND");

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "scout_user_1" },
        data: { userType: "BRAND" },
      })
    );

    expect(prisma.brandProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "scout_user_1",
          companyName: "Amit Kumar's Brand",
          panNumber: "ABCDE1234F",
        }),
      })
    );
  });
});
