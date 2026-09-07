"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

/* ============ Scroll-triggered animation hook ============ */
function useInView(threshold = 0.15) {
const ref = useRef<HTMLDivElement>(null);
const [isInView, setIsInView] = useState(false);

useEffect(() => {
const el = ref.current;
if (!el) return;
const observer = new IntersectionObserver(
([entry]) => {
if (entry?.isIntersecting) setIsInView(true);
},
{ threshold },
);
observer.observe(el);
return () => observer.disconnect();
}, [threshold]);

return { ref, isInView };
}

export function RevealOnScroll({
children,
delay = 0,
className = "",
}: Readonly<{
children: ReactNode;
delay?: number;
className?: string;
}>) {
const { ref, isInView } = useInView();
const delayClass = delay > 0 ? "reveal-on-scroll-delayed" : "";
return (
<div
ref={ref}
className={`reveal-on-scroll ${delayClass} ${isInView ? "is-in-view" : ""} ${className}`}
>
{children}
</div>
);
}

// Icon Mapping Function
export function getFeatureIcon(iconKey: string) {
switch (iconKey) {
case "PAY":
return (
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-light">
<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
<path d="M7 11V7a5 5 0 0 1 10 0v4" />
</svg>
);
case "TR":
return (
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-secondary-light">
<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
<path d="m9 12 2 2 4-4" />
</svg>
);
case "CT":
return (
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan">
<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
<polyline points="14 2 14 8 20 8" />
<line x1="16" y1="13" x2="8" y2="13" />
<line x1="16" y1="17" x2="8" y2="17" />
</svg>
);
case "MT":
return (
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald">
<circle cx="12" cy="12" r="10" />
<circle cx="12" cy="12" r="6" />
<circle cx="12" cy="12" r="2" />
</svg>
);
case "XP":
return (
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber">
<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
<path d="M4 22h16" />
<path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
<path d="M12 2a15 15 0 0 1 0 14.66A15 15 0 0 1 12 2z" />
</svg>
);
case "DP":
default:
return (
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-rose">
<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
<polyline points="14 2 14 8 20 8" />
<line x1="16" y1="13" x2="8" y2="13" />
<line x1="16" y1="17" x2="8" y2="17" />
<line x1="10" y1="9" x2="8" y2="9" />
</svg>
);
}
}

export function renderStars(rating: number) {
const starKeys = ["star-1", "star-2", "star-3", "star-4", "star-5"];
return (
<div className="flex justify-center gap-1 mb-4 text-amber">
{starKeys.slice(0, rating).map((key) => (
<svg key={key} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
</svg>
))}
</div>
);
}
