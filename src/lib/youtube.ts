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
import redis from "./redis";

const API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Calculate Pacific Date string (YYYY-MM-DD) for quota accounting.
 * YouTube Data API v3 daily quota resets at midnight Pacific Time (00:00 PST/PDT).
 * Docs: https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits
 */
export function getPacificDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export type YouTubeCallPriority = "critical" | "standard";

export interface QuotaCheckResult {
  allowed: boolean;
  currentUsage: number;
  dailyQuota: number;
  reason?: string;
}

/**
 * Checks and increments the daily YouTube quota counter in Redis.
 * Non-critical ("standard") calls are throttled when quota usage crosses 80%.
 * Deal-critical calls ("critical") proceed until 100% exhaustion.
 */
export async function checkAndConsumeYouTubeQuota(
  cost: number = 1,
  priority: YouTubeCallPriority = "standard",
): Promise<QuotaCheckResult> {
  const dailyQuota = env.YOUTUBE_DAILY_QUOTA || 10000;
  const pacificDay = getPacificDateString();
  const quotaKey = `yt:quota:${pacificDay}`;

  try {
    const rawVal = await redis.get(quotaKey);
    const currentUsage = rawVal ? Number.parseInt(rawVal, 10) : 0;
    const threshold = Math.floor(dailyQuota * 0.8);

    if (priority === "standard" && currentUsage + cost > threshold) {
      logger.warn("YouTube API quota >80% threshold reached, skipping non-critical sync", {
        currentUsage,
        threshold,
        dailyQuota,
        cost,
        pacificDay,
      });
      return {
        allowed: false,
        currentUsage,
        dailyQuota,
        reason: "YOUTUBE_QUOTA_EXCEEDED",
      };
    }

    if (currentUsage + cost > dailyQuota) {
      logger.error("YouTube API quota 100% exhausted", {
        currentUsage,
        dailyQuota,
        cost,
        pacificDay,
      });
      return {
        allowed: false,
        currentUsage,
        dailyQuota,
        reason: "YOUTUBE_DAILY_LIMIT_EXHAUSTED",
      };
    }

    const newUsage = await redis.incrby(quotaKey, cost);
    if (newUsage === cost) {
      // First call of the day - set 48h expiration
      await redis.expire(quotaKey, 48 * 3600);
    }

    return { allowed: true, currentUsage: newUsage, dailyQuota };
  } catch (error) {
    logger.warn("Redis quota tracking failed, allowing call in fallback mode", { error });
    return { allowed: true, currentUsage: 0, dailyQuota };
  }
}

async function fetchYouTube(
  endpoint: string,
  searchParams: Record<string, string>,
  accessToken?: string,
  priority: YouTubeCallPriority = "standard",
) {
  // Quota check before making API call
  const quotaCheck = await checkAndConsumeYouTubeQuota(1, priority);
  if (!quotaCheck.allowed) {
    logger.warn("YouTube API call blocked by quota guard", {
      endpoint,
      priority,
      reason: quotaCheck.reason,
      currentUsage: quotaCheck.currentUsage,
    });
    return {
      error: {
        code: 403,
        message: "YouTube API quota exceeded or threshold reached",
        errors: [{ reason: "quotaExceeded" }],
      },
    };
  }

  const url = new URL(`${API_BASE}${endpoint}`);
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  const apiKey = env.YOUTUBE_API_KEY || "";
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



export function getYouTubeOAuthUrl(redirectUri: string, state: string): string {
const isHex = /^[0-9a-fA-F]+$/.test(state);
if (!isHex || state.length < 32) {
throw AppError.badRequest("Invalid state parameter");
}

const params = new URLSearchParams({
client_id: env.GOOGLE_CLIENT_ID || "",
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
export interface YouTubeTokenRefreshResult {
  accessToken: string;
  expiresAt: Date;
  isInvalidGrant?: boolean;
}

/**
 * Refresh a YouTube OAuth access token using the stored refresh token.
 * Docs: https://developers.google.com/identity/protocols/oauth2/web-server#offline
 */
export async function refreshYouTubeToken(
  refreshToken: string,
): Promise<YouTubeTokenRefreshResult | null> {
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
      const isInvalidGrant = data.error === "invalid_grant";
      logger.error("YouTube token refresh failed", {
        error: data.error,
        errorDescription: data.error_description,
        isInvalidGrant,
      });
      return isInvalidGrant ? { accessToken: "", expiresAt: new Date(0), isInvalidGrant: true } : null;
    }

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + Number(data.expires_in || 3600) * 1000),
      isInvalidGrant: false,
    };
  } catch (error) {
    logger.error("YouTube token refresh error", { error });
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
    if (!refreshed || refreshed.isInvalidGrant || !refreshed.accessToken) {
      if (refreshed?.isInvalidGrant) {
        await prisma.oAuthAccount.update({
          where: { id: oauth.id },
          data: {
            accessToken: null,
            scope: "NEEDS_RECONNECT",
          },
        });
        try {
          const { NotificationService } = await import("@/services/notification.service");
          await NotificationService.createNotification({
            userId,
            type: "security_alert",
            title: "YouTube Reconnect Required",
            message: "Aapka YouTube connection expire ya revoke ho gaya hai. Settings me dobara connect karein.",
            data: { provider: "youtube", action: "reconnect" },
          });
        } catch (notifErr) {
          logger.warn("Failed to notify user of YouTube invalid_grant", { userId, notifErr });
        }
      }
      return null;
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
    logger.error("getFreshYouTubeAccessToken error", { error, userId });
    return null;
  }
}

/**
 * Revoke a YouTube/Google OAuth token using Google's revoke endpoint.
 * Docs: https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke
 */
export async function revokeYouTubeToken(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });

    if (res.ok) {
      logger.info("Successfully revoked Google OAuth token with provider");
      return true;
    }

    const errText = await res.text().catch(() => "");
    logger.warn("Google OAuth token revoke endpoint returned error status", {
      status: res.status,
      errorText: errText,
    });
    return false;
  } catch (error) {
    logger.error("Network error revoking Google OAuth token", { error });
    return false;
  }
}



/**
* Fetch YouTube channel info by channel ID or username.
*/
export async function getYouTubeChannel(
channelIdentifier: string,
accessToken?: string,
): Promise<YouTubeChannel | null> {
const apiKey = env.YOUTUBE_API_KEY || "";
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

return await getYouTubeChannel(identifier);
} catch (error) {
logger.warn("Failed to resolve YouTube URL", { url, error });
return null;
}
}



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
  const apiKey = env.YOUTUBE_API_KEY || "";
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
    }, accessToken, "critical");

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



/**
 * Resolve the uploads playlist ID for a channel.
 * Cost: 1 quota unit on channels.list, then cached in Redis for 30 days (0 quota units on cache hit).
 * Standard YouTube channels with ID "UC..." map to uploads playlist "UU...", confirmed via channels.list.
 * Docs: https://developers.google.com/youtube/v3/docs/channels/list
 */
export async function getUploadsPlaylistId(
  channelId: string,
  accessToken?: string,
): Promise<string | null> {
  const cacheKey = `yt:uploads:${channelId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return cached;
  } catch (err) {
    logger.warn("Redis error fetching cached uploads playlist id", { channelId, err });
  }

  try {
    const data = await fetchYouTube(
      "/channels",
      {
        part: "contentDetails",
        id: channelId,
      },
      accessToken,
    );

    const uploadsId = data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (uploadsId) {
      try {
        await redis.set(cacheKey, uploadsId, "EX", 30 * 86400); // 30 days TTL
      } catch (err) {
        logger.warn("Redis error caching uploads playlist id", { channelId, err });
      }
      return uploadsId;
    }

    // Deterministic fallback for standard UC-prefixed channels if API returns no items
    if (channelId.startsWith("UC")) {
      const fallbackId = "UU" + channelId.slice(2);
      return fallbackId;
    }

    return null;
  } catch (err) {
    logger.error("Failed to resolve uploads playlist ID for channel", err, { channelId });
    if (channelId.startsWith("UC")) {
      return "UU" + channelId.slice(2);
    }
    return null;
  }
}

/**
 * Fetch recent videos from a channel using official uploads playlist.
 * Cost breakdown:
 * - channels.list(part=contentDetails): 1 quota unit (cached in Redis with 30d TTL)
 * - playlistItems.list(part=contentDetails): 1 quota unit
 * - videos.list(part=snippet,statistics,contentDetails,status): 1 quota unit
 * Total: 2-3 quota units (vs search.list which cost 100 units).
 * Docs: https://developers.google.com/youtube/v3/docs/playlistItems/list
 */
export async function getRecentVideos(
  channelId: string,
  maxResults: number = 10,
  accessToken?: string,
): Promise<YouTubeVideo[]> {
  const apiKey = env.YOUTUBE_API_KEY || "";
  if (!apiKey && !accessToken) return [];

  try {
    // Step 1: Resolve uploads playlist ID (1 unit or 0 from cache)
    const uploadsPlaylistId = await getUploadsPlaylistId(channelId, accessToken);
    if (!uploadsPlaylistId) return [];

    // Step 2: Fetch playlist items from uploads playlist (1 quota unit)
    const playlistData = await fetchYouTube(
      "/playlistItems",
      {
        part: "contentDetails",
        playlistId: uploadsPlaylistId,
        maxResults: String(Math.min(maxResults, 50)),
      },
      accessToken,
    );

    if (playlistData.error || !playlistData.items || playlistData.items.length === 0) {
      return [];
    }

    const videoIds = playlistData.items
      .map((item: { contentDetails?: { videoId?: string } }) => item.contentDetails?.videoId)
      .filter((id: unknown): id is string => Boolean(id))
      .join(",");

    if (!videoIds) return [];

    // Step 3: Fetch video statistics & details (1 quota unit)
    const videosData = await fetchYouTube(
      "/videos",
      {
        part: "snippet,statistics,contentDetails,status",
        id: videoIds,
      },
      accessToken,
    );

    if (!videosData.items) return [];

    return videosData.items.map((video: Record<string, unknown>) => ({
      id: video.id as string,
      title: ((video.snippet as Record<string, unknown>)?.title as string) || "",
      description: ((video.snippet as Record<string, unknown>)?.description as string) || "",
      thumbnail:
        ((video.snippet as Record<string, Record<string, Record<string, string>>>)?.thumbnails?.high?.url) ||
        ((video.snippet as Record<string, Record<string, Record<string, string>>>)?.thumbnails?.default?.url) ||
        "",
      publishedAt: ((video.snippet as Record<string, unknown>)?.publishedAt as string) || "",
      viewCount: Number.parseInt(((video.statistics as Record<string, string>)?.viewCount) || "0", 10),
      likeCount: Number.parseInt(((video.statistics as Record<string, string>)?.likeCount) || "0", 10),
      commentCount: Number.parseInt(((video.statistics as Record<string, string>)?.commentCount) || "0", 10),
      duration: ((video.contentDetails as Record<string, unknown>)?.duration as string) || "",
      isLive: (video.status as Record<string, unknown>)?.privacyStatus === "public",
      privacyStatus: (video.status as Record<string, unknown>)?.privacyStatus as string | undefined,
    }));
  } catch (error) {
    logger.error("YouTube recent videos fetch error", error, { channelId });
    return [];
  }
}

/**
 * Calculate channel engagement from recent videos.
 */
export async function calculateYouTubeEngagement(
  channelId: string,
  accessToken?: string,
): Promise<YouTubeInsights | null> {
  const channel = await getYouTubeChannel(channelId, accessToken);
  const videos = await getRecentVideos(channelId, 20, accessToken);

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
