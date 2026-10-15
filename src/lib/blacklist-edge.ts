/**
* Edge-Compatible Dynamic Blacklisting Checker
* Uses standard HTTP fetch to query Upstash Redis REST API.
* This is edge-safe and can run inside Next.js Middleware.
*/

import { logger } from "./logger-client";

let warned = false;
// In-memory cache of known banned IPs at the edge runtime to maintain protection during transient Redis hiccups
const edgeKnownBannedIps = new Set<string>();

export async function isIpBannedEdge(ip: string): Promise<boolean> {
  // Fast path: Check local edge cache first
  if (edgeKnownBannedIps.has(ip)) {
    return true;
  }

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
      logger.warn(`Edge blacklist lookup HTTP status ${response.status}; failing open with local edge ban cache`, { ip });
      return edgeKnownBannedIps.has(ip);
    }

    const data = await response.json();
    // Upstash REST returns { result: "value" } or { result: null }
    const isBanned = Boolean(data && data.result !== null);
    if (isBanned) {
      // Remember banned IP in edge runtime
      edgeKnownBannedIps.add(ip);
      // Bound the memory size
      if (edgeKnownBannedIps.size > 5000) {
        const first = edgeKnownBannedIps.values().next().value;
        if (first) edgeKnownBannedIps.delete(first);
      }
    }
    return isBanned;
  } catch (err) {
    // Fail-safe resilience:
    // If Upstash encounters a transient timeout or network error, check if the IP was previously cached as banned.
    // Fail-open for normal users to preserve site availability and prevent platform-wide lockouts during Upstash outages.
    const isCachedBanned = edgeKnownBannedIps.has(ip);
    if (isCachedBanned) {
      return true;
    }
    logger.warn("Edge blacklist lookup transiently failed; failing open to preserve legitimate user site availability", {
      ip,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
