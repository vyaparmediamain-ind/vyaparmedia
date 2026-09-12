/**
* Next.js Edge Middleware - Enterprise WAF + Security Layer
*/

import { NextResponse, NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { logger } from "@/lib/logger-client";
import { getSecureClientIp } from "@/lib/ip";

// Edge-safe auth instance
const { auth } = NextAuth(authConfig);

function hostnameFromUrl(value?: string) {
if (!value) return null;
try {
return new URL(value).hostname;
} catch {
return null;
}
}

const storagePublicHost =
hostnameFromUrl(process.env.STORAGE_PUBLIC_URL) ||
hostnameFromUrl(process.env.R2_PUBLIC_URL);
const storageEndpointHost = hostnameFromUrl(process.env.S3_ENDPOINT);
const s3Bucket = process.env.S3_BUCKET;
const s3Region = process.env.S3_REGION || "ap-south-1";

const storageConnectSources = [
storagePublicHost ? `https://${storagePublicHost}` : null,
storageEndpointHost ? `https://${storageEndpointHost}` : null,
s3Bucket ? `https://${s3Bucket}.s3.${s3Region}.amazonaws.com` : null,
].filter(Boolean);

const storageImageSources = [
storagePublicHost ? `https://${storagePublicHost}` : null,
s3Bucket ? `https://${s3Bucket}.s3.${s3Region}.amazonaws.com` : null,
].filter(Boolean);

const storageConnectStr = storageConnectSources.length > 0 ? " " + storageConnectSources.join(" ") : "";
const storageImageStr = storageImageSources.length > 0 ? " " + storageImageSources.join(" ") : "";

// Unified Content Security Policy supporting Next.js SSR/hydration with nonce-based execution, inline styles, Google, Razorpay, and Vercel analytics
function generateCspWithNonce(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://*.google.com https://*.googleapis.com https://checkout.razorpay.com https://*.razorpay.com https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://images.unsplash.com${storageImageStr}`,
    "font-src 'self' https://fonts.gstatic.com data:",
    `connect-src 'self' https://*.googleapis.com https://*.razorpay.com https://api.razorpay.com https://graph.instagram.com https://api.instagram.com https://graph.facebook.com https://api.msg91.com https://surepass.io https://*.surepass.io https://*.ingest.sentry.io https://*.sentry.io https://va.vercel-scripts.com https://vitals.vercel-insights.com${storageConnectStr}`,
    "frame-src 'self' https://checkout.razorpay.com https://*.razorpay.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

// ---------------------------------------------------------------------------
// Private guard helpers (not exported)
// ---------------------------------------------------------------------------

/** Returns true if the request fingerprint matches any WAF-blocked pattern. */
function checkWafPatterns(requestFingerprint: string): boolean {
const suspiciousPatterns = [
/\bsqlmap\b/,
/\bnikto\b/,
/\bnmap\b/,
/\bmasscan\b/,
/\bdirbuster\b/,
/\bgobuster\b/,
/\bwp-scan\b/,
/\bwpscan\b/,
/\/wp-admin\b/,
/\/wp-login\.php\b/,
/\/phpmyadmin\b/,
/\.\.\/|\.\.\\/,
/<script\b/,
/union(?:\s|%20|\+)+select/,
/sleep\s*\(/,
/benchmark\s*\(/,
/\/etc\/passwd/,
];
return suspiciousPatterns.some((pattern) => pattern.test(requestFingerprint));
}

/** Returns true if the IP address is found in the Edge Redis blacklist. */
async function checkEdgeIpBlacklist(ip: string): Promise<boolean> {
try {
const { isIpBannedEdge } = await import("./lib/blacklist-edge");
return await isIpBannedEdge(ip);
} catch (err) {
logger.error("Middleware edge blacklist lookup failed:", err);
return false;
}
}

/**
* Returns true when an unauthenticated user is accessing a protected path,
* meaning a login redirect (or 401) should be issued.
*/
function requiresLoginRedirect(
isAuth: boolean,
isStaticAsset: boolean,
isDashboardPath: boolean,
isAdminPath: boolean,
): boolean {
return !isAuth && !isStaticAsset && (isDashboardPath || isAdminPath);
}

/**
* Returns true when the current path is an admin path but the user's
* userType is not "ADMIN".
*/
function isAdminAccessDenied(
userType: string | undefined,
isAdminPath: boolean,
): boolean {
return isAdminPath && userType !== "ADMIN";
}

/**
* Timing-safe CRON secret verification using Web Crypto (Edge-safe).
* Returns true if the provided secret matches the expected value.
*/
async function verifyCronSecret(
  cronSecret: string | null,
  expectedSecret: string,
): Promise<boolean> {
  if (!cronSecret || !expectedSecret) return false;
  const encoder = new TextEncoder();
  const expectedHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(expectedSecret)),
  );
  const actualHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(cronSecret)),
  );
  let result = 0;
  for (let i = 0; i < expectedHash.length; i++) {
    result |= expectedHash[i]! ^ actualHash[i]!;
  }
  return result === 0;
}

// ---------------------------------------------------------------------------

/**
* Enterprise Middleware Logic
*/
async function handleWafAndIpCheck(
req: NextRequest,
pathname: string,
applyCSP: (response: NextResponse) => NextResponse
): Promise<NextResponse | null> {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  let decodedPath = pathname.toLowerCase();
  let decodedSearch = req.nextUrl.search.toLowerCase();
  try {
    decodedPath = decodeURIComponent(pathname).toLowerCase();
    decodedSearch = decodeURIComponent(req.nextUrl.search).toLowerCase();
  } catch {
    // Keep raw strings on malformed URI encoding
  }
  const requestFingerprint = `${ua} ${decodedPath} ${decodedSearch}`;
  if (checkWafPatterns(requestFingerprint)) {
    return applyCSP(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

const ip = getSecureClientIp(req);
if (ip !== "unknown" && (await checkEdgeIpBlacklist(ip))) {
return applyCSP(
NextResponse.json({ error: "Access Denied: Your IP is banned." }, { status: 403 }),
);
}
return null;
}

interface AuthRedirectConfig {
req: NextRequest;
pathname: string;
isAuth: boolean;
isStaticAsset: boolean;
isDashboardPath: boolean;
isAdminPath: boolean;
isApiRoute: boolean;
redirectTo: (targetPath: string) => URL;
applyCSP: (response: NextResponse) => NextResponse;
}

function handleAuthRedirect(config: AuthRedirectConfig): NextResponse | null {
const {
req,
pathname,
isAuth,
isStaticAsset,
isDashboardPath,
isAdminPath,
isApiRoute,
redirectTo,
applyCSP,
} = config;
if (requiresLoginRedirect(isAuth, isStaticAsset, isDashboardPath, isAdminPath)) {
if (isApiRoute) {
return applyCSP(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
}
const loginUrl = redirectTo("/login");
loginUrl.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search || ""}`);
return applyCSP(NextResponse.redirect(loginUrl));
}
return null;
}

function handleAdminRedirect(
pathname: string,
session: { user?: { userType?: string } } | null,
isAuth: boolean,
isAdminPath: boolean,
redirectTo: (targetPath: string) => URL,
applyCSP: (response: NextResponse) => NextResponse
): NextResponse | null {
if (isAdminPath && isAdminAccessDenied(session?.user?.userType, isAdminPath)) {
if (pathname.startsWith("/api/")) {
return applyCSP(
NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 }),
);
}
return applyCSP(NextResponse.redirect(redirectTo(isAuth ? "/dashboard" : "/login")));
}
return null;
}

async function handleCronProtection(
  req: NextRequest,
  pathname: string,
  applyCSP: (response: NextResponse) => NextResponse
): Promise<NextResponse | null> {
  if (pathname.startsWith("/api/cron/")) {
    const expectedSecret = process.env.CRON_SECRET || "";
    const xCronSecret = req.headers.get("x-cron-secret") || req.headers.get("x-api-key");
    const authHeader = req.headers.get("authorization");
    const bearerSecret = authHeader?.replace(/^bearer /i, "")?.trim() || null;
    const querySecret = req.nextUrl.searchParams.get("key") || req.nextUrl.searchParams.get("secret");

    const isXCronValid = await verifyCronSecret(xCronSecret, expectedSecret);
    const isBearerValid = await verifyCronSecret(bearerSecret, expectedSecret);
    const isQueryValid = await verifyCronSecret(querySecret, expectedSecret);

    if (!isXCronValid && !isBearerValid && !isQueryValid) {
      return applyCSP(NextResponse.json({ error: "Forbidden: Invalid Cron Secret" }, { status: 403 }));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------

/**
* Enterprise Middleware Logic
*/
export default auth(async (req) => {
const { pathname } = req.nextUrl;
const session = req.auth;

const redirectTo = (targetPath: string) => {
  const configured =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    req.nextUrl.origin;
  return new URL(targetPath, configured);
};

// Helper to apply CSP headers to response
const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
const cspHeader = generateCspWithNonce(nonce);

const applyCSP = (response: NextResponse) => {
  response.headers.set('Content-Security-Policy', cspHeader);
  return response;
};

const wafResult = await handleWafAndIpCheck(req, pathname, applyCSP);
if (wafResult) return wafResult;

// 2. Auth Logic
const isAuth = !!session && !session.error;
const isApiRoute = pathname.startsWith("/api/");
const isStaticAsset =
pathname.startsWith("/_next") ||
pathname === "/favicon.ico" ||
/\.[a-zA-Z0-9]+$/.test(pathname);
const isDashboardPath =
pathname === "/dashboard" || pathname.startsWith("/dashboard/");

// 3. Admin Protection
const isAdminPath =
pathname === "/admin" ||
pathname.startsWith("/admin/") ||
pathname === "/api/admin" ||
pathname.startsWith("/api/admin/");

const authRedirect = handleAuthRedirect({
req,
pathname,
isAuth,
isStaticAsset,
isDashboardPath,
isAdminPath,
isApiRoute,
redirectTo,
applyCSP,
});
if (authRedirect) return authRedirect;

const adminRedirect = handleAdminRedirect(
pathname,
session,
isAuth,
isAdminPath,
redirectTo,
applyCSP
);
if (adminRedirect) return adminRedirect;

// 4. Prevent logged-in users from seeing /login and /register
const authPages = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);
if (isAuth && authPages.has(pathname)) {
return applyCSP(NextResponse.redirect(redirectTo("/dashboard")));
}

// 5. Cron route protection - fallback in case guard import is forgotten
const cronResult = await handleCronProtection(req, pathname, applyCSP);
if (cronResult) return cronResult;

const requestHeaders = new Headers(req.headers);
requestHeaders.set("x-nonce", nonce);
requestHeaders.set("Content-Security-Policy", cspHeader);

const response = NextResponse.next({
  request: {
    headers: requestHeaders,
  },
});
response.headers.set("Content-Security-Policy", cspHeader);
return response;
});

export const config = {
  matcher: ["/((?!api/payments/webhook|api/webhooks/razorpay|api/metrics|_next/static|_next/image|favicon.ico).*)"],
};
