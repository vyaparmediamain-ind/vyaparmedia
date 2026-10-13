import Link from "next/link";

import Image from "next/image";

export function Logo({
  href = "/",
  asLink = true,
  tabIndex,
}: Readonly<{
  href?: string;
  asLink?: boolean;
  tabIndex?: number;
}> = {}) {
  const content = (
    <>
      <div className="logo-mark p-1 flex items-center justify-center rounded-xl text-foreground flex-shrink-0 relative overflow-hidden bg-card border border-border">
        {/* Official VyaparMedia Logo Mark */}
        <Image
          src="/logo-vm.png"
          alt="VyaparMedia"
          width={28}
          height={28}
          className="w-7 h-7 object-contain drop-shadow"
          priority
        />
      </div>
      <div className="logo-copy flex flex-col min-w-0 flex-1">
        <span
          className="gradient-text text-xl font-extrabold tracking-tight truncate leading-tight"
        >
          VyaparMedia
        </span>
        <span
          className="text-secondary font-medium text-xs truncate"
        >
          Trusted Creator Commerce
        </span>
      </div>
    </>
  );

  if (!asLink) {
    return (
      <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden group">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 no-underline min-w-0 flex-1 overflow-hidden group"
      tabIndex={tabIndex}
    >
      {content}
    </Link>
  );
}

export default Logo;
