import { apiWrapper, ApiResponse, type AuthenticatedRequest } from "@/lib/api-wrapper";
import { AppError } from "@/lib/errors";
import { InfluencerProfile } from "@prisma/client";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  calculateYouTubeEngagement,
  getYouTubeChannelByToken,
  getFreshYouTubeAccessToken,
} from "@/lib/youtube";
import { calculateEngagement, getInstagramProfile } from "@/lib/instagram";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { decrypt } from "@/lib/encryption";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkGrowthFraud } from "@/lib/fraud-detection";

// Enforces strict platform API checks without simulation to protect data integrity.

const verifySchema = z.object({
platform: z.enum(["youtube", "instagram"]),
handle: z
.string()
.min(1, "Handle is required")
.max(100, "Handle too long")
.regex(/^[a-zA-Z0-9._@-]+$/, "Handle contains invalid characters"),
});

async function verifyYouTubeChannel(userId: string, handle: string, userProfile: InfluencerProfile) {
  const freshAccessToken = await getFreshYouTubeAccessToken(userId);
  if (!freshAccessToken) {
    throw AppError.badRequest("Connect YouTube through OAuth before verifying profile metrics.");
  }

  const channel = await getYouTubeChannelByToken(freshAccessToken);
  if (!channel) {
    throw AppError.badRequest("Unable to verify YouTube channel via connected Google account.");
  }

  const normalizedCustomUrl = channel.customUrl?.replace(/^@/, "").toLowerCase();
  const normalizedHandle = handle.replace(/^@/, "").toLowerCase();
  if (normalizedCustomUrl && normalizedCustomUrl !== normalizedHandle) {
    throw AppError.badRequest("Connected YouTube channel handle does not match the requested handle.");
  }

const followers = channel.subscriberCount === -1 ? null : channel.subscriberCount;
let engagementRate = 0;
const insights = await calculateYouTubeEngagement(channel.id);
if (insights) {
engagementRate = insights.engagementRate;
}

const previousSubscribers = userProfile.youtubeSubscribers || 0;
if (previousSubscribers > 0 && followers !== null && followers > previousSubscribers) {
const growthCheck = checkGrowthFraud({
currentFollowers: followers,
previousFollowers: previousSubscribers,
timeDeltaHours: 48,
});

if (!growthCheck.passed) {
logger.warn("Suspicious YouTube subscriber growth detected", {
userId,
previousSubscribers,
currentSubscribers: followers,
flags: growthCheck.flags,
});
}
}

await prisma.influencerProfile.update({
where: { userId },
data: {
youtubeHandle: channel.customUrl || handle,
youtubeSubscribers: followers,
youtubeEngagementRate: engagementRate,
},
});

return { followers, engagementRate };
}

async function verifyInstagramChannel(userId: string, handle: string, userProfile: InfluencerProfile) {
const oauth = await prisma.oAuthAccount.findFirst({
where: { userId, provider: "instagram" },
select: { accessToken: true },
});

const decryptedAccessToken = oauth?.accessToken ? decrypt(oauth.accessToken) : null;
const normalizedHandle = handle.replace(/^@/, "").toLowerCase();

if (!decryptedAccessToken) {
throw AppError.badRequest("Connect Instagram through OAuth before verifying profile metrics.");
}

const profile = await getInstagramProfile(decryptedAccessToken);
if (!profile || profile.username?.toLowerCase() !== normalizedHandle) {
throw AppError.badRequest("Unable to verify Instagram profile through Meta Graph API.");
}

const followers = profile.followersCount;
const insights = await calculateEngagement(decryptedAccessToken);
const engagementRate = insights?.engagementRate || 0;

const previousFollowers = userProfile.instagramFollowers || 0;
if (previousFollowers > 0 && followers > previousFollowers) {
const growthCheck = checkGrowthFraud({
currentFollowers: followers,
previousFollowers: previousFollowers,
timeDeltaHours: 48,
});

if (!growthCheck.passed) {
logger.warn("Suspicious Instagram follower growth detected", {
userId,
previousFollowers,
currentFollowers: followers,
flags: growthCheck.flags,
});
}
}

await prisma.influencerProfile.update({
where: { userId },
data: {
instagramHandle: profile.username,
instagramFollowers: followers,
instagramEngagementRate: engagementRate,
},
});

return { followers, engagementRate };
}

async function _handler_POST(request: NextRequest) {
try {
const session = (request as AuthenticatedRequest).session;

const limit = await checkRateLimit(session.user.id, "PROFILE_UPDATE");
if (!limit.success) {
throw AppError.tooManyRequests("Too many social verification requests");
}

let body: unknown;
try {
body = await request.json();
} catch {
throw AppError.badRequest("Invalid request body");
}

const parsed = verifySchema.safeParse(body);
if (!parsed.success) {
throw AppError.badRequest("Validation failed");
}

const { platform, handle } = parsed.data;

const userProfile = await prisma.influencerProfile.findUnique({
where: { userId: session.user.id },
});

if (!userProfile) {
throw AppError.notFound("Influencer profile not found");
}

let result: { followers: number | null; engagementRate: number };

if (platform === "youtube") {
result = await verifyYouTubeChannel(session.user.id, handle, userProfile);
} else {
result = await verifyInstagramChannel(session.user.id, handle, userProfile);
}

return ApiResponse.success(
{ followers: result.followers, engagementRate: result.engagementRate },
"Social profile verified successfully",
);
} catch (error: unknown) {
if (error instanceof AppError) {
return ApiResponse.error(error.message, error.statusCode);
}
logger.error("Social Verify Error:", error);
return ApiResponse.error("Failed to verify social profile. Please try again.", 500);
}
}


// Wrapped handlers via apiWrapper
export const POST = apiWrapper(_handler_POST, { requirePermission: "SUBMIT_VERIFICATION" });
