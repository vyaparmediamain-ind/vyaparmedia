import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export interface PageHeaderProps {
  /** Page title heading text or React elements */
  readonly title: React.ReactNode;
  /** Optional descriptive subtitle or summary text */
  readonly subtitle?: React.ReactNode | undefined;
  /** Optional badge or status chip next to the title (e.g. "Live Sync", "Unread (3)") */
  readonly badge?: React.ReactNode | undefined;
  /** Optional leading icon container or badge (e.g. category icon) */
  readonly icon?: React.ReactNode | undefined;
  /** Optional breadcrumbs element shown above the title */
  readonly breadcrumbs?: React.ReactNode | undefined;
  /** Destination URL for back button navigation */
  readonly backHref?: string | undefined;
  /** Optional back click handler callback */
  readonly onBack?: (() => void) | undefined;
  /** Accessible label for the back button */
  readonly backLabel?: string | undefined;
  /** Right-aligned action buttons, filters, or controls */
  readonly actions?: React.ReactNode | undefined;
  /** Additional custom CSS class names */
  readonly className?: string | undefined;
  /** Whether to show the bottom border divider (default: true) */
  readonly border?: boolean | undefined;
}

/**
 * Universal PageHeader component for consistent page titles, subtitles,
 * back navigation, and right-aligned actions across mobile and desktop.
 */
export function PageHeader({
  title,
  subtitle,
  badge,
  icon,
  breadcrumbs,
  backHref,
  onBack,
  backLabel,
  actions,
  className = "",
  border = true,
}: Readonly<PageHeaderProps>) {
  return (
    <header
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 w-full ${
        border ? "border-b border-border pb-4 sm:pb-5" : ""
      } ${className}`.trim()}
    >
      <div className="min-w-0 flex-1">
        {breadcrumbs && (
          <nav aria-label="Breadcrumb" className="mb-1.5 sm:mb-2">
            {breadcrumbs}
          </nav>
        )}

        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
          {(backHref || onBack) && (
            backHref ? (
              <Link
                href={backHref}
                className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0 shadow-2xs mt-0.5 sm:mt-0"
                aria-label={backLabel || "Go back"}
                title={backLabel || "Go back"}
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground hover:text-foreground" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-card hover:bg-muted border border-border text-foreground transition-colors shrink-0 shadow-2xs mt-0.5 sm:mt-0 cursor-pointer"
                aria-label={backLabel || "Go back"}
                title={backLabel || "Go back"}
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground hover:text-foreground" />
              </button>
            )
          )}

          {icon && (
            <div className="shrink-0 mt-0.5 sm:mt-0 flex items-center justify-center">
              {icon}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground font-heading truncate">
                {title}
              </h1>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>

            {subtitle && (
              <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 leading-relaxed">
                {subtitle}
              </div>
            )}
          </div>
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap self-start sm:self-center shrink-0 pt-1 sm:pt-0">
          {actions}
        </div>
      )}
    </header>
  );
}
