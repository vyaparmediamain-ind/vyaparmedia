import React from "react";

export interface CardProps {
readonly children: React.ReactNode;
readonly className?: string;
readonly gradient?: boolean;
readonly as?: "div" | "article" | "section" | "li";
readonly onClick?: React.MouseEventHandler<HTMLDivElement>;
readonly id?: string;
readonly "aria-label"?: string;
}

export function Card({
children,
className = "",
gradient = false,
as: Tag = "div",
onClick,
id,
"aria-label": ariaLabel,
}: CardProps) {
return (
<Tag
id={id}
className={`card ${gradient ? "card-gradient" : ""} ${className}`}
// onClick only valid on div, but Tag can vary cast to any for flexibility
{...(onClick ? { onClick: onClick as React.MouseEventHandler } : {})}
{...(ariaLabel ? { "aria-label": ariaLabel } : {})}
>
{children}
</Tag>
);
}
