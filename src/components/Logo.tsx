import Link from "next/link";

import Image from "next/image";

export default function Logo({ tabIndex }: Readonly<{ tabIndex?: number }> = {}) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 no-underline min-w-0 flex-1 overflow-hidden group"
      tabIndex={tabIndex}
    >
      <div className="logo-mark p-1 flex items-center justify-center rounded-xl text-white flex-shrink-0 relative overflow-hidden bg-slate-900/60 border border-slate-700/50">
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
          className="text-secondary font-semibold uppercase text-3xs tracking-wider truncate"
        >
          Trusted Creator Commerce
        </span>
      </div>
    </Link>
  );
}
