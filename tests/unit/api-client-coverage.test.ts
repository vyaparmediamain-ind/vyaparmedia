import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mocks
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

vi.mock("@/lib/logger-client", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { http, get, post, put, patch } from "@/lib/api-client/http";
import { ApiClientError } from "@/lib/api-client/errors";
import * as applicationsApi from "@/lib/api-client/applications";
import * as authApi from "@/lib/api-client/auth";
import * as campaignsApi from "@/lib/api-client/campaigns";
import * as dealsApi from "@/lib/api-client/deals";
import * as messagesApi from "@/lib/api-client/messages";
import * as settingsApi from "@/lib/api-client/settings";
import * as uploadApi from "@/lib/api-client/upload";
import * as usersApi from "@/lib/api-client/users";
import { apiClient } from "@/lib/api-client";
import { z } from "zod";

describe("Frontend API Client Modules Suite", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // =========================================================================
  // 1. HTTP Core Transport
  // =========================================================================
  describe("http.ts", () => {
    it("makes successful GET request and parses JSON", async () => {
      const mockData = { success: true, count: 5 };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as any);

      const res = await http<typeof mockData>("/api/test");
      expect(res).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith("/api/test", expect.objectContaining({ cache: "no-store" }));
    });

    it("validates response with Zod schema when provided", async () => {
      const schema = z.object({ id: z.string(), score: z.number() });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "u-123", score: 95 }),
      } as any);

      const res = await http("/api/user", { schema });
      expect(res).toEqual({ id: "u-123", score: 95 });
    });

    it("throws ApiClientError on non-ok status codes", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Bad Request", code: "INVALID_INPUT" }),
      } as any);

      await expect(http("/api/bad")).rejects.toThrow(ApiClientError);
    });

    it("supports post, put, patch helper methods", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as any);

      await post("/api/post", { a: 1 });
      expect(global.fetch).toHaveBeenCalledWith("/api/post", expect.objectContaining({ method: "POST" }));

      await put("/api/put", { b: 2 });
      expect(global.fetch).toHaveBeenCalledWith("/api/put", expect.objectContaining({ method: "PUT" }));

      await patch("/api/patch", { c: 3 });
      expect(global.fetch).toHaveBeenCalledWith("/api/patch", expect.objectContaining({ method: "PATCH" }));
    });
  });

  // =========================================================================
  // 2. Applications API
  // =========================================================================
  describe("applications.ts", () => {
    it("list calls /api/applications with query parameters", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ applications: [] }),
      } as any);

      await applicationsApi.list({ campaignId: "camp-1", page: 1 });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/applications?campaignId=camp-1&page=1"),
        expect.anything()
      );
    });

    it("apply sends POST to /api/applications", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: "app-1" }),
      } as any);

      await applicationsApi.apply({
        campaignId: "c-1",
        proposal: "Great proposal",
        proposedRate: 50000,
      });
      expect(global.fetch).toHaveBeenCalledWith("/api/applications", expect.objectContaining({ method: "POST" }));
    });

    it("action sends accept or reject action", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as any);

      await applicationsApi.action("app-1", "accept");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/applications/app-1/accept",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  // =========================================================================
  // 3. Auth API
  // =========================================================================
  describe("auth.ts", () => {
    it("sendEmailOtp sends PUT to /api/auth/verify-email-otp", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as any);

      await authApi.sendEmailOtp({ email: "test@example.com" });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/verify-email-otp",
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  // =========================================================================
  // 4. Campaigns API
  // =========================================================================
  describe("campaigns.ts", () => {
    it("create and update invoke corresponding endpoints", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "camp-new" }),
      } as any);

      await campaignsApi.create({ title: "New Campaign" });
      expect(global.fetch).toHaveBeenCalledWith("/api/campaigns", expect.objectContaining({ method: "POST" }));

      await campaignsApi.update("camp-new", { title: "Updated Title" });
      expect(global.fetch).toHaveBeenCalledWith("/api/campaigns/camp-new", expect.objectContaining({ method: "PUT" }));
    });
  });

  // =========================================================================
  // 5. Deals API
  // =========================================================================
  describe("deals.ts", () => {
    it("getById fetches deal details by ID", async () => {
      const mockResponse = {
        deal: {
          id: "deal-1",
          campaignId: "camp-1",
          influencerId: "inf-1",
          brandId: "brand-1",
          amount: 100000,
          totalAmount: 110000,
          platformFee: 10000,
          status: "IN_PROGRESS",
          createdAt: new Date().toISOString(),
          campaign: { title: "Test Camp" },
          influencer: { displayName: "Creator" },
          brand: { companyName: "Brand" },
        },
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as any);

      const res = await dealsApi.getById("deal-1");
      expect(res).toEqual(mockResponse);
    });
  });

  // =========================================================================
  // 6. Messages API
  // =========================================================================
  describe("messages.ts", () => {
    it("send sends new message to /api/messages", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: "msg-1" }),
      } as any);

      await messagesApi.send({ dealId: "deal-1", content: "Hello brand" });
      expect(global.fetch).toHaveBeenCalledWith("/api/messages", expect.objectContaining({ method: "POST" }));
    });

    it("setTyping updates typing indicator via PATCH", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as any);

      await messagesApi.setTyping({ dealId: "deal-1", isTyping: true });
      expect(global.fetch).toHaveBeenCalledWith("/api/messages", expect.objectContaining({ method: "PATCH" }));
    });
  });

  // =========================================================================
  // 7. Settings API
  // =========================================================================
  describe("settings.ts", () => {
    it("save updates user settings via PUT", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as any);

      await settingsApi.save({ displayName: "New Name" });
      expect(global.fetch).toHaveBeenCalledWith("/api/settings", expect.objectContaining({ method: "PUT" }));
    });

    it("markNotificationsAsRead sends POST with notification IDs", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as any);

      await settingsApi.markNotificationsAsRead({ markAll: true });
      expect(global.fetch).toHaveBeenCalledWith("/api/notifications", expect.objectContaining({ method: "POST" }));
    });
  });

  // =========================================================================
  // 8. Upload API
  // =========================================================================
  describe("upload.ts", () => {
    it("presign sends POST to /api/upload/presign", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ uploadUrl: "https://s3.amazonaws.com/test", key: "k1" }),
      } as any);

      const res = await uploadApi.presign({
        fileName: "photo.jpg",
        fileType: "image/jpeg",
        fileSize: 1024,
      });
      expect(res).toBeDefined();
    });
  });

  // =========================================================================
  // 9. Users API
  // =========================================================================
  describe("users.ts", () => {
    it("getInfluencer fetches public influencer profile", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "inf-1", displayName: "Creator" }),
      } as any);

      await usersApi.getInfluencer("inf-1");
      expect(global.fetch).toHaveBeenCalledWith("/api/influencers/inf-1", expect.anything());
    });

    it("switchRole sends POST to /api/user/switch-role", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, targetRole: "INFLUENCER", redirectUrl: "/dashboard", message: "Success" }),
      } as any);

      const res = await usersApi.switchRole({ targetRole: "INFLUENCER" });
      expect(res.success).toBe(true);
    });
  });

  // =========================================================================
  // 10. Aggregated apiClient Object
  // =========================================================================
  describe("index.ts (apiClient)", () => {
    it("exports centralized apiClient with all domain namespaces", () => {
      expect(apiClient.applications).toBeDefined();
      expect(apiClient.auth).toBeDefined();
      expect(apiClient.campaigns).toBeDefined();
      expect(apiClient.deals).toBeDefined();
      expect(apiClient.messages).toBeDefined();
      expect(apiClient.settings).toBeDefined();
      expect(apiClient.upload).toBeDefined();
      expect(apiClient.users).toBeDefined();
    });
  });
});
