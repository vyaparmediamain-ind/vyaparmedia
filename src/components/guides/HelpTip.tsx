"use client";

import React, { useId } from "react";
import { HelpCircle } from "lucide-react";
import { useGuideDrawer } from "./GuideDrawerContext";

export interface HelpTipProps {
  readonly guideId: string;
  readonly stepIndex?: number | undefined;
  readonly label?: string | undefined;
  readonly tooltip?: string | undefined;
  readonly className?: string | undefined;
}

/**
 * Accessible small "?" button component beside features and buttons.
 * Complies with aria-describedby and full keyboard navigation (Enter/Space).
 */
export function HelpTip({
  guideId,
  stepIndex,
  label = "Need help with this feature?",
  tooltip,
  className = "",
}: Readonly<HelpTipProps>) {
  const { openGuideDrawer } = useGuideDrawer();
  const tooltipId = useId();
  const stepAnchor = stepIndex !== undefined ? `step-${stepIndex}` : undefined;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openGuideDrawer(guideId, stepAnchor);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      openGuideDrawer(guideId, stepAnchor);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={label}
      aria-describedby={tooltip ? tooltipId : undefined}
      title={tooltip || label}
      data-guide-id={guideId}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 cursor-pointer shrink-0 ${className}`}
    >
      <HelpCircle className="w-3.5 h-3.5 stroke-[2.2]" aria-hidden="true" />
      {tooltip && (
        <span id={tooltipId} className="sr-only">
          {tooltip}
        </span>
      )}
    </button>
  );
}
