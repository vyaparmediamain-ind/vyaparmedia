/**
* NextAuth.js v5 Route Handler
* Re-exports handlers from the centralized auth configuration.
*/
import { handlers } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
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
    return await handlers.POST(req);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[NextAuth POST error]", errorMsg);
    return NextResponse.json({ error: "AuthError", message: errorMsg }, { status: 500 });
  }
}
