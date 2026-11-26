import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as platformConfigGetHandler } from "@/app/api/admin/system/platform-config/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-wrapper", () => ({
  apiWrapper: (fn: any) => fn,
  ApiResponse: {
    success: (data: any, message: string) => ({
      status: 200,
      json: async () => ({ success: true, data, message }),
    }),
  },
}));

describe("Admin Platform Config API Route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns live server configuration fields and tax verification result", async () => {
    const req = {
      url: "https://localhost:3000/api/admin/system/platform-config",
      session: { user: { id: "admin_123", role: "ADMIN" } },
    } as unknown as NextRequest;

    const response = await platformConfigGetHandler(req);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.fields).toBeInstanceOf(Array);
    expect(body.data.fields.length).toBeGreaterThanOrEqual(10);
    expect(body.data.taxCheck).toBeDefined();
    expect(typeof body.data.taxCheck.valid).toBe("boolean");

    const gstinField = body.data.fields.find((f: any) => f.key === "gstin");
    expect(gstinField).toBeDefined();
    expect(gstinField.envVar).toBe("PLATFORM_GSTIN");
    expect(gstinField.isTaxRequired).toBe(true);
  });
});
