import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { createHash, randomBytes } from "node:crypto";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { appUrl } from "@/lib/app-url";

async function _handler_GET(_req: NextRequest) {
try {
const session = await auth();
if (!session?.user?.id) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const limit = await checkRateLimit(session.user.id, "AUTH");
if (!limit.success) {
return NextResponse.json({ error: "Too many OAuth requests" }, { status: 429 });
}

const state = randomBytes(32).toString("hex");
const codeVerifier = randomBytes(32).toString("base64url");
const codeChallenge = createHash("sha256")
.update(codeVerifier)
.digest("base64url");

await prisma.oAuthState.create({
data: {
userId: session.user.id,
state,
provider: "digilocker",
expiresAt: new Date(Date.now() + 10 * 60 * 1000),
},
});

const redirectUri = appUrl("/api/auth/digilocker/callback", _req.nextUrl.origin);

// DigiLocker OAuth 2.0 authorization URL
const params = new URLSearchParams({
client_id: process.env.DIGILOCKER_CLIENT_ID || "",
redirect_uri: redirectUri,
response_type: "code",
scope: "profile documents",
state,
code_challenge: codeChallenge,
code_challenge_method: "S256",
});

const oauthUrl = `https://accounts.digilocker.gov.in/oauth2/authorize?${params}`;

// Store code_verifier in cookie temporarily
const response = NextResponse.json({ url: oauthUrl });
response.cookies.set("digilocker_code_verifier", codeVerifier, {
httpOnly: true,
secure: process.env.NODE_ENV === "production",
sameSite: "lax",
maxAge: 10 * 60, // 10 mins
});

return response;
} catch (error: unknown) {
logger.error("DigiLocker authorize error", error);
return NextResponse.json(
{ error: "Failed to initiate DigiLocker connection" },
{ status: 500 }
);
}
}


// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
