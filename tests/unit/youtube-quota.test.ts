import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkAndConsumeYouTubeQuota, getPacificDateString, getYouTubeVideoDetailed } from "@/lib/youtube";
import redis from "@/lib/redis";
import { logger } from "@/lib/logger";

describe("O2-T2: YouTube API Quota Guard with Redis Counter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calculates Pacific date string correctly for quota window", () => {
    // 2026-10-15 05:00 UTC is 2026-10-14 22:00 PDT (Pacific Daylight Time)
    const testDate = new Date("2026-10-15T05:00:00Z");
    const pacificDate = getPacificDateString(testDate);
    expect(pacificDate).toBe("2026-10-14");

    // 2026-10-15 08:00 UTC is 2026-10-15 01:00 PDT
    const nextDate = new Date("2026-10-15T08:00:00Z");
    const nextPacificDate = getPacificDateString(nextDate);
    expect(nextPacificDate).toBe("2026-10-15");
  });

  it("increments quota counter in Redis when under 80% threshold", async () => {
    vi.spyOn(redis, "get").mockResolvedValue("500");
    const incrSpy = vi.spyOn(redis, "incrby").mockResolvedValue(501 as never);

    const res = await checkAndConsumeYouTubeQuota(1, "standard");
    expect(res.allowed).toBe(true);
    expect(res.currentUsage).toBe(501);
    expect(incrSpy).toHaveBeenCalledWith(expect.stringMatching(/^yt:quota:\d{4}-\d{2}-\d{2}$/), 1);
  });

  it("sets 48 hour TTL when creating new daily counter", async () => {
    vi.spyOn(redis, "get").mockResolvedValue(null);
    vi.spyOn(redis, "incrby").mockResolvedValue(1 as never);
    const expireSpy = vi.spyOn(redis, "expire").mockResolvedValue(1 as never);

    const res = await checkAndConsumeYouTubeQuota(1, "standard");
    expect(res.allowed).toBe(true);
    expect(expireSpy).toHaveBeenCalledWith(expect.stringMatching(/^yt:quota:/), 48 * 3600);
  });

  it("blocks non-critical 'standard' calls when usage exceeds 80% of quota and logs alert", async () => {
    // 8000 out of default 10000 quota
    vi.spyOn(redis, "get").mockResolvedValue("8001");
    const warnSpy = vi.spyOn(logger, "warn");
    const incrSpy = vi.spyOn(redis, "incrby");

    const res = await checkAndConsumeYouTubeQuota(1, "standard");
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("YOUTUBE_QUOTA_EXCEEDED");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(">80% threshold"),
      expect.anything(),
    );
    expect(incrSpy).not.toHaveBeenCalled();
  });

  it("allows deal-critical verification calls even when usage is above 80%", async () => {
    // 8500 out of 10000 quota
    vi.spyOn(redis, "get").mockResolvedValue("8500");
    vi.spyOn(redis, "incrby").mockResolvedValue(8501 as never);

    const res = await checkAndConsumeYouTubeQuota(1, "critical");
    expect(res.allowed).toBe(true);
    expect(res.currentUsage).toBe(8501);
  });

  it("blocks even critical calls when quota is 100% exhausted", async () => {
    vi.spyOn(redis, "get").mockResolvedValue("10000");
    const incrSpy = vi.spyOn(redis, "incrby");

    const res = await checkAndConsumeYouTubeQuota(1, "critical");
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("YOUTUBE_DAILY_LIMIT_EXHAUSTED");
    expect(incrSpy).not.toHaveBeenCalled();
  });
});
