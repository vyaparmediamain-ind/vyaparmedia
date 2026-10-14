import { AppError } from "@/lib/errors";
import { env } from "@/env";
/**
 * Instagram API with Instagram Login — Meta Graph API
 *
 * Official Docs:
 * https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 * https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
 * https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/get-access-tokens-and-permissions
 * https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/get-user-profile-and-media
 *
 * Scopes:
 *   - instagram_business_basic (Profile, media, follower counts)
 *   ⚠️ instagram_business_manage_insights requires Meta App Review (held until approval)
 *
 * Hosts:
 *   - Authorize:    https://www.instagram.com/oauth/authorize
 *   - Short Token:  https://api.instagram.com/oauth/access_token
 *   - Long Token:   https://graph.instagram.com/access_token
 *   - Refresh:      https://graph.instagram.com/refresh_access_token
 *   - User / Media: https://graph.instagram.com/me and /me/media
 */

import { logger } from "./logger";
import { cleanUrl } from "./utils";
import { SOCIAL_API_TIMEOUT_MS } from "@/constants";
import prisma from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { withCircuitBreaker } from "@/lib/circuit-breaker";

// ─── API Constants ─────────────────────────────────────────────────────────────
const IG_OAUTH_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const IG_OAUTH_TOKEN_URL     = "https://api.instagram.com/oauth/access_token";
const IG_GRAPH_BASE_URL      = "https://graph.instagram.com";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface InstagramProfile {
  id: string;
  username: string;
  name: string;
  biography: string;
  followersCount: number;
  followingCount: number;
  mediaCount: number;
  profilePicture: string;
  isVerified: boolean;
  website?: string | undefined;
  accountType?: "BUSINESS" | "CREATOR" | "PERSONAL" | string | undefined;
}

export interface InstagramPost {
  id: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS";
  mediaUrl: string;
  permalink: string;
  caption: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  isLive: boolean;
  isPaidPartnership?: boolean;
}

export interface InstagramInsights {
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  reachEstimate: number;
}

// ─── Helper: Environment Credentials ──────────────────────────────────────────

function getInstagramCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.INSTAGRAM_APP_ID || env.INSTAGRAM_APP_ID || "";
  const appSecret = process.env.INSTAGRAM_APP_SECRET || env.INSTAGRAM_APP_SECRET || "";
  return { appId, appSecret };
}

// ─── OAuth URL ─────────────────────────────────────────────────────────────────

/**
 * Generate Instagram API with Instagram Login OAuth URL.
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
 * Target: https://www.instagram.com/oauth/authorize
 * Scope: instagram_business_basic
 */
export function getInstagramOAuthUrl(
  redirectUri: string,
  state: string,
): string {
  const isHex = /^[0-9a-fA-F]+$/.test(state);
  if (!isHex || state.length < 32) {
    throw AppError.badRequest(
      "Invalid state parameter: Must be a cryptographically secure hex string of at least 32 characters.",
    );
  }

  const { appId } = getInstagramCredentials();

  const params = new URLSearchParams({
    client_id:     appId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         "instagram_business_basic",
    state,
  });

  return `${IG_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

// ─── Token Exchange ─────────────────────────────────────────────────────────────

/**
 * Exchange authorization code for a long-lived access token.
 *
 * Step 1: POST https://api.instagram.com/oauth/access_token
 *         (grant_type=authorization_code, client_id, client_secret, redirect_uri, code)
 *         Returns: { access_token: short_token, user_id: string }
 *
 * Step 2: GET https://graph.instagram.com/access_token
 *         (grant_type=ig_exchange_token, client_secret, access_token=short_token)
 *         Returns: { access_token: long_token, token_type: "bearer", expires_in: number }
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/get-access-tokens-and-permissions
 */
export async function exchangeInstagramCode(
  code: string,
  redirectUri: string,
): Promise<{
  accessToken: string;
  userId: string;
  expiresIn?: number;
} | null> {
  const { appId, appSecret } = getInstagramCredentials();

  if (!appId || !appSecret) {
    logger.warn("Instagram app credentials not configured (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET)");
    return null;
  }

  try {
    // Step 1: Exchange auth code for short-lived access token
    const shortTokenRes = await withCircuitBreaker("instagram:exchange_short", async () => {
      return await fetch(IG_OAUTH_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id:     appId,
          client_secret: appSecret,
          grant_type:    "authorization_code",
          redirect_uri:  redirectUri,
          code,
        }),
        signal: AbortSignal.timeout(SOCIAL_API_TIMEOUT_MS),
      });
    });

    if (!shortTokenRes.ok) {
      logger.error("Instagram short-lived token exchange HTTP error", { status: shortTokenRes.status });
      return null;
    }

    const shortTokenData = await shortTokenRes.json() as {
      access_token?: string;
      user_id?: string;
      error_type?: string;
      code?: number;
      error_message?: string;
    };

    if (!shortTokenData.access_token || !shortTokenData.user_id) {
      logger.error("Instagram short-lived token exchange failed", {
        errorType: shortTokenData.error_type,
        errorCode: shortTokenData.code,
      });
      return null;
    }

    const shortToken = shortTokenData.access_token;
    const igUserId = String(shortTokenData.user_id);

    // Step 2: Exchange short-lived token for long-lived access token (60 days)
    const longTokenParams = new URLSearchParams({
      grant_type:    "ig_exchange_token",
      client_secret: appSecret,
      access_token:  shortToken,
    });

    const longTokenRes = await withCircuitBreaker("instagram:exchange_long", async () => {
      return await fetch(`${IG_GRAPH_BASE_URL}/access_token?${longTokenParams.toString()}`, {
        signal: AbortSignal.timeout(SOCIAL_API_TIMEOUT_MS),
      });
    });

    if (!longTokenRes.ok) {
      logger.error("Instagram long-lived token exchange HTTP error", { status: longTokenRes.status });
      // Fallback: If long-lived exchange fails, return short token with 1h expiry
      return {
        accessToken: shortToken,
        userId:      igUserId,
        expiresIn:   3600,
      };
    }

    const longTokenData = await longTokenRes.json() as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      error?: { message: string; type: string; code: number };
    };

    if (longTokenData.error || !longTokenData.access_token) {
      logger.error("Instagram long-lived token exchange error response", {
        errorType: longTokenData.error?.type,
        errorCode: longTokenData.error?.code,
      });
      return {
        accessToken: shortToken,
        userId:      igUserId,
        expiresIn:   3600,
      };
    }

    return {
      accessToken: longTokenData.access_token,
      userId:      igUserId,
      expiresIn:   longTokenData.expires_in ?? 5184000, // 60 days default
    };
  } catch (error) {
    logger.error("Instagram OAuth exchange exception", {
      message: error instanceof Error ? error.message : "Request failed",
    });
    return null;
  }
}

// ─── Token Refresh (Lifecycle) ──────────────────────────────────────────────────

/**
 * Refresh a long-lived Instagram access token.
 * Token must be at least 24 hours old and not yet expired.
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/get-access-tokens-and-permissions#refresh-a-long-lived-token
 * Target: GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<long>
 */
export async function refreshInstagramToken(
  accessToken: string,
): Promise<{ accessToken: string; expiresIn: number } | null> {
  if (!accessToken) return null;

  try {
    const params = new URLSearchParams({
      grant_type:   "ig_refresh_token",
      access_token: accessToken,
    });

    const res = await withCircuitBreaker("instagram:refresh", async () => {
      return await fetch(`${IG_GRAPH_BASE_URL}/refresh_access_token?${params.toString()}`, {
        signal: AbortSignal.timeout(SOCIAL_API_TIMEOUT_MS),
      });
    });
    if (!res.ok) {
      logger.error("Instagram token refresh HTTP error", { status: res.status });
      return null;
    }

    const data = await res.json() as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      error?: { message: string; type: string; code: number };
    };

    if (data.error || !data.access_token) {
      logger.error("Instagram token refresh rejected", {
        errorCode: data.error?.code,
        errorType: data.error?.type,
      });
      return null;
    }

    return {
      accessToken: data.access_token,
      expiresIn:   data.expires_in ?? 5184000,
    };
  } catch (err) {
    logger.error("Instagram token refresh exception", {
      message: err instanceof Error ? err.message : "Refresh failed",
    });
    return null;
  }
}

/**
 * Enforce token expiry on every read and automatically refresh expired tokens.
 * Matches getFreshYouTubeAccessToken pattern.
 */
export async function getFreshInstagramAccessToken(userId: string): Promise<string | null> {
  if (!userId) return null;

  try {
    const oauth = await prisma.oAuthAccount.findFirst({
      where: {
        userId,
        provider: "instagram",
      },
      select: {
        id: true,
        accessToken: true,
        expiresAt: true,
      },
    });

    if (!oauth?.accessToken) return null;

    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    const isExpiredOrExpiring = !oauth.expiresAt || oauth.expiresAt <= fiveMinutesFromNow;

    if (!isExpiredOrExpiring) {
      // Token is still fresh; return decrypted access token
      return decrypt(oauth.accessToken);
    }

    // Token is expired or expiring soon; refresh it
    const decryptedCurrentToken = decrypt(oauth.accessToken);
    const refreshed = await refreshInstagramToken(decryptedCurrentToken);

    if (!refreshed?.accessToken) {
      // Refresh failed — mark as needing reconnect
      await prisma.oAuthAccount.update({
        where: { id: oauth.id },
        data: {
          scope: "NEEDS_RECONNECT",
        },
      }).catch((updateErr) => {
        logger.warn("Failed to mark Instagram account as NEEDS_RECONNECT", { userId, updateErr });
      });
      return null;
    }

    const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
    await prisma.oAuthAccount.update({
      where: { id: oauth.id },
      data: {
        accessToken: encrypt(refreshed.accessToken),
        expiresAt: newExpiresAt,
      },
    });

    return refreshed.accessToken;
  } catch (error) {
    logger.error("getFreshInstagramAccessToken error", { error, userId });
    return null;
  }
}

// ─── Profile Fetch ─────────────────────────────────────────────────────────────

/**
 * Fetch Instagram Business/Creator profile data using direct Instagram Login token.
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/get-user-profile-and-media
 * Endpoint: GET https://graph.instagram.com/me?fields=user_id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,account_type
 * Header: Authorization: Bearer <accessToken>
 *
 * Only BUSINESS or CREATOR account types are supported; PERSONAL accounts fail.
 */
export async function getInstagramProfile(
  accessToken: string,
): Promise<InstagramProfile | null> {
  if (!accessToken) {
    logger.warn("No Instagram access token provided");
    return null;
  }

  try {
    const fields = "user_id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,account_type";
    const res = await withCircuitBreaker("instagram:profile", async () => {
      return await fetch(`${IG_GRAPH_BASE_URL}/me?fields=${fields}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(SOCIAL_API_TIMEOUT_MS),
      });
    });

    const data = await res.json() as {
      user_id?: string;
      id?: string;
      username?: string;
      name?: string;
      biography?: string;
      followers_count?: number;
      follows_count?: number;
      media_count?: number;
      profile_picture_url?: string;
      account_type?: string;
      error?: { message: string; type: string; code: number };
    };

    if (!res.ok || data.error || (!data.user_id && !data.id)) {
      if (data.error) {
        logger.error("Instagram profile fetch error", {
          errorCode: data.error.code,
          errorType: data.error.type,
        });
      }
      return null;
    }

    // Business or Creator only; personal accounts fail per platform requirements
    const accountType = data.account_type?.toUpperCase();
    if (accountType === "PERSONAL") {
      logger.warn("Instagram personal account rejected — Business or Creator account required", {
        username: data.username,
      });
      return null;
    }

    return {
      id:             data.user_id || data.id || "",
      username:       data.username || "",
      name:           data.name || data.username || "",
      biography:      data.biography || "",
      followersCount: data.followers_count ?? 0,
      followingCount: data.follows_count ?? 0,
      mediaCount:     data.media_count ?? 0,
      profilePicture: data.profile_picture_url || "",
      isVerified:     false,
      accountType:    data.account_type,
    };
  } catch (error) {
    logger.error("Instagram profile fetch error", error);
    return null;
  }
}

// ─── Media / Posts ─────────────────────────────────────────────────────────────

/**
 * Fetch recent media posts using Instagram Login token.
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/get-user-profile-and-media
 * Endpoint: GET https://graph.instagram.com/me/media?fields=id,media_type,permalink,caption,timestamp,like_count,comments_count,is_paid_partnership
 * Header: Authorization: Bearer <accessToken>
 */
async function getRecentPosts(
  accessToken: string,
  limit: number = 10,
): Promise<InstagramPost[]> {
  const allPosts: InstagramPost[] = [];
  const fields = "id,media_type,media_url,permalink,caption,timestamp,like_count,comments_count,is_paid_partnership";
  let nextUrl: string | null =
    `${IG_GRAPH_BASE_URL}/me/media?fields=${fields}&limit=${Math.min(limit, 50)}`;

  try {
    while (nextUrl && allPosts.length < limit) {
      const currentUrl = nextUrl;
      const res = await withCircuitBreaker("instagram:media", async () => {
        return await fetch(currentUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: AbortSignal.timeout(SOCIAL_API_TIMEOUT_MS),
        });
      });
      if (!res.ok) {
        logger.error("Instagram API HTTP error during getRecentPosts", { status: res.status });
        break;
      }
      const data = await res.json() as {
        error?: { message: string; code?: number };
        data?: Array<Record<string, unknown>>;
        paging?: { next?: string };
      };

      if (data.error || !data.data) {
        if (data.error) {
          logger.error("Instagram media fetch error", { errorCode: data.error.code });
        }
        break;
      }

      allPosts.push(...data.data.map((post) => ({
        id:                post.id as string,
        mediaType:         post.media_type as InstagramPost["mediaType"],
        mediaUrl:          (post.media_url as string) || "",
        permalink:         (post.permalink as string) || "",
        caption:           (post.caption as string) || "",
        timestamp:         post.timestamp as string,
        likeCount:         (post.like_count as number) || 0,
        commentsCount:     (post.comments_count as number) || 0,
        isLive:            true,
        isPaidPartnership: (post.is_paid_partnership as boolean) || false,
      })));

      nextUrl = data.paging?.next || null;
    }

    return allPosts.slice(0, limit);
  } catch (error) {
    logger.error("Instagram posts fetch error", error);
    return allPosts;
  }
}

// ─── Post URL Lookup & Shortcode Normalization ──────────────────────────────────

export type InstagramPostFetchResult =
  | { status: "FOUND"; post: InstagramPost }
  | { status: "NOT_FOUND" }
  | { status: "API_ERROR"; error: string };

/**
 * Extracts normalized Instagram shortcode from /p/, /reel/, or /tv/ URLs.
 * Handles query parameters (?utm_source=..., ?igsh=...) and trailing slashes.
 */
export function extractInstagramShortcode(url: string): string | null {
  if (!url) return null;
  try {
    const rawClean = cleanUrl(url);
    const match = rawClean.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i);
    return match && match[1] ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Find a specific post by URL among a user's recent media.
 * Matches by shortcode across /p/, /reel/, and /tv/ permalinks.
 */
export async function findPostByUrlDetailed(
  accessToken: string,
  postUrl: string,
  _igUserId?: string,
): Promise<InstagramPostFetchResult> {
  if (!accessToken) {
    return { status: "API_ERROR", error: "No Instagram access token provided" };
  }

  const targetShortcode = extractInstagramShortcode(postUrl);
  const targetClean = cleanUrl(postUrl);

  const fields = "id,media_type,media_url,permalink,caption,timestamp,like_count,comments_count,is_paid_partnership";
  let nextUrl: string | null =
    `${IG_GRAPH_BASE_URL}/me/media?fields=${fields}&limit=50&access_token=${accessToken}`;
  let checkedCount = 0;

  try {
    while (nextUrl && checkedCount < 150) {
      const res = await fetch(nextUrl);
      if (!res.ok) {
        let errorDetails = `Instagram API HTTP ${res.status}`;
        try {
          const errData = await res.json() as { error?: { message: string; code?: number } };
          if (errData?.error?.message || errData?.error?.code) {
            errorDetails = `${errData.error.message || "Error"} (code: ${errData.error.code ?? res.status})`;
          }
        } catch {
          // ignore json parse error
        }
        return { status: "API_ERROR", error: errorDetails };
      }
      const data = await res.json() as {
        error?: { message: string; code?: number };
        data?: Array<Record<string, unknown>>;
        paging?: { next?: string };
      };

      if (data.error) {
        logger.error("Instagram API error during post search", { errorCode: data.error.code });
        return { status: "API_ERROR", error: data.error.message || `Instagram error code ${data.error.code}` };
      }

      if (!data.data || data.data.length === 0) break;

      for (const rawPost of data.data) {
        checkedCount++;
        const post: InstagramPost = {
          id:                rawPost.id as string,
          mediaType:         rawPost.media_type as InstagramPost["mediaType"],
          mediaUrl:          (rawPost.media_url as string) || "",
          permalink:         (rawPost.permalink as string) || "",
          caption:           (rawPost.caption as string) || "",
          timestamp:         rawPost.timestamp as string,
          likeCount:         (rawPost.like_count as number) || 0,
          commentsCount:     (rawPost.comments_count as number) || 0,
          isLive:            true,
          isPaidPartnership: (rawPost.is_paid_partnership as boolean) || false,
        };

        const postShortcode = extractInstagramShortcode(post.permalink);

        // Match either by extracted shortcode or normalized URL clean string
        if (
          (targetShortcode && postShortcode && targetShortcode === postShortcode) ||
          cleanUrl(post.permalink) === targetClean
        ) {
          return { status: "FOUND", post };
        }
      }

      nextUrl = data.paging?.next || null;
    }

    return { status: "NOT_FOUND" };
  } catch (error) {
    logger.error("Instagram post search error", error);
    return {
      status: "API_ERROR",
      error: error instanceof Error ? error.message : "Network error fetching Instagram posts",
    };
  }
}

/**
 * Simplified wrapper — returns post or null.
 */
export async function findPostByUrl(
  accessToken: string,
  postUrl: string,
  igUserId?: string,
): Promise<InstagramPost | null> {
  const result = await findPostByUrlDetailed(accessToken, postUrl, igUserId);
  return result.status === "FOUND" ? result.post : null;
}

// ─── Engagement Calculation ────────────────────────────────────────────────────

/**
 * Calculate engagement rate from recent 20 posts.
 */
export async function calculateEngagement(
  accessToken: string,
): Promise<InstagramInsights | null> {
  const profile = await getInstagramProfile(accessToken);
  if (!profile) return null;

  const posts = await getRecentPosts(accessToken, 20);
  if (posts.length === 0) return null;

  const totalLikes    = posts.reduce((s, p) => s + p.likeCount, 0);
  const totalComments = posts.reduce((s, p) => s + p.commentsCount, 0);
  const avgLikes      = Math.round(totalLikes / posts.length);
  const avgComments   = Math.round(totalComments / posts.length);

  const engagementRate =
    profile.followersCount > 0
      ? ((avgLikes + avgComments) / profile.followersCount) * 100
      : 0;

  return {
    engagementRate: Math.round(engagementRate * 100) / 100,
    avgLikes,
    avgComments,
    reachEstimate:  Math.round(profile.followersCount * (engagementRate / 100) * 3),
  };
}

// ─── Public Post Check ──────────────────────────────────────────────────────────

/**
 * Unauthenticated check whether an Instagram permalink is publicly accessible.
 * Returns false if it redirects to login (302/301/307) or 404/403.
 */
export async function checkIsInstagramPostPublic(permalink: string): Promise<boolean> {
  if (!permalink) return false;
  try {
    const parsed = new URL(permalink);
    if (parsed.protocol !== "https:") return false;

    const allowedHosts = new Set(["www.instagram.com", "instagram.com", "instagr.am"]);
    if (!allowedHosts.has(parsed.hostname.toLowerCase())) return false;

    if (!/^\/(p|reel|tv)\/[\w-]+/i.test(parsed.pathname)) return false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOCIAL_API_TIMEOUT_MS);

    const res = await fetch(parsed.toString(), {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "manual",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if ([404, 403, 302, 301, 307].includes(res.status)) return false;
    return true;
  } catch (err) {
    logger.warn("Unauthenticated Instagram public check failed, defaulting to true", {
      permalink,
      error: err,
    });
    return true;
  }
}
