import { AppError } from "@/lib/errors";
/**
* Instagram Graph API Integration
* Fetches profile data, post metrics, and verifies post existence.
* Add INSTAGRAM_ACCESS_TOKEN or use OAuth flow to activate.
*
* Docs: https://developers.facebook.com/docs/instagram-api
*/

import { logger } from "./logger";
import { cleanUrl } from "./utils";

const GRAPH_API_BASE = "https://graph.instagram.com";
const GRAPH_API_VERSION = "v18.0";

// ==================== TYPES ====================

interface InstagramProfile {
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
mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
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

// ==================== OAUTH ====================

/**
* Generate Instagram OAuth URL for user authorization.
*/
export function getInstagramOAuthUrl(
redirectUri: string,
state: string,
): string {
const isHex = /^[0-9a-fA-F]+$/.test(state);
if (!isHex || state.length < 32) {
throw AppError.badRequest("Invalid state parameter: Must be a cryptographically secure hex string of at least 32 characters.");
}

const baseUrl = "https://api.instagram.com/oauth/authorize";
const params = new URLSearchParams({
client_id: process.env.INSTAGRAM_APP_ID || "",
redirect_uri: redirectUri,
scope: "user_profile,user_media",
response_type: "code",
state,
});

return `${baseUrl}?${params.toString()}`;
}

/**
* Exchange auth code for access token.
*/
export async function exchangeInstagramCode(
code: string,
redirectUri: string,
): Promise<{
accessToken: string;
userId: string;
} | null> {
const appId = process.env.INSTAGRAM_APP_ID || "";
const appSecret = process.env.INSTAGRAM_APP_SECRET || "";

if (!appId || !appSecret) {
logger.warn("Instagram app credentials not configured");
return null;
}

try {
const res = await fetch("https://api.instagram.com/oauth/access_token", {
method: "POST",
headers: { "Content-Type": "application/x-www-form-urlencoded" },
body: new URLSearchParams({
client_id: appId,
client_secret: appSecret,
grant_type: "authorization_code",
redirect_uri: redirectUri,
code,
}),
});

if (!res.ok) {
logger.error("Instagram token exchange HTTP error", { status: res.status });
return null;
}
const data = await res.json();

if (data.access_token) {
// Exchange for long-lived token
const longLived = await getLongLivedToken(data.access_token);
return {
accessToken: longLived || data.access_token,
userId: data.user_id.toString(),
};
}

// Sanitize error response: Remove tokens if present
const cleanData = { ...data };
delete cleanData.access_token;
delete cleanData.client_secret;

logger.error("Instagram token exchange failed", { response: cleanData });
return null;
} catch (error) {
logger.error("Instagram OAuth error", {
message: error instanceof Error ? error.message : "Request failed"
});
return null;
}
}

async function getLongLivedToken(shortToken: string): Promise<string | null> {
try {
const appSecret = process.env.INSTAGRAM_APP_SECRET || "";
const res = await fetch(`${GRAPH_API_BASE}/access_token`, {
method: "POST",
headers: { "Content-Type": "application/x-www-form-urlencoded" },
body: new URLSearchParams({
grant_type: "ig_exchange_token",
client_secret: appSecret,
access_token: shortToken,
}),
});
const data = await res.json();
return data.access_token || null;
} catch {
return null;
}
}

// ==================== PROFILE DATA ====================

/**
* Fetch Instagram profile data using access token.
*/
export async function getInstagramProfile(
accessToken: string,
): Promise<InstagramProfile | null> {
if (!accessToken) {
logger.warn("No Instagram access token provided");
return null;
}

try {
const fields =
"id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,is_verified,website";
const res = await fetch(
`${GRAPH_API_BASE}/${GRAPH_API_VERSION}/me?fields=${fields}&access_token=${accessToken}`,
);

const data = await res.json();

if (data.error) {
logger.error("Instagram API error", { message: data.error.message });
return null;
}

return {
id: data.id,
username: data.username,
name: data.name || data.username,
biography: data.biography || "",
followersCount: data.followers_count || 0,
followingCount: data.follows_count || 0,
mediaCount: data.media_count || 0,
profilePicture: data.profile_picture_url || "",
isVerified: data.is_verified || false,
website: data.website,
};
} catch (error) {
logger.error("Instagram profile fetch error", error);
return null;
}
}

// ==================== POST VERIFICATION ====================

/**
* Fetch recent media (posts) for verification.
*/
async function getRecentPosts(
accessToken: string,
limit: number = 10,
): Promise<InstagramPost[]> {
if (!accessToken) return [];

const allPosts: InstagramPost[] = [];
const fields =
"id,media_type,media_url,permalink,caption,timestamp,like_count,comments_count,is_paid_partnership";
let nextUrl: string | null = `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/me/media?fields=${fields}&limit=${Math.min(limit, 50)}&access_token=${accessToken}`;

try {
while (nextUrl && allPosts.length < limit) {
const res: Response = await fetch(nextUrl);
if (!res.ok) {
logger.error("Instagram API HTTP error during getRecentPosts pagination", { status: res.status });
break;
}
const data = await res.json() as {
error?: { message: string };
data?: Array<Record<string, unknown>>;
paging?: { next?: string };
};

if (data.error || !data.data) {
if (data.error) {
logger.error("Instagram API error during getRecentPosts pagination", { message: data.error.message });
}
break;
}

const pagePosts = data.data.map((post: Record<string, unknown>) => ({
id: post.id as string,
mediaType: post.media_type as "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM",
mediaUrl: (post.media_url as string) || "",
permalink: (post.permalink as string) || "",
caption: (post.caption as string) || "",
timestamp: post.timestamp as string,
likeCount: (post.like_count as number) || 0,
commentsCount: (post.comments_count as number) || 0,
isLive: true,
isPaidPartnership: (post.is_paid_partnership as boolean) || false,
}));

allPosts.push(...pagePosts);
nextUrl = data.paging?.next || null;
}

return allPosts.slice(0, limit);
} catch (error) {
logger.error("Instagram posts fetch error", error);
return allPosts;
}
}

export type InstagramPostFetchResult =
  | { status: "FOUND"; post: InstagramPost }
  | { status: "NOT_FOUND" }
  | { status: "API_ERROR"; error: string };

/**
* Find a specific post with distinction between found, confirmed absent, and API/network failure.
*/
export async function findPostByUrlDetailed(
  accessToken: string,
  postUrl: string,
): Promise<InstagramPostFetchResult> {
  if (!accessToken) {
    return { status: "API_ERROR", error: "No Instagram access token provided" };
  }

  const fields =
    "id,media_type,media_url,permalink,caption,timestamp,like_count,comments_count,is_paid_partnership";
  let nextUrl: string | null = `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/me/media?fields=${fields}&limit=50&access_token=${accessToken}`;
  const target = cleanUrl(postUrl);
  let checkedCount = 0;

  try {
    while (nextUrl && checkedCount < 150) {
      const res: Response = await fetch(nextUrl);
      if (!res.ok) {
        logger.error("Instagram API HTTP error during post search", { status: res.status });
        return { status: "API_ERROR", error: `Instagram API HTTP ${res.status}` };
      }
      const data = (await res.json()) as {
        error?: { message: string };
        data?: Array<Record<string, unknown>>;
        paging?: { next?: string };
      };

      if (data.error) {
        logger.error("Instagram API error during post search", { message: data.error.message });
        return { status: "API_ERROR", error: data.error.message };
      }

      if (!data.data || data.data.length === 0) {
        break;
      }

      for (const rawPost of data.data) {
        checkedCount++;
        const post: InstagramPost = {
          id: rawPost.id as string,
          mediaType: rawPost.media_type as "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM",
          mediaUrl: (rawPost.media_url as string) || "",
          permalink: (rawPost.permalink as string) || "",
          caption: (rawPost.caption as string) || "",
          timestamp: rawPost.timestamp as string,
          likeCount: (rawPost.like_count as number) || 0,
          commentsCount: (rawPost.comments_count as number) || 0,
          isLive: true,
          isPaidPartnership: (rawPost.is_paid_partnership as boolean) || false,
        };

        if (cleanUrl(post.permalink) === target) {
          return { status: "FOUND", post };
        }
      }

      nextUrl = data.paging?.next || null;
    }

    return { status: "NOT_FOUND" };
  } catch (error) {
    logger.error("Instagram posts fetch error", error);
    return {
      status: "API_ERROR",
      error: error instanceof Error ? error.message : "Network error fetching Instagram posts",
    };
  }
}

/**
* Find a specific post by its permalink among recent posts.
*/
export async function findPostByUrl(
  accessToken: string,
  postUrl: string,
): Promise<InstagramPost | null> {
  const result = await findPostByUrlDetailed(accessToken, postUrl);
  return result.status === "FOUND" ? result.post : null;
}


// ==================== ENGAGEMENT METRICS ====================

/**
* Calculate engagement rate from recent posts.
*/
export async function calculateEngagement(
accessToken: string,
): Promise<InstagramInsights | null> {
const profile = await getInstagramProfile(accessToken);
const posts = await getRecentPosts(accessToken, 20);

if (!profile || posts.length === 0) return null;

const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);
const totalComments = posts.reduce((sum, p) => sum + p.commentsCount, 0);
const avgLikes = Math.round(totalLikes / posts.length);
const avgComments = Math.round(totalComments / posts.length);

// Engagement rate = (avg likes + avg comments) / followers 100
const engagementRate =
profile.followersCount > 0
? ((avgLikes + avgComments) / profile.followersCount) * 100
: 0;

return {
engagementRate: Math.round(engagementRate * 100) / 100,
avgLikes,
avgComments,
reachEstimate: Math.round(
profile.followersCount * (engagementRate / 100) * 3,
),
};
}

/**
* Perform an unauthenticated check on an Instagram permalink to see if it's publicly accessible.
* Returns false if it redirects to the login page (redirect: "manual" returns 302/301/307) or returns 404/403.
*/
export async function checkIsInstagramPostPublic(permalink: string): Promise<boolean> {
  if (!permalink) return false;
  try {
    const parsed = new URL(permalink);
    if (parsed.protocol !== "https:") return false;

    const allowedHosts = new Set(["www.instagram.com", "instagram.com", "instagr.am"]);
    if (!allowedHosts.has(parsed.hostname.toLowerCase())) return false;

    // Ensure path is restricted to valid post permalinks (/p/, /reel/, /tv/)
    if (!/^\/(p|reel|tv)\/[\w-]+/i.test(parsed.pathname)) return false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(parsed.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "manual",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 404 || res.status === 403 || res.status === 302 || res.status === 301 || res.status === 307) {
      return false;
    }
    return true;
  } catch (err) {
    logger.warn("Unauthenticated Instagram public check failed, defaulting to true", { permalink, error: err });
    return true;
  }
}

