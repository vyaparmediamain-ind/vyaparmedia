import { AppError } from "@/lib/errors";
import { env } from "@/env";
/**
 * Instagram Business Login — Meta Graph API v22.0
 *
 * ⚠️  MIGRATION NOTE (Dec 2024)
 * Instagram Basic Display API was permanently shut down by Meta on 4 Dec 2024.
 * This module now uses the INSTAGRAM BUSINESS LOGIN flow:
 *
 *   OAuth URL  : https://www.facebook.com/v22.0/dialog/oauth
 *   Scope      : instagram_business_basic,instagram_business_manage_messages
 *   Token URL  : https://graph.facebook.com/v22.0/oauth/access_token
 *   Profile    : https://graph.facebook.com/v22.0/me/accounts → IG Business account
 *
 * App Setup (Meta for Developers):
 *   1. Open your app → Add Product → "Instagram" → "Instagram Business Login"
 *   2. Add scopes: instagram_business_basic (required), instagram_business_manage_messages (optional)
 *   3. Add redirect URI: https://yourdomain.com/api/auth/instagram/callback
 *   4. Submit for App Review if publishing to public
 *
 * Environment Variables (unchanged keys):
 *   INSTAGRAM_APP_ID     - Your Meta App ID
 *   INSTAGRAM_APP_SECRET - Your Meta App Secret
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 */

import { logger } from "./logger";
import { cleanUrl } from "./utils";
import { SOCIAL_API_TIMEOUT_MS } from "@/constants";

// ─── API Constants ─────────────────────────────────────────────────────────────
// Facebook Graph API is the host for Instagram Business Login token exchange
// and profile fetching (NOT api.instagram.com which was Basic Display).
const FB_GRAPH_BASE    = "https://graph.facebook.com";
const GRAPH_API_VER    = "v22.0";
const FB_GRAPH_V       = `${FB_GRAPH_BASE}/${GRAPH_API_VER}`;

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
  website?: string;
}

interface InstagramPost {
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

interface InstagramInsights {
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  reachEstimate: number;
}

// ─── OAuth URL ─────────────────────────────────────────────────────────────────

/**
 * Generate Instagram Business Login OAuth URL.
 *
 * Uses Facebook dialog (NOT api.instagram.com/oauth/authorize which was
 * the deprecated Basic Display endpoint).
 *
 * Scopes:
 *   - instagram_business_basic           : read profile, followers, media (required)
 *   - instagram_business_manage_messages : optional, add if DMs needed
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

  const params = new URLSearchParams({
    client_id:     env.INSTAGRAM_APP_ID || "",
    redirect_uri:  redirectUri,
    scope:         "instagram_business_basic",
    response_type: "code",
    state,
  });

  // Facebook OAuth dialog — this is the new entry point for Instagram Business Login
  return `${FB_GRAPH_BASE}/${GRAPH_API_VER}/dialog/oauth?${params.toString()}`;
}

// ─── Token Exchange ─────────────────────────────────────────────────────────────

/**
 * Exchange authorization code for a long-lived access token.
 *
 * Instagram Business Login issues long-lived tokens directly (60-day expiry)
 * via the Facebook Graph API token endpoint.  No separate short → long exchange
 * step is needed (unlike the old Basic Display API flow).
 */
export async function exchangeInstagramCode(
  code: string,
  redirectUri: string,
): Promise<{
  accessToken: string;
  userId: string;       // Facebook user ID
} | null> {
  const appId     = env.INSTAGRAM_APP_ID     || "";
  const appSecret = env.INSTAGRAM_APP_SECRET || "";

  if (!appId || !appSecret) {
    logger.warn("Instagram app credentials not configured (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET)");
    return null;
  }

  try {
    // Step 1: Exchange code for access token via Facebook Graph API
    const tokenRes = await fetch(`${FB_GRAPH_V}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     appId,
        client_secret: appSecret,
        redirect_uri:  redirectUri,
        code,
      }),
    });

    if (!tokenRes.ok) {
      logger.error("Instagram token exchange HTTP error", { status: tokenRes.status });
      return null;
    }

    const tokenData = await tokenRes.json() as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      error?: { message: string; type: string; code: number };
    };

    if (tokenData.error || !tokenData.access_token) {
      // Scrub token from logs
      logger.error("Instagram Business Login token exchange failed", {
        errorType:    tokenData.error?.type,
        errorCode:    tokenData.error?.code,
        errorMessage: tokenData.error?.message,
      });
      return null;
    }

    // Step 2: Get the Facebook User ID to use as providerAccountId
    const fbUserId = await getFacebookUserId(tokenData.access_token);
    if (!fbUserId) {
      logger.error("Could not resolve Facebook user ID from access token");
      return null;
    }

    return {
      accessToken: tokenData.access_token,
      userId:      fbUserId,
    };
  } catch (error) {
    logger.error("Instagram OAuth error", {
      message: error instanceof Error ? error.message : "Request failed",
    });
    return null;
  }
}

/**
 * Resolve the Facebook User ID for the authenticated user.
 * Used as the stable providerAccountId in oAuthAccount.
 */
async function getFacebookUserId(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${FB_GRAPH_V}/me?fields=id&access_token=${accessToken}`,
    );
    const data = await res.json() as { id?: string; error?: { message: string } };
    if (data.error || !data.id) {
      logger.error("Facebook user ID fetch failed", { error: data.error?.message });
      return null;
    }
    return data.id;
  } catch {
    return null;
  }
}

// ─── Profile Fetch ─────────────────────────────────────────────────────────────

/**
 * Fetch Instagram Business profile data using an access token.
 *
 * Flow:
 *   1. GET /me/accounts  → get the list of Facebook Pages the user manages
 *   2. For each Page, check for a linked Instagram Business Account via
 *      /page_id?fields=instagram_business_account
 *   3. Fetch the Instagram account details using the IG account ID
 *
 * Falls back to /me?fields=... (for Creator accounts linked via Instagram Login)
 * if no Business account is found via Pages.
 */
export async function getInstagramProfile(
  accessToken: string,
): Promise<InstagramProfile | null> {
  if (!accessToken) {
    logger.warn("No Instagram access token provided");
    return null;
  }

  try {
    // Try Business Account path first (via Facebook Pages)
    const profile = await getProfileViaBusinessAccount(accessToken);
    if (profile) return profile;

    // Fallback: Creator / Personal account via Instagram Login
    return await getProfileViaDirectLogin(accessToken);
  } catch (error) {
    logger.error("Instagram profile fetch error", error);
    return null;
  }
}

/**
 * Fetch Instagram Business account profile via Facebook Pages.
 * This is the primary path for business/creator accounts.
 */
async function getProfileViaBusinessAccount(
  accessToken: string,
): Promise<InstagramProfile | null> {
  // Get all pages the user manages
  const pagesRes = await fetch(
    `${FB_GRAPH_V}/me/accounts?fields=id,instagram_business_account&access_token=${accessToken}`,
  );
  const pagesData = await pagesRes.json() as {
    data?: Array<{
      id: string;
      instagram_business_account?: { id: string };
    }>;
    error?: { message: string };
  };

  if (pagesData.error || !pagesData.data?.length) return null;

  // Find first page with a linked Instagram Business account
  const igAccountId = pagesData.data
    .map(p => p.instagram_business_account?.id)
    .find(Boolean);

  if (!igAccountId) return null;

  // Fetch the Instagram Business account details
  const igFields = "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website,is_verified";
  const igRes = await fetch(
    `${FB_GRAPH_V}/${igAccountId}?fields=${igFields}&access_token=${accessToken}`,
  );
  const igData = await igRes.json() as {
    id?: string;
    username?: string;
    name?: string;
    biography?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
    profile_picture_url?: string;
    website?: string;
    is_verified?: boolean;
    error?: { message: string };
  };

  if (igData.error || !igData.id) {
    if (igData.error) {
      logger.error("Instagram Business account fetch error", { message: igData.error.message });
    }
    return null;
  }

  return {
    id:             igData.id,
    username:       igData.username       || "",
    name:           igData.name           || igData.username || "",
    biography:      igData.biography      || "",
    followersCount: igData.followers_count  ?? 0,
    followingCount: igData.follows_count    ?? 0,
    mediaCount:     igData.media_count      ?? 0,
    profilePicture: igData.profile_picture_url || "",
    isVerified:     igData.is_verified      ?? false,
    ...(igData.website !== undefined ? { website: igData.website } : {}),
  };
}

/**
 * Fallback: Fetch profile via direct Instagram Login (Creator / Personal accounts).
 * Uses the /me endpoint with instagram_business_basic scope fields.
 */
async function getProfileViaDirectLogin(
  accessToken: string,
): Promise<InstagramProfile | null> {
  const fields = "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website";
  const res = await fetch(
    `${FB_GRAPH_V}/me?fields=${fields}&access_token=${accessToken}`,
  );
  const data = await res.json() as {
    id?: string;
    username?: string;
    name?: string;
    biography?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
    profile_picture_url?: string;
    website?: string;
    error?: { message: string };
  };

  if (data.error || !data.id) {
    if (data.error) {
      logger.error("Instagram direct login profile fetch error", { message: data.error.message });
    }
    return null;
  }

  return {
    id:             data.id,
    username:       data.username           || "",
    name:           data.name               || data.username || "",
    biography:      data.biography          || "",
    followersCount: data.followers_count    ?? 0,
    followingCount: data.follows_count      ?? 0,
    mediaCount:     data.media_count        ?? 0,
    profilePicture: data.profile_picture_url || "",
    isVerified:     false, // not exposed via this path
    ...(data.website !== undefined ? { website: data.website } : {}),
  };
}

// ─── Media / Posts ─────────────────────────────────────────────────────────────

/**
 * Fetch recent media posts for an Instagram Business account.
 * Uses /ig_user_id/media endpoint (Business Graph API).
 */
async function getRecentPosts(
  accessToken: string,
  igUserId: string,
  limit: number = 10,
): Promise<InstagramPost[]> {
  const allPosts: InstagramPost[] = [];
  const fields = "id,media_type,media_url,permalink,caption,timestamp,like_count,comments_count,is_paid_partnership";
  let nextUrl: string | null =
    `${FB_GRAPH_V}/${igUserId}/media?fields=${fields}&limit=${Math.min(limit, 50)}&access_token=${accessToken}`;

  try {
    while (nextUrl && allPosts.length < limit) {
      const res = await fetch(nextUrl);
      if (!res.ok) {
        logger.error("Instagram API HTTP error during getRecentPosts", { status: res.status });
        break;
      }
      const data = await res.json() as {
        error?: { message: string };
        data?: Array<Record<string, unknown>>;
        paging?: { next?: string };
      };

      if (data.error || !data.data) {
        if (data.error) {
          logger.error("Instagram media fetch error", { message: data.error.message });
        }
        break;
      }

      allPosts.push(...data.data.map((post) => ({
        id:               post.id as string,
        mediaType:        post.media_type as InstagramPost["mediaType"],
        mediaUrl:         (post.media_url as string)  || "",
        permalink:        (post.permalink as string)   || "",
        caption:          (post.caption as string)     || "",
        timestamp:        post.timestamp as string,
        likeCount:        (post.like_count as number)        || 0,
        commentsCount:    (post.comments_count as number)    || 0,
        isLive:           true,
        isPaidPartnership:(post.is_paid_partnership as boolean) || false,
      })));

      nextUrl = data.paging?.next || null;
    }

    return allPosts.slice(0, limit);
  } catch (error) {
    logger.error("Instagram posts fetch error", error);
    return allPosts;
  }
}

// ─── Post URL Lookup ────────────────────────────────────────────────────────────

export type InstagramPostFetchResult =
  | { status: "FOUND"; post: InstagramPost }
  | { status: "NOT_FOUND" }
  | { status: "API_ERROR"; error: string };

/**
 * Find a specific post by URL among a user's recent media.
 * `igUserId` is the Instagram Business Account ID (not Facebook user ID).
 */
export async function findPostByUrlDetailed(
  accessToken: string,
  postUrl: string,
  igUserId?: string,
): Promise<InstagramPostFetchResult> {
  if (!accessToken) {
    return { status: "API_ERROR", error: "No Instagram access token provided" };
  }

  // If no igUserId provided, resolve from profile first
  let resolvedIgUserId = igUserId;
  if (!resolvedIgUserId) {
    const profile = await getInstagramProfile(accessToken);
    if (!profile) {
      return { status: "API_ERROR", error: "Could not resolve Instagram user ID" };
    }
    resolvedIgUserId = profile.id;
  }

  const fields = "id,media_type,media_url,permalink,caption,timestamp,like_count,comments_count,is_paid_partnership";
  let nextUrl: string | null =
    `${FB_GRAPH_V}/${resolvedIgUserId}/media?fields=${fields}&limit=50&access_token=${accessToken}`;
  const target = cleanUrl(postUrl);
  let checkedCount = 0;

  try {
    while (nextUrl && checkedCount < 150) {
      const res = await fetch(nextUrl);
      if (!res.ok) {
        return { status: "API_ERROR", error: `Instagram API HTTP ${res.status}` };
      }
      const data = await res.json() as {
        error?: { message: string };
        data?: Array<Record<string, unknown>>;
        paging?: { next?: string };
      };

      if (data.error) {
        logger.error("Instagram API error during post search", { message: data.error.message });
        return { status: "API_ERROR", error: data.error.message };
      }

      if (!data.data || data.data.length === 0) break;

      for (const rawPost of data.data) {
        checkedCount++;
        const post: InstagramPost = {
          id:               rawPost.id as string,
          mediaType:        rawPost.media_type as InstagramPost["mediaType"],
          mediaUrl:         (rawPost.media_url as string)  || "",
          permalink:        (rawPost.permalink as string)   || "",
          caption:          (rawPost.caption as string)     || "",
          timestamp:        rawPost.timestamp as string,
          likeCount:        (rawPost.like_count as number)     || 0,
          commentsCount:    (rawPost.comments_count as number) || 0,
          isLive:           true,
          isPaidPartnership:(rawPost.is_paid_partnership as boolean) || false,
        };
        if (cleanUrl(post.permalink) === target) return { status: "FOUND", post };
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

  const posts = await getRecentPosts(accessToken, profile.id, 20);
  if (posts.length === 0) return null;

  const totalLikes    = posts.reduce((s, p) => s + p.likeCount, 0);
  const totalComments = posts.reduce((s, p) => s + p.commentsCount, 0);
  const avgLikes      = Math.round(totalLikes    / posts.length);
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
