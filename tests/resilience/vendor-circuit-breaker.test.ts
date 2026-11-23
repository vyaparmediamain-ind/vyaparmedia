import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withCircuitBreaker } from "@/lib/circuit-breaker";
import { circuitBreakerOpenTotal } from "@/lib/metrics";
import redis from "@/lib/redis";
import { logger } from "@/lib/logger";
import { buildInstagramClicks, buildYouTubeSaves, estimateMetrics } from "@/lib/engagement-tracker";
import { SurepassKYCProvider } from "@/lib/kyc/providers/surepass";

describe("Part 2 Resilience: Vendor Circuit Breakers & Quality Flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Razorpay / Gateway: trips circuit breaker on consecutive 5xx errors and fails fast", async () => {
    const metricSpy = vi.spyOn(circuitBreakerOpenTotal, "inc");
    const errorSpy = vi.spyOn(logger, "error");

    // Mock Redis counter for failures
    let failCount = 0;
    vi.spyOn(redis, "incr").mockImplementation(async () => {
      failCount++;
      return failCount;
    });
    vi.spyOn(redis, "expire").mockResolvedValue(1);
    vi.spyOn(redis, "set").mockResolvedValue("OK");
    vi.spyOn(redis, "del").mockResolvedValue(1);

    // Call with 5xx error until threshold (3) is reached
    const simulatedRazorpayPayout = vi.fn().mockRejectedValue({
      statusCode: 502,
      message: "Bad Gateway from Razorpay Banking API",
    });

    for (let i = 0; i < 3; i++) {
      try {
        await withCircuitBreaker("razorpay:payout", simulatedRazorpayPayout, {
          failureThreshold: 3,
          resetTimeout: 30,
        });
      } catch {
        // expected failure
      }
    }

    // Circuit breaker tripped and incremented metric
    expect(metricSpy).toHaveBeenCalledWith({ action_name: "razorpay:payout" });

    // Observability: Logged without PII (no bank account number, card, or beneficiary name)
    expect(errorSpy).toHaveBeenCalled();
    const logs = errorSpy.mock.calls.map((c) => JSON.stringify(c)).join(" ");
    expect(logs).toContain("TRIPPED!");
    expect(logs).not.toContain("beneficiary_name");
  });

  it("Instagram API: insights timeout returns explicit DERIVED / UNAVAILABLE flags (no fabricated numbers)", () => {
    const clicks = buildInstagramClicks();
    expect(clicks.quality).toBe("UNAVAILABLE");
    expect(clicks.value).toBe(0);

    const estimated = estimateMetrics(25000, 2.8, "48h");
    expect(estimated.metricsQuality?.ratesQuality?.engagementRate).toBe("DERIVED");
    expect(estimated.metricsQuality?.ratesQuality?.clickThroughRate).toBe("UNAVAILABLE");
  });

  it("YouTube API: data unavailable falls back to quality metadata without fabricated metrics", () => {
    const saves = buildYouTubeSaves();
    expect(saves.quality).toBe("UNAVAILABLE");
    expect(saves.value).toBe(0);
  });

  it("Surepass KYC: 5xx API failure trips circuit breaker and fails closed without auto-verifying user", async () => {
    const metricSpy = vi.spyOn(circuitBreakerOpenTotal, "inc");
    const errorSpy = vi.spyOn(logger, "error");
    const provider = new SurepassKYCProvider("test_key", "https://mock-kyc.surepass.io");

    // Mock fetch returning 500 Server Error
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Internal Surepass Gateway Error" }), { status: 500 })
    );

    let failCount = 0;
    vi.spyOn(redis, "incr").mockImplementation(async () => {
      failCount++;
      return failCount;
    });
    vi.spyOn(redis, "expire").mockResolvedValue(1);
    vi.spyOn(redis, "set").mockResolvedValue("OK");
    vi.spyOn(redis, "del").mockResolvedValue(1);

    let lastResult;
    for (let i = 0; i < 5; i++) {
      lastResult = await provider.verifyAadhaar("123412341234");
    }

    // Must fail closed (NOT verified, status PENDING, success false)
    expect(lastResult?.success).toBe(false);
    expect(lastResult?.status).toBe("PENDING");
    expect(lastResult?.error).toBe("Verification abhi available nahi, thodi der baad try karein");

    // Circuit breaker tripped and incremented metric
    expect(metricSpy).toHaveBeenCalledWith({ action_name: "surepass:api" });

    // Observability: Logged without PII (no raw Aadhaar number leaked)
    expect(errorSpy).toHaveBeenCalled();
    const logs = errorSpy.mock.calls.map((c) => JSON.stringify(c)).join(" ");
    expect(logs).not.toContain("123412341234");
  });
});
