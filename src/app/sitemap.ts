import { MetadataRoute } from "next";
import prisma from "@/lib/db";

export const revalidate = 86400; // Cache and revalidate daily
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rawBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vyaparmedia.vercel.app";
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/blog?post=tds-compliance-194o`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog?post=gst-invoicing-creators`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog?post=fake-engagement-audit`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/refund`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/cookie-policy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/legal`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/status`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  let creatorRoutes: MetadataRoute.Sitemap = [];
  let brandRoutes: MetadataRoute.Sitemap = [];

  try {
    const [creators, brands] = await Promise.all([
      prisma.influencerProfile.findMany({
        where: {
          instagramHandle: { not: null },
        },
        select: {
          instagramHandle: true,
          updatedAt: true,
        },
        take: 500,
      }),
      prisma.brandProfile.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          updatedAt: true,
        },
        take: 200,
      }),
    ]);

    creatorRoutes = creators
      .filter((c) => Boolean(c.instagramHandle))
      .map((c) => ({
        url: `${baseUrl}/creator/${encodeURIComponent(c.instagramHandle ?? ''.replace(/^@/, "").toLowerCase())}`,
        lastModified: c.updatedAt || now,
        changeFrequency: "weekly",
        priority: 0.7,
      }));

    brandRoutes = brands.map((b) => ({
      url: `${baseUrl}/brand/${encodeURIComponent(b.id)}`,
      lastModified: b.updatedAt || now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch (_err: unknown) {
    // If DB is offline during build time, gracefully return staticRoutes
    console.warn("[sitemap] DB query failed during build, falling back to static routes");
  }

  return [...staticRoutes, ...creatorRoutes, ...brandRoutes];
}
