import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const rawBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vyaparmedia.vercel.app";
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");

  const publicAllowedPaths = [
    "/",
    "/pricing",
    "/campaigns",
    "/leaderboard",
    "/blog",
    "/about",
    "/help",
    "/contact",
    "/terms",
    "/privacy",
    "/refund",
    "/cookie-policy",
    "/legal",
    "/status",
    "/login",
    "/register",
    "/creator/",
    "/brand/",
    "/llms.txt",
    "/llms-full.txt",
    "/og-image.png",
    "/icon-192.png",
    "/icon-512.png",
    "/manifest.webmanifest",
  ];

  const privateDisallowedPaths = [
    "/api/",
    "/admin/",
    "/dashboard/",
    "/_next/",
    "/onboarding/",
    "/reset-password/",
    "/forgot-password/",
  ];

  const aiSearchAgents = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "anthropic-ai",
    "Claude-Web",
    "PerplexityBot",
    "Google-Extended",
    "GoogleOther",
    "Applebot",
    "Applebot-Extended",
    "bingbot",
    "Copilot",
    "BingPreview",
    "FacebookBot",
    "Meta-ExternalAgent",
    "Meta-ExternalFetcher",
    "cohere-ai",
    "Diffbot",
    "Bytespider",
    "DuckDuckBot",
    "YouBot",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: publicAllowedPaths,
        disallow: privateDisallowedPaths,
      },
      // Explicitly allow & optimize for all leading AI reasoning engines & search bots
      {
        userAgent: aiSearchAgents,
        allow: publicAllowedPaths,
        disallow: privateDisallowedPaths,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
