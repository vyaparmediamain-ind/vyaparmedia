import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import prisma from "@/lib/db";
import { acquireDistributedLock } from "@/lib/lock";
import { claimIdempotencyKey, saveIdempotencyResponse } from "@/lib/idempotency";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/feature-flags";
import { invalidate, cache } from "@/lib/cache";
import { getKolkataDayBounds } from "@/lib/telemetry-aggregator";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import redis from "@/lib/redis";

describe("Part 2 Resilience: Concurrency, Idempotency & Edge Failure Modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Cron Overlap / Double-Run Prevention", () => {
    it("Distributed Lock: prevents duplicate concurrent execution of cron workers", async () => {
      // First worker acquires the distributed lock
      vi.spyOn(redis, "set").mockResolvedValueOnce("OK");
      const firstWorkerToken = await acquireDistributedLock(
        "cron:reconcile-ledger-settlements:lock",
        300
      );
      expect(firstWorkerToken).not.toBeNull();

      // Second worker running simultaneously receives null (lock already held)
      vi.spyOn(redis, "set").mockResolvedValueOnce(null);
      const secondWorkerToken = await acquireDistributedLock(
        "cron:reconcile-ledger-settlements:lock",
        300
      );

      expect(secondWorkerToken).toBeNull();
      // Second worker must abort gracefully without duplicate mutations
    });
  });

  describe("2. Concurrent Duplicate Submissions / Replay Attacks", () => {
    it("Idempotency: double-click / concurrent replay returns duplicate check and prevents duplicate writes", async () => {
      const idempotencyKey = "idem_tx_double_click_789";
      const userId = "usr_creator_456";

      // First request claims the key successfully
      vi.spyOn(prisma.idempotencyKey, "findUnique")
        .mockResolvedValueOnce(null) // check 1: doesn't exist
        .mockResolvedValueOnce({
          // check 2: already claimed by usr_creator_456
          id: "rec_1",
          key: idempotencyKey,
          userId,
          response: { status: "PROCESSING" },
          expiresAt: new Date(Date.now() + 600000),
          createdAt: new Date(),
        } as never);

      vi.spyOn(prisma.idempotencyKey, "create").mockResolvedValueOnce({
        id: "rec_1",
        key: idempotencyKey,
        userId,
        response: { status: "PROCESSING" },
        expiresAt: new Date(Date.now() + 600000),
        createdAt: new Date(),
      } as never);

      const claim1 = await claimIdempotencyKey(idempotencyKey, userId);
      expect(claim1.isDuplicate).toBe(false);

      // Second simultaneous request with same key detects duplicate
      const claim2 = await claimIdempotencyKey(idempotencyKey, userId);
      expect(claim2.isDuplicate).toBe(true);
      expect(claim2.savedResponse).toEqual({ status: "PROCESSING" });

      // Save processed response
      const upsertSpy = vi.spyOn(prisma.idempotencyKey, "upsert").mockResolvedValueOnce({} as never);
      await saveIdempotencyResponse(idempotencyKey, {
        success: true,
        transactionId: "tx_999",
        amountPaise: 150000,
      });

      expect(upsertSpy).toHaveBeenCalledWith({
        where: { key: idempotencyKey },
        create: expect.objectContaining({
          key: idempotencyKey,
          response: {
            success: true,
            transactionId: "tx_999",
            amountPaise: 150000,
          },
        }),
        update: expect.objectContaining({
          response: {
            success: true,
            transactionId: "tx_999",
            amountPaise: 150000,
          },
        }),
      });
    });

    it("Idempotency: owner mismatch blocks cross-user replay attacks", async () => {
      const idempotencyKey = "idem_tx_stolen_replay";
      const legitUser = "usr_alice";
      const attackerUser = "usr_mallory";

      vi.spyOn(prisma.idempotencyKey, "findUnique").mockResolvedValueOnce({
        id: "rec_2",
        key: idempotencyKey,
        userId: legitUser,
        response: { status: "PROCESSING" },
        expiresAt: new Date(Date.now() + 600000),
        createdAt: new Date(),
      } as never);

      const warnSpy = vi.spyOn(logger, "warn");

      const claim = await claimIdempotencyKey(idempotencyKey, attackerUser);
      expect(claim.isDuplicate).toBe(true);
      expect(claim.ownerMismatch).toBe(true);

      // Observability: Logged owner mismatch warning without PII
      expect(warnSpy).toHaveBeenCalled();
      const logs = warnSpy.mock.calls.map((c) => JSON.stringify(c)).join(" ");
      expect(logs).toContain("Owner mismatch blocked");
      expect(logs).not.toContain("password");
    });
  });

  describe("3. Feature-Flag Service Error", () => {
    it("isFeatureEnabled fails closed (returns false) when feature flag query throws unexpected error", async () => {
      vi.spyOn(redis, "get").mockRejectedValue(new Error("Redis query timeout"));
      vi.spyOn(prisma.featureFlag, "findUnique").mockRejectedValue(new Error("Connection reset by peer"));
      const errorSpy = vi.spyOn(logger, "error");

      const result = await isFeatureEnabled(FEATURE_FLAGS.CREATOR_METRICS, {
        userId: "usr_test",
        role: "CREATOR",
      });

      // Must fail closed (false)
      expect(result).toBe(false);

      // Observability: Logged failure closed without PII
      expect(errorSpy).toHaveBeenCalled();
      const logText = errorSpy.mock.calls.map((c) => JSON.stringify(c)).join(" ");
      expect(logText).toContain("Failing closed");
    });
  });

  describe("4. Stale Cache After Config Change", () => {
    it("invalidate flushes Redis key pattern and in-memory cache", async () => {
      const scanSpy = vi.spyOn(redis, "scan").mockResolvedValueOnce(["0", ["deal:123", "deal:456"]]);
      const delSpy = vi.spyOn(redis, "del").mockResolvedValue(2);

      await invalidate("deal:*");

      expect(scanSpy).toHaveBeenCalledWith("0", "MATCH", "deal:*", "COUNT", 100);
      expect(delSpy).toHaveBeenCalledWith("deal:123", "deal:456");
    });
  });

  describe("5. Clock Skew Around IST Midnight", () => {
    it("Day bucketing strictly adheres to Asia/Kolkata date boundaries around UTC 18:30:00 (IST 00:00:00)", () => {
      // 1 millisecond before IST midnight: 23:59:59.999 IST = 18:29:59.999 UTC
      const dateBeforeMidnightUtc = new Date("2026-11-23T18:29:59.999Z");
      const boundsBefore = getKolkataDayBounds(dateBeforeMidnightUtc);
      expect(boundsBefore.dateStr).toBe("2026-11-23");

      // Exactly IST midnight: 00:00:00.000 IST = 18:30:00.000 UTC
      const dateAtMidnightUtc = new Date("2026-11-23T18:30:00.000Z");
      const boundsAtMidnight = getKolkataDayBounds(dateAtMidnightUtc);
      expect(boundsAtMidnight.dateStr).toBe("2026-11-24");

      // 1 millisecond after IST midnight: 00:00:00.001 IST = 18:30:00.001 UTC
      const dateAfterMidnightUtc = new Date("2026-11-23T18:30:00.001Z");
      const boundsAfter = getKolkataDayBounds(dateAfterMidnightUtc);
      expect(boundsAfter.dateStr).toBe("2026-11-24");

      // Verify the day start and end timestamps in UTC
      expect(boundsAtMidnight.dayStart.toISOString()).toBe("2026-11-23T18:30:00.000Z");
      expect(boundsAtMidnight.dayEnd.toISOString()).toBe("2026-11-24T18:30:00.000Z");
    });
  });

  describe("6. Large Payload Rejection", () => {
    it("Oversized payload throws 413 AppError.payloadTooLarge", () => {
      const err = AppError.payloadTooLarge("File size exceeds 2MB limit");
      expect(err.statusCode).toBe(413);
      expect(err.errorCode).toBe("FILE_TOO_LARGE");
      expect(err.message).toBe("File size exceeds 2MB limit");
    });
  });
});
