"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import Logo from "@/components/Logo";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui";
import { BackButton } from "@/components/ui/BackButton";
import {
  LayoutDashboard,
  BarChart3,
  Wallet,
  ShieldCheck,
  FileText,
  Scale,
  Users,
  Banknote,
  ScrollText,
  Target,
  AlertTriangle,
  ShieldAlert,
  Mail,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

type AdminFrameProps = {
  children: ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
  };
};

const navItems = [
  { icon: LayoutDashboard, label: "Overview",         href: "/admin" },
  { icon: BarChart3,       label: "Analytics",        href: "/admin/analytics" },
  { icon: Wallet,          label: "Financials",       href: "/admin/financial" },
  { icon: ShieldCheck,     label: "Verifications",    href: "/admin/verifications" },
  { icon: FileText,        label: "Applications",     href: "/admin/applications" },
  { icon: Scale,           label: "Disputes",         href: "/admin/disputes" },
  { icon: Users,           label: "Users",            href: "/admin/users" },
  { icon: Banknote,        label: "Payouts",          href: "/admin/payouts" },
  { icon: ScrollText,      label: "Audit Logs",       href: "/admin/audit-logs" },
  { icon: Target,          label: "CPV Benchmarks",   href: "/admin/benchmarks" },
  { icon: AlertTriangle,   label: "Violations",       href: "/admin/violations" },
  { icon: ShieldAlert,     label: "Review Collusion", href: "/admin/suspicious-reviews" },
  { icon: Mail,            label: "Newsletter",       href: "/admin/newsletter" },
] as const;

function getInitials(name?: string | null, email?: string | null) {
  const source = (name || email || "Admin").trim();
  return (
    source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A"
  );
}

export default function AdminFrame({ children, user }: Readonly<AdminFrameProps>) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close admin navigation"
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-card border-r border-border shadow-xl pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pl-[max(0.5rem,env(safe-area-inset-left,0px))] transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-disputed-muted border border-disputed-border text-disputed text-[10px] font-extrabold uppercase tracking-wider">
              Admin
            </span>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={closeSidebar}
            className="lg:hidden p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" aria-label="Admin navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                  aria-hidden="true"
                />
                <span className="flex-1">{item.label}</span>
                {active && (
                  <ChevronRight className="w-3.5 h-3.5 text-primary opacity-60" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer — user card + logout */}
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/30">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-extrabold text-primary shrink-0">
              {getInitials(user.name, user.email)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground truncate">
                {user.name || "Admin"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {user.email || "Admin access"}
              </div>
            </div>
          </div>

          <Button
            onClick={() => signOut({ callbackUrl: "/login" })}
            variant="ghost"
            className="w-full justify-start gap-2 text-sm font-semibold text-muted-foreground hover:text-disputed hover:bg-disputed-muted border border-transparent hover:border-disputed-border"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] bg-card/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open admin navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            {pathname !== "/admin" && (
              <BackButton variant="header" showLabel={false} fallbackHref="/admin" label="Back to Admin" />
            )}
            <div>
              <div className="text-sm font-extrabold text-foreground">
                {pathname === "/admin" ? "Admin Console" : navItems.find((n) => n.href === pathname)?.label || "Admin Console"}
              </div>
              <div className="text-[11px] text-muted-foreground hidden sm:block">Live operations workspace</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-primary hover:underline px-2.5 py-1.5 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <span>User Dashboard &rarr;</span>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto py-4 sm:py-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
