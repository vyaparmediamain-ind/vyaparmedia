/**
* IP Intelligence VPN/Proxy Detection and Geolocation
* Uses freeipapi.com (HTTPS, free, up to 60 req/min, no key required).
* Results are cached in Redis for 1 hour per IP to minimise external calls.
*/

import { redis } from "./redis";
import { logger } from "./logger";

const CACHE_PREFIX = "ipinfo:";
const CACHE_TTL_SECONDS = 3600; // 1 hour

interface IpDetails {
ipAddress: string;
latitude: number;
longitude: number;
cityName: string;
countryCode: string;
isProxy: boolean;
}

/**
* Returns full IP details from freeipapi.com, falling back to null on failure.
*/
export async function getIpDetails(ip: string): Promise<IpDetails | null> {
// Skip private/loopback/empty/invalid IPs
if (
!ip ||
ip === "unknown" ||
ip.startsWith("192.168.") ||
ip.startsWith("10.") ||
ip === "127.0.0.1" ||
ip === "::1"
) {
return null;
}

const cacheKey = `${CACHE_PREFIX}${ip}`;
try {
const cached = await redis.get(cacheKey);
if (cached !== null) {
return JSON.parse(cached) as IpDetails;
}
} catch (err) {
logger.debug("[IPInfo] Redis read failure; failing over to live check", { error: err });
}

try {
const url = `https://freeipapi.com/api/json/${encodeURIComponent(ip)}`;
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout

let data: IpDetails;
try {
const res = await fetch(url, { signal: controller.signal });
clearTimeout(timeout);
if (!res.ok) {
logger.warn("[IPInfo] freeipapi.com returned non-OK status", { ip, status: res.status });
return null;
}
data = (await res.json()) as IpDetails;
} catch (fetchError) {
clearTimeout(timeout);
logger.warn("[IPInfo] freeipapi.com request failed; failing open", {
ip,
error: String(fetchError),
});
return null;
}

const details: IpDetails = {
ipAddress: data.ipAddress || ip,
latitude: typeof data.latitude === "number" ? data.latitude : 0,
longitude: typeof data.longitude === "number" ? data.longitude : 0,
cityName: data.cityName || "Unknown",
countryCode: data.countryCode || "Unknown",
isProxy: data.isProxy === true,
};

// Cache result in Redis
try {
await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(details));
} catch (err) {
logger.debug("[IPInfo] Redis cache write failure", { error: err });
}

return details;
} catch (error) {
logger.warn("[IPInfo] Unexpected error during IP lookup; failing open", {
ip,
error: String(error),
});
return null;
}
}

/**
* Returns true if the IP belongs to a VPN, proxy, or hosting/datacenter network.
*/
export async function isVPNOrProxy(ip: string): Promise<boolean> {
const details = await getIpDetails(ip);
if (!details) return false;
return details.isProxy;
}
