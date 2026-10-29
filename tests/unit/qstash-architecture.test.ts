import { describe, it, expect, afterAll } from "vitest";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  publishJob,
  recordDeadLetterJob,
  JOB_CATEGORY_CONFIGS,
} from "@/lib/qstash";
import { POST as processRazorpayWebhook } from "@/app/api/webhooks/razorpay/process/route";
import { POST as jobsConsumer } from "@/app/api/jobs/consumer/route";
import { POST as jobsDlq } from "@/app/api/jobs/dlq/route";
import { JobCategory, JobStatus } from "@prisma/client";

describe("Upstash QStash Background Architecture", () => {
  const createdDlqIds: string[] = [];

  afterAll(async () => {
    if (createdDlqIds.length > 0) {
      await prisma.deadLetterJob.deleteMany({
        where: { id: { in: createdDlqIds } },
      });
    }
  });

  describe("Requirement 1: Consumer Signature Verification & Endpoint Protection", () => {
    it("should reject direct call to /api/webhooks/razorpay/process without signature with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/webhooks/razorpay/process", {
        method: "POST",
        body: JSON.stringify({ eventId: "evt_test", eventType: "payment.captured" }),
        headers: { "content-type": "application/json" },
      });

      const res = await processRazorpayWebhook(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Missing Upstash-Signature header");
    });

    it("should reject direct call to /api/jobs/consumer without signature with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/jobs/consumer", {
        method: "POST",
        body: JSON.stringify({ topic: "analytics.track", category: "best-effort" }),
        headers: { "content-type": "application/json" },
      });

      const res = await jobsConsumer(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Missing Upstash-Signature header");
    });

    it("should reject direct call to /api/jobs/dlq without signature with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/jobs/dlq", {
        method: "POST",
        body: JSON.stringify({ topic: "test.fail", category: "time-critical" }),
        headers: { "content-type": "application/json" },
      });

      const res = await jobsDlq(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Missing Upstash-Signature header");
    });

    it("should allow verified QStash requests with valid signature", async () => {
      const req = new NextRequest("http://localhost:3000/api/jobs/consumer", {
        method: "POST",
        body: JSON.stringify({ topic: "test.acknowledge", category: "best-effort" }),
        headers: {
          "content-type": "application/json",
          "upstash-signature": "valid_mock_qstash_signature",
        },
      });

      const res = await jobsConsumer(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe("Requirement 2 & 5: Categorized Retry & Backoff Strategy", () => {
    it("should configure time-critical jobs with 5 retries and exponential backoff", () => {
      const config = JOB_CATEGORY_CONFIGS["time-critical"];
      expect(config.retries).toBe(5);
      expect(config.backoffMode).toBe("exponential");
      expect(config.failureCallbackPath).toBe("/api/jobs/dlq");
      expect(config.timeoutSeconds).toBe(60);
    });

    it("should configure scheduled jobs with 3 retries and exponential backoff", () => {
      const config = JOB_CATEGORY_CONFIGS["scheduled"];
      expect(config.retries).toBe(3);
      expect(config.backoffMode).toBe("exponential");
      expect(config.failureCallbackPath).toBe("/api/jobs/dlq");
      expect(config.timeoutSeconds).toBe(120);
    });

    it("should configure best-effort jobs with 2 retries and linear backoff", () => {
      const config = JOB_CATEGORY_CONFIGS["best-effort"];
      expect(config.retries).toBe(2);
      expect(config.backoffMode).toBe("linear");
      expect(config.failureCallbackPath).toBe("/api/jobs/dlq");
      expect(config.timeoutSeconds).toBe(30);
    });
  });

  describe("Requirement 3: Deduplication ID Enforcement", () => {
    it("should throw error if deduplicationId is missing on time-critical jobs", async () => {
      await expect(
        publishJob({
          endpoint: "/api/webhooks/razorpay/process",
          topic: "payment.captured",
          category: "time-critical",
          payload: { eventId: "pay_123" },
        }),
      ).rejects.toThrow("deduplicationId is mandatory for time-critical jobs");
    });

    it("should throw error if deduplicationId is missing on scheduled jobs", async () => {
      await expect(
        publishJob({
          endpoint: "/api/jobs/consumer",
          topic: "cron.daily_reconciliation",
          category: "scheduled",
          payload: { date: "2026-09-13" },
        }),
      ).rejects.toThrow("deduplicationId is mandatory for scheduled jobs");
    });

    it("should proceed when deduplicationId is provided", async () => {
      const result = await publishJob({
        endpoint: "/api/webhooks/razorpay/process",
        topic: "payment.captured",
        category: "time-critical",
        deduplicationId: "evt_unique_101",
        payload: { eventId: "evt_unique_101" },
      });

      expect(result.deduplicationId).toBe("evt_unique_101");
    });
  });

  describe("Requirement 6: Light Payload Budget Enforcement (<8KB IDs only)", () => {
    it("should reject payloads exceeding 8KB budget to prevent bloat and staleness", async () => {
      const heavyPayload = {
        data: "X".repeat(9000),
      };

      await expect(
        publishJob({
          endpoint: "/api/jobs/consumer",
          topic: "analytics.track",
          category: "best-effort",
          payload: heavyPayload,
        }),
      ).rejects.toThrow("exceeds maximum allowed budget of 8192 bytes");
    });

    it("should accept lightweight payloads containing only IDs and references", async () => {
      const lightPayload = {
        userId: "usr_abc123",
        dealId: "deal_xyz789",
        action: "SUBMIT_CONTENT",
      };

      const result = await publishJob({
        endpoint: "/api/jobs/consumer",
        topic: "gamification.evaluate_badges",
        category: "best-effort",
        payload: lightPayload,
      });

      expect(result).toBeDefined();
    });
  });

  describe("Requirement 4 & DoD: Dead-Letter Queue (DLQ) Flow on Failure", () => {
    it("should record failed-after-all-retries job to DeadLetterJob table with status FAILED", async () => {
      const dedupId = `dlq_unit_${Date.now()}`;
      const record = await recordDeadLetterJob({
        jobId: "msg_failed_simulation",
        endpoint: "/api/jobs/consumer",
        category: "time-critical",
        topic: "payment.webhook.processing_failed",
        deduplicationId: dedupId,
        payload: { eventId: "evt_fail_999", attempt: 5 },
        errorMessage: "Simulated gateway 500 error after 5 attempts",
        attempts: 5,
        maxRetries: 5,
      });

      expect(record).not.toBeNull();
      expect(record?.id).toBeDefined();
      if (record?.id) createdDlqIds.push(record.id);

      expect(record?.status).toBe(JobStatus.FAILED);
      expect(record?.category).toBe(JobCategory.TIME_CRITICAL);
      expect(record?.deduplicationId).toBe(dedupId);

      // Verify in DB
      const dbEntry = await prisma.deadLetterJob.findUnique({
        where: { id: record!.id },
      });
      expect(dbEntry).not.toBeNull();
      expect(dbEntry?.errorMessage).toContain("Simulated gateway 500 error");
    });

    it("should handle incoming QStash failure callback at /api/jobs/dlq with signature", async () => {
      const dedupId = `dlq_callback_${Date.now()}`;
      const req = new NextRequest("http://localhost:3000/api/jobs/dlq", {
        method: "POST",
        body: JSON.stringify({
          jobId: "msg_qstash_callback_404",
          endpoint: "/api/jobs/consumer",
          category: "scheduled",
          topic: "cron.reconciliation.failed",
          deduplicationId: dedupId,
          errorMessage: "QStash retries exhausted: 504 Gateway Timeout",
          attempts: 3,
          maxRetries: 3,
        }),
        headers: {
          "content-type": "application/json",
          "upstash-signature": "valid_mock_qstash_signature",
        },
      });

      const res = await jobsDlq(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.dlqId).toBeDefined();
      if (json.dlqId) createdDlqIds.push(json.dlqId);

      const dbEntry = await prisma.deadLetterJob.findUnique({
        where: { id: json.dlqId },
      });
      expect(dbEntry).not.toBeNull();
      expect(dbEntry?.category).toBe(JobCategory.SCHEDULED);
    });
  });
});
