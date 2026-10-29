import Image from "next/image";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface AvatarProps {
  readonly name?: string | null | undefined;
  readonly src?: string | null | undefined;
  readonly size?: AvatarSize | undefined;
  readonly className?: string | undefined;
  readonly "aria-hidden"?: boolean | undefined;
}

const sizeClass: Record<AvatarSize, string> = {
sm: "avatar-sm",
md: "",
lg: "avatar-lg",
xl: "avatar-xl",
};

export function Avatar({
name,
src,
size = "md",
className = "",
"aria-hidden": ariaHidden,
}: AvatarProps) {
const initial = name ? (name[0]?.toUpperCase() ?? "U") : "U";
const classes = `avatar ${sizeClass[size]} ${className}`.trim();

return (
<div className={classes} aria-hidden={ariaHidden}>
{src ? (
<Image src={src} alt={name ?? "Avatar"} fill className="object-cover" />
) : (
initial
)}
</div>
);
}
