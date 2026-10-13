import React from "react";
import Link from "next/link";

export interface ListItemProps {
  /** Leading visual: avatar, icon badge, or rank indicator (typically 40px-48px) */
  readonly leading?: React.ReactNode | undefined;
  /** Primary title element or text */
  readonly title?: React.ReactNode | undefined;
  /** Optional badge or status indicator rendered inline next to the title */
  readonly titleBadge?: React.ReactNode | undefined;
  /** Secondary subtitle text or snippet */
  readonly subtitle?: React.ReactNode | undefined;
  /** Line clamp for subtitle (default: 1 line) */
  readonly subtitleClamp?: 1 | 2 | 3 | "none" | undefined;
  /** Tertiary metadata tags, deliverable badges, or category pills */
  readonly meta?: React.ReactNode | undefined;
  /** Primary trailing content: timestamp, amount, action button, or status badge */
  readonly trailing?: React.ReactNode | undefined;
  /** Secondary trailing content: unread count pill, chevron, secondary badge, or action button */
  readonly trailingSecondary?: React.ReactNode | undefined;
  /** Body children (for expandable card accordions, steppers, feedback alerts, or forms) */
  readonly children?: React.ReactNode | undefined;
  /** Click handler for interactive list rows */
  readonly onClick?: ((e: React.MouseEvent<HTMLElement>) => void) | undefined;
  /** Optional keyboard handler */
  readonly onKeyDown?: React.KeyboardEventHandler<HTMLElement> | undefined;
  /** Optional destination link (wraps with Next.js Link) */
  readonly href?: string | undefined;
  /** Whether the item is currently active / selected */
  readonly active?: boolean | undefined;
  /** Whether the item represents an unread message / notification */
  readonly unread?: boolean | undefined;
  /** Visual presentation mode: standalone card ("card") or divided flush row ("flush") */
  readonly variant?: "card" | "flush" | undefined;
  /** Compact padding mode (e.g. for tight sidebar drawers) */
  readonly compact?: boolean | undefined;
  /** Vertical alignment of leading slot: "center" (default, Instagram style) or "start" */
  readonly alignLeading?: "center" | "start" | undefined;
  /** HTML container element */
  readonly as?: "div" | "li" | "article" | "button" | undefined;
  /** Additional CSS class names */
  readonly className?: string | undefined;
  /** Accessibility label */
  readonly "aria-label"?: string | undefined;
  /** Accessibility expanded state (e.g. for accordion cards) */
  readonly "aria-expanded"?: boolean | undefined;
  /** Accessibility current state */
  readonly "aria-current"?: boolean | "true" | "false" | "page" | "step" | "location" | "date" | "time" | undefined;
  /** Element ID */
  readonly id?: string | undefined;
}

/**
 * Universal ListItem base component for lists, activity feeds, and table-like rows.
 * Implements standard 3-zone responsive visual grammar inspired by Instagram:
 * [Leading Visual: Avatar / Icon] [Title (bold) + Subtitle (muted) + Meta] [Trailing Content / Meta]
 */
export function ListItem({
  leading,
  title,
  titleBadge,
  subtitle,
  subtitleClamp = 1,
  meta,
  trailing,
  trailingSecondary,
  children,
  onClick,
  onKeyDown,
  href,
  active = false,
  unread = false,
  variant = "card",
  compact = false,
  alignLeading = "center",
  as = "div",
  className = "",
  "aria-label": ariaLabel,
  "aria-expanded": ariaExpanded,
  "aria-current": ariaCurrent,
  id,
}: Readonly<ListItemProps>) {
  const Component = as;

  // Base layout styling according to variant
  let containerStyles = "";
  if (variant === "card") {
    containerStyles = `rounded-2xl border transition-all ${
      compact ? "p-3 sm:p-3.5" : "p-4 sm:p-5"
    } ${
      active
        ? "bg-card border-primary shadow-sm ring-1 ring-primary/20"
        : unread
        ? "bg-primary/[0.03] border-primary/30 hover:border-primary/50 shadow-xs"
        : "bg-card border-border hover:border-border/90 shadow-xs"
    }`;
  } else {
    // Flush variant (divided rows, sidebar items, activity streams)
    containerStyles = `transition-all ${
      compact ? "px-3.5 py-3" : "px-4 py-3.5 sm:px-5 sm:py-4"
    } ${
      active
        ? "bg-primary/10 border-l-[3px] border-primary"
        : unread
        ? "bg-primary/[0.04] dark:bg-primary/[0.07] border-l-[3px] border-primary/50 hover:bg-muted/50"
        : "hover:bg-muted/40 border-l-[3px] border-transparent"
    }`;
  }

  const interactiveStyles = onClick || href ? "cursor-pointer select-none" : "";
  const baseStyles = `group relative w-full text-left ${containerStyles} ${interactiveStyles} ${className}`.trim();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (onKeyDown) {
      onKeyDown(e);
      return;
    }
    if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick(e as unknown as React.MouseEvent<HTMLElement>);
    }
  };

  const hasHeader = Boolean(
    leading || title || titleBadge || subtitle || meta || trailing || trailingSecondary
  );

  const clampClass =
    subtitleClamp === "none"
      ? ""
      : subtitleClamp === 2
      ? "line-clamp-2"
      : subtitleClamp === 3
      ? "line-clamp-3"
      : "truncate";

  const alignClass = alignLeading === "start" ? "items-start" : "items-center";

  const content = hasHeader ? (
    <div className="w-full space-y-3">
      <div className={`flex ${alignClass} justify-between gap-3 sm:gap-4 w-full`}>
        {/* ── Leading & Center Content Zone ── */}
        {(leading || title || titleBadge || subtitle || meta) && (
          <div className={`flex ${alignClass} gap-3 sm:gap-3.5 min-w-0 flex-1`}>
            {leading && <div className="shrink-0 flex items-center justify-center">{leading}</div>}

            <div className="min-w-0 flex-1 space-y-0.5">
              {title && (
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
                  <div className="text-sm sm:text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {title}
                  </div>
                  {titleBadge}
                  {unread && (
                    <span
                      className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse"
                      aria-label="Unread item"
                    />
                  )}
                </div>
              )}

              {subtitle && (
                <div className={`text-xs text-muted-foreground ${clampClass} leading-relaxed`}>
                  {subtitle}
                </div>
              )}

              {meta && <div className="mt-1 flex flex-wrap items-center gap-1.5">{meta}</div>}
            </div>
          </div>
        )}

        {/* ── Trailing Content Zone (Instagram pinned right-hand meta) ── */}
        {(trailing || trailingSecondary) && (
          <div className="shrink-0 flex flex-col items-end justify-center gap-1 text-right pl-2">
            {trailing && <div className="flex items-center justify-end gap-1.5">{trailing}</div>}
            {trailingSecondary && (
              <div className="flex items-center justify-end gap-1.5">{trailingSecondary}</div>
            )}
          </div>
        )}
      </div>

      {/* ── Expandable / Secondary Children Zone ── */}
      {children && <div className="w-full pt-1">{children}</div>}
    </div>
  ) : (
    <div className="w-full">{children}</div>
  );

  if (href) {
    return (
      <Link
        href={href}
        id={id}
        aria-label={ariaLabel}
        aria-current={ariaCurrent}
        className={baseStyles}
        {...(onClick ? { onClick } : {})}
      >
        {content}
      </Link>
    );
  }

  if (as === "button") {
    return (
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        aria-current={ariaCurrent}
        className={baseStyles}
        {...(onClick ? { onClick } : {})}
        {...(onKeyDown ? { onKeyDown } : {})}
      >
        {content}
      </button>
    );
  }

  return (
    <Component
      id={id}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-current={ariaCurrent}
      className={baseStyles}
      {...(onClick
        ? {
            onClick,
            onKeyDown: handleKeyDown,
            role: "button",
            tabIndex: 0,
          }
        : {})}
    >
      {content}
    </Component>
  );
}

export default ListItem;
