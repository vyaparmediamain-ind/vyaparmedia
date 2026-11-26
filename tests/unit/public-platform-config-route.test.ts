import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as publicPlatformConfigHandler } from "@/app/api/public/platform-config/route";
import { GET as authenticatedPlatformConfigHandler } from "@/app/api/reports/platform-config/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";

describe("Platform Config API Routes & Sensitive Data Isolation", () => {
  const mockAuth = vi.mocked(auth);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Public Endpoint /api/public/platform-config", () => {
    it("returns only public branding fields and strictly omits sensitive PII/statutory keys", async () => {
      const response = await publicPlatformConfigHandler();
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(typeof body.data).toBe("object");

      // Public branding fields
      expect(body.data).toHaveProperty("name");
      expect(body.data).toHaveProperty("tradeName");
      expect(body.data).toHaveProperty("email");
      expect(body.data).toHaveProperty("website");
      expect(body.data).toHaveProperty("domain");

      // Must strictly NOT leak sensitive corporate or personal details to anonymous callers
      expect(body.data).not.toHaveProperty("pan");
      expect(body.data).not.toHaveProperty("phone");
      expect(body.data).not.toHaveProperty("officialEmail");
      expect(body.data).not.toHaveProperty("billingEmail");
      expect(body.data).not.toHaveProperty("legalEmail");
      expect(body.data).not.toHaveProperty("privacyEmail");
      expect(body.data).not.toHaveProperty("grievanceEmail");
      expect(body.data).not.toHaveProperty("grievanceOfficer");

      // Must not leak infrastructure secrets
      expect(body.data).not.toHaveProperty("DATABASE_URL");
      expect(body.data).not.toHaveProperty("NEXTAUTH_SECRET");
      expect(body.data).not.toHaveProperty("ENCRYPTION_KEY");
    });
  });

  describe("Authenticated Endpoint /api/reports/platform-config", () => {
    it("rejects unauthenticated anonymous callers with 401 Unauthorized", async () => {
      mockAuth.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
      const req = new NextRequest("https://app.vyaparmedia.in/api/reports/platform-config");
      const response = await authenticatedPlatformConfigHandler(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it("returns full statutory details to authenticated users for official letterheads & statements", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "usr_active_member", userType: "INFLUENCER", isActive: true },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      const req = new NextRequest("https://app.vyaparmedia.in/api/reports/platform-config");
      const response = await authenticatedPlatformConfigHandler(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("legalName");
      expect(body.data).toHaveProperty("gstin");
      expect(body.data).toHaveProperty("address");
      expect(body.data).toHaveProperty("pan");
      expect(body.data).toHaveProperty("sacCode");
    });
  });
});
