import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { exchangeInstagramCode, getInstagramProfile } from "@/lib/instagram";
import { logger } from "@/lib/logger";
import { encrypt } from "@/lib/encryption";
import { appUrl } from "@/lib/app-url";
import { isInfluencer } from "@/lib/rbac";
import { oauthRedirect, validateAndConsumeOAuthState } from "@/lib/oauth-callback-helper";

const ERROR_BASE = "/dashboard/settings?error=";

async function _handler_GET(req: NextRequest) {
const { searchParams } = new URL(req.url);
const code = searchParams.get("code");
const state = searchParams.get("state");
const error = searchParams.get("error");

try {
const { storedState, errorRedirect } = await validateAndConsumeOAuthState(
req, code, state, error,
"instagram", ERROR_BASE, "instagram_connect_cancelled",
);
if (errorRedirect || !storedState || !code) {
return errorRedirect || oauthRedirect(req, `${ERROR_BASE}invalid_state`);
}
const userId = storedState.userId;

const redirectUri = appUrl("/api/auth/instagram/callback", req.nextUrl.origin);
const tokens = await exchangeInstagramCode(code, redirectUri);

if (!tokens) {
return oauthRedirect(req, `${ERROR_BASE}token_exchange_failed`);
}

const profile = await getInstagramProfile(tokens.accessToken);
if (!profile) {
return oauthRedirect(req, `${ERROR_BASE}profile_fetch_failed`);
}

// Ownership-safe link
// Check whether this Instagram account is already linked to *any* VyaparMedia
// user before touching anything.
const existingLink = await prisma.oAuthAccount.findUnique({
where: {
provider_providerAccountId: {
provider: "instagram",
providerAccountId: tokens.userId,
},
},
select: { userId: true },
});

if (existingLink && existingLink.userId !== userId) {
// Ownership conflict
// The Instagram account is currently linked to a *different* VyaparMedia
// user (previousOwner). Silently overwriting the access token would leave
// the DB row owned by previousOwner while holding the new user's token
// causing cross-account data leakage in social-verify and post-monitoring.
//
// Safe resolution: atomically remove the previous link and clear the
// previous owner's instagramHandle (they no longer control this account),
// then create a fresh link for the current user.
const previousOwnerId = existingLink.userId;

logger.warn("Instagram account ownership conflict re-linking to new owner", {
instagramUserId: tokens.userId,
instagramHandle: profile.username,
previousOwnerId,
newOwnerId: userId,
});

await prisma.$transaction([
// 1. Remove old link
prisma.oAuthAccount.delete({
where: {
provider_providerAccountId: {
provider: "instagram",
providerAccountId: tokens.userId,
},
},
}),
// 2. Clear the previous owner's handle so they are not left showing a
// handle they no longer have authorised access to.
prisma.influencerProfile.updateMany({
where: {
userId: previousOwnerId,
instagramHandle: profile.username,
},
data: { instagramHandle: null },
}),
// 3. Create a fresh link for the new owner
prisma.oAuthAccount.create({
data: {
userId,
provider: "instagram",
providerAccountId: tokens.userId,
accessToken: encrypt(tokens.accessToken),
},
}),
]);
} else if (existingLink) {
// Same user re-linking (token refresh)
await prisma.oAuthAccount.update({
where: {
provider_providerAccountId: {
provider: "instagram",
providerAccountId: tokens.userId,
},
},
data: { accessToken: encrypt(tokens.accessToken) },
});
} else {
// Fresh link no prior row
await prisma.oAuthAccount.create({
data: {
userId,
provider: "instagram",
providerAccountId: tokens.userId,
accessToken: encrypt(tokens.accessToken),
},
});
}
//

// If the connecting user is an influencer, sync their handle + follower count.
const user = await prisma.user.findUnique({
where: { id: userId },
select: { userType: true, email: true },
});

if (user && isInfluencer(user.userType)) {
await prisma.influencerProfile.upsert({
where: { userId },
create: {
userId,
displayName: user.email?.split("@")[0] || profile.username || "Creator",
categories: "General",
languages: "English",
instagramHandle: profile.username,
instagramFollowers: profile.followersCount,
instagramEngagementRate: 0,
},
update: {
instagramHandle: profile.username,
instagramFollowers: profile.followersCount,
},
});
}

return oauthRedirect(req, "/dashboard/settings?success=instagram_connected");
} catch (error: unknown) {
logger.error("Instagram callback error", error);
return oauthRedirect(req, `${ERROR_BASE}instagram_connect_failed`);
}
}

// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
