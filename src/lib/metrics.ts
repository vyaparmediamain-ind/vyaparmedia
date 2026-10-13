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

// Provide access to the metrics string
export const getMetrics = async () => {
return await client.register.metrics();
};

export const getMetricsContentType = () => {
return client.register.contentType;
};
