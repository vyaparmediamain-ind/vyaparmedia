import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { assertNoDuplicateDocument } from "@/lib/kyc";
import prisma from "@/lib/db";
import { redis } from "@/lib/redis";
import { AppError } from "@/lib/errors";

describe("KYC-RACE-01: Duplicate Document Race Safety & Atomic Tier Elevation", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("prevents concurrent duplicate document submission race via distributed lock", async () => {
    const docNumber = `ABCDE${Math.floor(1000 + Math.random() * 9000)}Z`;
    const userA = `user_race_a_${Date.now()}`;
    const userB = `user_race_b_${Date.now()}`;

    // Mock prisma findFirst to return null initially (no DB records yet)
    vi.spyOn(prisma.verificationDocument, "findFirst").mockResolvedValue(null as any);
    vi.spyOn(prisma.indiaTaxCompliance, "findFirst").mockResolvedValue(null as any);

    // Run 2 concurrent assertions on the same document in Promise.all
    const results = await Promise.allSettled([
      assertNoDuplicateDocument(docNumber, "PAN_CARD", userA),
      assertNoDuplicateDocument(docNumber, "PAN_CARD", userB),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one should succeed, and the concurrent one should be rejected
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectionReason).toBeInstanceOf(AppError);
    expect(rejectionReason.message).toMatch(/CONCURRENT_VERIFICATION|DUPLICATE_DOCUMENT/);
  });

  it("throws DUPLICATE_DOCUMENT error when document is already verified by another user", async () => {
    const docNumber = `ABCDE${Math.floor(1000 + Math.random() * 9000)}X`;
    const userA = `user_owner_${Date.now()}`;
    const userB = `user_attacker_${Date.now()}`;

    vi.spyOn(prisma.verificationDocument, "findFirst").mockResolvedValue({
      id: "doc_123",
      userId: userA,
    } as any);

    await expect(assertNoDuplicateDocument(docNumber, "PAN_CARD", userB)).rejects.toThrow(
      /DUPLICATE_DOCUMENT/i
    );
  });
});
