/**
 * IP Intelligence VPN/Proxy Detection and Geolocation
 * Uses freeipapi.com (HTTPS, free, up to 60 req/min, no key required).
 * 
 * 📚 Architecture Guidelines & Operational Invariants (TP-07):
 * 1. Soft Signal Only: VPN/proxy detection MUST remain a soft signal and never solely block a user.
 * 2. Caching: Successful responses are cached in Redis for 24 hours (86,400s) to minimize egress.
 * 3. Negative Caching: Non-OK / timeout failures are cached for 5 minutes (300s) to prevent hammering.
 * 4. SEC-04 Strict IP Filtering: All private, loopback, CGNAT, broadcast, and cloud metadata (169.254.169.254)
 *    IP ranges are strictly skipped before URL interpolation.
 */

import { isIP } from "node:net";
import { redis } from "./redis";
import { logger } from "./logger";
import { IPINFO_TIMEOUT_MS } from "@/constants";
import { ipIntelFailuresTotal } from "./metrics";

const CACHE_PREFIX = "ipinfo:";
const CACHE_TTL_SECONDS = 86400; // 24 hours
const NEGATIVE_CACHE_TTL_SECONDS = 300; // 5 minutes

export interface IpDetails {
  ipAddress: string;
  latitude: number;
  longitude: number;
  cityName: string;
  countryCode: string;
  isProxy: boolean;
}

interface CacheEntry extends Partial<IpDetails> {
  failed?: boolean;
}

/**
 * Validates IP format and verifies whether an IP address belongs to
 * private, reserved, loopback, carrier-grade NAT, or cloud metadata ranges.
 */
export function isReservedOrPrivateIp(ip: string): boolean {
  if (!ip || typeof ip !== "string") return true;
  const trimmed = ip.trim();
  if (trimmed === "unknown" || trimmed === "localhost") return true;

  const version = isIP(trimmed);
  if (version === 0) return true; // Invalid IP format

  if (version === 4) {
    const parts = trimmed.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
      return true;
    }
    const p0 = parts[0];
    const p1 = parts[1];
    if (p0 === undefined || p1 === undefined) return true;
    // 0.0.0.0/8 (Current network)
    if (p0 === 0) return true;
    // 10.0.0.0/8 (Private RFC 1918)
    if (p0 === 10) return true;
    // 100.64.0.0/10 (Shared address space / Carrier-grade NAT RFC 6598)
    if (p0 === 100 && p1 >= 64 && p1 <= 127) return true;
    // 127.0.0.0/8 (Loopback RFC 1122)
    if (p0 === 127) return true;
    // 169.254.0.0/16 (Link-local & AWS/GCP/Azure instance metadata RFC 3927)
    if (p0 === 169 && p1 === 254) return true;
    // 172.16.0.0/12 (Private RFC 1918)
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;
    // 192.168.0.0/16 (Private RFC 1918)
    if (p0 === 192 && p1 === 168) return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved / Future Use)
    if (p0 >= 224) return true;

    return false;
  }

  if (version === 6) {
    const lower = trimmed.toLowerCase();
    // ::1 (Loopback) or :: (Unspecified)
    if (lower === "::1" || lower === "::") return true;
    // Link-local: fe80::/10 (fe8x, fe9x, feax, febx)
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
    // Unique local address (ULA): fc00::/7 (fc.. or fd..)
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // Multicast: ff00::/8
    if (lower.startsWith("ff")) return true;

    return false;
  }

  return true;
}

/**
 * Extracts trusted client IP prioritizing Vercel verified headers.
 */
export function extractTrustedIp(headers: Headers | Record<string, string | string[] | undefined>): string {
  const getHeader = (name: string): string | undefined => {
    if ("get" in headers && typeof headers.get === "function") {
      return headers.get(name) || undefined;
    }
    const val = (headers as Record<string, string | string[] | undefined>)[name];
    if (Array.isArray(val)) return val[0];
    return val;
  };

  const vercelForwarded = getHeader("x-vercel-forwarded-for");
  if (vercelForwarded && !isReservedOrPrivateIp(vercelForwarded)) {
    return vercelForwarded.trim();
  }

  const forwardedFor = getHeader("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((s) => s.trim());
    for (const candidate of ips) {
      if (!isReservedOrPrivateIp(candidate)) {
        return candidate;
      }
    }
  }

  const realIp = getHeader("x-real-ip");
  if (realIp && !isReservedOrPrivateIp(realIp)) {
    return realIp.trim();
  }

  return "unknown";
}

/**
 * Returns full IP details from freeipapi.com, falling back to null on failure.
 * Implements 24-hour cache and 5-minute negative caching.
 */
export async function getIpDetails(ip: string): Promise<IpDetails | null> {
  // 1. Skip private, loopback, empty, carrier-grade NAT, or cloud metadata IPs
  if (isReservedOrPrivateIp(ip)) {
    return null;
  }

  const cacheKey = `${CACHE_PREFIX}${ip}`;

  // 2. Check Redis cache (positive and negative cache)
  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      const parsed = JSON.parse(cached) as CacheEntry;
      if (parsed.failed) {
        // Negative cache hit: previous failure occurred within last 5 minutes
        return null;
      }
      return parsed as IpDetails;
    }
  } catch (err) {
    logger.debug("[IPInfo] Redis read failure; failing over to live check", { error: err });
  }

  // 3. Query freeipapi.com with timeout
  try {
    const url = `https://freeipapi.com/api/json/${encodeURIComponent(ip)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(IPINFO_TIMEOUT_MS) });

    if (!res.ok) {
      ipIntelFailuresTotal.inc({ reason: `status_${res.status}` });
      logger.warn("[IPInfo] freeipapi.com returned non-OK status", { ip, status: res.status });

      // Negative cache for 5 minutes
      try {
        await redis.setex(cacheKey, NEGATIVE_CACHE_TTL_SECONDS, JSON.stringify({ failed: true, timestamp: Date.now() }));
      } catch (cacheErr) {
        logger.debug("[IPInfo] Redis negative cache write failure", { error: cacheErr });
      }
      return null;
    }

    const data = (await res.json()) as Partial<IpDetails>;

    const details: IpDetails = {
      ipAddress: data.ipAddress || ip,
      latitude: typeof data.latitude === "number" ? data.latitude : 0,
      longitude: typeof data.longitude === "number" ? data.longitude : 0,
      cityName: data.cityName || "Unknown",
      countryCode: data.countryCode || "Unknown",
      isProxy: data.isProxy === true,
    };

    // 4. Cache positive result in Redis for 24 hours
    try {
      await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(details));
    } catch (err) {
      logger.debug("[IPInfo] Redis cache write failure", { error: err });
    }

    return details;
  } catch (fetchError) {
    ipIntelFailuresTotal.inc({ reason: "network_or_timeout" });
    logger.warn("[IPInfo] freeipapi.com request failed; failing open", {
      ip,
      error: String(fetchError),
    });

    // Negative cache for 5 minutes
    try {
      await redis.setex(cacheKey, NEGATIVE_CACHE_TTL_SECONDS, JSON.stringify({ failed: true, timestamp: Date.now() }));
    } catch (cacheErr) {
      logger.debug("[IPInfo] Redis negative cache write failure", { error: cacheErr });
    }

    return null;
  }
}

/**
 * Returns true if the IP belongs to a VPN, proxy, or hosting/datacenter network.
 * Fails open (returns false) if provider fails, ensuring user is never blocked solely on provider error.
 */
export async function isVPNOrProxy(ip: string): Promise<boolean> {
  const details = await getIpDetails(ip);
  if (!details) return false;
  return details.isProxy === true;
}
