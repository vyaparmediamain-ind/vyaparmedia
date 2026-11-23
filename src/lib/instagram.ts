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
import { isKillSwitchActive, KILL_SWITCH_FEATURES } from "@/lib/kill-switch";
import { instagramInsightsRequestsTotal } from "@/lib/metrics";

// ─── API Constants ─────────────────────────────────────────────────────────────
export const IG_API_VERSION = "v21.0";
export const IG_OAUTH_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
export const IG_OAUTH_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
export const IG_GRAPH_BASE_URL = `https://graph.instagram.com/${IG_API_VERSION}`;

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
  mediaProductType?: "FEED" | "REELS" | "STORY" | "AD" | string | undefined;
  mediaUrl: string;
  permalink: string;
  caption: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  isLive: boolean;
  isPaidPartnership?: boolean;
}

export type InstagramCapabilityState =
  | "ACTIVE"
  | "RECONNECT_NEEDED"
  | "PERSONAL_ACCOUNT"
  | "UNKNOWN"
  | "BASIC_ONLY";

export interface InstagramCapabilities {
  basic: boolean;
  insights: boolean;
  needsReconnect: boolean;
  capability?: InstagramCapabilityState | undefined;
}

export interface InstagramMediaInsightsValues {
  views?: number | undefined;
  reach?: number | undefined;
  likes?: number | undefined;
  comments?: number | undefined;
  shares?: number | undefined;
  saved?: number | undefined;
  totalInteractions?: number | undefined;
}

export type InstagramMediaInsightsResult =
  | {
      status: "OK";
      values: InstagramMediaInsightsValues;
      quality: "API";
      views?: number | undefined;
      reach?: number | undefined;
      likes?: number | undefined;
      comments?: number | undefined;
      shares?: number | undefined;
      saved?: number | undefined;
      totalInteractions?: number | undefined;
    }
  | {
      status: "EMPTY";
      quality?: "API" | undefined;
      views?: undefined;
      reach?: undefined;
      likes?: undefined;
      comments?: undefined;
      shares?: undefined;
      saved?: undefined;
      totalInteractions?: undefined;
    }
  | {
      status: "NOT_ENOUGH_VIEWERS";
      quality?: "API" | undefined;
      views?: undefined;
      reach?: undefined;
      likes?: undefined;
      comments?: undefined;
      shares?: undefined;
      saved?: undefined;
      totalInteractions?: undefined;
    }
  | {
      status: "UNSUPPORTED_MEDIA";
      quality?: "API" | undefined;
      views?: undefined;
      reach?: undefined;
      likes?: undefined;
      comments?: undefined;
      shares?: undefined;
      saved?: undefined;
      totalInteractions?: undefined;
    }
  | {
      status: "PERMISSION_DENIED";
      quality?: undefined;
      views?: undefined;
      reach?: undefined;
      likes?: undefined;
      comments?: undefined;
      shares?: undefined;
      saved?: undefined;
      totalInteractions?: undefined;
    }
  | {
      status: "TOKEN_INVALID";
      quality?: undefined;
      views?: undefined;
      reach?: undefined;
      likes?: undefined;
      comments?: undefined;
      shares?: undefined;
      saved?: undefined;
      totalInteractions?: undefined;
    }
  | {
      status: "RATE_LIMITED";
      retryAfterMs?: number | undefined;
      quality?: undefined;
      views?: undefined;
      reach?: undefined;
      likes?: undefined;
      comments?: undefined;
      shares?: undefined;
      saved?: undefined;
      totalInteractions?: undefined;
    }
  | {
      status: "METRIC_UNSUPPORTED";
      quality?: undefined;
      views?: undefined;
      reach?: undefined;
      likes?: undefined;
      comments?: undefined;
      shares?: undefined;
      saved?: undefined;
      totalInteractions?: undefined;
    }
  | {
      status: "ERROR";
      message?: string | undefined;
      code?: number | undefined;
      quality?: undefined;
      views?: undefined;
      reach?: undefined;
      likes?: undefined;
      comments?: undefined;
      shares?: undefined;
      saved?: undefined;
      totalInteractions?: undefined;
    };

export type InstagramInsightsStatus = InstagramMediaInsightsResult["status"];

export type InstagramInsightsErrorClassification =
  | { status: "PERMISSION_DENIED"; message?: string | undefined; code?: number | undefined }
  | { status: "NOT_ENOUGH_VIEWERS"; message?: string | undefined; code?: number | undefined }
  | { status: "TOKEN_INVALID"; message?: string | undefined; code?: number | undefined; subcode?: number | undefined }
  | { status: "METRIC_UNSUPPORTED"; message?: string | undefined; code?: number | undefined }
  | { status: "UNSUPPORTED_MEDIA"; message?: string | undefined; code?: number | undefined }
  | { status: "RATE_LIMITED"; retryAfterMs?: number | undefined; message?: string | undefined; code?: number | undefined }
  | { status: "ERROR"; message?: string | undefined; code?: number | undefined };

export function classifyInstagramInsightsError(
  httpStatus: number,
  errorBody: unknown
): InstagramInsightsErrorClassification {
  const errObj = errorBody && typeof errorBody === "object"
    ? ((errorBody as { error?: { message?: string; code?: number; error_subcode?: number } }).error ||
       (errorBody as { message?: string; code?: number; error_subcode?: number }))
    : undefined;

  const code = typeof errObj?.code === "number" ? errObj.code : undefined;
  const subcode = typeof (errObj as { error_subcode?: number })?.error_subcode === "number"
    ? (errObj as { error_subcode?: number }).error_subcode
    : undefined;
  const message = typeof errObj?.message === "string" ? errObj.message : "";
  const lowerMsg = message.toLowerCase();

  // 1. Rate limit (Code 80002 or HTTP 429)
  if (code === 80002 || httpStatus === 429 || lowerMsg.includes("too many calls") || lowerMsg.includes("rate limit")) {
    return { status: "RATE_LIMITED", message, code };
  }

  // 2. Token invalid / expired (Code 190, HTTP 401, subcodes 463, 467)
  if (code === 190 || httpStatus === 401 || lowerMsg.includes("validating access token") || lowerMsg.includes("session has expired") || lowerMsg.includes("invalid oauth")) {
    return { status: "TOKEN_INVALID", message, code, subcode };
  }

  // 3. Code 10: Disambiguate "not enough viewers" vs "permission denied"
  if (code === 10) {
    if (lowerMsg.includes("not enough viewers") || lowerMsg.includes("viewers for the media")) {
      return { status: "NOT_ENOUGH_VIEWERS", message, code };
    }
    return { status: "PERMISSION_DENIED", message, code };
  }

  if (lowerMsg.includes("not enough viewers") || lowerMsg.includes("viewers for the media")) {
    return { status: "NOT_ENOUGH_VIEWERS", message, code };
  }

  // 4. Code 200 or HTTP 403: Permission denied
  if (code === 200 || httpStatus === 403 || lowerMsg.includes("permission") || lowerMsg.includes("not have permission")) {
    return { status: "PERMISSION_DENIED", message, code };
  }

  // 5. Code 100 / Unsupported Media / Unsupported Metric
  if (code === 100 || lowerMsg.includes("album") || lowerMsg.includes("carousel") || lowerMsg.includes("child")) {
    if (lowerMsg.includes("album") || lowerMsg.includes("carousel") || lowerMsg.includes("child")) {
      return { status: "UNSUPPORTED_MEDIA", message, code };
    }
    if (lowerMsg.includes("metric") || lowerMsg.includes("not supported")) {
      return { status: "METRIC_UNSUPPORTED", message, code };
    }
    return { status: "METRIC_UNSUPPORTED", message, code };
  }

  return { status: "ERROR", message, code };
}

export interface InstagramPostWithInsights {
  post: InstagramPost;
  insights?: InstagramMediaInsightsResult | undefined;
}

/**
 * Derived helper to inspect an OAuthAccount's Instagram capabilities.
 * Invariant:
 * - If account is marked NEEDS_RECONNECT or token is missing -> needsReconnect: true, others false.
 * - basic: true if grantedScopes includes "instagram_business_basic" or scope matches.
 * - insights: true if grantedScopes includes "instagram_business_manage_insights" or scope matches.
 */
export function instagramCapabilities(oauthAccount?: {
  scope?: string | null;
  grantedScopes?: string[] | null;
  accessToken?: string | null;
} | null): InstagramCapabilities {
  if (!oauthAccount) {
    return { basic: false, insights: false, needsReconnect: false, capability: "BASIC_ONLY" };
  }

  const isExplicitReconnect = oauthAccount.scope === "NEEDS_RECONNECT";
  const hasNoToken = !oauthAccount.accessToken && oauthAccount.scope !== "PENDING_APPROVAL";
  const needsReconnect = isExplicitReconnect || hasNoToken;

  if (needsReconnect) {
    return { basic: false, insights: false, needsReconnect: true, capability: "RECONNECT_NEEDED" };
  }

  const granted = Array.isArray(oauthAccount.grantedScopes) ? oauthAccount.grantedScopes : [];
  const scopeStr = oauthAccount.scope || "";

  const hasBasic =
    granted.includes("instagram_business_basic") ||
    scopeStr.includes("instagram_business_basic");

  const hasInsights =
    granted.includes("instagram_business_manage_insights") ||
    scopeStr.includes("instagram_business_manage_insights");

  let capability: InstagramCapabilityState = "BASIC_ONLY";
  if (hasInsights) {
    capability = "ACTIVE";
  } else if (scopeStr === "UNKNOWN" || granted.includes("unknown") || granted.includes("insights_unknown")) {
    capability = "UNKNOWN";
  } else if (scopeStr === "PERSONAL_ACCOUNT" || granted.includes("personal_account")) {
    capability = "PERSONAL_ACCOUNT";
  } else {
    capability = "BASIC_ONLY";
  }

  return {
    basic: hasBasic,
    insights: hasInsights,
    needsReconnect: false,
    capability,
  };
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
  options?: { requestInsights?: boolean },
): string {
  const isHex = /^[0-9a-fA-F]+$/.test(state);
  if (!isHex || state.length < 32) {
    throw AppError.badRequest(
      "Invalid state parameter: Must be a cryptographically secure hex string of at least 32 characters.",
    );
  }

  const { appId } = getInstagramCredentials();

  const scopes = options?.requestInsights
    ? "instagram_business_basic,instagram_business_manage_insights"
    : "instagram_business_basic";

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
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
 *         Returns: { access_token: short_token, user_id: string, permissions?: string[] }
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
  expiresIn?: number | undefined;
  permissions?: string[] | undefined;
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
          client_id: appId,
          client_secret: appSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
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
      permissions?: string[];
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
    const permissions = Array.isArray(shortTokenData.permissions)
      ? shortTokenData.permissions
      : undefined;

    // Step 2: Exchange short-lived token for long-lived access token (60 days)
    const longTokenParams = new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: appSecret,
      access_token: shortToken,
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
        userId: igUserId,
        expiresIn: 3600,
        permissions,
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
        userId: igUserId,
        expiresIn: 3600,
        permissions,
      };
    }

    return {
      accessToken: longTokenData.access_token,
      userId: igUserId,
      expiresIn: longTokenData.expires_in ?? 5184000, // 60 days default
      permissions,
    };
  } catch (error) {
    logger.error("Instagram OAuth exchange exception", {
      message: error instanceof Error ? error.message : "Request failed",
    });
    return null;
  }
}

/**
 * Fetch granted permissions from Meta Graph API /me/permissions.
 */
export async function fetchInstagramPermissions(accessToken: string): Promise<string[]> {
  if (!accessToken) return [];
  try {
    const res = await withCircuitBreaker("instagram:permissions", async () => {
      return await fetch(`${IG_GRAPH_BASE_URL}/me/permissions`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(SOCIAL_API_TIMEOUT_MS),
      });
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      data?: Array<{ permission: string; status: string }>;
    };
    if (!Array.isArray(data.data)) return [];
    return data.data
      .filter((p) => p.status === "granted")
      .map((p) => p.permission);
  } catch (err) {
    logger.warn("Failed to fetch Instagram permissions from /me/permissions", { error: err });
    return [];
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
      grant_type: "ig_refresh_token",
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
      expiresIn: data.expires_in ?? 5184000,
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
      id: data.user_id || data.id || "",
      username: data.username || "",
      name: data.name || data.username || "",
      biography: data.biography || "",
      followersCount: data.followers_count ?? 0,
      followingCount: data.follows_count ?? 0,
      mediaCount: data.media_count ?? 0,
      profilePicture: data.profile_picture_url || "",
      isVerified: false,
      accountType: data.account_type,
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
export async function getRecentPosts(
  accessToken: string,
  limit: number = 10,
): Promise<InstagramPost[]> {
  const allPosts: InstagramPost[] = [];
  const fields = "id,media_type,media_product_type,media_url,permalink,caption,timestamp,like_count,comments_count,is_paid_partnership";
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
        id: post.id as string,
        mediaType: post.media_type as InstagramPost["mediaType"],
        mediaProductType: (post.media_product_type as string) || undefined,
        mediaUrl: (post.media_url as string) || "",
        permalink: (post.permalink as string) || "",
        caption: (post.caption as string) || "",
        timestamp: post.timestamp as string,
        likeCount: (post.like_count as number) || 0,
        commentsCount: (post.comments_count as number) || 0,
        isLive: true,
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

/**
 * Fetch top comments for a given Instagram media ID.
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/get-user-profile-and-media
 * Endpoint: GET https://graph.instagram.com/{media-id}/comments?fields=id,text,timestamp,username&limit={limit}
 */
export async function getPostComments(
  mediaId: string,
  accessToken: string,
  limit: number = 20,
): Promise<Array<{ id: string; text: string; username?: string; timestamp?: string }>> {
  if (!mediaId || !accessToken) return [];
  try {
    const res = await withCircuitBreaker("instagram:comments", async () => {
      return await fetch(
        `${IG_GRAPH_BASE_URL}/${mediaId}/comments?fields=id,text,timestamp,username&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(SOCIAL_API_TIMEOUT_MS),
        },
      );
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      data?: Array<{ id: string; text: string; username?: string; timestamp?: string }>;
    };
    return data?.data || [];
  } catch (error) {
    logger.warn("Failed to fetch Instagram post comments for audit", { mediaId, error });
    return [];
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

  const fields = "id,media_type,media_product_type,media_url,permalink,caption,timestamp,like_count,comments_count,is_paid_partnership";
  let nextUrl: string | null =
    `${IG_GRAPH_BASE_URL}/me/media?fields=${fields}&limit=50&access_token=${accessToken}`;
  let checkedCount = 0;

  try {
    while (nextUrl && checkedCount < 150) {
      const currentNextUrl = nextUrl;
      const res = await withCircuitBreaker("instagram:fetch_media", async () => {
        return await fetch(currentNextUrl, {
          signal: AbortSignal.timeout(SOCIAL_API_TIMEOUT_MS),
        });
      });
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
          id: rawPost.id as string,
          mediaType: rawPost.media_type as InstagramPost["mediaType"],
          mediaProductType: (rawPost.media_product_type as string) || undefined,
          mediaUrl: (rawPost.media_url as string) || "",
          permalink: (rawPost.permalink as string) || "",
          caption: (rawPost.caption as string) || "",
          timestamp: rawPost.timestamp as string,
          likeCount: (rawPost.like_count as number) || 0,
          commentsCount: (rawPost.comments_count as number) || 0,
          isLive: true,
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

// ─── Media Insights ────────────────────────────────────────────────────────────

/**
 * Fetch insights metrics for a specific Instagram media object.
 *
 * Official Docs:
 * https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights
 *
 * Supported metrics per product type:
 * - REELS / FEED: views, reach, likes, comments, shares, saved, total_interactions
 * - STORY: views, reach (stories with <5 viewers return error code 10: "Not enough viewers to show insights")
 *
 * Invariants & Behaviors:
 * - Gated by kill-switch (SOCIAL_INSTAGRAM) and circuit breaker ("instagram:insights")
 * - Enforces SOCIAL_API_TIMEOUT_MS
 * - Returns { quality: "API" } with missing metrics as undefined (never 0)
 * - Returns empty metrics (undefined) when Meta returns an empty dataset [] (e.g. unavailable)
 * - Returns empty metrics on Story error code 10 and carousel album children
 * - Never logs OAuth tokens
 */
async function fetchInsightsSingleCall(
  accessToken: string,
  mediaId: string,
  metrics: string[],
): Promise<{ ok: boolean; status: number; data?: unknown; errorData?: unknown }> {
  const metricQuery = metrics.join(",");
  const url = `${IG_GRAPH_BASE_URL}/${mediaId}/insights?metric=${metricQuery}`;

  let res: Response;
  try {
    res = await withCircuitBreaker("instagram:insights", async () => {
      return await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(SOCIAL_API_TIMEOUT_MS),
      });
    });
  } catch (netErr) {
    return { ok: false, status: 500, errorData: { error: { message: netErr instanceof Error ? netErr.message : String(netErr) } } };
  }

  if (!res.ok) {
    let errorData: unknown = null;
    try {
      errorData = await res.json();
    } catch {
      // ignore json parse error
    }
    return { ok: false, status: res.status, errorData };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { ok: true, status: res.status, data };
}

async function fetchInsightsWithRetry(
  accessToken: string,
  mediaId: string,
  metrics: string[],
  maxRetries = 2
): Promise<{ ok: boolean; status: number; data?: unknown; errorData?: unknown }> {
  let attempt = 0;
  while (true) {
    const res = await fetchInsightsSingleCall(accessToken, mediaId, metrics);
    if (res.ok) return res;

    const classified = classifyInstagramInsightsError(res.status, res.errorData);
    if (classified.status === "RATE_LIMITED" && attempt < maxRetries) {
      attempt++;
      const backoffMs = attempt * 300;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      continue;
    }
    return res;
  }
}

export async function getMediaInsights(
  accessToken: string,
  mediaId: string,
  productType?: string | null | undefined,
): Promise<InstagramMediaInsightsResult | null> {
  if (!accessToken || !mediaId) return null;

  // 1. Kill-switch check
  if (await isKillSwitchActive(KILL_SWITCH_FEATURES.SOCIAL_INSTAGRAM)) {
    logger.warn("Instagram media insights skipped: SOCIAL_INSTAGRAM kill switch is active");
    return null;
  }

  const normalizedType = (productType || "").toUpperCase();

  try {
    // 2. Request minimal safe set first: views, reach
    const safeMetrics = ["views", "reach"];
    const safeRes = await fetchInsightsWithRetry(accessToken, mediaId, safeMetrics);

    if (!safeRes.ok) {
      const classification = classifyInstagramInsightsError(safeRes.status, safeRes.errorData);
      instagramInsightsRequestsTotal.inc({ status: classification.status });

      if (classification.status === "NOT_ENOUGH_VIEWERS") {
        logger.info("Instagram story has <5 viewers; insights dataset empty", { mediaId });
        return { status: "NOT_ENOUGH_VIEWERS", quality: "API" };
      }
      if (classification.status === "UNSUPPORTED_MEDIA") {
        logger.info("Instagram media is inside an album or unsupported child item", { mediaId });
        return { status: "UNSUPPORTED_MEDIA", quality: "API" };
      }
      if (classification.status === "PERMISSION_DENIED") {
        logger.warn("Instagram media insights permission denied", { mediaId, code: classification.code });
        return { status: "PERMISSION_DENIED" };
      }
      if (classification.status === "TOKEN_INVALID") {
        logger.warn("Instagram media insights token invalid / expired", { mediaId });
        return { status: "TOKEN_INVALID" };
      }
      if (classification.status === "RATE_LIMITED") {
        logger.warn("Instagram media insights rate limited", { mediaId });
        return { status: "RATE_LIMITED", retryAfterMs: classification.retryAfterMs };
      }
      if (classification.status === "METRIC_UNSUPPORTED") {
        return { status: "METRIC_UNSUPPORTED" };
      }

      logger.warn("Instagram media insights fetch HTTP failure", {
        status: safeRes.status,
        code: classification.code,
      });
      return { status: "ERROR", message: classification.message, code: classification.code };
    }

    const safeData = safeRes.data as {
      data?: Array<{
        name: string;
        values?: Array<{ value: number }>;
        total_value?: { value: number };
      }>;
      error?: { message: string; code?: number };
    };

    if (safeData?.error) {
      const classification = classifyInstagramInsightsError(safeRes.status, safeData);
      instagramInsightsRequestsTotal.inc({ status: classification.status });
      return classification;
    }

    if (!safeData?.data || safeData.data.length === 0) {
      instagramInsightsRequestsTotal.inc({ status: "EMPTY" });
      return { status: "EMPTY", quality: "API" };
    }

    const values: InstagramMediaInsightsValues = {};
    for (const item of safeData.data) {
      const val = typeof item.total_value?.value === "number"
        ? item.total_value.value
        : typeof item.values?.[0]?.value === "number"
          ? item.values[0].value
          : undefined;

      if (typeof val !== "number") continue;
      if (item.name === "views") values.views = val;
      if (item.name === "reach") values.reach = val;
    }

    // 3. Request optional groups for non-story content
    if (normalizedType !== "STORY") {
      const optionalMetrics = ["likes", "comments", "shares", "saved", "total_interactions"];
      const optRes = await fetchInsightsWithRetry(accessToken, mediaId, optionalMetrics);

      if (optRes.ok && optRes.data) {
        const optData = optRes.data as {
          data?: Array<{
            name: string;
            values?: Array<{ value: number }>;
            total_value?: { value: number };
          }>;
        };

        if (Array.isArray(optData?.data)) {
          for (const item of optData.data) {
            const val = typeof item.total_value?.value === "number"
              ? item.total_value.value
              : typeof item.values?.[0]?.value === "number"
                ? item.values[0].value
                : undefined;

            if (typeof val !== "number") continue;
            if (item.name === "likes") values.likes = val;
            if (item.name === "comments") values.comments = val;
            if (item.name === "shares") values.shares = val;
            if (item.name === "saved") values.saved = val;
            if (item.name === "total_interactions") values.totalInteractions = val;
          }
        }
      } else if (!optRes.ok) {
        const optClassification = classifyInstagramInsightsError(optRes.status, optRes.errorData);
        // On code 100 retry per-metric so one unsupported metric never nukes the rest
        if (optClassification.status === "METRIC_UNSUPPORTED") {
          for (const metric of optionalMetrics) {
            try {
              const singleRes = await fetchInsightsSingleCall(accessToken, mediaId, [metric]);
              if (singleRes.ok && singleRes.data) {
                const sData = singleRes.data as {
                  data?: Array<{
                    name: string;
                    values?: Array<{ value: number }>;
                    total_value?: { value: number };
                  }>;
                };
                if (Array.isArray(sData?.data) && sData.data[0]) {
                  const item = sData.data[0];
                  const val = typeof item.total_value?.value === "number"
                    ? item.total_value.value
                    : typeof item.values?.[0]?.value === "number"
                      ? item.values[0].value
                      : undefined;
                  if (typeof val === "number") {
                    if (metric === "likes") values.likes = val;
                    if (metric === "comments") values.comments = val;
                    if (metric === "shares") values.shares = val;
                    if (metric === "saved") values.saved = val;
                    if (metric === "total_interactions") values.totalInteractions = val;
                  }
                }
              }
            } catch {
              // Isolated per-metric failure, continue
            }
          }
        }
      }
    }

    instagramInsightsRequestsTotal.inc({ status: "OK" });
    return {
      status: "OK",
      values,
      quality: "API",
      views: values.views,
      reach: values.reach,
      likes: values.likes,
      comments: values.comments,
      shares: values.shares,
      saved: values.saved,
      totalInteractions: values.totalInteractions,
    };
  } catch (error) {
    instagramInsightsRequestsTotal.inc({ status: "ERROR" });
    logger.error("Instagram media insights exception", {
      mediaId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "ERROR", message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Fetch recent Instagram posts accompanied by their verified media insights.
 * Uses bounded concurrency pool of 4 and per-call error isolation.
 */
export async function getRecentPostsWithInsights(
  accessToken: string,
  limit: number = 10,
  concurrency: number = 4,
): Promise<InstagramPostWithInsights[]> {
  const posts = await getRecentPosts(accessToken, limit);
  if (posts.length === 0) return [];

  const results: InstagramPostWithInsights[] = new Array(posts.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < posts.length) {
      const idx = nextIndex++;
      const post = posts[idx];
      if (!post) continue;
      try {
        const insights = await getMediaInsights(
          accessToken,
          post.id,
          post.mediaProductType,
        );
        results[idx] = { post, insights: insights ?? undefined };
      } catch (err) {
        logger.warn("Per-call isolated error fetching media insights for post", {
          postId: post.id,
          error: err instanceof Error ? err.message : String(err),
        });
        results[idx] = { post, insights: undefined };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, posts.length) }, () => worker());
  await Promise.all(workers);

  return results;
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

  const totalLikes = posts.reduce((s, p) => s + p.likeCount, 0);
  const totalComments = posts.reduce((s, p) => s + p.commentsCount, 0);
  const avgLikes = Math.round(totalLikes / posts.length);
  const avgComments = Math.round(totalComments / posts.length);

  const engagementRate =
    profile.followersCount > 0
      ? ((avgLikes + avgComments) / profile.followersCount) * 100
      : 0;

  return {
    engagementRate: Math.round(engagementRate * 100) / 100,
    avgLikes,
    avgComments,
    reachEstimate: Math.round(profile.followersCount * (engagementRate / 100) * 3),
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

    const res = await withCircuitBreaker("instagram:public_check", async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SOCIAL_API_TIMEOUT_MS);
      try {
        return await fetch(parsed.toString(), {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          redirect: "manual",
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    });

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
