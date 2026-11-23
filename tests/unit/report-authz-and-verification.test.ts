import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReportVerificationService } from "@/services/report-verification.service";
import prisma from "@/lib/db";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("Report Authorization & Verification Suite (Report Standard v3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ReportVerificationService.verifyReport", () => {
    it("returns valid: false immediately if report ID is empty or invalid", async () => {
      const res = await ReportVerificationService.verifyReport("");
      expect(res.valid).toBe(false);
    });

    it("returns valid: false when report ID is not in database", async () => {
      vi.spyOn(prisma.generatedReport, "findUnique").mockResolvedValue(null);
      const res = await ReportVerificationService.verifyReport("VM-ROI-20261122-ABCDEF");
      expect(res.valid).toBe(false);
    });

    it("returns minimal verification details without leaking payload or user PII", async () => {
      const mockRecord = {
        id: "VM-ROI-20261122-ABCDEF",
        type: "ROI",
        createdAt: new Date("2026-11-22T10:00:00.000Z"),
      };

      vi.spyOn(prisma.generatedReport, "findUnique").mockResolvedValue(mockRecord as unknown as import("@prisma/client").GeneratedReport);

      const res = await ReportVerificationService.verifyReport("VM-ROI-20261122-ABCDEF");
      expect(res.valid).toBe(true);
      expect(res.id).toBe("VM-ROI-20261122-ABCDEF");
      expect(res.type).toBe("ROI");
      expect(res.createdAt).toBe("2026-11-22T10:00:00.000Z");

      // Verify no sensitive payload or user IDs leaked
      expect(res).not.toHaveProperty("payloadHash");
      expect(res).not.toHaveProperty("userId");
      expect(res).not.toHaveProperty("scopeId");
    });
  });
});
