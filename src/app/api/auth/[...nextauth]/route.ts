/**
* NextAuth.js v5 Route Handler
* Re-exports handlers from the centralized auth configuration.
*/
import { handlers } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getSecureClientIp } from "@/lib/ip";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const AUTH_RL_WINDOW = 60; // 60 seconds
const AUTH_CALLBACK_LIMIT = 20; // 20 requests/min per IP for OAuth callbacks
const AUTH_CREDENTIALS_LIMIT = 10; // 10 requests/min per IP for credentials sign-in

async function checkAuthRateLimit(req: NextRequest, isCallback: boolean, isCredentialsOrSignIn: boolean) {
  if (!isCallback && !isCredentialsOrSignIn) {
    return null;
  }

  const ip = getSecureClientIp({ headers: req.headers }) || "127.0.0.1";
  const limit = isCredentialsOrSignIn ? AUTH_CREDENTIALS_LIMIT : AUTH_CALLBACK_LIMIT;
  const actionKey = isCredentialsOrSignIn ? "auth:credentials" : "auth:callback";

  const rlResult = await rateLimit({
    uniqueToken: `${actionKey}:${ip}`,
    limit,
    window: AUTH_RL_WINDOW,
    securityCritical: true,
  });

  if (!rlResult.success) {
    logger.warn(`Auth route rate limit exceeded for ${actionKey}`, { ip, remaining: rlResult.remaining });
    const retryAfter = Math.max(1, rlResult.reset - Math.floor(Date.now() / 1000));
    return NextResponse.json(
      {
        error: "RateLimitExceeded",
        message: "Too many authentication requests. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const pathname = req.nextUrl?.pathname || "";
    const isCallback = pathname.includes("/callback/");
    if (isCallback) {
      const rlResponse = await checkAuthRateLimit(req, true, false);
      if (rlResponse) return rlResponse;
    }

    return await handlers.GET(req);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[NextAuth GET error]", errorMsg);
    // Graceful recovery for error endpoint: redirect user back to login with context
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("error", "AuthError");
    return NextResponse.redirect(loginUrl);
  }
}

export async function POST(req: NextRequest) {
  try {
    const pathname = req.nextUrl?.pathname || "";
    const isCredentials = pathname.includes("/callback/credentials");
    const isSignIn = pathname.includes("/signin");
    if (isCredentials || isSignIn) {
      const rlResponse = await checkAuthRateLimit(req, false, true);
      if (rlResponse) return rlResponse;
    }

    return await handlers.POST(req);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[NextAuth POST error]", errorMsg);
    return NextResponse.json({ error: "AuthError", message: errorMsg }, { status: 500 });
  }
}
