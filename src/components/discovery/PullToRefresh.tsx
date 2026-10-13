"use client";

import React, { useState, useRef, useCallback } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { haptic } from "@/lib/haptics";

export interface PullToRefreshProps {
  readonly onRefresh: () => Promise<unknown> | void;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly pullThreshold?: number;
}

const DEFAULT_PULL_THRESHOLD = 65; // px to trigger refresh
const MAX_PULL = 90; // max visible pull height

export default function PullToRefresh({
  onRefresh,
  children,
  className = "relative w-full min-h-full",
  disabled = false,
  pullThreshold = DEFAULT_PULL_THRESHOLD,
}: Readonly<PullToRefreshProps>) {
  const shouldReduceMotion = useReducedMotion();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);
  const hasVibratedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAtTop = useCallback(() => {
    if (typeof window === "undefined") return false;
    const winScroll = window.scrollY || document.documentElement.scrollTop || 0;
    if (winScroll > 0) return false;

    if (containerRef.current) {
      let el: HTMLElement | null = containerRef.current;
      while (el && el !== document.body) {
        if (el.scrollTop > 0) return false;
        el = el.parentElement;
      }
    }
    return true;
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    if (isAtTop()) {
      startYRef.current = e.touches[0]!.clientY;
      isPullingRef.current = true;
      hasVibratedRef.current = false;
    }
  };

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPullingRef.current || isRefreshing || disabled) return;

      const currentY = e.touches[0]!.clientY;
      const rawDelta = currentY - startYRef.current;

      if (rawDelta > 0) {
        // Damping resistance curve: delta^0.75
        const damped = Math.min(MAX_PULL, Math.pow(rawDelta, 0.75) * 2.2);
        setPullDistance(damped);

        // Subtle tactile tick when crossing the pullThreshold
        if (damped >= pullThreshold && !hasVibratedRef.current) {
          haptic.selection();
          hasVibratedRef.current = true;
        } else if (damped < pullThreshold && hasVibratedRef.current) {
          hasVibratedRef.current = false;
        }
      } else {
        setPullDistance(0);
      }
    },
    [isRefreshing, disabled, pullThreshold]
  );

  const handleTouchEnd = async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    hasVibratedRef.current = false;

    if (pullDistance >= pullThreshold && !isRefreshing && !disabled) {
      haptic.medium(); // Haptic pulse when pull-to-refresh triggers
      setIsRefreshing(true);
      setPullDistance(50); // Hold at spinner height
      try {
        await Promise.resolve(onRefresh());
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  const isTriggerReady = pullDistance >= pullThreshold;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={className}
    >
      {/* Pull indicator container */}
      <div
        style={{
          height: `${pullDistance}px`,
          transition: isPullingRef.current || shouldReduceMotion ? "none" : "height 0.3s ease-out",
        }}
        className="overflow-hidden flex items-center justify-center transition-all pointer-events-none select-none"
        aria-hidden="true"
      >
        <div
          className={`w-9 h-9 rounded-full bg-card border border-border shadow-md flex items-center justify-center transition-transform ${
            isRefreshing
              ? "scale-100"
              : isTriggerReady
              ? "scale-110 text-primary ring-2 ring-primary/20"
              : "scale-90 text-muted-foreground"
          }`}
        >
          {isRefreshing ? (
            <Loader2 className={`w-5 h-5 text-primary ${shouldReduceMotion ? "" : "animate-spin"}`} />
          ) : (
            <ArrowDown
              className={`w-4 h-4 ${shouldReduceMotion ? "" : "transition-transform duration-200"}`}
              style={{
                transform: `rotate(${Math.min(180, (pullDistance / pullThreshold) * 180)}deg)`,
              }}
            />
          )}
        </div>
      </div>

      {children}
    </div>
  );
}

export { PullToRefresh };
