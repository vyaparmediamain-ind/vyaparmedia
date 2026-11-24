import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const rawBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vyaparmedia.vercel.app";
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/pricing",
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
          "/og-image.png",
          "/icon-192.png",
          "/icon-512.png",
          "/manifest.webmanifest",
        ],
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/_next/",
          "/onboarding/",
          "/reset-password/",
          "/forgot-password/",
        ],
      },
      // Allow AI search engines to index public brand and creator knowledge
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "PerplexityBot",
          "ClaudeBot",
          "anthropic-ai",
          "Google-Extended",
        ],
        allow: [
          "/",
          "/pricing",
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
          "/register",
          "/creator/",
          "/brand/",
        ],
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/_next/",
          "/onboarding/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
