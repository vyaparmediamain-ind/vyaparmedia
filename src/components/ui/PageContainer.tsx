import React, { ElementType, forwardRef, HTMLAttributes } from "react";

export type PageContainerMaxWidth =
  | "3xl"
  | "4xl"
  | "5xl"
  | "6xl"
  | "7xl"
  | "full"
  | "none";

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Systematic max-width constraint.
   * Defaults to "7xl" for standard dashboard page canvas.
   */
  maxWidth?: PageContainerMaxWidth;
  /**
   * If true, removes horizontal screen padding (px-0) for intentional edge-to-edge / full-bleed canvas.
   * Exception cases must be explicitly declared via fullBleed={true}.
   */
  fullBleed?: boolean;
  /**
   * HTML element to render as (default: "div").
   */
  as?: ElementType;
}

const MAX_WIDTH_MAP: Record<PageContainerMaxWidth, string> = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
  none: "max-w-none",
};

/**
 * Standard horizontal screen padding across VyaparMedia:
 * - Mobile (< 640px): 16px (px-4) with safe-area inset
 * - Tablet (640px - 1023px, sm: / md:): 24px (sm:px-6) with safe-area inset
 * - Desktop (>= 1024px, lg: / xl:): 32px (lg:px-8) with safe-area inset
 */
export const PAGE_CONTAINER_PADDING_CLASSES =
  "px-4 sm:px-6 lg:px-8 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] sm:pl-[max(1.5rem,env(safe-area-inset-left,0px))] sm:pr-[max(1.5rem,env(safe-area-inset-right,0px))] lg:pl-[max(2rem,env(safe-area-inset-left,0px))] lg:pr-[max(2rem,env(safe-area-inset-right,0px))]";

export const PAGE_CONTAINER_FULL_BLEED_CLASSES =
  "px-0 pl-0 pr-0 sm:px-0 sm:pl-0 sm:pr-0 lg:px-0 lg:pl-0 lg:pr-0";

/**
 * PageContainer provides unified, responsive screen padding and centering
 * across all dashboard and application views.
 */
export const PageContainer = forwardRef<HTMLDivElement, PageContainerProps>(
  function PageContainer(
    {
      maxWidth = "7xl",
      fullBleed = false,
      as: Component = "div",
      className = "",
      children,
      ...props
    },
    ref
  ) {
    const widthClass = MAX_WIDTH_MAP[maxWidth] || "max-w-7xl";
    const paddingClass = fullBleed
      ? PAGE_CONTAINER_FULL_BLEED_CLASSES
      : PAGE_CONTAINER_PADDING_CLASSES;

    return (
      <Component
        ref={ref}
        className={`w-full mx-auto ${widthClass} ${paddingClass} ${className}`.trim()}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

PageContainer.displayName = "PageContainer";

/**
 * PageBleed allows breakout elements (edge-to-edge carousels, full-width banners,
 * or horizontal overflow tables) within an already padded PageContainer.
 */
export const PageBleed = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function PageBleed({ className = "", children, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={`-mx-4 sm:-mx-6 lg:-mx-8 w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] lg:w-[calc(100%+4rem)] ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  }
);

PageBleed.displayName = "PageBleed";

export default PageContainer;
