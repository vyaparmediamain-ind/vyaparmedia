"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export interface BackButtonProps {
  readonly fallbackHref?: string | undefined;
  readonly label?: string | undefined;
  readonly className?: string | undefined;
  readonly variant?: "default" | "ghost" | "pill" | "minimal" | "header" | undefined;
  readonly showLabel?: boolean | undefined;
}

export function BackButton({
  fallbackHref,
  label = "Back",
  className = "",
  variant = "default",
  showLabel = true,
}: BackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleBack = () => {
    // If we have history within the app, go back
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else if (fallbackHref) {
      router.push(fallbackHref);
    } else if (pathname.startsWith("/dashboard")) {
      router.push("/dashboard");
    } else if (pathname.startsWith("/admin")) {
      router.push("/admin");
    } else {
      router.push("/");
    }
  };

  const variantStyles = {
    default:
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer shrink-0 whitespace-nowrap",
    ghost:
      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 text-xs font-semibold transition-all active:scale-95 cursor-pointer shrink-0 whitespace-nowrap",
    pill:
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card/80 backdrop-blur-sm hover:bg-muted text-foreground text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer shrink-0 whitespace-nowrap",
    minimal:
      "inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95 cursor-pointer shrink-0",
    header:
      "inline-flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-all shadow-xs active:scale-95 shrink-0 cursor-pointer",
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`${variantStyles[variant]} ${className}`}
      aria-label={`Go back to previous page (${label})`}
      title={label}
    >
      <ArrowLeft className="w-4 h-4 shrink-0" />
      {showLabel && <span className="text-xs font-bold">{label}</span>}
    </button>
  );
}

export default BackButton;
