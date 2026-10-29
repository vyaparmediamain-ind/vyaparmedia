import { describe, it, expect, vi } from "vitest";
import {
  razorpayApiDurationMs,
  razorpayApiErrorsTotal,
  razorpayWebhookLagSeconds,
  razorpayPayoutsTotal,
  circuitBreakerOpenTotal,
  getMetrics,
} from "@/lib/metrics";
import { instrumentRazorpayCall } from "@/lib/razorpay";
import { withCircuitBreaker } from "@/lib/circuit-breaker";
import { redis } from "@/lib/redis";

describe("RZP-METRICS-01 (Checklist H): Razorpay Observability & Metrics", () => {
  it("observes API latency and error counter on Razorpay API calls", async () => {
    // Test successful operation
    const result = await instrumentRazorpayCall("orders.create", async () => {
      return { id: "order_123" };
    });
    expect(result.id).toBe("order_123");

    // Test failing operation
    await expect(
      instrumentRazorpayCall("payouts.create", async () => {
        throw new Error("Gateway timeout");
      }),
    ).rejects.toThrow("Gateway timeout");

    const metricsOutput = await getMetrics();
    expect(metricsOutput).toContain("VyaparMedia_razorpay_api_duration_ms");
    expect(metricsOutput).toContain("VyaparMedia_razorpay_api_errors_total");
    expect(metricsOutput).toContain('operation="orders.create"');
    expect(metricsOutput).toContain('operation="payouts.create"');
  });

  it("records circuit breaker open counter when threshold is crossed", async () => {
    vi.spyOn(redis, "incr").mockResolvedValue(5);
    vi.spyOn(redis, "expire").mockResolvedValue(1);
    vi.spyOn(redis, "set").mockResolvedValue("OK");
    vi.spyOn(redis, "del").mockResolvedValue(1);

    await expect(
      withCircuitBreaker(
        "test_trip_action",
        async () => {
          const err: any = new Error("Gateway 500");
          err.statusCode = 500;
          throw err;
        },
        { failureThreshold: 5, resetTimeout: 60 },
      ),
    ).rejects.toThrow();

    const metricsOutput = await getMetrics();
    expect(metricsOutput).toContain("VyaparMedia_circuit_breaker_open_total");
    expect(metricsOutput).toContain('action_name="test_trip_action"');
  });

  it("registers webhook lag and payout outcome counters", async () => {
    razorpayWebhookLagSeconds.observe({ event_type: "payment.captured" }, 12);
    razorpayPayoutsTotal.inc({ status: "processed" });
    razorpayPayoutsTotal.inc({ status: "reversed" });

    const metricsOutput = await getMetrics();
    expect(metricsOutput).toContain("VyaparMedia_razorpay_webhook_lag_seconds");
    expect(metricsOutput).toContain("VyaparMedia_razorpay_payouts_total");
    expect(metricsOutput).toContain('status="processed"');
    expect(metricsOutput).toContain('status="reversed"');
  });
});
