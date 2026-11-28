import { describe, it, expect, vi, beforeEach } from "vitest";
import { FEATURE_FLAGS, FEATURE_METADATA } from "@/lib/feature-flags-metadata";
import {
  fetchInstagramPostDataDetailed,
  fetchYouTubePostDataDetailed,
} from "@/lib/fraud-detection/post-fetcher";
import { createResolutionNotifications } from "@/lib/dispute-mediator/transaction-helpers";
import { NotificationService } from "@/services/notification.service";
import { Prisma } from "@prisma/client";

describe("Feature Flags Metadata (M5 Coverage)", () => {
  it("should define all expected feature flags with valid metadata", () => {
    const keys = Object.values(FEATURE_FLAGS);
    expect(keys.length).toBeGreaterThan(5);

    for (const key of keys) {
      const meta = FEATURE_METADATA[key];
      expect(meta).toBeDefined();
      expect(meta.title).toBeTypeOf("string");
      expect(meta.simpleDescription).toBeTypeOf("string");
      expect(meta.category).toBeTypeOf("string");
      expect(meta.audienceLabel).toBeTypeOf("string");
      expect(Array.isArray(meta.intendedRoles)).toBe(true);
    }
  });

  it("should have recognized categories for every metadata entry", () => {
    const validCategories = [
      "Reports & Valuation",
      "Campaigns & Marketplace",
      "Integrations & Tracking",
    ];
    for (const meta of Object.values(FEATURE_METADATA)) {
      expect(validCategories).toContain(meta.category);
    }
  });
});

describe("Fraud Detection Post Fetcher (M5 Coverage)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should fail gracefully when URL is not an Instagram link", async () => {
    const result = await fetchInstagramPostDataDetailed("https://twitter.com/post/123");
    expect(result.status).toBe("CHECK_FAILED");
    if (result.status === "CHECK_FAILED") {
      expect(result.reason).toContain("not an Instagram link");
    }
  });

  it("should fail gracefully when URL is not a YouTube link", async () => {
    const result = await fetchYouTubePostDataDetailed("https://instagram.com/p/abc");
    expect(result.status).toBe("CHECK_FAILED");
    if (result.status === "CHECK_FAILED") {
      expect(result.reason).toContain("Invalid YouTube URL");
    }
  });

  it("should handle invalid YouTube video ID extraction cleanly", async () => {
    const result = await fetchYouTubePostDataDetailed("https://youtube.com/invalid-path");
    expect(result.status).toBe("CHECK_FAILED");
    if (result.status === "CHECK_FAILED") {
      expect(result.reason).toContain("Invalid YouTube URL");
    }
  });
});

describe("Dispute Mediator Transaction Helpers (M5 Coverage)", () => {
  it("should trigger NotificationService for both brand and influencer on dispute resolution", async () => {
    const notifySpy = vi.spyOn(NotificationService, "createNotification").mockResolvedValue({
      id: "notif_1",
      userId: "u1",
      type: "dispute",
      title: "Test",
      message: "Test message",
      data: null,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockTx = {} as Prisma.TransactionClient;

    await createResolutionNotifications(
      mockTx,
      "dispute_123",
      "REFUND_BRAND",
      "Refund granted due to non-delivery",
      "deal_456",
      "brand_789",
      "influencer_101"
    );

    expect(notifySpy).toHaveBeenCalledTimes(2);
    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "influencer_101",
        type: "dispute",
        title: expect.stringContaining("Dispute Resolved"),
      }),
      mockTx
    );
    expect(notifySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "brand_789",
        type: "dispute",
        title: expect.stringContaining("Dispute Resolved"),
      }),
      mockTx
    );
  });
});
