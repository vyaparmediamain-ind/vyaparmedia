"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  getNavigationItems,
  getCreateActionConfig,
  NavItemConfig,
} from "@/config/navigation";
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
  HelpCircle,
  BarChart3,
  FileText,
  X,
  Sparkles,
} from "lucide-react";
import { signOut } from "next-auth/react";
import type { SidebarUser } from "./DesktopSidebar";

interface MobileSidebarProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly userType?: string | null | undefined;
  readonly user?: SidebarUser | null | undefined;
  readonly unreadCount?: number | undefined;
  readonly activeDealsCount?: number | undefined;
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

export default function MobileSidebar({
  isOpen,
  onClose,
  userType,
  user,
  unreadCount = 0,
  activeDealsCount = 0,
}: MobileSidebarProps) {
  const pathname = usePathname();
  const navItems = getNavigationItems(userType);
  const createAction = getCreateActionConfig(userType);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  const isBrand = (userType || "").toUpperCase() === "BRAND";
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Sidebar Navigation">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Slide-out Drawer Panel */}
          <motion.aside
            initial={{ x: shouldReduceMotion ? 0 : "-100%", opacity: shouldReduceMotion ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: shouldReduceMotion ? 0 : "-100%", opacity: shouldReduceMotion ? 0 : 1 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-50 flex flex-col w-72 sm:w-80 max-w-[85vw] h-full bg-card border-r border-border p-4 sm:p-5 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] shadow-2xl overflow-y-auto"
          >
            {/* Header: Brand Logo, Role Badge & Close Button */}
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <Logo href="/dashboard" />
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border bg-muted text-muted-foreground shrink-0 whitespace-nowrap">
                  {isBrand ? "Brand" : "Creator"}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close sidebar navigation"
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Prominent Context-Aware Create CTA */}
            <div className="mb-4">
              <Link
                href={createAction.href}
                onClick={onClose}
                aria-label={createAction.ariaLabel}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-md shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{createAction.label}</span>
              </Link>
            </div>

            {/* Primary Navigation Links */}
            <nav className="flex-1 space-y-1" role="tablist">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2 block mb-1">
                Main Menu
              </span>
              {navItems.map((item: NavItemConfig) => {
                const active = isActive(item.href);

                let badge = 0;
                if (item.badgeKey === "unreadMessages") badge = unreadCount;
                if (item.badgeKey === "activeDeals") badge = activeDealsCount;

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={onClose}
                    role="tab"
                    aria-selected={active}
                    aria-label={item.ariaLabel}
                    className={`relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors focus:outline-none ${
                      active
                        ? "bg-primary/10 text-primary font-bold border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <div className="shrink-0">
                      {renderNavIcon(
                        item.icon,
                        `w-4 h-4 ${active ? "text-primary stroke-[2.25]" : "stroke-[1.75]"}`
                      )}
                    </div>
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge > 0 && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-2xs font-bold tabular-nums flex items-center justify-center">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                );
              })}

              {/* Platform Ecosystem Shortcuts */}
              <div className="pt-3 mt-3 border-t border-border/60 space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2 block mb-1">
                  Workspace & Finance
                </span>

                <Link
                  href="/dashboard/wallet"
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive("/dashboard/wallet")
                      ? "bg-primary/10 text-primary font-bold border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Wallet className="w-4 h-4 stroke-[1.75]" />
                  <span className="flex-1 truncate">Escrow Wallet</span>
                </Link>

                <Link
                  href="/dashboard/leaderboard"
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive("/dashboard/leaderboard")
                      ? "bg-primary/10 text-primary font-bold border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Trophy className="w-4 h-4 stroke-[1.75]" />
                  <span className="flex-1 truncate">Leaderboard</span>
                </Link>

                <Link
                  href="/dashboard/badges"
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive("/dashboard/badges")
                      ? "bg-primary/10 text-primary font-bold border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Award className="w-4 h-4 stroke-[1.75]" />
                  <span className="flex-1 truncate">Badges & Level</span>
                </Link>

                {!isBrand && (
                  <Link
                    href="/dashboard/applications"
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      isActive("/dashboard/applications")
                        ? "bg-primary/10 text-primary font-bold border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <FileText className="w-4 h-4 stroke-[1.75]" />
                    <span className="flex-1 truncate">My Applications</span>
                  </Link>
                )}

                <Link
                  href="/dashboard/analytics"
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive("/dashboard/analytics")
                      ? "bg-primary/10 text-primary font-bold border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <BarChart3 className="w-4 h-4 stroke-[1.75]" />
                  <span className="flex-1 truncate">Analytics & Reports</span>
                </Link>

                <Link
                  href="/dashboard/referrals"
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive("/dashboard/referrals")
                      ? "bg-primary/10 text-primary font-bold border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Share2 className="w-4 h-4 stroke-[1.75]" />
                  <span className="flex-1 truncate">Refer & Earn</span>
                </Link>

                <Link
                  href="/dashboard/support"
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive("/dashboard/support")
                      ? "bg-primary/10 text-primary font-bold border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <HelpCircle className="w-4 h-4 stroke-[1.75]" />
                  <span className="flex-1 truncate">Support & Disputes</span>
                </Link>
              </div>
            </nav>

            {/* User Profile Footer */}
            <div className="pt-4 border-t border-border mt-auto flex items-center justify-between">
              <Link
                href="/dashboard/settings"
                onClick={onClose}
                className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 border border-border flex items-center justify-center shrink-0">
                  {user?.image ? (
                    <Image
                      src={user.image}
                      alt={user.name || "User profile"}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-primary">
                      {(user?.name || "VM").substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate">
                    {user?.name || "My Account"}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span>DRS {user?.trustScore || 600}</span>
                  </div>
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
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
