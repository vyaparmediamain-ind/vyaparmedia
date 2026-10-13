"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

export interface ThemeToggleProps {
  variant?: "button" | "segmented";
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ThemeToggle({
  variant = "button",
  className = "",
  showLabel = false,
  size = "md",
}: Readonly<ThemeToggleProps>) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    if (variant === "segmented") {
      return (
        <div
          aria-hidden="true"
          className={`inline-flex items-center p-1 rounded-xl bg-muted/60 border border-border/70 ${className}`}
        >
          <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
          <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
          <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
        </div>
      );
    }

    return (
      <div
        aria-hidden="true"
        className={`w-9 h-9 rounded-xl bg-muted/50 border border-border/60 animate-pulse ${className}`}
      />
    );
  }

  if (variant === "segmented") {
    return (
      <div
        role="group"
        aria-label="Select theme mode"
        className={`inline-flex items-center p-1 rounded-xl bg-muted/70 border border-border/70 text-xs ${className}`}
      >
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            theme === "light"
              ? "bg-card text-foreground font-semibold shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={theme === "light"}
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>Light</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            theme === "dark"
              ? "bg-card text-foreground font-semibold shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={theme === "dark"}
        >
          <Moon className="w-3.5 h-3.5 text-indigo-400" />
          <span>Dark</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme("system")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            theme === "system"
              ? "bg-card text-foreground font-semibold shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={theme === "system"}
        >
          <Monitor className="w-3.5 h-3.5 text-sky-500" />
          <span>System</span>
        </button>
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  const sizeClasses = {
    sm: "w-8 h-8 text-xs p-1.5",
    md: "w-9 h-9 text-sm p-2",
    lg: "w-10 h-10 text-base p-2.5",
  }[size];

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-card hover:bg-muted/80 text-foreground transition-all shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 ${
        showLabel ? "px-3 py-2" : sizeClasses
      } ${className}`}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-500 transition-transform rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-500 transition-transform -rotate-12 hover:rotate-0" />
      )}
      {showLabel && (
        <span className="text-xs font-semibold">
          {isDark ? "Light Mode" : "Dark Mode"}
        </span>
      )}
    </button>
  );
}

export default ThemeToggle;
