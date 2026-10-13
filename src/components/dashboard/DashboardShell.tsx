"use client";

import Image from "next/image";
import Logo from "../Logo";
import PWAInstallButton from "@/components/pwa/PWAInstallButton";
import React, { useState, useEffect, memo } from "react";
import { usePathname } from "next/navigation";
import { isAdmin as rbacIsAdmin, isBrand, isInfluencer } from "@/lib/rbac";
import { Button } from "@/components/ui/Button";
import MobileSidebar from "@/components/navigation/MobileSidebar";
import DesktopSidebar from "@/components/navigation/DesktopSidebar";
import MobileBottomBar from "@/components/navigation/MobileBottomBar";
import EscrowStoriesBar from "@/components/navigation/EscrowStoriesBar";
import RoleGuard from "@/components/navigation/RoleGuard";
import { useNotificationCenter } from "@/hooks/useNotificationCenter";
import ActivityFeedDrawer from "@/components/notifications/ActivityFeedDrawer";
import NotificationToastBanner from "@/components/notifications/NotificationToastBanner";
import { BackButton } from "@/components/ui/BackButton";

type TopbarIconName = "bell" | "menu";

function AppIcon({
  name,
  size = 20,
}: Readonly<{
  name: TopbarIconName;
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
    case "bell":
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
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
    default:
      return null;
  }
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  const {
    notifications,
    unreadCount,
    activeToast,
    dismissToast,
    markAsRead,
    markAllAsRead,
  } = useNotificationCenter(user?.id);

  const [showNotifications, setShowNotifications] = useState(false);

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

  const userType = user?.userType;
  const isAdmin = rbacIsAdmin(userType);

  let subtitleText = `Welcome, ${user?.name || "User"}!`;
  if (isBrand(userType)) {
    subtitleText = "Brand Dashboard";
  } else if (isInfluencer(userType)) {
    subtitleText = "Influencer Dashboard";
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Desktop Left Sidebar */}
      <DesktopSidebar
        userType={user?.userType}
        user={user}
        unreadCount={unreadCount}
      />

      {/* Slide-over Navigation Drawer (Mobile & Tablet) */}
      <MobileSidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        user={user}
        userType={user?.userType}
        unreadCount={unreadCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-24 md:pb-8">
        <TopbarComponent
          user={user}
          isAdmin={isAdmin}
          pathname={pathname}
          subtitleText={subtitleText}
          showNotifications={showNotifications}
          setShowNotifications={setShowNotifications}
          unreadCount={unreadCount}
          setMobileSidebarOpen={setMobileSidebarOpen}
        />

        {/* Activity Feed Drawer */}
        <ActivityFeedDrawer
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
        />

        {/* Non-intrusive Foreground In-App Toast */}
        <NotificationToastBanner
          toast={activeToast}
          onDismiss={dismissToast}
          onMarkAsRead={markAsRead}
        />

        {/* Escrow Status Stories Bar (Active on Home View) */}
        {pathname === "/dashboard" && (
          <EscrowStoriesBar userType={user?.userType} />
        )}

        {/* Dashboard Page Content with Client-side Role Guard */}
        <main className="flex-1 w-full pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:pb-6 animate-fade-in">
          <RoleGuard userType={user?.userType}>
            {children}
          </RoleGuard>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <MobileBottomBar
        userType={user?.userType}
        unreadCount={unreadCount}
      />
    </div>
  );
}

interface TopbarProps {
  readonly user?: DashboardUser | null | undefined;
  readonly isAdmin: boolean;
  readonly pathname: string;
  readonly subtitleText: string;
  readonly showNotifications: boolean;
  readonly setShowNotifications: (show: boolean) => void;
  readonly unreadCount: number;
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
  setMobileSidebarOpen,
}: TopbarProps) {
  return (
    <header className="dashboard-topbar glass">
      <div className="dashboard-topbar-left">
        {/* Sidebar / Menu Navigation Trigger Button */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border text-foreground hover:bg-muted active:scale-95 transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-primary mr-1 shrink-0"
          aria-label="Open sidebar navigation menu"
          title="Open Menu / Sidebar"
        >
          <AppIcon name="menu" size={20} />
        </button>

        {/* Global Back Navigation Button */}
        {pathname !== "/dashboard" && (
          <BackButton
            variant="header"
            showLabel={false}
            fallbackHref="/dashboard"
            className="mr-1.5"
            label="Back"
          />
        )}
        <div className="dashboard-mobile-logo md:hidden" aria-hidden="true">
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
        {/* Notifications Bell */}
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowNotifications(!showNotifications)}
            className="dashboard-icon-button relative !overflow-visible"
            aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
          >
            <AppIcon name="bell" size={19} />
            {unreadCount > 0 && (
              <span
                className="notif-badge"
                aria-label={`${unreadCount} unread notifications`}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
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

