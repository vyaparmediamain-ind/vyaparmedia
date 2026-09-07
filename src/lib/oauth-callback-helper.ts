/**
* Shared OAuth callback helpers
* Eliminates duplicated CSRF-state validation used across social OAuth callbacks
* (Instagram, YouTube, etc.)
*/
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { appUrl } from "@/lib/app-url";

export function oauthRedirect(req: NextRequest, path: string): NextResponse {
return NextResponse.redirect(appUrl(path, req.nextUrl.origin));
}

interface OAuthStateValidationResult {
/** Non-null when validation succeeded. */
storedState: { userId: string; expiresAt: Date } | null;
/** Non-null when the callback should terminate with this redirect. */
errorRedirect: NextResponse | null;
}

/**
* Validates the OAuth `state` parameter and session ownership:
* 1. Checks for error param from provider
* 2. Ensures `code` and `state` are present
* 3. Looks up the stored state, verifies provider and session ownership
* 4. Checks expiry
* 5. Consumes (deletes) the one-time state
*
* @param req - The incoming request
* @param code - The `code` query parameter
* @param state - The `state` query parameter
* @param providerError - The `error` query parameter from the OAuth provider
* @param provider - Expected provider name (e.g. "instagram", "youtube")
* @param errorBase - Base redirect path for errors (e.g. "/dashboard/settings?error=")
* @param cancelledError - Error key appended to errorBase on user cancellation
*/
export async function validateAndConsumeOAuthState(
req: NextRequest,
code: string | null,
state: string | null,
providerError: string | null,
provider: string,
errorBase: string,
cancelledError: string,
): Promise<OAuthStateValidationResult> {
if (providerError) {
logger.warn(`${provider} OAuth error`, { error: providerError });
return { storedState: null, errorRedirect: oauthRedirect(req, `${errorBase}${cancelledError}`) };
}

if (!code || !state) {
return { storedState: null, errorRedirect: oauthRedirect(req, `${errorBase}missing_parameters`) };
}

const storedState = await prisma.oAuthState.findUnique({ where: { state } });
if (storedState?.provider !== provider) {
return { storedState: null, errorRedirect: oauthRedirect(req, `${errorBase}invalid_state`) };
}

const session = await auth();
if (!session?.user?.id || session.user.id !== storedState.userId) {
await prisma.oAuthState.delete({ where: { state } }).catch(() => {});
logger.warn(`${provider} OAuth state owner mismatch`, {
stateUserId: storedState.userId,
sessionUserId: session?.user?.id,
});
return { storedState: null, errorRedirect: oauthRedirect(req, `${errorBase}invalid_session`) };
}

if (new Date() > storedState.expiresAt) {
await prisma.oAuthState.delete({ where: { state } });
return { storedState: null, errorRedirect: oauthRedirect(req, `${errorBase}state_expired`) };
}

// Consume the one-time state immediately
await prisma.oAuthState.delete({ where: { state } });

return { storedState: { userId: storedState.userId, expiresAt: storedState.expiresAt }, errorRedirect: null };
}
