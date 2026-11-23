/**
 * Prometheus Metrics & Observability Unit Tests
 *
 * Verifies that the 9 required Prometheus metrics are properly declared,
 * registered in prom-client, and formatted for the /api/metrics endpoint:
 *
 * 1. telemetry_events_received_total
 * 2. telemetry_events_dropped_total{reason}
 * 3. telemetry_flush_duration_ms
 * 4. fair_price_evaluations_total{confidence,dataQuality}
 * 5. fair_price_compute_duration_ms
 * 6. instagram_insights_requests_total{status}
 * 7. campaign_metrics_job_duration_ms
 * 8. report_generated_total{type,format}
 * 9. cron_job_runs_total{job,status}
 */

import { describe, it, expect } from "vitest";
import {
  telemetryEventsReceivedTotal,
  telemetryEventsDroppedTotal,
  telemetryFlushDurationMs,
  fairPriceEvaluationsTotal,
  fairPriceComputeDurationMs,
  instagramInsightsRequestsTotal,
  campaignMetricsJobDurationMs,
  reportGeneratedTotal,
  cronJobRunsTotal,
  getMetrics,
  getMetricsContentType,
} from "@/lib/metrics";

describe("Prometheus Metrics Registration & Ingestion Suite", () => {
  it("registers all 9 custom observability metrics in prom-client", () => {
    expect(telemetryEventsReceivedTotal).toBeDefined();
    expect(telemetryEventsDroppedTotal).toBeDefined();
    expect(telemetryFlushDurationMs).toBeDefined();
    expect(fairPriceEvaluationsTotal).toBeDefined();
    expect(fairPriceComputeDurationMs).toBeDefined();
    expect(instagramInsightsRequestsTotal).toBeDefined();
    expect(campaignMetricsJobDurationMs).toBeDefined();
    expect(reportGeneratedTotal).toBeDefined();
    expect(cronJobRunsTotal).toBeDefined();
  });

  it("increments counters with and without label combinations", async () => {
    // 1. Unlabeled counter
    telemetryEventsReceivedTotal.inc();

    // 2. Reason-labeled dropped counter
    telemetryEventsDroppedTotal.inc({ reason: "INVALID_SCHEMA" });
    telemetryEventsDroppedTotal.inc({ reason: "REDIS_DOWN" });

    // 3. Fair price evaluations with confidence & dataQuality
    fairPriceEvaluationsTotal.inc({ confidence: "HIGH", dataQuality: "VERIFIED" });
    fairPriceEvaluationsTotal.inc({ confidence: "LOW", dataQuality: "ESTIMATED" });

    // 4. Instagram insights status
    instagramInsightsRequestsTotal.inc({ status: "success" });
    instagramInsightsRequestsTotal.inc({ status: "error" });

    // 5. Report generated type and format
    reportGeneratedTotal.inc({ type: "CAMPAIGN_ROI", format: "PDF" });
    reportGeneratedTotal.inc({ type: "MARKET_RANGE", format: "JSON" });

    // 6. Cron job runs
    cronJobRunsTotal.inc({ job: "campaign-metrics", status: "SUCCESS" });
    cronJobRunsTotal.inc({ job: "telemetry-flush", status: "FAILED" });

    // 7. Histograms
    telemetryFlushDurationMs.observe(45);
    fairPriceComputeDurationMs.observe(12);
    campaignMetricsJobDurationMs.observe(1250);

    const metricsOutput = await getMetrics();

    expect(metricsOutput).toContain("VyaparMedia_telemetry_events_received_total");
    expect(metricsOutput).toContain('reason="INVALID_SCHEMA"');
    expect(metricsOutput).toContain('confidence="HIGH"');
    expect(metricsOutput).toContain('status="success"');
    expect(metricsOutput).toContain('type="CAMPAIGN_ROI"');
    expect(metricsOutput).toContain('job="campaign-metrics"');
  });

  it("provides standard Prometheus content type header", () => {
    const contentType = getMetricsContentType();
    expect(contentType).toMatch(/text\/plain/);
  });
});
