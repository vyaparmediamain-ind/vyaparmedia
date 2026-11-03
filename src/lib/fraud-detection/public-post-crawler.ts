import { logger } from "../logger";
import { withCircuitBreaker } from "../circuit-breaker";
import { SOCIAL_API_TIMEOUT_MS } from "@/constants";
import { VerifiedPostData } from "./types";

const PUBLIC_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Public Headless Live Link Crawler (Token-Free Fallback)
 * Fallback crawler that inspects public OpenGraph metadata, JSON-LD schemas,
 * and oEmbed payloads when official Meta Graph API or YouTube Data API tokens
 * are unavailable or expired.
 */
export async function crawlInstagramPublicPost(
  postUrl: string,
): Promise<{ status: "FOUND"; data: VerifiedPostData } | { status: "FAILED"; reason: string }> {
  try {
    const cleanUrl = (postUrl.split("?")[0] ?? "").replace(/\/+$/, "") + "/";

    // Attempt 1: Instagram Public oEmbed endpoint
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(cleanUrl)}`;
    const oembedRes = await withCircuitBreaker("instagram:public_oembed", async () => {
      return await fetch(oembedUrl, {
        headers: { "User-Agent": PUBLIC_USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(SOCIAL_API_TIMEOUT_MS),
      });
    }).catch(() => null);

    if (oembedRes && oembedRes.ok) {
      const oembedData = (await oembedRes.json().catch(() => null)) as {
        title?: string;
        author_name?: string;
      } | null;

      if (oembedData?.title) {
        const caption = oembedData.title;
        const hashtags = [...(caption.match(/#(\w+)/g) || [])].map((h) => h.slice(1));
        const mentions = [...(caption.match(/@(\w+)/g) || [])].map((m) => m.slice(1));
        const isPaidPartnership = /paid partnership|sponsored|#ad\b/i.test(caption);

        return {
          status: "FOUND",
          data: {
            isPublic: true,
            caption,
            isPaidPartnership,
            hashtags,
            mentions,
            postTimestamp: new Date(),
          },
        };
      }
    }

    // Attempt 2: Direct OpenGraph HTML meta tag inspection
    const htmlRes = await withCircuitBreaker("instagram:public_html", async () => {
      return await fetch(cleanUrl, {
        headers: {
          "User-Agent": PUBLIC_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(SOCIAL_API_TIMEOUT_MS),
      });
    }).catch(() => null);

    if (!htmlRes || !htmlRes.ok) {
      return { status: "FAILED", reason: `Public fetch HTTP ${htmlRes?.status || "Network error"}` };
    }

    const html = await htmlRes.text();

    if (html.includes("Sorry, this page isn't available") || html.includes("The link you followed may be broken")) {
      return { status: "FAILED", reason: "Post is private, deleted, or removed on Instagram" };
    }

    // Extract OpenGraph description (<meta property="og:description" content="..." />)
    const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i)
      || html.match(/<meta\s+content=["'](.*?)["']\s+property=["']og:description["']/i);

    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i)
      || html.match(/<meta\s+content=["'](.*?)["']\s+property=["']og:title["']/i);

    const caption = ogDescMatch?.[1] || ogTitleMatch?.[1] || "";

    if (!caption) {
      return { status: "FAILED", reason: "Could not extract public caption from OpenGraph tags" };
    }

    const cleanCaption = caption
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    const hashtags = [...(cleanCaption.match(/#(\w+)/g) || [])].map((h) => h.slice(1));
    const mentions = [...(cleanCaption.match(/@(\w+)/g) || [])].map((m) => m.slice(1));
    const isPaidPartnership = /paid partnership|sponsored|#ad\b/i.test(cleanCaption);

    return {
      status: "FOUND",
      data: {
        isPublic: true,
        caption: cleanCaption,
        isPaidPartnership,
        hashtags,
        mentions,
        postTimestamp: new Date(),
      },
    };
  } catch (error) {
    logger.warn("Public Instagram fallback crawler exception", { postUrl, error });
    return { status: "FAILED", reason: error instanceof Error ? error.message : "Public crawl error" };
  }
}

/**
 * Public YouTube fallback crawler via YouTube oEmbed API
 */
export async function crawlYouTubePublicPost(
  postUrl: string,
): Promise<{ status: "FOUND"; data: VerifiedPostData } | { status: "FAILED"; reason: string }> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(postUrl)}&format=json`;
    const res = await withCircuitBreaker("youtube:public_oembed", async () => {
      return await fetch(oembedUrl, {
        headers: { "User-Agent": PUBLIC_USER_AGENT },
        signal: AbortSignal.timeout(SOCIAL_API_TIMEOUT_MS),
      });
    }).catch(() => null);

    if (!res || !res.ok) {
      return { status: "FAILED", reason: `YouTube public oEmbed failed with status ${res?.status || "error"}` };
    }

    const data = (await res.json()) as { title?: string; author_name?: string };
    const caption = data.title || "";
    const hashtags = [...(caption.match(/#(\w+)/g) || [])].map((h) => h.slice(1));
    const mentions = [...(caption.match(/@(\w+)/g) || [])].map((m) => m.slice(1));

    return {
      status: "FOUND",
      data: {
        isPublic: true,
        caption,
        isPaidPartnership: false,
        hashtags,
        mentions,
        postTimestamp: new Date(),
      },
    };
  } catch (error) {
    logger.warn("Public YouTube fallback crawler exception", { postUrl, error });
    return { status: "FAILED", reason: error instanceof Error ? error.message : "Public crawl error" };
  }
}
