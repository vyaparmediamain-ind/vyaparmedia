import { apiWrapper } from "@/lib/api-wrapper";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { encrypt } from "@/lib/encryption";
import { appUrl } from "@/lib/app-url";
import {
calculateYouTubeEngagement,
exchangeYouTubeCode,
getYouTubeChannelByToken,
} from "@/lib/youtube";
import { isInfluencer } from "@/lib/rbac";
import { oauthRedirect, validateAndConsumeOAuthState } from "@/lib/oauth-callback-helper";

const ERROR_BASE = "/dashboard/settings?tab=social&error=";

function channelHandle(channel: { customUrl: string; title: string; id: string }) {
return channel.customUrl || channel.title || channel.id;
}

interface YouTubeTokenData {
accessToken: string;
refreshToken?: string;
expiresAt?: Date;
scope?: string;
}

async function linkYouTubeOAuthAccount(
userId: string,
channelId: string,
handle: string,
tokenData: YouTubeTokenData,
existingLink: { userId: string } | null
) {
if (existingLink && existingLink.userId !== userId) {
const previousOwnerId = existingLink.userId;
logger.warn("YouTube channel ownership conflict - re-linking to new owner", {
channelId,
previousOwnerId,
newOwnerId: userId,
});

await prisma.$transaction([
prisma.oAuthAccount.delete({
where: {
provider_providerAccountId: {
provider: "youtube",
providerAccountId: channelId,
},
},
}),
prisma.influencerProfile.updateMany({
where: { userId: previousOwnerId, youtubeHandle: handle },
data: { youtubeHandle: null },
}),
prisma.oAuthAccount.create({
data: {
userId,
provider: "youtube",
providerAccountId: channelId,
...tokenData,
},
}),
]);
} else {
await prisma.oAuthAccount.upsert({
where: {
provider_providerAccountId: {
provider: "youtube",
providerAccountId: channelId,
},
},
update: tokenData,
create: {
userId,
provider: "youtube",
providerAccountId: channelId,
...tokenData,
},
});
}
}

async function syncYouTubeInfluencerProfile(
userId: string,
channel: { id: string; subscriberCount: number },
handle: string
) {
const user = await prisma.user.findUnique({
where: { id: userId },
select: { userType: true, email: true },
});

if (user && isInfluencer(user.userType)) {
// Map -1 (YouTube hidden subscriber sentinel) to null
const subscribers = channel.subscriberCount === -1 ? null : channel.subscriberCount;
const insights = await calculateYouTubeEngagement(channel.id);
await prisma.influencerProfile.upsert({
where: { userId },
create: {
userId,
displayName: user.email?.split("@")[0] || handle || "Creator",
categories: "General",
languages: "English",
youtubeHandle: handle,
youtubeSubscribers: subscribers,
youtubeEngagementRate: insights?.engagementRate || 0,
},
update: {
youtubeHandle: handle,
youtubeSubscribers: subscribers,
youtubeEngagementRate: insights?.engagementRate || 0,
},
});
}
}

async function _handler_GET(req: NextRequest) {
const { searchParams } = new URL(req.url);
const code = searchParams.get("code");
const state = searchParams.get("state");
const error = searchParams.get("error");

try {
const { storedState, errorRedirect } = await validateAndConsumeOAuthState(
req, code, state, error,
"youtube", ERROR_BASE, "youtube_connect_cancelled",
);
if (errorRedirect || !storedState || !code) {
return errorRedirect || oauthRedirect(req, `${ERROR_BASE}invalid_state`);
}
const userId = storedState.userId;

const redirectUri = appUrl("/api/auth/youtube/callback", req.nextUrl.origin);
const tokens = await exchangeYouTubeCode(code, redirectUri);
if (!tokens) {
return oauthRedirect(req, `${ERROR_BASE}youtube_token_exchange_failed`);
}

const channel = await getYouTubeChannelByToken(tokens.accessToken);
if (!channel) {
return oauthRedirect(req, `${ERROR_BASE}youtube_channel_fetch_failed`);
}

const existingLink = await prisma.oAuthAccount.findUnique({
where: {
provider_providerAccountId: {
provider: "youtube",
providerAccountId: channel.id,
},
},
select: { userId: true },
});

const handle = channelHandle(channel);
const tokenData = {
accessToken: encrypt(tokens.accessToken),
...(tokens.refreshToken ? { refreshToken: encrypt(tokens.refreshToken) } : {}),
...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {}),
...(tokens.scope ? { scope: tokens.scope } : {}),
};

await linkYouTubeOAuthAccount(userId, channel.id, handle, tokenData, existingLink);
await syncYouTubeInfluencerProfile(userId, channel, handle);

return oauthRedirect(req, "/dashboard/settings?tab=social&success=youtube_connected");
} catch (err: unknown) {
logger.error("YouTube callback error", err);
return oauthRedirect(req, `${ERROR_BASE}youtube_connect_failed`);
}
}

// Wrapped handlers via apiWrapper
export const GET = apiWrapper(_handler_GET);
