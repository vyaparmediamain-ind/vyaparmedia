import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import Logo from "@/components/Logo";
import { Home, HelpCircle, MessageSquare, Compass, ArrowRight, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "404 - Page Not Found | VyaparMedia",
  description: "The page you are looking for does not exist or has been moved.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground">
      {/* Top Header */}
      <header className="border-b border-border px-6 py-4 bg-card">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Button href="/help" variant="ghost" size="sm" className="text-xs font-bold text-muted-foreground hover:text-foreground">
              Help Center
            </Button>
            <Button href="/login" variant="secondary" size="sm" className="text-xs font-bold">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Main 404 Hero */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center space-y-6">
          {/* Branded 404 Visual Icon */}
          <div className="relative inline-flex items-center justify-center">
            <div className="w-24 h-24 rounded-3xl bg-card border border-border flex flex-col items-center justify-center shadow-lg shadow-primary/5">
              <span className="text-4xl font-black text-primary tracking-tight tabular-nums">
                404
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Page Not Found
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              The page you are searching for might have been moved, renamed, or is temporarily unavailable.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button href="/" variant="primary" className="inline-flex items-center justify-center gap-2 text-xs font-bold shadow-md shadow-primary/20">
              <Home className="w-4 h-4" />
              <span>Go Home</span>
            </Button>
            <Button href="/dashboard/support" variant="secondary" className="inline-flex items-center justify-center gap-2 text-xs font-bold border border-border">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span>Contact Support</span>
            </Button>
            <Button href="/help" variant="ghost" className="inline-flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground">
              <HelpCircle className="w-4 h-4" />
              <span>Browse FAQ</span>
            </Button>
          </div>

          {/* Quick Helpful Discovery Links */}
          <div className="pt-8 border-t border-border space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-primary" />
              <span>Popular Destinations</span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
              <Link
                href="/dashboard"
                className="px-3.5 py-2.5 min-h-[44px] rounded-full bg-muted text-foreground border border-border hover:border-primary/50 transition-colors inline-flex items-center gap-1.5"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              </Link>
              <Link
                href="/dashboard/influencers"
                className="px-3.5 py-2.5 min-h-[44px] rounded-full bg-muted text-foreground border border-border hover:border-primary/50 transition-colors inline-flex items-center gap-1.5"
              >
                <span>Discover Creators</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              </Link>
              <Link
                href="/dashboard/campaigns"
                className="px-3.5 py-2.5 min-h-[44px] rounded-full bg-muted text-foreground border border-border hover:border-primary/50 transition-colors inline-flex items-center gap-1.5"
              >
                <span>Live Campaigns</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              </Link>
              <Link
                href="/help"
                className="px-3.5 py-2.5 min-h-[44px] rounded-full bg-muted text-foreground border border-border hover:border-primary/50 transition-colors inline-flex items-center gap-1.5"
              >
                <span>Escrow Guidelines</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Trust Footer */}
      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between max-w-6xl mx-auto w-full gap-2">
        <div className="flex items-center gap-1.5 text-verified">
          <ShieldCheck className="w-4 h-4" />
          <span className="font-semibold text-foreground">100% Escrow Security Guaranteed</span>
        </div>
        <div>
          &copy; {new Date().getFullYear()} VyaparMedia Technologies Pvt Ltd. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
