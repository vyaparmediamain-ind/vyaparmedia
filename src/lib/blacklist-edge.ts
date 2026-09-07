/**
* Edge-Compatible Dynamic Blacklisting Checker
* Uses standard HTTP fetch to query Upstash Redis REST API.
* This is edge-safe and can run inside Next.js Middleware.
*/

import { logger } from "./logger-client";

let warned = false;

export async function isIpBannedEdge(ip: string): Promise<boolean> {
const restUrl = process.env.UPSTASH_REDIS_REST_URL;
const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!restUrl || !restToken) {
if (!warned) {
logger.warn(
"WARNING: Upstash REST credentials (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) are missing. IP blacklist security feature is disabled."
);
warned = true;
}
// Upstash REST credentials not set. Fall back to false (allow)
return false;
}

try {
const key = `ban:ip:${ip}`;
// Query Upstash Redis via HTTP GET
const response = await fetch(`${restUrl}/get/${key}`, {
headers: {
Authorization: `Bearer ${restToken}`,
},
// Short timeout (1s) to avoid delaying request pipeline if Redis is slow
signal: AbortSignal.timeout(1000),
});

if (!response.ok) {
return false;
}

const data = await response.json();
// Upstash REST returns { result: "value" } or { result: null }
return data && data.result !== null;
} catch (err) {
logger.error("Edge blacklist lookup failed:", err);
// Fail closed in production for security, fail open in development/testing
if (process.env.NODE_ENV === "production") {
return true;
}
return false;
}
}
