import Image from "next/image";

export default function RootLoading() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background text-foreground select-none"
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full opacity-20 filter blur-[80px]"
          style={{ background: "radial-gradient(circle, var(--color-primary, #10b981) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-sm">
        {/* Brand Logo Icon */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 mb-4 flex items-center justify-center p-2.5 rounded-2xl bg-card border border-border shadow-xl">
          <Image
            src="/logo-vm.png"
            alt="VyaparMedia Logo"
            width={72}
            height={72}
            className="w-full h-full object-contain animate-pulse select-none"
            priority
          />
        </div>

        {/* Brand Name Typography */}
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center justify-center leading-none">
          Vyapar<span className="text-primary font-black ml-0.5">Media</span>
        </h2>

        {/* Tagline */}
        <p className="text-[11px] sm:text-xs font-semibold tracking-wider text-muted-foreground uppercase mt-1.5 select-none">
          Trusted Creator Commerce
        </p>

        {/* Trust Badge */}
        <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-[10px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
          <span>Bharat&apos;s #1 Creator Escrow Platform</span>
        </div>

        {/* Mini progress line */}
        <div className="w-28 h-1 bg-muted/60 rounded-full overflow-hidden mt-5">
          <div className="h-full bg-primary rounded-full animate-pulse w-3/4" />
        </div>
      </div>
    </div>
  );
}
