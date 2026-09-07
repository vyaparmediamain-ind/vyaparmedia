"use client";
import React from "react";
import { Button } from "./Button";

export interface EmptyStateProps {
  readonly emoji?: string | undefined;
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string | undefined;
  readonly actionHref?: string | undefined;
  readonly onActionClick?: (() => void) | undefined;
  readonly secondaryActionLabel?: string | undefined;
  readonly secondaryActionHref?: string | undefined;
  readonly onSecondaryActionClick?: (() => void) | undefined;
  readonly compact?: boolean | undefined;
  readonly className?: string | undefined;
}

function getIconForTitle(title: string, description: string): React.ReactNode {
  const t = title.toLowerCase();
  const d = description.toLowerCase();

  if (t.includes("notification") || t.includes("caught up")) {
    return (
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-muted mx-auto mb-2 opacity-60">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    );
  }
  if (t.includes("login") || t.includes("session") || t.includes("security")) {
    return (
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-muted mx-auto mb-2 opacity-60">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  if (t.includes("bank") || t.includes("transaction") || t.includes("payout") || t.includes("payment") || t.includes("wallet")) {
    return (
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-muted mx-auto mb-2 opacity-60">
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <line x1="2" x2="22" y1="10" y2="10" />
      </svg>
    );
  }
  if (t.includes("campaign") || t.includes("collaboration")) {
    return (
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-muted mx-auto mb-2 opacity-60">
        <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    );
  }
  if (t.includes("deal") || t.includes("contract")) {
    return (
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-muted mx-auto mb-2 opacity-60">
        <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18 2h4v4" />
        <path d="M13 11 22 2" />
        <path d="M2 10h9" />
      </svg>
    );
  }
  if (t.includes("application") || t.includes("proposal") || t.includes("apply")) {
    return (
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-muted mx-auto mb-2 opacity-60">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <line x1="10" x2="8" y1="9" y2="9" />
      </svg>
    );
  }
  if (t.includes("challenge") || t.includes("leaderboard") || d.includes("leaderboard") || t.includes("badge") || t.includes("trophy")) {
    return (
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-muted mx-auto mb-2 opacity-60">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
        <path d="M12 2a5 5 0 0 1 5 5v3.5a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
      </svg>
    );
  }
  if (t.includes("dispute") || t.includes("violation") || t.includes("warning") || t.includes("report")) {
    return (
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-muted mx-auto mb-2 opacity-60">
        <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    );
  }
  if (t.includes("referral") || t.includes("invite") || t.includes("gift")) {
    return (
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-muted mx-auto mb-2 opacity-60">
        <rect width="18" height="14" x="3" y="8" rx="2" />
        <path d="M12 5a3 3 0 1 0-3 3h6a3 3 0 1 0-3-3Z" />
        <path d="M12 8v14" />
        <path d="M3 13h18" />
      </svg>
    );
  }
  if (t.includes("user") || t.includes("influencer") || t.includes("brand")) {
    return (
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-muted mx-auto mb-2 opacity-60">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (t.includes("chat") || t.includes("message") || t.includes("conversation") || t.includes("dm")) {
    return (
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-muted mx-auto mb-2 opacity-60">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }

  // Generic fallback
  return (
    <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-muted mx-auto mb-2 opacity-60">
      <path d="M4 20V6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export default function EmptyState({
  emoji,
  title,
  description,
  actionLabel,
  actionHref,
  onActionClick,
  secondaryActionLabel,
  secondaryActionHref,
  onSecondaryActionClick,
  compact = false,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`empty-state ${compact ? "compact" : ""} ${className}`}
    >
      {emoji ? (
        <div className="empty-state-emoji" aria-hidden="true">
          {emoji}
        </div>
      ) : (
        <div className="empty-state-icon flex justify-center items-center" aria-hidden="true">
          {getIconForTitle(title, description)}
        </div>
      )}
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex gap-3 justify-center flex-wrap">
          {actionLabel && (
            <Button
              {...(actionHref ? { href: actionHref } : {})}
              {...(onActionClick ? { onClick: onActionClick } : {})}
              variant="primary"
              size={compact ? "md" : "lg"}
            >
              {actionLabel}
            </Button>
          )}

          {secondaryActionLabel && (
            <Button
              {...(secondaryActionHref ? { href: secondaryActionHref } : {})}
              {...(onSecondaryActionClick ? { onClick: onSecondaryActionClick } : {})}
              variant="secondary"
              size="md"
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
