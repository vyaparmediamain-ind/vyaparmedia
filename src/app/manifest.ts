import type { MetadataRoute } from "next";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

const SHORTCUT_ICONS = [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }];

export default function manifest(): MetadataRoute.Manifest {
return {
id: "/",
name: `${PLATFORM_CONFIG.name} — Trusted Creator Commerce`,
short_name: PLATFORM_CONFIG.name,
description:
`${PLATFORM_CONFIG.name} — Where Brands & Creators Build Trusted Business. Smart escrow contracts, verified metrics, and zero-risk collaborations.`,
start_url: "/dashboard",
scope: "/",
display: "standalone",
display_override: ["standalone", "browser"],
background_color: "#070a13",
theme_color: "#059669",
orientation: "portrait",
lang: "en-IN",
categories: ["business", "productivity", "social"],
shortcuts: [
{
name: "Dashboard",
short_name: "Home",
description: "Open your VyaparMedia workspace",
url: "/dashboard",
icons: SHORTCUT_ICONS,
},
{
name: "Campaigns",
short_name: "Campaigns",
description: "Browse or manage campaigns",
url: "/dashboard/campaigns",
icons: SHORTCUT_ICONS,
},
{
name: "Deals",
short_name: "Deals",
description: "Open active collaboration deals",
url: "/dashboard/deals",
icons: SHORTCUT_ICONS,
},
{
name: "Messages",
short_name: "Messages",
description: "Open collaboration messages",
url: "/dashboard/messages",
icons: SHORTCUT_ICONS,
},
],
icons: [
{
src: "/icon-192.png",
sizes: "192x192",
type: "image/png",
},
{
src: "/icon-512.png",
sizes: "512x512",
type: "image/png",
},
{
src: "/icon-512-maskable.png",
sizes: "512x512",
type: "image/png",
purpose: "maskable",
},
{
src: "/apple-touch-icon.png",
sizes: "180x180",
type: "image/png",
},
],
};
}
