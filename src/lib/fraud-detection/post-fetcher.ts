import { logger } from "../logger";
import {
  checkIsInstagramPostPublic,
  findPostByUrlDetailed,
  getFreshInstagramAccessToken,
} from "../instagram";
import { extractVideoId, getFreshYouTubeAccessToken, getYouTubeVideoDetailed } from "../youtube";
import { VerifiedPostData } from "./types";
import { crawlInstagramPublicPost, crawlYouTubePublicPost } from "./public-post-crawler";

export type PostVerificationFetchResult =
  | { status: "FOUND"; data: VerifiedPostData }
  | { status: "CONFIRMED_DELETED"; reason: string }
  | { status: "CHECK_FAILED"; reason: string };

export async function fetchInstagramPostDataDetailed(
  postUrl: string,
  userId?: string,
): Promise<PostVerificationFetchResult> {
  if (!postUrl.includes("instagram.com")) {
    return { status: "CHECK_FAILED", reason: "URL is not an Instagram link" };
  }

  try {
    let decryptedAccessToken: string | null = null;
    if (userId) {
      decryptedAccessToken = await getFreshInstagramAccessToken(userId);
    }

    // Path A: If user has a valid OAuth access token, use official Meta Graph API
    if (decryptedAccessToken) {
      const igPostResult = await findPostByUrlDetailed(decryptedAccessToken, postUrl);
      if (igPostResult.status === "FOUND") {
        const igPost = igPostResult.post;
        const caption = igPost.caption ?? "";
        return {
          status: "FOUND",
          data: {
            isPublic: await checkIsInstagramPostPublic(igPost.permalink),
            caption,
            isPaidPartnership: igPost.isPaidPartnership ?? false,
            mentions: [...(caption.match(/@(\w+)/g) || [])].map((m) => m.slice(1)),
            hashtags: [...(caption.match(/#(\w+)/g) || [])].map((h) => h.slice(1)),
            postTimestamp: new Date(igPost.timestamp),
            likeCount: igPost.likeCount,
            commentCount: igPost.commentsCount,
          },
        };
      }

      if (igPostResult.status === "NOT_FOUND") {
        return {
          status: "CONFIRMED_DELETED",
          reason: "Instagram post not found in creator's recent media",
        };
      }

      // If Graph API returned a transient error (e.g. rate limit), fall through to public crawler
      logger.warn("Official Instagram API lookup failed, falling back to public crawler", {
        postUrl,
        error: igPostResult.error,
      });
    }

    // Path B: Public Headless Live Link Crawler (Token-Free Fallback)
    const publicResult = await crawlInstagramPublicPost(postUrl);
    if (publicResult.status === "FOUND") {
      return { status: "FOUND", data: publicResult.data };
    }

    return {
      status: "CHECK_FAILED",
      reason: publicResult.reason || "Unable to inspect Instagram post via official API or public crawler",
    };
  } catch (apiError) {
    logger.warn("Instagram verification exception, trying public crawler fallback", {
      error: apiError instanceof Error ? apiError.message : String(apiError),
    });

    const publicResult = await crawlInstagramPublicPost(postUrl);
    if (publicResult.status === "FOUND") {
      return { status: "FOUND", data: publicResult.data };
    }

    return {
      status: "CHECK_FAILED",
      reason: apiError instanceof Error ? apiError.message : String(apiError),
    };
  }
}

export async function fetchInstagramPostData(
  postUrl: string,
  userId?: string,
): Promise<VerifiedPostData | null> {
  const result = await fetchInstagramPostDataDetailed(postUrl, userId);
  return result.status === "FOUND" ? result.data : null;
}

export async function fetchYouTubePostDataDetailed(
  postUrl: string,
  userId?: string,
): Promise<PostVerificationFetchResult> {
  const youtubeId = extractVideoId(postUrl);
  if (!youtubeId) {
    return { status: "CHECK_FAILED", reason: "Invalid YouTube URL" };
  }

  try {
    let accessToken: string | undefined;
    if (userId) {
      accessToken = (await getFreshYouTubeAccessToken(userId)) ?? undefined;
    }

    // Path A: Official YouTube Data API
    const ytResult = await getYouTubeVideoDetailed(youtubeId, accessToken);
    if (ytResult.status === "FOUND") {
      const ytVideo = ytResult.video;
      const isPublic = ytVideo.privacyStatus ? ytVideo.privacyStatus === "public" : true;
      return {
        status: "FOUND",
        data: {
          isPublic,
          isPaidPartnership: false,
          caption: ytVideo.description,
          mentions: [...(ytVideo.description.match(/@([\w.-]+)/g) || [])].map((m) => m.slice(1)),
          hashtags: [...(ytVideo.description.match(/#(\w+)/g) || [])].map((h) => h.slice(1)),
          postTimestamp: new Date(ytVideo.publishedAt),
          likeCount: ytVideo.likeCount,
          commentCount: ytVideo.commentCount,
          viewCount: ytVideo.viewCount,
        },
      };
    }

    if (ytResult.status === "NOT_FOUND") {
      return {
        status: "CONFIRMED_DELETED",
        reason: "YouTube video not found (confirmed gone from YouTube)",
      };
    }

    // Path B: Public YouTube oEmbed Crawler Fallback
    const publicResult = await crawlYouTubePublicPost(postUrl);
    if (publicResult.status === "FOUND") {
      return { status: "FOUND", data: publicResult.data };
    }

    return {
      status: "CHECK_FAILED",
      reason: ytResult.error,
    };
  } catch (apiError) {
    logger.warn("YouTube verification exception, trying public crawler fallback", {
      error: apiError instanceof Error ? apiError.message : String(apiError),
    });

    const publicResult = await crawlYouTubePublicPost(postUrl);
    if (publicResult.status === "FOUND") {
      return { status: "FOUND", data: publicResult.data };
    }

    return {
      status: "CHECK_FAILED",
      reason: apiError instanceof Error ? apiError.message : String(apiError),
    };
  }
}

export async function fetchYouTubePostData(
  postUrl: string,
  userId?: string,
): Promise<VerifiedPostData | null> {
  const result = await fetchYouTubePostDataDetailed(postUrl, userId);
  return result.status === "FOUND" ? result.data : null;
}
