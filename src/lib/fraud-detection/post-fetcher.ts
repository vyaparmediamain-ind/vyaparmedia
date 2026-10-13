import prisma from "../db";
import { logger } from "../logger";
import { decrypt } from "../encryption";
import { checkIsInstagramPostPublic, findPostByUrlDetailed } from "../instagram";
import { extractVideoId, getFreshYouTubeAccessToken, getYouTubeVideoDetailed } from "../youtube";
import { VerifiedPostData } from "./types";

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
  if (!userId) {
    return { status: "CHECK_FAILED", reason: "User ID not provided for Instagram verification" };
  }

  try {
    const oauth = await prisma.oAuthAccount.findFirst({
      where: { userId, provider: "instagram" },
      select: { accessToken: true },
    });
    const decryptedAccessToken = oauth?.accessToken ? decrypt(oauth.accessToken) : null;
    if (!decryptedAccessToken) {
      return {
        status: "CHECK_FAILED",
        reason: "No connected Instagram OAuth account or access token found",
      };
    }

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

    return {
      status: "CHECK_FAILED",
      reason: igPostResult.error,
    };
  } catch (apiError) {
    logger.warn("Instagram official verification failed", {
      error: apiError instanceof Error ? apiError.message : String(apiError),
    });
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

    return {
      status: "CHECK_FAILED",
      reason: ytResult.error,
    };
  } catch (apiError) {
    logger.warn("YouTube official verification failed", {
      error: apiError instanceof Error ? apiError.message : String(apiError),
    });
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
