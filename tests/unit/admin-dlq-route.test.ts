import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as dlqPostHandler, GET as dlqGetHandler } from "@/app/api/admin/jobs/dlq/route";
import prisma from "@/lib/db";
import * as qstashModule from "@/lib/qstash";
import * as auditModule from "@/lib/audit";
import { NextRequest } from "next/server";

vi.mock("@/lib/admin-auth", () => ({
  requireActiveAdmin: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/api-wrapper", () => ({
  apiWrapper: (fn: any) => fn,
}));

describe("Admin DLQ Management API - Auth, Validation & Universal Replay", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function createMockRequest(body: any, method = "POST"): NextRequest {
    return {
      json: vi.fn().mockResolvedValue(body),
      url: "https://localhost:3000/api/admin/jobs/dlq",
      session: {
        user: { id: "admin_123", email: "admin@vyapar.media", role: "ADMIN" },
      },
    } as unknown as NextRequest;
  }

  it("GET returns dead letter jobs enriched with topic registry metadata", async () => {
    vi.spyOn(prisma.deadLetterJob, "findMany").mockResolvedValue([
      {
        id: "dlq_1",
        topic: "payment.escrow_release_gateway_failed",
        category: "TIME_CRITICAL",
        status: "FAILED",
        endpoint: "/api/jobs/consumer",
        attempts: 2,
        createdAt: new Date(),
      } as any,
    ]);
    vi.spyOn(prisma.deadLetterJob, "count").mockResolvedValue(1);

    const req = {
      url: "https://localhost:3000/api/admin/jobs/dlq?limit=10",
      session: { user: { id: "admin_123", role: "ADMIN" } },
    } as unknown as NextRequest;

    const res = await dlqGetHandler(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.jobs[0].registry).toBeDefined();
    expect(data.jobs[0].registry.isMoneyImpacting).toBe(true);
    expect(data.jobs[0].registry.requiresAdminApproval).toBe(true);
  });

  it("POST rejects replay of unregistered DLQ topics with 400", async () => {
    vi.spyOn(prisma.deadLetterJob, "findUnique").mockResolvedValue({
      id: "dlq_unregistered",
      topic: "unregistered.fake_topic",
      category: "TIME_CRITICAL",
      endpoint: "/api/jobs/consumer",
      payload: {},
      attempts: 1,
    } as any);

    const req = createMockRequest({ dlqId: "dlq_unregistered" });
    const res = await dlqPostHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("is not registered in JOB_TOPICS_REGISTRY");
  });

  it("POST rejects automated replay of manual-only topics with runbook note", async () => {
    vi.spyOn(prisma.deadLetterJob, "findUnique").mockResolvedValue({
      id: "dlq_manual",
      topic: "reconciliation.gateway_mismatch",
      category: "TIME_CRITICAL",
      endpoint: "/api/jobs/consumer",
      payload: { paymentId: "pay_1" },
      attempts: 1,
    } as any);

    const req = createMockRequest({ dlqId: "dlq_manual" });
    const res = await dlqPostHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("marked as manual-only");
    expect(data.runbookNote).toBeDefined();
  });

  it("POST requires explicit confirm: true for money-impacting topics", async () => {
    vi.spyOn(prisma.deadLetterJob, "findUnique").mockResolvedValue({
      id: "dlq_money",
      topic: "payment.escrow_release_gateway_failed",
      category: "TIME_CRITICAL",
      endpoint: "/api/jobs/consumer",
      payload: { dealId: "deal_1", paymentHoldId: "hold_1", transferId: "trf_1" },
      attempts: 1,
    } as any);

    const reqWithoutConfirm = createMockRequest({ dlqId: "dlq_money" });
    const res = await dlqPostHandler(reqWithoutConfirm);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.requiresConfirmation).toBe(true);
  });

  it("POST re-enqueues job to universal /api/jobs/consumer and writes audit activity log", async () => {
    vi.spyOn(prisma.deadLetterJob, "findUnique").mockResolvedValue({
      id: "dlq_valid",
      topic: "payment.escrow_release_gateway_failed",
      category: "TIME_CRITICAL",
      endpoint: "/api/escrow/release", // Old endpoint in DB
      payload: { dealId: "deal_1", paymentHoldId: "hold_1", transferId: "trf_1" },
      attempts: 1,
    } as any);

    vi.spyOn(prisma.deadLetterJob, "update").mockResolvedValue({} as any);
    vi.spyOn(prisma.processedWebhookEvent, "deleteMany").mockResolvedValue({ count: 0 });

    const auditSpy = vi.spyOn(auditModule, "createActivityLog").mockResolvedValue({} as any);
    const publishSpy = vi.spyOn(qstashModule, "publishJob").mockResolvedValue({
      enqueued: true,
      messageId: "msg_qstash_123",
    });

    const req = createMockRequest({ dlqId: "dlq_valid", confirm: true });
    const res = await dlqPostHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.enqueued).toBe(true);

    // Verify it published to /api/jobs/consumer
    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/api/jobs/consumer",
        topic: "payment.escrow_release_gateway_failed",
      })
    );

    // Verify audit log was recorded
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_DLQ_JOB_REPLAY_INITIATED",
        entityId: "dlq_valid",
      })
    );
  });
});
