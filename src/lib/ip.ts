import { NextRequest } from "next/server";

export function getSecureClientIp(request: Request | NextRequest | { headers: Headers }): string {
  let headersList: Headers;
  if (request instanceof Request) {
    headersList = request.headers;
  } else if ("headers" in request && typeof request.headers.get === "function") {
    headersList = request.headers as Headers;
  } else {
    return "unknown";
  }

  // Cloudflare Connecting IP (most trusted when behind Cloudflare proxy)
  const cfConnectingIp = headersList.get("cf-connecting-ip");
  if (cfConnectingIp?.trim()) {
    return cleanIp(cfConnectingIp.trim());
  }

  // Direct next-hop IP from NextRequest runtime
  if ("ip" in request && (request as NextRequest & { ip?: string }).ip) {
    return cleanIp((request as NextRequest & { ip?: string }).ip || "unknown");
  }

  // Fallback to direct x-real-ip header
  const realIp = headersList.get("x-real-ip");
  if (realIp?.trim()) {
    return cleanIp(realIp.trim());
  }

  // Parse x-forwarded-for: client IP is the first element in standard proxies
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    const clientIp = forwardedFor.split(",")[0]?.trim();
    if (clientIp) return cleanIp(clientIp);
  }

  return "unknown";
}

function cleanIp(ip: string): string {
  if (ip.startsWith("::ffff:")) {
    return ip.slice(7);
  }
  return ip;
}
