import React from "react";

export interface SkeletonProps {
readonly width?: string | number;
readonly height?: string | number;
readonly borderRadius?: string | number;
readonly className?: string;
/** Render as a circle (e.g. avatar placeholder) */
readonly circle?: boolean;
}

export function Skeleton({
width,
height,
borderRadius,
className = "",
circle = false,
}: SkeletonProps) {
const randomId = React.useId().replace(/:/g, "");
const skeletonClass = `skeleton-${randomId}`;

  let widthCss = "";
  if (width !== undefined) {
    const widthVal = typeof width === "number" ? width + "px" : width;
    widthCss = `width: ${widthVal};`;
  }

  let heightCss = "";
  if (height !== undefined) {
    const heightVal = typeof height === "number" ? height + "px" : height;
    heightCss = `height: ${heightVal};`;
  }

  let radiusCss = "";
  if (circle) {
    radiusCss = "border-radius: 50%;";
  } else if (borderRadius !== undefined) {
    const radiusVal = typeof borderRadius === "number" ? borderRadius + "px" : borderRadius;
    radiusCss = `border-radius: ${radiusVal};`;
  }

  const styleContent = `
.${skeletonClass} {
  ${widthCss}
  ${heightCss}
  ${radiusCss}
}
`.trim();

return (
<>
<style>{styleContent}</style>
<div
className={`skeleton ${skeletonClass} ${className}`}
aria-hidden="true"
/>
</>
);
}
