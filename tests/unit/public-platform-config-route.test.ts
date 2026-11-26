import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as publicPlatformConfigHandler } from "@/app/api/public/platform-config/route";

describe("Public Platform Config API Route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns public corporate fields safely without exposing secrets", async () => {
    const response = await publicPlatformConfigHandler();
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(typeof body.data).toBe("object");

    // Corporate fields must be present in object keys
    expect(body.data).toHaveProperty("legalName");
    expect(body.data).toHaveProperty("gstin");
    expect(body.data).toHaveProperty("address");
    expect(body.data).toHaveProperty("email");
    expect(body.data).toHaveProperty("website");

    // Must not leak sensitive secrets
    expect(body.data).not.toHaveProperty("DATABASE_URL");
    expect(body.data).not.toHaveProperty("NEXTAUTH_SECRET");
    expect(body.data).not.toHaveProperty("ENCRYPTION_KEY");
  });
});
