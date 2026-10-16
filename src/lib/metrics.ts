import client, { HistogramConfiguration, CounterConfiguration } from "prom-client";

const globalForPrometheus = global as unknown as {
prometheusInitialized: boolean;
};

if (!globalForPrometheus.prometheusInitialized) {
client.collectDefaultMetrics({ prefix: "VyaparMedia_" });
globalForPrometheus.prometheusInitialized = true;
}

// Ensure we don't recreate metrics on Next.js hot reload
const getOrCreateHistogram = (name: string, config: Omit<HistogramConfiguration<string>, 'name'>) => {
let metric = client.register.getSingleMetric(name);
if (!metric) {
metric = new client.Histogram({ name, ...config });
}
return metric as client.Histogram<string>;
};

const getOrCreateCounter = (name: string, config: Omit<CounterConfiguration<string>, 'name'>) => {
let metric = client.register.getSingleMetric(name);
if (!metric) {
metric = new client.Counter({ name, ...config });
}
return metric as client.Counter<string>;
};


export const httpRequestDurationMs = getOrCreateHistogram(
"VyaparMedia_http_request_duration_ms",
{
help: "Duration of HTTP requests in ms",
labelNames: ["method", "route", "status_code"],
buckets: [10, 50, 100, 300, 500, 1000, 3000, 5000], // ms buckets
},
);

export const httpRequestsTotal = getOrCreateCounter(
"VyaparMedia_http_requests_total",
{
help: "Total number of HTTP requests",
labelNames: ["method", "route", "status_code"],
},
);

export const systemErrorsTotal = getOrCreateCounter(
"VyaparMedia_system_errors_total",
{
help: "Total number of system/unhandled errors",
labelNames: ["error_type", "route"],
},
);

export const razorpayApiDurationMs = getOrCreateHistogram(
  "VyaparMedia_razorpay_api_duration_ms",
  {
    help: "Duration of outbound Razorpay API requests in ms",
    labelNames: ["operation", "status"],
    buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000],
  },
);

export const razorpayApiErrorsTotal = getOrCreateCounter(
  "VyaparMedia_razorpay_api_errors_total",
  {
    help: "Total number of outbound Razorpay API errors",
    labelNames: ["operation", "error_type"],
  },
);

export const razorpayWebhookLagSeconds = getOrCreateHistogram(
  "VyaparMedia_razorpay_webhook_lag_seconds",
  {
    help: "Lag in seconds between Razorpay event created_at and webhook ingestion",
    labelNames: ["event_type"],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  },
);

export const razorpayPayoutsTotal = getOrCreateCounter(
  "VyaparMedia_razorpay_payouts_total",
  {
    help: "Total count of Razorpay payouts processed by outcome status",
    labelNames: ["status"],
  },
);

export const circuitBreakerOpenTotal = getOrCreateCounter(
  "VyaparMedia_circuit_breaker_open_total",
  {
    help: "Total number of times a circuit breaker entered OPEN state",
    labelNames: ["action_name"],
  },
);

export const ipIntelFailuresTotal = getOrCreateCounter(
  "VyaparMedia_ip_intel_failures_total",
  {
    help: "Total number of failed or degraded IP intelligence lookups",
    labelNames: ["reason"],
  },
);

export const visionOcrRequestsTotal = getOrCreateCounter(
  "VyaparMedia_vision_ocr_requests_total",
  {
    help: "Total number of Google Vision OCR scanning attempts",
    labelNames: ["status"],
  },
);

export const visionOcrErrorsTotal = getOrCreateCounter(
  "VyaparMedia_vision_ocr_errors_total",
  {
    help: "Total number of Google Vision OCR scanning errors",
    labelNames: ["error_type"],
  },
);

// Provide access to the metrics string
export const getMetrics = async () => {
return await client.register.metrics();
};

export const getMetricsContentType = () => {
return client.register.contentType;
};
