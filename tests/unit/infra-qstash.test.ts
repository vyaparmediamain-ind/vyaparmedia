import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { secureQStashEndpoint } from "@/lib/qstash-guard";
import { verifyCronSchedules } from "@/../scripts/verify-qstash-crons";
import * as idempotency from "@/lib/idempotency";
import prisma from "@/lib/db";
import { JobStatus, JobCategory } from "@prisma/client";

vi.mock("@/lib/api-wrapper", () => ({
  apiWrapper: (fn: any) => fn,
}));

vi.mock("@/lib/admin-auth", () => ({
  requireActiveAdmin: vi.fn().mockResolvedValue({ id: "admin_1", role: "ADMIN" }),
}));

// Mock QStash Receiver class and Client
vi.mock("@upstash/qstash", () => {
  class MockReceiver {
    currentSigningKey: string;
    nextSigningKey?: string | undefined;

    constructor(config: { currentSigningKey: string; nextSigningKey?: string }) {
      this.currentSigningKey = config.currentSigningKey;
      this.nextSigningKey = config.nextSigningKey;
    }

    async verify({ signature }: { signature: string }): Promise<boolean> {
      if (signature === "valid_real_signature") return true;
      if (signature === "valid_with_next_key" && this.nextSigningKey === "next_key_secret") return true;
      return false;
    }
  }

  class MockClient {
    publishJSON = vi.fn().mockResolvedValue({ messageId: "msg_123" });
    schedules = {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ scheduleId: "sch_123" }),
      delete: vi.fn().mockResolvedValue({}),
    };
  }

  return {
    Receiver: MockReceiver,
    Client: MockClient,
  };
});

describe("INFRA-QSTASH-01: QStash Guard, Anti-Replay, Idempotency & Cron Automation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("QStash Signature Guard & Key Rotation", () => {
    it("rejects requests missing the Upstash-Signature header with 401", async () => {
      const handler = vi.fn();
      const guarded = secureQStashEndpoint(handler);

      const req = new NextRequest("http://localhost:3000/api/jobs/consumer", {
        method: "POST",
      });

      const res = await guarded(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Missing Upstash-Signature header");
      expect(handler).not.toHaveBeenCalled();
    });

    it("accepts valid signatures using current signing key", async () => {
      const origCurrent = process.env.QSTASH_CURRENT_SIGNING_KEY;
      try {
        process.env.QSTASH_CURRENT_SIGNING_KEY = "current_key_secret";

        const handler = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
        const guarded = secureQStashEndpoint(handler);

        const req = new NextRequest("http://localhost:3000/api/jobs/consumer", {
          method: "POST",
          headers: {
            "upstash-signature": "valid_real_signature",
          },
          body: JSON.stringify({ topic: "test" }),
        });

        const res = await guarded(req);
        expect(res.status).toBe(200);
        expect(handler).toHaveBeenCalled();
      } finally {
        process.env.QSTASH_CURRENT_SIGNING_KEY = origCurrent;
      }
    });

    it("supports zero-downtime key rotation using nextSigningKey", async () => {
      const origCurrent = process.env.QSTASH_CURRENT_SIGNING_KEY;
      const origNext = process.env.QSTASH_NEXT_SIGNING_KEY;
      try {
        process.env.QSTASH_CURRENT_SIGNING_KEY = "expired_or_rotated_key";
        process.env.QSTASH_NEXT_SIGNING_KEY = "next_key_secret";

        const handler = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
        const guarded = secureQStashEndpoint(handler);

        const req = new NextRequest("http://localhost:3000/api/jobs/consumer", {
          method: "POST",
          headers: {
            "upstash-signature": "valid_with_next_key",
          },
          body: JSON.stringify({ topic: "test" }),
        });

        const res = await guarded(req);
        expect(res.status).toBe(200);
        expect(handler).toHaveBeenCalled();
      } finally {
        process.env.QSTASH_CURRENT_SIGNING_KEY = origCurrent;
        process.env.QSTASH_NEXT_SIGNING_KEY = origNext;
      }
    });
  });

  describe("SEC-13: Production Mock Signature Prohibition", () => {
    it("strictly rejects mock signatures when NODE_ENV is production", async () => {
      const origEnv = process.env.NODE_ENV;
      const origCurrent = process.env.QSTASH_CURRENT_SIGNING_KEY;
      try {
        (process.env as Record<string, string | undefined>)["NODE_ENV"] = "production";
        process.env.QSTASH_CURRENT_SIGNING_KEY = "test_key";

        const handler = vi.fn();
        const guarded = secureQStashEndpoint(handler);

        const req = new NextRequest("https://vyaparmedia-nine.vercel.app/api/jobs/consumer", {
          method: "POST",
          headers: {
            "upstash-signature": "valid_mock_qstash_signature",
            host: "vyaparmedia-nine.vercel.app",
          },
        });

        const res = await guarded(req);
        expect(res.status).toBe(401);
        expect(handler).not.toHaveBeenCalled();
      } finally {
        (process.env as Record<string, string | undefined>)["NODE_ENV"] = origEnv;
        process.env.QSTASH_CURRENT_SIGNING_KEY = origCurrent;
      }
    });
  });

  describe("Anti-Replay: Host Verification across Environments", () => {
    it("rejects requests if host does not match expected environment in production", async () => {
      const origEnv = process.env.NODE_ENV;
      const origAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      const origCurrent = process.env.QSTASH_CURRENT_SIGNING_KEY;
      try {
        (process.env as Record<string, string | undefined>)["NODE_ENV"] = "production";
        process.env.NEXT_PUBLIC_APP_URL = "https://vyaparmedia-nine.vercel.app";
        process.env.QSTASH_CURRENT_SIGNING_KEY = "current_key_secret";

        const handler = vi.fn();
        const guarded = secureQStashEndpoint(handler);

        // Attacker attempting cross-environment replay from staging/preview to production
        const req = new NextRequest("https://staging.vyaparmedia.in/api/jobs/consumer", {
          method: "POST",
          headers: {
            "upstash-signature": "valid_real_signature",
            host: "staging.vyaparmedia.in",
          },
        });

        const res = await guarded(req);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error).toContain("Anti-replay");
        expect(handler).not.toHaveBeenCalled();
      } finally {
        (process.env as Record<string, string | undefined>)["NODE_ENV"] = origEnv;
        process.env.NEXT_PUBLIC_APP_URL = origAppUrl;
        process.env.QSTASH_CURRENT_SIGNING_KEY = origCurrent;
      }
    });
  });

  describe("Consumer Idempotency by DeduplicationId", () => {
    it("claims idempotency key and prevents duplicate job processing", async () => {
      const claimSpy = vi.spyOn(idempotency, "claimIdempotencyKey").mockResolvedValue({
        isDuplicate: true,
        savedResponse: { success: true, processed: "already_done" },
      });

      // Import consumer handler directly
      const consumerModule = await import("@/app/api/jobs/consumer/route");
      const req = new NextRequest("http://localhost:3000/api/jobs/consumer", {
        method: "POST",
        headers: {
          "upstash-signature": "valid_mock_qstash_signature",
        },
        body: JSON.stringify({
          topic: "email.withdrawal",
          category: "time-critical",
          deduplicationId: "withdrawal-tx-999",
          withdrawalId: "w_123",
        }),
      });

      const res = await consumerModule.POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe("Duplicate job skipped");
      expect(json.deduplicationId).toBe("withdrawal-tx-999");
      expect(claimSpy).toHaveBeenCalledWith("job:dedup:withdrawal-tx-999");
    });
  });

  describe("Admin DLQ Replay Safety (P6-MONEY-08)", () => {
    it("reverts dead letter job status back to FAILED if re-enqueue fails", async () => {
      vi.spyOn(prisma.deadLetterJob, "findUnique").mockResolvedValue({
        id: "dlq_failed_1",
        jobId: "job_xyz",
        endpoint: "/api/jobs/consumer",
        category: JobCategory.TIME_CRITICAL,
        topic: "email.withdrawal",
        deduplicationId: "dedup_456",
        payload: { withdrawalId: "w_456" },
        status: JobStatus.FAILED,
        attempts: 5,
        maxRetries: 5,
        errorMessage: "Network timeout",
        errorStack: null,
        lastAttemptAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        resolvedBy: null,
      });

      const updateSpy = vi.spyOn(prisma.deadLetterJob, "update").mockResolvedValue({} as never);
      vi.spyOn(prisma.processedWebhookEvent, "deleteMany").mockResolvedValue({ count: 0 });

      // Mock publishJob to fail
      const qstashModule = await import("@/lib/qstash");
      vi.spyOn(qstashModule, "publishJob").mockResolvedValue({
        enqueued: false,
      });

      const adminDlqModule = await import("@/app/api/admin/jobs/dlq/route");

      const req = new NextRequest("http://localhost:3000/api/admin/jobs/dlq", {
        method: "POST",
        body: JSON.stringify({ dlqId: "dlq_failed_1", action: "retry" }),
      });
      // Mock admin session
      (req as unknown as { session: unknown }).session = {
        user: { id: "admin_user_1", role: "ADMIN", permissions: ["SYSTEM_ADMIN"] },
      };

      const res = await adminDlqModule.POST(req);
      expect(res.status).toBe(502);

      // Verify status was reverted back to FAILED
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "dlq_failed_1" },
          data: { status: JobStatus.FAILED },
        }),
      );
    });
  });

  describe("Cron Automation & Verification (P11 REL-06)", () => {
    it("verifies that all 16 background cron jobs are properly configured and route files exist", () => {
      const verification = verifyCronSchedules();
      expect(verification.success).toBe(true);
      expect(verification.errors).toHaveLength(0);
      expect(verification.schedules.length).toBe(16);
    });
  });
});
