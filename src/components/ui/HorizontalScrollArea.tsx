"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface HorizontalScrollAreaProps {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly containerClassName?: string;
  readonly scrollStep?: number;
  readonly showButtons?: boolean;
  readonly showFadeMasks?: boolean;
  readonly enableWheelScroll?: boolean;
  readonly enableDragScroll?: boolean;
  readonly showScrollIndicator?: boolean;
  readonly "aria-label"?: string;
}

/**
 * HorizontalScrollArea
 * Provides smooth, accessible horizontal scrolling for chips, tabs, tags, and story carousels.
 * Solves cut-off edges, hidden desktop scrollbars, and missing navigation controls end-to-end.
 * Features:
 * - Always-visible floating chevron buttons (pinned inside container, never clipped)
 * - Mouse drag-to-scroll (pan with mouse click & drag)
 * - Mouse wheel to horizontal scroll conversion
 * - Touch pan support
 * - Dynamic dimension & font observation
 * - Built-in min-w-max protection to prevent flex-shrinking of tabs
 */
export function HorizontalScrollArea({
  children,
  className = "",
  containerClassName = "",
  scrollStep = 240,
  showButtons = true,
  showFadeMasks = true,
  enableWheelScroll = true,
  enableDragScroll = true,
  showScrollIndicator = false,
  "aria-label": ariaLabel = "Scrollable horizontal list",
}: Readonly<HorizontalScrollAreaProps>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Drag tracking refs
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    const canLeft = el.scrollLeft > 2;
    const canRight = el.scrollLeft < maxScroll - 2;

    setCanScrollLeft(canLeft);
    setCanScrollRight(canRight);

    if (maxScroll > 0) {
      setScrollProgress(Math.min(100, Math.max(0, (el.scrollLeft / maxScroll) * 100)));
    } else {
      setScrollProgress(0);
    }
  }, []);

  // Multi-pass measurement to handle font rendering, async data hydration & resize
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();

    // Deferred checks for web fonts & layout recalculations
    const t1 = setTimeout(checkScroll, 50);
    const t2 = setTimeout(checkScroll, 150);
    const t3 = setTimeout(checkScroll, 400);

    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => checkScroll()).catch(() => {});
    }

    // ResizeObserver tracks element dimension changes (viewport resize or dynamic chips)
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        checkScroll();
      });
      ro.observe(el);
      Array.from(el.children).forEach((child) => ro?.observe(child));
    }

    // MutationObserver catches dynamic DOM changes in children
    let mo: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined") {
      mo = new MutationObserver(() => {
        checkScroll();
      });
      mo.observe(el, { childList: true, subtree: true, characterData: true });
    }

    const onScroll = () => {
      checkScroll();
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, children]);

  // Mouse wheel conversion for seamless horizontal navigation on desktop
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enableWheelScroll) return;

    const onWheel = (e: WheelEvent) => {
      // If user is already scrolling horizontally (trackpad/tilt-wheel), let browser handle it
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      // Only hijack if content actually overflows horizontally
      if (el.scrollWidth > el.clientWidth) {
        const canScroll =
          (e.deltaY > 0 && el.scrollLeft < el.scrollWidth - el.clientWidth - 1) ||
          (e.deltaY < 0 && el.scrollLeft > 1);

        if (canScroll) {
          e.preventDefault();
          el.scrollBy({ left: e.deltaY, behavior: "auto" });
          checkScroll();
        }
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [enableWheelScroll, checkScroll]);

  // Click-to-scroll button handlers
  const handleScroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;

    const distance = direction === "left" ? -scrollStep : scrollStep;
    el.scrollBy({ left: distance, behavior: "smooth" });
  };

  // Keyboard navigation support
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      handleScroll("left");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      handleScroll("right");
    }
  };

  // Mouse drag-to-scroll handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enableDragScroll || e.button !== 0) return;
    const el = scrollRef.current;
    if (!el) return;

    isMouseDownRef.current = true;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
    hasMovedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDownRef.current || !enableDragScroll) return;
    const el = scrollRef.current;
    if (!el) return;

    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.2;
    if (Math.abs(walk) > 4) {
      if (!hasMovedRef.current) {
        hasMovedRef.current = true;
        setIsDragging(true);
      }
      el.scrollLeft = scrollLeftRef.current - walk;
      checkScroll();
    }
  };

  const handleMouseUpOrLeave = () => {
    isMouseDownRef.current = false;
    if (isDragging) {
      // Small timeout to prevent child click events from triggering on release
      setTimeout(() => {
        setIsDragging(false);
        hasMovedRef.current = false;
      }, 50);
    }
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const isOverflowing = canScrollLeft || canScrollRight;

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={`relative group/hscroll w-full ${containerClassName}`}
    >
      {/* Left Fade Mask */}
      {showFadeMasks && canScrollLeft && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-r from-background via-background/85 to-transparent z-15 transition-opacity duration-300"
        />
      )}

      {/* Right Fade Mask */}
      {showFadeMasks && canScrollRight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-l from-background via-background/85 to-transparent z-15 transition-opacity duration-300"
        />
      )}

      {/* Left Navigation Chevron Button */}
      {showButtons && canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScroll("left")}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-card/95 backdrop-blur-md border border-border shadow-md flex items-center justify-center text-foreground hover:bg-primary hover:text-primary-foreground hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Scroll left"
          title="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Scrollable Viewport */}
      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onClickCapture={handleClickCapture}
        className={`flex items-center overflow-x-auto scrollbar-none scroll-smooth touch-pan-x focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 rounded-xl ${
          isDragging ? "cursor-grabbing select-none" : isOverflowing ? "cursor-grab" : ""
        } ${className}`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="inline-flex items-center min-w-max shrink-0">
          {children}
        </div>
      </div>

      {/* Right Navigation Chevron Button */}
      {showButtons && canScrollRight && (
        <button
          type="button"
          onClick={() => handleScroll("right")}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-card/95 backdrop-blur-md border border-border shadow-md flex items-center justify-center text-foreground hover:bg-primary hover:text-primary-foreground hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Scroll right"
          title="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Optional Subtle Scroll Progress Indicator */}
      {showScrollIndicator && isOverflowing && (
        <div
          aria-hidden="true"
          className="absolute -bottom-1 left-2 right-2 h-0.5 bg-muted/40 rounded-full overflow-hidden pointer-events-none opacity-0 group-hover/hscroll:opacity-100 transition-opacity"
        >
          <div
            className="h-full bg-primary/60 rounded-full transition-all duration-100"
            style={{
              width: "20%",
              transform: `translateX(${scrollProgress * 4}%)`,
            }}
          />
        </div>
      )}
    </div>
  );
}
