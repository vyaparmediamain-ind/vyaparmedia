import React from "react";

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps {
readonly size?: SpinnerSize;
readonly className?: string;
readonly "aria-label"?: string;
}

export function Spinner({
size = "md",
className = "",
"aria-label": ariaLabel = "Loading",
}: SpinnerProps) {
const randomId = React.useId().replace(/:/g, "");
const spinnerClass = `spinner-${randomId}`;

const sizeStyleMap = {
sm: { width: "14px", height: "14px" },
md: { width: "20px", height: "20px" },
lg: { width: "32px", height: "32px" },
};

const styleContent = `
.${spinnerClass} {
width: ${sizeStyleMap[size].width};
height: ${sizeStyleMap[size].height};
}
`.trim();

return (
<>
<style>{styleContent}</style>
<output
className={`loading ${spinnerClass} ${className}`}
aria-label={ariaLabel}
/>
</>
);
}
