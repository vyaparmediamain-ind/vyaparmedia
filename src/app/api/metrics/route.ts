import { NextResponse } from "next/server";
import { getMetrics, getMetricsContentType } from "@/lib/metrics";
import { getSecureClientIp } from "@/lib/ip";
import { logger } from "@/lib/logger";
import crypto from "node:crypto";

// Optional: you can restrict access to this route with a bearer token for enterprise security
// This is typical for Prometheus scraping endpoints
const EXPECTED_TOKEN = process.env.PROMETHEUS_AUTH_TOKEN || null;

export async function GET(request: Request) {
try {
// Require auth token in ALL environments metrics exposure is a security risk.
if (!EXPECTED_TOKEN) {
logger.error(
"[Metrics] PROMETHEUS_AUTH_TOKEN is not set metrics endpoint disabled",
);
return new NextResponse("Not Found", { status: 404 });
}

const authHeader = request.headers.get("Authorization") || "";
const expectedHeader = `Bearer ${EXPECTED_TOKEN}`;

// Use timingSafeEqual on hashed values to prevent timing attacks while handling variable length headers.
const expectedHash = crypto.createHash("sha256").update(expectedHeader).digest();
const actualHash = crypto.createHash("sha256").update(authHeader).digest();

if (!crypto.timingSafeEqual(expectedHash, actualHash)) {
logger.warn(
"[Metrics] Unauthorized attempt to access metrics endpoint",
{
ip: getSecureClientIp(request),
},
);
return new NextResponse("Unauthorized", { status: 401 });
}

const metrics = await getMetrics();
const contentType = getMetricsContentType();

return new NextResponse(metrics, {
status: 200,
headers: {
"Content-Type": contentType,
},
});
} catch (error) {
logger.error("Failed to generate metrics", error);
return new NextResponse("Internal Server Error", { status: 500 });
}
}
