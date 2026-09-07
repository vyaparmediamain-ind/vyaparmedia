"use client";

import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import EmptyState from "@/components/ui/EmptyState";
import Logo from "../Logo";
import PWAInstallButton from "@/components/pwa/PWAInstallButton";
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { createPortal } from "react-dom";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { isAdmin as rbacIsAdmin, isBrand, isInfluencer } from "@/lib/rbac";
import { logger } from "@/lib/logger-client";
import { Button } from "@/components/ui/Button";



type AppIconName =
| "analytics"
| "badge"
| "bell"
| "campaigns"
| "chat"
| "deals"
| "disputes"
| "home"
| "leaderboard"
| "menu"
| "plus"
| "referrals"
| "search"
| "settings"
| "wallet";

interface Notification {
id: string;
type: string;
title: string;
message: string;
isRead: boolean;
createdAt: string;
data?: Record<string, unknown>;
}

function AppIcon({
name,
size = 20,
}: Readonly<{
name: AppIconName;
size?: number;
}>) {
const common = {
width: size,
height: size,
viewBox: "0 0 24 24",
fill: "none",
stroke: "currentColor",
strokeWidth: 2,
strokeLinecap: "round" as const,
strokeLinejoin: "round" as const,
"aria-hidden": true,
};

switch (name) {
case "analytics":
return (
<svg {...common}>
<path d="M4 19V9" />
<path d="M10 19V5" />
<path d="M16 19v-7" />
<path d="M22 19H2" />
</svg>
);
case "badge":
return (
<svg {...common}>
<path d="m12 3 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4 7.2 18l.9-5.4-3.9-3.8 5.4-.8L12 3Z" />
</svg>
);
case "bell":
return (
<svg {...common}>
<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
<path d="M10 21h4" />
</svg>
);
case "campaigns":
return (
<svg {...common}>
<path d="M4 6h16" />
<path d="M4 12h10" />
<path d="M4 18h7" />
<path d="m17 14 3 3-3 3" />
</svg>
);
case "chat":
return (
<svg {...common}>
<path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.4-4.2A8 8 0 1 1 21 12Z" />
</svg>
);
case "deals":
return (
<svg {...common}>
<path d="M8 11 4 15a3 3 0 0 0 4 4l2-2" />
<path d="m14 7 2-2a3 3 0 0 1 4 4l-4 4" />
<path d="m8 16 8-8" />
<path d="m12 12 2 2" />
</svg>
);
case "disputes":
return (
<svg {...common}>
<path d="M12 3 3 7v6c0 5 4 8 9 8s9-3 9-8V7l-9-4Z" />
<path d="M12 8v5" />
<path d="M12 17h.01" />
</svg>
);
case "home":
return (
<svg {...common}>
<path d="m3 11 9-8 9 8" />
<path d="M5 10v10h14V10" />
<path d="M10 20v-6h4v6" />
</svg>
);
case "leaderboard":
return (
<svg {...common}>
<path d="M7 20V9" />
<path d="M12 20V4" />
<path d="M17 20v-7" />
<path d="M4 20h16" />
</svg>
);
case "menu":
return (
<svg {...common}>
<path d="M4 7h16" />
<path d="M4 12h16" />
<path d="M4 17h16" />
</svg>
);
case "plus":
return (
<svg {...common}>
<path d="M12 5v14" />
<path d="M5 12h14" />
</svg>
);
case "referrals":
return (
<svg {...common}>
<path d="M16 11a4 4 0 1 0-8 0" />
<path d="M4 21a8 8 0 0 1 16 0" />
<path d="M19 8h3" />
<path d="M20.5 6.5v3" />
</svg>
);
case "search":
return (
<svg {...common}>
<circle cx="11" cy="11" r="7" />
<path d="m20 20-3.5-3.5" />
</svg>
);
case "settings":
return (
<svg {...common}>
<circle cx="12" cy="8" r="3" />
<path d="M4 21a8 8 0 0 1 16 0" />
<path d="M20 4h2" />
<path d="M21 3v2" />
</svg>
);
case "wallet":
return (
<svg {...common}>
<path d="M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" />
<path d="M16 13h.01" />
</svg>
);
default:
return null;
}
}

function getNavIcon(label: string): AppIconName {
const icons: Record<string, AppIconName> = {
Analytics: "analytics",
Dashboard: "home",
"Create Campaign": "plus",
Campaigns: "campaigns",
"My Campaigns": "campaigns",
"My Applications": "deals",
"Find Influencers": "search",
"My Deals": "deals",
Wallet: "wallet",
Messages: "chat",
Disputes: "disputes",
Leaderboard: "leaderboard",
Badges: "badge",
Referrals: "referrals",
"Support & Feedback": "chat",
Settings: "settings",
"Admin Panel": "settings",
};
return icons[label] || "home";
}

function getPageTitle(pathname: string): string {
const segments = pathname.split("/").filter(Boolean);
const map: Record<string, string> = {
dashboard: "Dashboard",
analytics: "Analytics",
campaigns: "Campaigns",
deals: "My Deals",
applications: "My Applications",
wallet: "Wallet",
messages: "Messages",
disputes: "Disputes",
leaderboard: "Leaderboard",
badges: "Badges",
referrals: "Referrals",
support: "Support & Feedback",
settings: "Settings",
influencers: "Find Influencers",
create: "Create Campaign",
};
// Find the deepest meaningful segment
for (let i = segments.length - 1; i >= 0; i--) {
const seg = segments[i];
// Skip UUID-like segments (deal/campaign IDs)
if (seg && !/^[a-f0-9-]{20,}$/.test(seg) && map[seg]) {
return map[seg];
}
}
return "Dashboard";
}

interface DashboardUser {
id?: string | undefined;
name?: string | null | undefined;
email?: string | null | undefined;
userType?: string | null | undefined;
level?: number | null | undefined;
xp?: number | null | undefined;
trustScore?: number | null | undefined;
image?: string | null | undefined;
}

export default function DashboardShell({
children,
user,
}: Readonly<{
children: React.ReactNode;
user?: DashboardUser | null | undefined;
}>) {
const [sidebarOpen, setSidebarOpen] = useState(true);
const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
const pathname = usePathname();

const { data: notifData, mutate: refreshNotifications } = useSWR<{ notifications?: Notification[]; unreadCount?: number }>(
user?.id ? "/api/notifications?limit=10" : null,
fetcher,
{ refreshInterval: 60000 }
);

const notifications = notifData?.notifications || [];
const unreadCount = notifData?.unreadCount || 0;
const [showNotifications, setShowNotifications] = useState(false);
const notificationRef = useRef<HTMLDivElement>(null);
const notifPortalRef = useRef<HTMLDivElement | null>(null);


// Close mobile sidebar on route change without a visual flash.
useEffect(() => {
const id = requestAnimationFrame(() => setMobileSidebarOpen(false));
return () => cancelAnimationFrame(id);
}, [pathname]);

// Lock body when mobile sidebar is open
useEffect(() => {
if (mobileSidebarOpen) {
document.body.classList.add("overflow-hidden");
} else {
document.body.classList.remove("overflow-hidden");
}
return () => {
document.body.classList.remove("overflow-hidden");
};
}, [mobileSidebarOpen]);

// Close notifications when clicking outside
useEffect(() => {
function handleClickOutside(event: MouseEvent) {
const target = event.target as Node;
const insideBell = notificationRef.current?.contains(target);
const insidePortal = notifPortalRef.current?.contains(target);
if (!insideBell && !insidePortal) {
setShowNotifications(false);
}
}
document.addEventListener("mousedown", handleClickOutside);
return () => {
document.removeEventListener("mousedown", handleClickOutside);
};
}, []);

const markAsRead = useCallback(async (notificationId?: string) => {
try {
const body = notificationId
? { notificationIds: [notificationId] }
: { markAll: true };
await fetch("/api/notifications", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(body),
});

refreshNotifications();
} catch (error) {
logger.error("[dashboard-shell] Failed to mark notifications as read:", error);
}
}, [refreshNotifications]);

const userType = user?.userType;
const isBrandOrIndividual = isBrand(userType);
const isAdmin = rbacIsAdmin(userType);

let subtitleText = `Welcome, ${user?.name || "User"}!`;
if (isBrand(userType)) {
subtitleText = "Brand Dashboard";
} else if (isInfluencer(userType)) {
subtitleText = "Influencer Dashboard";
}

const navItems = useMemo(() => {
return isAdmin
? [
{ icon: "AD", label: "Admin Panel", href: "/admin" },
]
: [
{ icon: "DB", label: "Dashboard", href: "/dashboard" },
// Show Create Campaign only for Brands/Individuals
...(isBrandOrIndividual
? [
{
icon: "CP",
label: "My Campaigns",
href: "/dashboard/campaigns",
},
{
icon: "CP",
label: "Create Campaign",
href: "/dashboard/campaigns/create",
},
]
: []),
// Show Campaigns only for Influencers (Browse)
...(!isBrandOrIndividual
? [
{ icon: "CP", label: "Campaigns", href: "/dashboard/campaigns" },
{ icon: "DL", label: "My Applications", href: "/dashboard/applications" },
]
: [
{
icon: "FI",
label: "Find Influencers",
href: "/dashboard/influencers",
},
]),
{ icon: "DL", label: "My Deals", href: "/dashboard/deals" },
{ icon: "WT", label: "Wallet", href: "/dashboard/wallet" },
{ icon: "MS", label: "Messages", href: "/dashboard/messages" },
{ icon: "DS", label: "Disputes", href: "/dashboard/disputes" },
{ icon: "LB", label: "Leaderboard", href: "/dashboard/leaderboard" },
{ icon: "BG", label: "Badges", href: "/dashboard/badges" },
{ icon: "RF", label: "Referrals", href: "/dashboard/referrals" },
{ icon: "MS", label: "Support & Feedback", href: "/dashboard/support" },
{ icon: "ST", label: "Settings", href: "/dashboard/settings" },
];
}, [isAdmin, isBrandOrIndividual]);
let mobilePrimaryHref = "/dashboard/campaigns";
if (rbacIsAdmin(user?.userType)) {
mobilePrimaryHref = "/admin";
} else if (isBrandOrIndividual) {
mobilePrimaryHref = "/dashboard/campaigns/create";
}

let mobilePrimaryLabel = "Apply";
if (rbacIsAdmin(user?.userType)) {
mobilePrimaryLabel = "Admin";
} else if (isBrandOrIndividual) {
mobilePrimaryLabel = "Create";
}
const mobileNavItems = isAdmin
? [
{ icon: "settings" as const, label: "Admin", href: "/admin", primary: true },
]
: [
  { icon: "home" as const, label: "Home", href: "/dashboard" },
  {
    icon: "campaigns" as const,
    label: "Campaigns",
    href: "/dashboard/campaigns",
  },
{
icon: "plus" as const,
label: mobilePrimaryLabel,
href: mobilePrimaryHref,
primary: true,
},
{ icon: "deals" as const, label: "Deals", href: "/dashboard/deals" },
{ icon: "settings" as const, label: "Profile", href: "/dashboard/settings" },
];
const isActivePath = useCallback((href: string) => {
if (pathname === href) return true;
if (href !== "/dashboard" && pathname.startsWith(`${href}/`)) {
const hasMoreSpecificMatch = navItems.some(
(item) =>
item.href !== href &&
item.href !== "/dashboard" &&
pathname.startsWith(item.href) &&
item.href.length > href.length
);
return !hasMoreSpecificMatch;
}
return false;
}, [pathname, navItems]);

return (
<div className="dashboard-app-shell">
<SidebarComponent
sidebarOpen={sidebarOpen}
setSidebarOpen={setSidebarOpen}
mobileSidebarOpen={mobileSidebarOpen}
setMobileSidebarOpen={setMobileSidebarOpen}
user={user}
navItems={navItems}
isActivePath={isActivePath}
isAdmin={isAdmin}
/>

{/* Main Content */}
<main className={`dashboard-main ${!sidebarOpen ? "collapsed" : ""}`}>
<TopbarComponent
user={user}
isAdmin={isAdmin}
pathname={pathname}
subtitleText={subtitleText}
showNotifications={showNotifications}
setShowNotifications={setShowNotifications}
unreadCount={unreadCount}
notifications={notifications}
notificationRef={notificationRef}
notifPortalRef={notifPortalRef}
markAsRead={markAsRead}
setMobileSidebarOpen={setMobileSidebarOpen}
/>

{/* Dashboard Page Content */}
<div className="dashboard-content animate-fade-in">{children}</div>

<MobileTabbarComponent
mobileNavItems={mobileNavItems}
isActivePath={isActivePath}
/>
</main>
</div>
);
}

// ==================== SUBCOMPONENTS ====================

interface SidebarProps {
readonly sidebarOpen: boolean;
readonly setSidebarOpen: (open: boolean) => void;
readonly mobileSidebarOpen: boolean;
readonly setMobileSidebarOpen: (open: boolean) => void;
readonly user?: DashboardUser | null | undefined;
readonly navItems: Array<{ icon: string; label: string; href: string }>;
readonly isActivePath: (href: string) => boolean;
readonly isAdmin: boolean;
}

const SidebarComponent = memo(function SidebarComponent({
sidebarOpen,
setSidebarOpen,
mobileSidebarOpen,
setMobileSidebarOpen,
user,
navItems,
isActivePath,
isAdmin,
}: SidebarProps) {
const xpBarId = React.useId().replace(/:/g, "");
const xpBarFillClass = `xp-bar-fill-${xpBarId}`;
const xpPercent = Math.min(((user?.xp || 0) % 1000) / 10, 100);
return (
<>
{/* Mobile Sidebar Overlay */}
<div
role="none"
className={`sidebar-overlay ${mobileSidebarOpen ? "active" : ""}`}
onClick={() => setMobileSidebarOpen(false)}
/>

{/* Sidebar */}
<aside
className={`sidebar ${sidebarOpen ? "" : "collapsed"} ${mobileSidebarOpen ? "mobile-open" : ""}`}
>
{/* Logo */}
<div
className={`sidebar-header ${sidebarOpen ? "" : "collapsed"}`}
>
{(sidebarOpen || mobileSidebarOpen) && <Logo />}
<Button
type="button"
variant="ghost"
className="hide-mobile sidebar-collapse-btn"
onClick={() => setSidebarOpen(!sidebarOpen)}
aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
>
{sidebarOpen ? "‹" : "›"}
</Button>
</div>

{/* User Profile (Mobile) */}
<div className="show-mobile sidebar-user-profile">
<div className="avatar overflow-hidden relative" style={{ width: 40, height: 40, minWidth: 40, minHeight: 40 }}>
{user?.image ? (
  <Image src={user.image} alt={user.name || "User"} width={40} height={40} unoptimized className="object-cover rounded-full w-full h-full" />
) : (
  user?.name?.[0] || "U"
)}
</div>
<div>
<div className="text-sm font-semibold">{user?.name || "User"}</div>
<div className="text-xs text-capitalize text-muted">
{user?.userType?.toLowerCase()}
</div>
</div>
</div>

{/* Nav Links */}
<nav className="sidebar-nav">
{navItems.map((item) => {
const isActive = isActivePath(item.href);
return (
<Link
key={item.label}
href={item.href}
className={`sidebar-link ${isActive ? "active" : ""} ${sidebarOpen ? "" : "is-collapsed"}`}
onClick={() => setMobileSidebarOpen(false)}
>
<span className="sidebar-link-icon">
<AppIcon name={getNavIcon(item.label)} size={18} />
</span>
{(sidebarOpen || mobileSidebarOpen) && (
<span className="sidebar-link-text">{item.label}</span>
)}
</Link>
);
})}

{/* Logout Button */}
<Button
type="button"
variant="ghost"
onClick={() => signOut({ callbackUrl: "/" })}
className={`sidebar-link sidebar-logout-btn ${sidebarOpen ? "" : "is-collapsed"}`}
>
<span className="sidebar-link-icon">
<svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
<polyline points="16 17 21 12 16 7" />
<line x1="21" y1="12" x2="9" y2="12" />
</svg>
</span>
{(sidebarOpen || mobileSidebarOpen) && (
<span className="sidebar-link-text">Logout</span>
)}
</Button>
</nav>

{/* Level Badge at Bottom */}
{!isAdmin && (sidebarOpen || mobileSidebarOpen) && (
<div className="dashboard-level-card">
<div className="dashboard-level-label">YOUR LEVEL</div>
<div className="text-xl font-extrabold">
<span className="gradient-text">Level {user?.level || 1}</span>
</div>
<div className="xp-bar mt-2 h-6">
<style>{`
.${xpBarFillClass} {
width: ${xpPercent}%;
}
`}</style>
<div className={`xp-bar-fill ${xpBarFillClass}`} />
</div>
<div className="dashboard-level-xp-label">{user?.xp || 0} XP</div>
</div>
)}
</aside>
</>
);
});
SidebarComponent.displayName = "SidebarComponent";

interface TopbarProps {
  readonly user?: DashboardUser | null | undefined;
  readonly isAdmin: boolean;
  readonly pathname: string;
  readonly subtitleText: string;
  readonly showNotifications: boolean;
  readonly setShowNotifications: (show: boolean) => void;
  readonly unreadCount: number;
  readonly notifications: Notification[];
  readonly notificationRef: React.RefObject<HTMLDivElement | null>;
  readonly notifPortalRef: React.RefObject<HTMLDivElement | null>;
  readonly markAsRead: (id?: string) => void;
  readonly setMobileSidebarOpen: (open: boolean) => void;
}

const TopbarComponent = memo(function TopbarComponent({
  user,
  isAdmin,
  pathname,
  subtitleText,
  showNotifications,
  setShowNotifications,
  unreadCount,
  notifications,
  notificationRef,
  notifPortalRef,
  markAsRead,
  setMobileSidebarOpen,
}: TopbarProps) {
return (
<header className="dashboard-topbar glass">
<div className="dashboard-topbar-left">
{/* Mobile hamburger */}
<Button
type="button"
variant="ghost"
className="sidebar-toggle-mobile"
onClick={() => setMobileSidebarOpen(true)}
aria-label="Open sidebar"
>
<AppIcon name="menu" size={22} />
</Button>
<div className="dashboard-mobile-logo" aria-hidden="true">
<Logo tabIndex={-1} />
</div>
<div>
<h1 className="dashboard-topbar-title">
{getPageTitle(pathname)}
</h1>
<p className="dashboard-topbar-subtitle hide-mobile">
{subtitleText}
</p>
</div>
</div>

<div className="dashboard-topbar-right">
{!isAdmin && <PWAInstallButton className="dashboard-icon-button" />}
{isInfluencer(user?.userType) && (
<div className="dashboard-trust-chip">
<span>Trust</span>
<strong>{Number(user?.trustScore || 600)}</strong>
</div>
)}
{/* Notifications */}
<div className="position-relative" ref={notificationRef}>
<Button
type="button"
variant="ghost"
onClick={() => setShowNotifications(!showNotifications)}
className="dashboard-icon-button"
aria-label="Notifications"
>
<AppIcon name="bell" size={19} />
{unreadCount > 0 && (
<span
className="notif-badge"
aria-label={`${unreadCount} unread notifications`}
>
{unreadCount > 9 ? "9+" : unreadCount}
</span>
)}
</Button>

{/* Notifications Dropdown rendered via portal to escape stacking context */}
{showNotifications && typeof document !== "undefined" && createPortal(
<div
ref={notifPortalRef}
className="notif-dropdown-portal animate-fade-in"
>
<div className="notif-dropdown-header">
<h3>Notifications</h3>
{unreadCount > 0 && (
<Button
type="button"
variant="ghost"
className="notif-mark-read-btn"
onClick={(e) => { e.stopPropagation(); markAsRead(); }}
>
Mark all as read
</Button>
)}
</div>
<div className="flex flex-col">
{notifications.length === 0 ? (
<EmptyState emoji="" title="You're all caught up" description="No new notifications." compact />
) : (
(notifications ?? []).map((notif) => (
<Button
key={notif.id}
onClick={() => !notif.isRead && markAsRead(notif.id)}
type="button"
variant="ghost"
className={`notif-item ${notif.isRead ? "" : "unread"}`}
>
<div className="notif-item-title">{notif.title}</div>
<div className="notif-item-message">{notif.message}</div>
<div className="notif-item-date">
{new Date(notif.createdAt).toLocaleDateString()}
</div>
</Button>
))
)}
</div>
</div>,
document.body
)}
</div>

{/* Profile, desktop only */}
<div className="hide-mobile topbar-profile-pill">
<div className="avatar text-sm overflow-hidden relative" style={{ width: 32, height: 32, minWidth: 32, minHeight: 32 }}>
{user?.image ? (
  <Image src={user.image} alt={user.name || "User"} width={32} height={32} unoptimized className="object-cover rounded-full w-full h-full" />
) : (
  user?.name?.[0] || "U"
)}
</div>
<div>
<div className="topbar-profile-name">{user?.name}</div>
<div className="topbar-profile-role">{user?.userType?.toLowerCase()}</div>
</div>
</div>
</div>
</header>
);
});
TopbarComponent.displayName = "TopbarComponent";

interface MobileTabbarProps {
readonly mobileNavItems: Array<{ icon: string; label: string; href: string; primary?: boolean }>;
readonly isActivePath: (href: string) => boolean;
}

const MobileTabbarComponent = memo(function MobileTabbarComponent({ mobileNavItems, isActivePath }: MobileTabbarProps) {
return (
<nav className="dashboard-mobile-tabbar" aria-label="Primary mobile navigation">
{mobileNavItems.map((item) => {
const active = isActivePath(item.href);
return (
<Link
key={item.label}
href={item.href}
className={`dashboard-mobile-tab ${active ? "is-active" : ""} ${item.primary ? "is-primary" : ""}`}
aria-current={active ? "page" : undefined}
>
<span className="dashboard-mobile-tab-icon">
<AppIcon name={item.icon as AppIconName} size={item.primary ? 24 : 20} />
</span>
<span>{item.label}</span>
</Link>
);
})}
</nav>
);
});
MobileTabbarComponent.displayName = "MobileTabbarComponent";
