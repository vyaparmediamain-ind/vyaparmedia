"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import {
  Sun,
  Moon,
  Monitor,
  LogOut,
  Palette,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button, Modal } from "@/components/ui";
import type { User } from "./ProfileTab";

interface AppearanceTabProps {
  user?: User | null;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
}

export default function AppearanceTab({
  user,
  showToast,
}: Readonly<AppearanceTabProps>) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    if (showToast) {
      const label =
        newTheme === "system"
          ? "System default theme applied"
          : `${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode activated`;
      showToast(label, "success");
    }
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ callbackUrl: "/login" });
    } catch {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
      if (showToast) {
        showToast("Failed to sign out. Please try again.", "error");
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Theme & Appearance Card ── */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border bg-card shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Theme &amp; Display Preferences
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose how VyaparMedia appears on your device
              </p>
            </div>
          </div>

          {mounted && (
            <span className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0 whitespace-nowrap">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="capitalize">{theme || "system"}</span> Active
            </span>
          )}
        </div>

        {/* Theme Selection Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Light Theme */}
          <button
            type="button"
            onClick={() => handleThemeChange("light")}
            className={`group text-left p-4 rounded-xl border transition-all relative flex flex-col justify-between min-h-[140px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              mounted && theme === "light"
                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/40"
                : "border-border bg-card hover:bg-muted/40 hover:border-border/80"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Sun className="w-4 h-4" />
              </div>
              {mounted && theme === "light" && (
                <CheckCircle2 className="w-4 h-4 text-primary" />
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-foreground">Light Mode</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Bright, clean, high-contrast surfaces for daylight environments.
              </p>
            </div>

            {/* Visual Mini Preview Bar */}
            <div className="w-full mt-3 pt-2.5 border-t border-border/50 flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-secondary border border-border" />
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
              <div className="h-1.5 w-6 rounded-full bg-emerald-500 ml-auto" />
            </div>
          </button>

          {/* Dark Theme */}
          <button
            type="button"
            onClick={() => handleThemeChange("dark")}
            className={`group text-left p-4 rounded-xl border transition-all relative flex flex-col justify-between min-h-[140px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              mounted && theme === "dark"
                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/40"
                : "border-border bg-card hover:bg-muted/40 hover:border-border/80"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Moon className="w-4 h-4" />
              </div>
              {mounted && theme === "dark" && (
                <CheckCircle2 className="w-4 h-4 text-primary" />
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-foreground">Dark Mode</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Deep obsidian palette that minimizes glare and saves battery.
              </p>
            </div>

            {/* Visual Mini Preview Bar */}
            <div className="w-full mt-3 pt-2.5 border-t border-border/50 flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-card border border-border" />
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/50" />
              <div className="h-1.5 w-6 rounded-full bg-emerald-400 ml-auto" />
            </div>
          </button>

          {/* System Default */}
          <button
            type="button"
            onClick={() => handleThemeChange("system")}
            className={`group text-left p-4 rounded-xl border transition-all relative flex flex-col justify-between min-h-[140px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              mounted && theme === "system"
                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/40"
                : "border-border bg-card hover:bg-muted/40 hover:border-border/80"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                <Monitor className="w-4 h-4" />
              </div>
              {mounted && theme === "system" && (
                <CheckCircle2 className="w-4 h-4 text-primary" />
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-foreground">System Default</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Synchronizes automatically with your OS light/dark schedule.
              </p>
            </div>

            {/* Visual Mini Preview Bar */}
            <div className="w-full mt-3 pt-2.5 border-t border-border/50 flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-muted to-muted-foreground border border-border" />
              <div className="h-1.5 w-12 rounded-full bg-gradient-to-r from-border to-muted-foreground/40" />
              <div className="h-1.5 w-6 rounded-full bg-sky-500 ml-auto" />
            </div>
          </button>
        </div>
      </div>

      {/* ── Active Session & Sign Out Card ── */}
      <div className="p-5 sm:p-6 rounded-2xl border border-destructive/20 bg-card shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Session &amp; Account Sign Out
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage your active login session and sign out securely
              </p>
            </div>
          </div>

          <span className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-verified-muted text-verified border border-verified-border">
            <span className="w-1.5 h-1.5 rounded-full bg-verified animate-pulse" />
            Authenticated
          </span>
        </div>

        {/* User Account Info Bar */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Currently Signed In As
            </p>
            <p className="text-sm font-bold text-foreground truncate mt-0.5">
              {user?.name || "VyaparMedia Member"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email || "No email linked"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setShowLogoutModal(true)}
              className="text-xs font-semibold"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sign Out
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Signing out will invalidate your active session token and redirect you
          back to the login screen. You will need your credentials or Google account
          to sign back in.
        </p>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => !isLoggingOut && setShowLogoutModal(false)}
        title="Sign Out Confirmation"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-foreground">
                Are you sure you want to sign out?
              </p>
              <p className="text-muted-foreground mt-0.5">
                Any unsaved changes on other draft pages may be lost. You will be redirected to the login page.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isLoggingOut}
              onClick={() => setShowLogoutModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={isLoggingOut}
              onClick={handleConfirmLogout}
            >
              {isLoggingOut ? (
                <span className="loading" />
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5 mr-1.5" />
                  Yes, Sign Out
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
