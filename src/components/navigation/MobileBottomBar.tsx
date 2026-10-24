"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  getNavigationItems,
  getCreateActionConfig,
  NavItemConfig,
} from "@/config/navigation";
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
} from "lucide-react";

interface MobileBottomBarProps {
  userType?: string | null | undefined;
  unreadCount?: number;
  activeDealsCount?: number;
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

export default function MobileBottomBar({
  userType,
  unreadCount = 0,
  activeDealsCount = 0,
}: Readonly<MobileBottomBarProps>) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const navItems = getNavigationItems(userType);
  const createAction = getCreateActionConfig(userType);

  const isActive = (item: NavItemConfig) => {
    if (item.href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(item.href);
  };

  return (
    <>


      {/* Bottom Tab Bar Container */}
      <nav
        role="navigation"
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-30 min-h-16 h-[calc(4rem+env(safe-area-inset-bottom,0px))] bg-card/95 backdrop-blur-md border-t border-border flex md:hidden items-start justify-around px-2 pt-1.5 pb-[env(safe-area-inset-bottom,0px)] pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))]"
      >
        <div className="w-full max-w-lg mx-auto flex items-center justify-between" role="tablist">
          {navItems.map((item) => {
            const active = isActive(item);

            // Badge computation
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
                className="relative flex flex-col items-center justify-center flex-1 py-1 px-1.5 text-center min-w-[56px] min-h-[48px] touch-target-44 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg transition-colors group"
              >
                {/* Active Tab Sliding Pill Indicator (Framer Motion) */}
                {active && (
                  <motion.div
                    layoutId="activeTabMobile"
                    className="absolute -top-1 w-8 h-1 bg-primary rounded-full"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : {
                            type: "spring",
                            stiffness: 500,
                            damping: 35,
                          }
                    }
                    aria-hidden="true"
                  />
                )}

                {/* Icon Container with Badge */}
                <div className="relative flex items-center justify-center w-6 h-6 my-0.5">
                  {renderNavIcon(
                    item.icon,
                    `w-5 h-5 transition-transform group-active:scale-90 ${
                      active ? "text-primary stroke-[2.25]" : "text-muted-foreground group-hover:text-foreground stroke-[1.75]"
                    }`
                  )}

                  {/* Notification Badge */}
                  {badge > 0 && (
                    <span
                      className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tabular-nums flex items-center justify-center border border-card shadow-sm"
                      aria-label={`${badge} unread items`}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>

                {/* Tab Label */}
                <span
                  className={`text-[10px] tracking-tight transition-colors ${
                    active ? "font-semibold text-primary" : "font-medium text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
