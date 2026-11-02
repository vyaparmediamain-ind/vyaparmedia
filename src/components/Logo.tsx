import Link from "next/link";
import Image from "next/image";

export interface LogoProps {
  readonly href?: string;
  readonly asLink?: boolean;
  readonly tabIndex?: number;
  readonly className?: string;
  readonly size?: "sm" | "md" | "lg";
  readonly showTagline?: boolean;
  readonly priority?: boolean;
  readonly badge?: React.ReactNode;
}

const MARK_SIZES = {
  sm: "w-8 h-8",
  md: "w-9 h-9 sm:w-10 sm:h-10",
  lg: "w-11 h-11 sm:w-12 sm:h-12",
};

const TITLE_SIZES = {
  sm: "text-base",
  md: "text-lg sm:text-xl",
  lg: "text-xl sm:text-2xl",
};

const TAGLINE_SIZES = {
  sm: "text-[10px]",
  md: "text-[10px] sm:text-[11px]",
  lg: "text-xs",
};

export function Logo({
  href = "/",
  asLink = true,
  tabIndex,
  className = "",
  size = "md",
  showTagline = true,
  priority = true,
  badge,
}: LogoProps = {}) {
  const content = (
    <>
      {/* Official VyaparMedia Logo Mark matching browser tab favicon branding */}
      <div
        className={`logo-mark relative flex items-center justify-center transition-transform duration-200 group-hover:scale-105 shrink-0 ${MARK_SIZES[size]}`}
      >
        <Image
          src="/logo-vm.png"
          alt="VyaparMedia Logo"
          width={44}
          height={44}
          className="w-full h-full object-contain select-none"
          priority={priority}
        />
      </div>

      {/* Typography: Theme-Adaptive Crisp Text & Tagline */}
      <div className="logo-copy flex flex-col justify-center min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`logo-title font-black tracking-tight text-foreground leading-none flex items-center select-none whitespace-nowrap ${TITLE_SIZES[size]}`}
          >
            Vyapar<span className="logo-media text-primary font-black ml-0.5">Media</span>
          </span>
          {badge}
        </div>
        {showTagline && (
          <span
            className={`logo-tagline text-muted-foreground font-medium tracking-tight truncate leading-tight mt-0.5 select-none whitespace-nowrap ${TAGLINE_SIZES[size]}`}
          >
            Trusted Creator Commerce
          </span>
        )}
      </div>
    </>
  );

  const containerClasses = `inline-flex items-center gap-2.5 sm:gap-3 min-w-0 select-none group ${className}`;

  if (!asLink) {
    return <div className={containerClasses}>{content}</div>;
  }

  return (
    <Link
      href={href}
      className={`${containerClasses} no-underline`}
      tabIndex={tabIndex}
    >
      {content}
    </Link>
  );
}

export default Logo;
