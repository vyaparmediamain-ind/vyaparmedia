"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

export function AppSplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    // Check if splash was already shown in this browser session
    try {
      const alreadyShown =
        (typeof window !== "undefined" && (window as unknown as { __vm_splash_active?: boolean }).__vm_splash_active) ||
        (typeof sessionStorage !== "undefined" && sessionStorage.getItem("__vm_splash_shown") === "1");

      if (!alreadyShown) {
        if (typeof window !== "undefined") {
          (window as unknown as { __vm_splash_active?: boolean }).__vm_splash_active = true;
        }
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("__vm_splash_shown", "1");
        }

        // First time in session: show for a brief 150ms then smoothly fade out in 150ms
        setVisible(true);
        timer = setTimeout(() => {
          setFade(true);
          hideTimer = setTimeout(() => {
            setVisible(false);
          }, 150);
        }, 150);
      }
    } catch {
      setVisible(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Loading VyaparMedia"
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background text-foreground transition-opacity duration-300 ease-out select-none ${fade ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      style={{
        backgroundColor: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
      }}
    >
      {/* Ambient background glow matching platform accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full opacity-25 filter blur-[90px]"
          style={{ background: "radial-gradient(circle, var(--color-primary, #10b981) 0%, transparent 70%)" }}
        />
      </div>

      {/* Main Brand Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-sm">
        {/* Animated Brand Logo Icon */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-5 flex items-center justify-center p-3 rounded-2xl bg-card border border-border shadow-2xl">
          <Image
            src="/logo-vm.png"
            alt="VyaparMedia Logo"
            width={88}
            height={88}
            className="w-full h-full object-contain drop-shadow-md select-none animate-pulse"
            priority
          />
        </div>

        {/* Brand Name Typography */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center justify-center leading-none">
          Vyapar<span className="text-primary font-black ml-0.5">Media</span>
        </h1>

        {/* Tagline / Subtitle */}
        <p className="text-xs sm:text-sm font-semibold tracking-wide text-muted-foreground uppercase mt-2 select-none">
          Trusted Creator Commerce
        </p>

        {/* Trust Badge */}
        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary text-[11px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
          <span>Bharat&apos;s #1 Creator Escrow Platform</span>
        </div>

        {/* Smooth Mini Progress Indicator */}
        <div className="w-32 h-1 bg-muted/60 rounded-full overflow-hidden mt-6">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: fade ? "100%" : "75%" }}
          />
        </div>
      </div>

      {/* Security & Regulatory Tagline at Footer */}
      <div className="absolute bottom-6 text-center text-[11px] text-muted-foreground">
        <span>100% Escrow Protection &bull; RBI-Compliant &bull; Instant Payouts</span>
      </div>
    </div>
  );
}

export default AppSplashScreen;
