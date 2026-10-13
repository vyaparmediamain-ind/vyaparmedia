"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  getNavigationItems,
  getCreateActionConfig,
  NavItemConfig,
} from "@/config/navigation";
import { motion, useReducedMotion } from "framer-motion";
import Logo from "../Logo";

import {
  Home,
  Compass,
  Users,
  Briefcase,
  Layers,
  MessageSquare,
  User,
  Shield,
  Plus,
  LogOut,
  Wallet,
  Trophy,
  Award,
  Share2,
  BarChart3,
  HelpCircle,
  FileText,
} from "lucide-react";
import { signOut } from "next-auth/react";

export interface SidebarUser {
  id?: string | null | undefined;
  name?: string | null | undefined;
  email?: string | null | undefined;
  image?: string | null | undefined;
  userType?: string | null | undefined;
  walletBalance?: number | null | undefined;
  level?: number | null | undefined;
  xp?: number | null | undefined;
  trustScore?: number | null | undefined;
}

interface DesktopSidebarProps {
  userType?: string | null | undefined;
  user?: SidebarUser | null | undefined;
  unreadCount?: number | undefined;
  activeDealsCount?: number | undefined;
}

function renderNavIcon(icon: string, className: string) {
  switch (icon) {
    case "home":
      return <Home className={className} />;
    case "discover":
      return <Compass className={className} />;
    case "creators":
      return <Users className={className} />;
    case "deals":
      return <Briefcase className={className} />;
    case "campaigns":
      return <Layers className={className} />;
    case "messages":
      return <MessageSquare className={className} />;
    case "profile":
      return <User className={className} />;
    case "admin":
      return <Shield className={className} />;
    default:
      return <Home className={className} />;
  }
}

export default function DesktopSidebar({
  userType,
  user,
  unreadCount = 0,
  activeDealsCount = 0,
}: Readonly<DesktopSidebarProps>) {
  const shouldReduceMotion = useReducedMotion();
  const pathname = usePathname();
  const navItems = getNavigationItems(userType);
  const createAction = getCreateActionConfig(userType);

  const isActive = (item: NavItemConfig) => {
    if (item.href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(item.href);
  };

  const isBrand = (userType || "").toUpperCase() === "BRAND";

  return (
    <aside
      aria-label="Sidebar Navigation"
      className="hidden md:flex flex-col w-64 shrink-0 h-screen md:h-dvh sticky top-0 bg-card border-r border-border/80 px-4 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] z-20 select-none"
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-3 mb-8">
        <Logo href="/dashboard" />
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border bg-muted text-muted-foreground shrink-0 whitespace-nowrap">
          {isBrand ? "Brand" : "Creator"}
        </span>
      </div>

      {/* Prominent Context-Aware Create CTA */}
      <div className="mb-6 px-1">
        <Link
          href={createAction.href}
          aria-label={createAction.ariaLabel}
          className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>{createAction.label}</span>
        </Link>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 space-y-1.5" role="tablist">
        {navItems.map((item) => {
          const active = isActive(item);

          let badge = 0;
          if (item.badgeKey === "unreadMessages") badge = unreadCount;
          if (item.badgeKey === "activeDeals") badge = activeDealsCount;

          return (
            <Link
              key={item.id}
              href={item.href}
              role="tab"
              aria-selected={active}
              aria-label={item.ariaLabel}
              className={`relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary group ${
                active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {/* Sliding Background Indicator (Framer Motion) */}
              {active && (
                shouldReduceMotion ? (
                  <div
                    className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20"
                    aria-hidden="true"
                  />
                ) : (
                  <motion.div
                    layoutId="activeTabDesktop"
                    className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20"
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 35,
                    }}
                    aria-hidden="true"
                  />
                )
              )}


              {/* Icon */}
              <div className="relative z-1">
                {renderNavIcon(
                  item.icon,
                  `w-5 h-5 transition-transform group-hover:scale-105 ${
                    active ? "text-primary stroke-[2.25]" : "stroke-[1.75]"
                  }`
                )}
              </div>

              {/* Label */}
              <span className="relative z-1 flex-1 tracking-tight">
                {item.label}
              </span>

              {/* Badge */}
              {badge > 0 && (
                <span
                  className="relative z-1 min-w-5 h-5 px-1.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-xs font-bold tabular-nums flex items-center justify-center shadow-sm"
                  aria-label={`${badge} unread items`}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Quick Ecosystem Links */}
        <div className="pt-2 mt-2 border-t border-border/60 space-y-1">
          <Link
            href="/dashboard/wallet"
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Wallet className="w-4 h-4 stroke-[1.75]" />
            <span className="flex-1 tracking-tight">Escrow Wallet</span>
          </Link>

          <Link
            href="/dashboard/leaderboard"
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Trophy className="w-4 h-4 stroke-[1.75]" />
            <span className="flex-1 tracking-tight">Leaderboard</span>
          </Link>

          <Link
            href="/dashboard/badges"
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Award className="w-4 h-4 stroke-[1.75]" />
            <span className="flex-1 tracking-tight">Badges & Level</span>
          </Link>

          {!isBrand && (
            <Link
              href="/dashboard/applications"
              className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <FileText className="w-4 h-4 stroke-[1.75]" />
              <span className="flex-1 tracking-tight">My Applications</span>
            </Link>
          )}

          <Link
            href="/dashboard/analytics"
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <BarChart3 className="w-4 h-4 stroke-[1.75]" />
            <span className="flex-1 tracking-tight">Analytics & Reports</span>
          </Link>

          <Link
            href="/dashboard/referrals"
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Share2 className="w-4 h-4 stroke-[1.75]" />
            <span className="flex-1 tracking-tight">Refer & Earn</span>
          </Link>

          <Link
            href="/dashboard/support"
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <HelpCircle className="w-4 h-4 stroke-[1.75]" />
            <span className="flex-1 tracking-tight">Support & Help</span>
          </Link>
        </div>
      </nav>

      {/* User Profile Footer */}
      <div className="pt-4 border-t border-border/80 flex items-center justify-between px-2">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity focus:outline-none"
        >
          <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border">
            {user?.image ? (
              <Image
                src={user.image}
                alt={user.name || "User profile"}
                width={36}
                height={36}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold text-foreground">
                {(user?.name || "VM").substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">
              {user?.name || "My Account"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {user?.email || "Signed in"}
            </p>
          </div>
        </Link>

        {/* Sign Out Button */}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Sign out"
          aria-label="Sign out"
          className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus:outline-none focus:ring-2 focus:ring-destructive/20 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
