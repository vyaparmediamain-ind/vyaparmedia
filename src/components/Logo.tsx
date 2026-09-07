import Link from "next/link";

export default function Logo({ tabIndex }: Readonly<{ tabIndex?: number }> = {}) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 no-underline min-w-0 flex-1 overflow-hidden"
      tabIndex={tabIndex}
    >
      <div className="logo-mark p-2 flex items-center justify-center rounded-lg text-white flex-shrink-0">
        {/* VyaparMedia Logo Signal-to-Decision icon */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Diamond/decision shape */}
          <path d="M12 2L22 12L12 22L2 12Z" />
          {/* Signal waves inside */}
          <path d="M12 8v4l2 2" strokeWidth="2" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </svg>
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
