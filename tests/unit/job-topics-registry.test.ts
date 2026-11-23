import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  JOB_TOPICS_REGISTRY,
  getTopicDefinition,
  executeJobTopicHandler,
  type JobTopicName,
} from "@/lib/job-topics";
import prisma from "@/lib/db";
import * as razorpayModule from "@/lib/razorpay";
import fs from "node:fs";
import path from "node:path";

describe("Typed Job Topic Registry & DLQ Replay Handlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Registry Completeness Scan Guard
  describe("1. Registry Completeness Scan Guard", () => {
    it("ensures every topic string written in deadLetterJob.create across src/ exists in JOB_TOPICS_REGISTRY", () => {
      const srcDir = path.resolve(process.cwd(), "src");
      const foundTopics = new Set<string>();

      function walkDir(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
            const content = fs.readFileSync(fullPath, "utf-8");
            const matches = content.matchAll(/topic:\s*["']([^"']+)["']/g);
            for (const match of matches) {
              const topic = match[1];
              // Exclude test mocks and variable identifiers
              if (topic && !topic.startsWith("${") && !topic.includes("test.")) {
                foundTopics.add(topic);
              }
            }
          }
        }
      }

      walkDir(srcDir);

      const registeredKeys = Object.keys(JOB_TOPICS_REGISTRY);

      const unregisteredTopics: string[] = [];
      for (const topic of foundTopics) {
        if (!registeredKeys.includes(topic)) {
          unregisteredTopics.push(topic);
        }
      }

      expect(unregisteredTopics).toEqual([]);
    });
  });

  // 2. Handlers idempotency under double-replay & unknown topic
  describe("2. Handlers Idempotency Under Double Replay", () => {
    it("payment.escrow_release_gateway_failed is idempotent when releaseTransferHold was already called", async () => {
      const releaseSpy = vi.spyOn(razorpayModule, "releaseTransferHold").mockResolvedValue({
        success: true,
        transferId: "trf_test_123",
        status: "settled",
      });

      vi.spyOn(prisma.paymentHold, "findUnique").mockResolvedValue({
        id: "hold_1",
        dealId: "deal_123",
        amount: 50000,
        status: "RELEASED", // Already completed/released
        razorpayTransferId: "trf_test_123",
      } as any);

      const updateSpy = vi.spyOn(prisma.paymentHold, "update");

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        if (typeof callback === "function") {
          return callback(prisma);
        }
        return callback;
      });

      const payload = {
        dealId: "deal_123",
        paymentHoldId: "hold_1",
        transferId: "trf_test_123",
        amount: 50000,
      };

      const result = await executeJobTopicHandler("payment.escrow_release_gateway_failed", payload);

      expect(result.success).toBe(true);
      expect(result.skippedDuplicate).toBe(true);
      // Because paymentHold is already COMPLETED, gateway should not be re-invoked
      expect(releaseSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("dispute.gateway_refund executes refundPayment and is idempotent on repeat execution", async () => {
      const refundSpy = vi.spyOn(razorpayModule, "refundPayment").mockResolvedValue({
        id: "rfnd_test_456",
        status: "processed",
      } as any);

      vi.spyOn(prisma.deal, "findUnique").mockResolvedValue({
        id: "deal_refund_1",
        status: "DISPUTED",
        amount: 100000,
        brand: {
          user: {
            wallet: { id: "w_brand_refund", balance: 100000 },
          },
        },
      } as any);

      vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue(null);
      vi.spyOn(prisma.transaction, "create").mockResolvedValue({ id: "tx_refund_1" } as any);

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        if (typeof callback === "function") {
          return callback(prisma);
        }
        return callback;
      });

      const payload = {
        dealId: "deal_refund_1",
        paymentId: "pay_12345",
        amount: 75000,
        refundPercentage: 75,
      };

      const result1 = await executeJobTopicHandler("dispute.gateway_refund", payload);
      expect(result1.success).toBe(true);
      expect(refundSpy).toHaveBeenCalledTimes(1);

      // Second replay: findFirst returns existing refund transaction
      vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue({ id: "tx_refund_1" } as any);

      const result2 = await executeJobTopicHandler("dispute.gateway_refund", payload);
      expect(result2.success).toBe(true);
      expect(result2.skippedDuplicate).toBe(true);
      // refundPayment not called a second time
      expect(refundSpy).toHaveBeenCalledTimes(1);
    });

    it("shipping.unbilled_shipment_reconcile deducts charge and is idempotent on repeat execution", async () => {
      vi.spyOn(prisma.deal, "findUnique").mockResolvedValue({
        id: "deal_ship_1",
        brand: {
          user: {
            wallet: { id: "w_brand_1", balance: 50000 },
          },
        },
      } as any);

      vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue(null);
      const txCreateSpy = vi.spyOn(prisma.transaction, "create").mockResolvedValue({ id: "tx_ship_1" } as any);
      const walletUpdateSpy = vi.spyOn(prisma.wallet, "update").mockResolvedValue({ id: "w_brand_1", balance: 40000 } as any);

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
        if (typeof callback === "function") {
          return callback(prisma);
        }
        return callback;
      });

      const payload = {
        dealId: "deal_ship_1",
        brandUserId: "usr_brand_1",
        awbCode: "AWB12345678",
        courierChargePaise: 10000,
      };

      const result1 = await executeJobTopicHandler("shipping.unbilled_shipment_reconcile", payload);
      expect(result1.success).toBe(true);
      expect(txCreateSpy).toHaveBeenCalledTimes(1);
      expect(walletUpdateSpy).toHaveBeenCalledTimes(1);

      // Second execution: findFirst finds existing deduction
      vi.spyOn(prisma.transaction, "findFirst").mockResolvedValue({ id: "tx_ship_1" } as any);

      const result2 = await executeJobTopicHandler("shipping.unbilled_shipment_reconcile", payload);
      expect(result2.success).toBe(true);
      expect(result2.skippedDuplicate).toBe(true);
      expect(txCreateSpy).toHaveBeenCalledTimes(1);
      expect(walletUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it("rejects unknown topic explicitly without silently swallowing", async () => {
      const promise = executeJobTopicHandler("invalid.unknown_topic", {});
      await expect(promise).rejects.toThrow("Unknown job topic: invalid.unknown_topic");
    });
  });

  // 3. Manual-Only and Runbook topics
  describe("3. Manual-Only Topics & Runbooks", () => {
    it("flags reconciliation.gateway_mismatch as isManualOnly and requiresAdminApproval", () => {
      const def = getTopicDefinition("reconciliation.gateway_mismatch");
      expect(def).toBeDefined();
      expect(def?.isManualOnly).toBe(true);
      expect(def?.requiresAdminApproval).toBe(true);
      expect(def?.runbookNote).toBeDefined();
    });
  });
});
