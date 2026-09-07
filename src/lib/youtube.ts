import { AppError } from "@/lib/errors";
/**
* YouTube Data API Integration
* Fetches channel stats, video data, and verifies video existence.
* Add YOUTUBE_API_KEY to .env to activate.
*
* Docs: https://developers.google.com/youtube/v3
*/

import { logger } from "./logger";
import { env } from "@/env";

const API_BASE = "https://www.googleapis.com/youtube/v3";

async function fetchYouTube(
endpoint: string,
searchParams: Record<string, string>,
accessToken?: string
) {
const url = new URL(`${API_BASE}${endpoint}`);
for (const [key, value] of Object.entries(searchParams)) {
url.searchParams.set(key, value);
}

const apiKey = process.env.YOUTUBE_API_KEY || "";
if (apiKey) {
url.searchParams.set("key", apiKey);
}

const headers: Record<string, string> = {};
if (accessToken) {
headers["Authorization"] = `Bearer ${accessToken}`;
}

const res = await fetch(url.toString(), { headers });
return res.json();
}


// ==================== TYPES ====================

interface YouTubeChannel {
id: string;
title: string;
description: string;
customUrl: string;
thumbnail: string;
subscriberCount: number;
videoCount: number;
viewCount: number;
country?: string;
publishedAt: string;
}

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: string;
  isLive: boolean;
  /** Privacy status from YouTube API snippet ("public" | "private" | "unlisted"). Optional — only present when fetched with status part. */
  privacyStatus?: string;
}

interface YouTubeInsights {
avgViews: number;
avgLikes: number;
avgComments: number;
engagementRate: number;
uploadFrequency: string; // e.g., "2 videos/week"
}

// ==================== OAUTH ====================

export function getYouTubeOAuthUrl(redirectUri: string, state: string): string {
const isHex = /^[0-9a-fA-F]+$/.test(state);
if (!isHex || state.length < 32) {
throw AppError.badRequest("Invalid state parameter");
}

const params = new URLSearchParams({
client_id: env.GOOGLE_CLIENT_ID,
redirect_uri: redirectUri,
response_type: "code",
scope: "https://www.googleapis.com/auth/youtube.readonly",
access_type: "offline",
include_granted_scopes: "true",
prompt: "consent",
state,
});

return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeYouTubeCode(
code: string,
redirectUri: string,
): Promise<{
accessToken: string;
refreshToken?: string;
expiresAt?: Date;
scope?: string;
} | null> {
const clientId = env.GOOGLE_CLIENT_ID;
const clientSecret = env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
logger.warn("Google OAuth credentials not configured for YouTube connect");
return null;
}

try {
const res = await fetch("https://oauth2.googleapis.com/token", {
method: "POST",
headers: { "Content-Type": "application/x-www-form-urlencoded" },
body: new URLSearchParams({
client_id: clientId,
client_secret: clientSecret,
code,
grant_type: "authorization_code",
redirect_uri: redirectUri,
}),
});

const data = await res.json();
if (!res.ok || !data.access_token) {
logger.error("YouTube token exchange failed", {
error: data.error,
errorDescription: data.error_description,
});
return null;
}

return {
accessToken: data.access_token,
...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
...(data.expires_in
? { expiresAt: new Date(Date.now() + Number(data.expires_in) * 1000) }
: {}),
...(data.scope ? { scope: data.scope } : {}),
};
} catch (error) {
logger.error("YouTube OAuth exchange error", error);
return null;
}
}

/**
* Refresh a YouTube OAuth access token using the stored refresh token.
*/
async function refreshYouTubeToken(refreshToken: string): Promise<{
accessToken: string;
expiresAt: Date;
} | null> {
const clientId = env.GOOGLE_CLIENT_ID;
const clientSecret = env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
logger.warn("Google OAuth credentials not configured token refresh skipped");
return null;
}

try {
const res = await fetch("https://oauth2.googleapis.com/token", {
method: "POST",
headers: { "Content-Type": "application/x-www-form-urlencoded" },
body: new URLSearchParams({
client_id: clientId,
client_secret: clientSecret,
refresh_token: refreshToken,
grant_type: "refresh_token",
}),
});

const data = await res.json();
if (!res.ok || !data.access_token) {
logger.error("YouTube token refresh failed", {
error: data.error,
errorDescription: data.error_description,
});
return null;
}

return {
accessToken: data.access_token,
expiresAt: new Date(Date.now() + Number(data.expires_in || 3600) * 1000),
};
} catch (error) {
logger.error("YouTube token refresh error", error);
return null;
}
}

/**
* Get a fresh (non-expired) YouTube access token for a user.
* Automatically refreshes if the stored token is expired or expiring within 5 minutes.
* Returns the plaintext access token ready for use in API calls.
*/
export async function getFreshYouTubeAccessToken(userId: string): Promise<string | null> {
// Lazy import to avoid circular deps and keep youtube.ts edge-compatible if needed
const { default: prisma } = await import("./db");
const { encrypt, decrypt } = await import("./encryption");

try {
const oauth = await prisma.oAuthAccount.findFirst({
where: {
userId,
provider: { in: ["youtube", "google"] },
refreshToken: { not: null },
},
select: {
id: true,
accessToken: true,
refreshToken: true,
expiresAt: true,
},
});

if (!oauth) return null;

const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
const isExpiredOrExpiring = !oauth.expiresAt || oauth.expiresAt <= fiveMinutesFromNow;

if (!isExpiredOrExpiring && oauth.accessToken) {
// Token still valid return decrypted access token
return decrypt(oauth.accessToken);
}

// Token expired or expiring soon refresh it
if (!oauth.refreshToken) {
// No refresh token stored return existing access token as best-effort
return oauth.accessToken ? decrypt(oauth.accessToken) : null;
}

const decryptedRefreshToken = decrypt(oauth.refreshToken);
const refreshed = await refreshYouTubeToken(decryptedRefreshToken);
if (!refreshed) {
// Refresh failed fall back to the existing (possibly stale) token
return oauth.accessToken ? decrypt(oauth.accessToken) : null;
}

// Persist refreshed token back to DB
await prisma.oAuthAccount.update({
where: { id: oauth.id },
data: {
accessToken: encrypt(refreshed.accessToken),
expiresAt: refreshed.expiresAt,
},
});

logger.info("YouTube OAuth token refreshed", { userId });
return refreshed.accessToken;
} catch (error) {
logger.error("getFreshYouTubeAccessToken error", error, { userId });
return null;
}
}

// ==================== CHANNEL DATA ====================

/**
* Fetch YouTube channel info by channel ID or username.
*/
export async function getYouTubeChannel(
channelIdentifier: string,
accessToken?: string,
): Promise<YouTubeChannel | null> {
const apiKey = process.env.YOUTUBE_API_KEY || "";
if (!apiKey && !accessToken) {
logger.warn(
"Neither YOUTUBE_API_KEY nor accessToken provided channel fetch skipped",
);
return null;
}

try {
// Try by ID first, then by forHandle
const isChannelId = channelIdentifier.startsWith("UC");
const searchParams: Record<string, string> = {
part: "snippet,statistics",
};

if (isChannelId) {
searchParams.id = channelIdentifier;
} else {
searchParams.forHandle = `@${channelIdentifier.replace("@", "")}`;
}

const data = await fetchYouTube("/channels", searchParams, accessToken);

if (data.error) {
// Securely log only the message and reason, not the full request URL or potential metadata
logger.error("YouTube API error", {
reason: data.error.errors?.[0]?.reason || "Unknown",
message: data.error.message
});
return null;
}

if (!data.items || data.items.length === 0) {
return null;
}

const channel = data.items[0];
return {
id: channel.id,
title: channel.snippet.title,
description: channel.snippet.description || "",
customUrl: channel.snippet.customUrl || "",
thumbnail:
channel.snippet.thumbnails?.high?.url ||
channel.snippet.thumbnails?.default?.url ||
"",
subscriberCount: channel.statistics?.hiddenSubscriberCount === true || channel.statistics?.hiddenSubscriberCount === "true"
? -1
: Number.parseInt(channel.statistics?.subscriberCount || "0", 10),
videoCount: Number.parseInt(channel.statistics?.videoCount || "0", 10),
viewCount: Number.parseInt(channel.statistics?.viewCount || "0", 10),
country: channel.snippet.country,
publishedAt: channel.snippet.publishedAt,
};
} catch (error) {
logger.error("YouTube channel fetch error", error, { channelIdentifier });
return null;
}
}

/**
* Fetch the authenticated user's YouTube channel.
*/
export async function getYouTubeChannelByToken(
accessToken: string,
): Promise<YouTubeChannel | null> {
if (!accessToken) return null;

try {
const data = await fetchYouTube("/channels", {
part: "snippet,statistics",
mine: "true",
}, accessToken);

if (data.error || !data.items || data.items.length === 0) return null;

const channel = data.items[0];
  return {
    id: channel.id,
    title: channel.snippet.title,
    description: channel.snippet.description || "",
    customUrl: channel.snippet.customUrl || "",
    thumbnail: channel.snippet.thumbnails?.high?.url || "",
    subscriberCount: channel.statistics?.hiddenSubscriberCount === true || channel.statistics?.hiddenSubscriberCount === "true"
      ? -1
      : Number.parseInt(channel.statistics?.subscriberCount || "0", 10),
    videoCount: Number.parseInt(channel.statistics?.videoCount || "0", 10),
    viewCount: Number.parseInt(channel.statistics?.viewCount || "0", 10),
    country: channel.snippet.country,
    publishedAt: channel.snippet.publishedAt,
  };
} catch (error) {
logger.error("YouTube mine channel fetch error", error);
return null;
}
}

/**
* Resolve a YouTube channel URL to channel data.
* Supports: youtube.com/c/name, youtube.com/@handle, youtube.com/channel/ID
*/
export async function resolveYouTubeUrl(
url: string,
): Promise<YouTubeChannel | null> {
try {
const parsed = new URL(url);
const path = parsed.pathname;

// Extract identifier from URL
let identifier = "";

if (path.startsWith("/channel/")) {
identifier = path.replace("/channel/", "");
} else if (path.startsWith("/@")) {
identifier = path.replace("/@", "");
} else if (path.startsWith("/c/")) {
identifier = path.replace("/c/", "");
} else if (path.startsWith("/user/")) {
identifier = path.replace("/user/", "");
}

if (!identifier) return null;

return getYouTubeChannel(identifier);
} catch {
return null;
}
}

// ==================== VIDEO DATA ====================

export type YouTubeVideoFetchResult =
  | { status: "FOUND"; video: YouTubeVideo }
  | { status: "NOT_FOUND" }
  | { status: "API_ERROR"; error: string };

/**
* Fetch video details with explicit distinction between found, confirmed deleted, and API/network failure.
*/
export async function getYouTubeVideoDetailed(
  videoId: string,
  accessToken?: string,
): Promise<YouTubeVideoFetchResult> {
  const apiKey = process.env.YOUTUBE_API_KEY || "";
  if (!apiKey && !accessToken) {
    logger.warn(
      "Neither YOUTUBE_API_KEY nor accessToken provided video fetch skipped",
    );
    return { status: "API_ERROR", error: "Neither YOUTUBE_API_KEY nor accessToken provided" };
  }

  try {
    const data = await fetchYouTube("/videos", {
      part: "snippet,statistics,contentDetails,status",
      id: videoId,
    }, accessToken);

    if (data.error) {
      logger.error("YouTube API error", {
        reason: data.error.errors?.[0]?.reason || "Unknown",
        message: data.error.message,
      });
      return { status: "API_ERROR", error: data.error.message || "YouTube API error" };
    }

    if (!data.items || data.items.length === 0) {
      return { status: "NOT_FOUND" };
    }

    const video = data.items[0];
    return {
      status: "FOUND",
      video: {
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description || "",
        thumbnail:
          video.snippet.thumbnails?.high?.url ||
          video.snippet.thumbnails?.default?.url ||
          "",
        publishedAt: video.snippet.publishedAt,
        viewCount: Number.parseInt(video.statistics?.viewCount || "0", 10),
        likeCount: Number.parseInt(video.statistics?.likeCount || "0", 10),
        commentCount: Number.parseInt(video.statistics?.commentCount || "0", 10),
        duration: video.contentDetails.duration,
        isLive: video.status?.privacyStatus === "public",
        privacyStatus: video.status?.privacyStatus,
      },
    };
  } catch (error) {
    logger.error("YouTube video fetch error", error, { videoId });
    return {
      status: "API_ERROR",
      error: error instanceof Error ? error.message : "Network error fetching YouTube video",
    };
  }
}

/**
* Fetch video details by video ID.
*/
export async function getYouTubeVideo(
  videoId: string,
  accessToken?: string,
): Promise<YouTubeVideo | null> {
  const result = await getYouTubeVideoDetailed(videoId, accessToken);
  return result.status === "FOUND" ? result.video : null;
}

/**
* Extract video ID from various YouTube URL formats.
*/
export function extractVideoId(url: string): string | null {
try {
const parsed = new URL(url);

// youtube.com/watch?v=ID
if (
parsed.hostname.includes("youtube.com") &&
parsed.searchParams.has("v")
) {
return parsed.searchParams.get("v");
}

  // youtu.be/ID
  if (parsed.hostname === "youtu.be" || parsed.hostname === "www.youtu.be") {
    return parsed.pathname.slice(1).split("/")[0]?.trim() || null;
  }

// youtube.com/shorts/ID
if (parsed.pathname.startsWith("/shorts/")) {
return parsed.pathname.replace("/shorts/", "").split("/")[0] || null;
}

// youtube.com/embed/ID
if (parsed.pathname.startsWith("/embed/")) {
return parsed.pathname.replace("/embed/", "").split("/")[0] || null;
}

return null;
} catch {
return null;
}
}

/**
* Verify a YouTube video URL is live and public.
*/
export async function verifyYouTubeVideoIsLive(videoUrl: string): Promise<{
isLive: boolean;
video?: YouTubeVideo;
error?: string;
}> {
const videoId = extractVideoId(videoUrl);
if (!videoId) {
return { isLive: false, error: "Invalid YouTube URL" };
}

const video = await getYouTubeVideo(videoId);
if (!video) {
return { isLive: false, error: "Video not found or private" };
}

return { isLive: video.isLive, video };
}

// ==================== RECENT VIDEOS ====================

/**
* Fetch recent videos from a channel.
*/
async function getRecentVideos(
channelId: string,
maxResults: number = 10,
): Promise<YouTubeVideo[]> {
const apiKey = process.env.YOUTUBE_API_KEY || "";
if (!apiKey) return [];

try {
// Step 1: Search for recent uploads
const searchRes = await fetch(
`${API_BASE}/search?part=id&channelId=${channelId}&order=date&type=video&maxResults=${maxResults}&key=${apiKey}`,
);

const searchData = await searchRes.json();

if (searchData.error || !searchData.items) return [];

// Step 2: Get full video details
const videoIds = searchData.items
.map((item: { id: { videoId: string } }) => item.id.videoId)
.join(",");

const videosRes = await fetch(
`${API_BASE}/videos?part=snippet,statistics,contentDetails,status&id=${videoIds}&key=${apiKey}`,
);

const videosData = await videosRes.json();

if (!videosData.items) return [];

return videosData.items.map((video: Record<string, unknown>) => ({
id: video.id,
title: (video.snippet as Record<string, unknown>)?.title,
description: (video.snippet as Record<string, unknown>)?.description || "",
thumbnail: ((video.snippet as Record<string, Record<string, Record<string, string>>>)?.thumbnails?.high?.url) || "",
publishedAt: (video.snippet as Record<string, unknown>)?.publishedAt,
viewCount: Number.parseInt(((video.statistics as Record<string, string>)?.viewCount) || "0", 10),
likeCount: Number.parseInt(((video.statistics as Record<string, string>)?.likeCount) || "0", 10),
commentCount: Number.parseInt(((video.statistics as Record<string, string>)?.commentCount) || "0", 10),
duration: (video.contentDetails as Record<string, unknown>)?.duration,
isLive: (video.status as Record<string, unknown>)?.privacyStatus === "public",
}));
} catch (error) {
logger.error("YouTube recent videos fetch error", error, { channelId });
return [];
}
}

// ==================== ENGAGEMENT METRICS ====================

/**
* Calculate channel engagement from recent videos.
*/
export async function calculateYouTubeEngagement(
channelId: string,
): Promise<YouTubeInsights | null> {
const channel = await getYouTubeChannel(channelId);
const videos = await getRecentVideos(channelId, 20);

if (!channel || videos.length === 0) return null;

const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0);
const totalLikes = videos.reduce((sum, v) => sum + v.likeCount, 0);
const totalComments = videos.reduce((sum, v) => sum + v.commentCount, 0);

const avgViews = Math.round(totalViews / videos.length);
const avgLikes = Math.round(totalLikes / videos.length);
const avgComments = Math.round(totalComments / videos.length);

// Engagement rate = (avg likes + avg comments) / avg views 100
const engagementRate =
avgViews > 0 ? ((avgLikes + avgComments) / avgViews) * 100 : 0;

// Calculate upload frequency
const dates = videos.map((v) => new Date(v.publishedAt).getTime()).sort((a, b) => a - b);
const daySpan =
dates.length > 1
? (dates.at(-1)! - dates[0]!) / (1000 * 60 * 60 * 24)
: 30;
const videosPerWeek = daySpan > 0 ? (videos.length / daySpan) * 7 : 0;
const uploadFrequency =
videosPerWeek >= 1
? `${Math.round(videosPerWeek)} videos/week`
: `${Math.round(videosPerWeek * 4)} videos/month`;

return {
avgViews,
avgLikes,
avgComments,
engagementRate: Math.round(engagementRate * 100) / 100,
uploadFrequency,
};
}
