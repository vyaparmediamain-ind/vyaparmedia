import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
const baseUrl = process.env.NEXTAUTH_URL || "https://vyaparmedia.in";

return [
{
url: `${baseUrl}`,
lastModified: new Date(),
changeFrequency: "weekly",
priority: 1,
},
{
url: `${baseUrl}/campaigns`,
lastModified: new Date(),
changeFrequency: "hourly",
priority: 0.8,
},
{
url: `${baseUrl}/leaderboard`,
lastModified: new Date(),
changeFrequency: "daily",
priority: 0.7,
},
{
url: `${baseUrl}/about`,
lastModified: new Date(),
changeFrequency: "monthly",
priority: 0.6,
},
{
url: `${baseUrl}/legal`,
lastModified: new Date(),
changeFrequency: "monthly",
priority: 0.3,
},
{
url: `${baseUrl}/privacy`,
lastModified: new Date(),
changeFrequency: "monthly",
priority: 0.3,
},
{
url: `${baseUrl}/terms`,
lastModified: new Date(),
changeFrequency: "monthly",
priority: 0.3,
},
{
url: `${baseUrl}/refund`,
lastModified: new Date(),
changeFrequency: "monthly",
priority: 0.3,
},
{
url: `${baseUrl}/cookie-policy`,
lastModified: new Date(),
changeFrequency: "monthly",
priority: 0.3,
},
];
}
