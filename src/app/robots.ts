import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
const baseUrl = process.env.NEXTAUTH_URL || "https://vyaparmedia.in";

return {
rules: {
userAgent: "*",
allow: "/",
disallow: [
"/api/",
"/admin/",
"/dashboard/",
"/_next/",
"/login",
"/register",
],
},
sitemap: `${baseUrl}/sitemap.xml`,
};
}
