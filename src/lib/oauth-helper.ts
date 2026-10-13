import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { appUrl } from "@/lib/app-url";

/**
* Standard utility to initiate the OAuth flow:
* 1. Checks user authorization
* 2. Checks rate limit
* 3. Generates a secure CSRF state
* 4. Persists the state in oAuthState
* 5. Returns the JSON response containing the authorization URL
*/
export async function initiateOAuthFlow(
req: NextRequest,
provider: string,
getRedirectUriAndUrl: (state: string, redirectUri: string) => string,
): Promise<Response> {
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

await prisma.oAuthState.create({
data: {
userId: session.user.id,
state,
provider,
expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
},
});

const redirectUri = appUrl(`/api/auth/${provider}/callback`, req.nextUrl.origin);
const oauthUrl = getRedirectUriAndUrl(state, redirectUri);

return NextResponse.json({ url: oauthUrl });
} catch (error: unknown) {
logger.error(`${provider} authorize error`, error);
return NextResponse.json(
{ error: `Failed to initiate ${provider} connect` },
{ status: 500 },
);
}
}
