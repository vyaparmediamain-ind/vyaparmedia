import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveActor } from "@/lib/authz";
import { requireActiveAdmin } from "@/lib/admin-auth";
import { adminVerificationFailuresTotal } from "@/lib/metrics";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/admin-auth", () => ({
  requireActiveAdmin: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Universal Authz Actor Resolution (resolveActor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws unauthorized when session or user id is missing", async () => {
    await expect(resolveActor(null)).rejects.toThrow("Authentication required");
    await expect(resolveActor({ user: {} })).rejects.toThrow("Authentication required");
  });

  it("resolves non-admin user with isActiveAdmin = false without invoking admin verification", async () => {
    const actor = await resolveActor({
      user: {
        id: "creator_123",
        userType: "CREATOR",
        name: "Test Creator",
        email: "creator@example.com",
      },
    });

    expect(actor.id).toBe("creator_123");
    expect(actor.role).toBe("CREATOR");
    expect(actor.isActiveAdmin).toBe(false);
    expect(requireActiveAdmin).not.toHaveBeenCalled();
  });

  it("resolves active admin with isActiveAdmin = true when verification succeeds", async () => {
    vi.mocked(requireActiveAdmin).mockResolvedValueOnce({
      id: "admin_123",
      email: "admin@vyaparmedia.in",
      userType: "ADMIN",
    } as any);

    const actor = await resolveActor({
      user: {
        id: "admin_123",
        userType: "ADMIN",
        name: "Admin User",
        email: "admin@vyaparmedia.in",
      },
    });

    expect(actor.id).toBe("admin_123");
    expect(actor.role).toBe("ADMIN");
    expect(actor.isActiveAdmin).toBe(true);
    expect(requireActiveAdmin).toHaveBeenCalledWith({
      id: "admin_123",
      email: "admin@vyaparmedia.in",
      userType: "ADMIN",
    });
  });

  it("demotes admin with metric counter and warning log when verification is denied", async () => {
    vi.mocked(requireActiveAdmin).mockRejectedValueOnce(
      AppError.forbidden("Admin account has been suspended or demoted")
    );
    const incSpy = vi.spyOn(adminVerificationFailuresTotal, "inc");

    const actor = await resolveActor({
      user: {
        id: "banned_admin_999",
        userType: "ADMIN",
        name: "Banned Admin",
        email: "banned@vyaparmedia.in",
      },
    });

    expect(actor.id).toBe("banned_admin_999");
    expect(actor.isActiveAdmin).toBe(false);
    expect(incSpy).toHaveBeenCalledWith({ reason: "verification_denied" });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("downgraded to non-admin"),
      expect.objectContaining({
        userId: "banned_admin_999",
        reason: "verification_denied",
      })
    );
  });

  it("demotes admin with database_or_network_error reason when DB connection fails during verification", async () => {
    vi.mocked(requireActiveAdmin).mockRejectedValueOnce(
      new Error("Prisma client database connection timeout")
    );
    const incSpy = vi.spyOn(adminVerificationFailuresTotal, "inc");

    const actor = await resolveActor({
      user: {
        id: "admin_offline_db",
        userType: "ADMIN",
        name: "Admin User",
        email: "admin@vyaparmedia.in",
      },
    });

    expect(actor.id).toBe("admin_offline_db");
    expect(actor.isActiveAdmin).toBe(false);
    expect(incSpy).toHaveBeenCalledWith({ reason: "database_or_network_error" });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("downgraded to non-admin"),
      expect.objectContaining({
        userId: "admin_offline_db",
        reason: "database_or_network_error",
      })
    );
  });
});
