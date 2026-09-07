"use client";

import Link from "next/link";
import Logo from "./Logo";

const platformLinks = [
{ label: "For Influencers", href: "/register?type=influencer" },
{ label: "For Brands", href: "/register?type=brand" },
{ label: "Pricing", href: "/pricing" },
];

const companyLinks = [
{ label: "About", href: "/about" },
{ label: "Blog", href: "/blog" },
{ label: "Contact", href: "/contact" },
];

const legalLinks = [
{ label: "Privacy Policy", href: "/privacy" },
{ label: "Terms and Conditions", href: "/terms" },
{ label: "Refund Policy", href: "/refund" },
{ label: "Cookie Policy", href: "/cookie-policy" },
];

const socialLinks = [
{ label: "X", href: "https://twitter.com" },
{ label: "IG", href: "https://instagram.com" },
{ label: "YT", href: "https://youtube.com" },
{ label: "IN", href: "https://linkedin.com" },
];

export default function Footer() {
return (
<footer className="site-footer bg-secondary border-t border-card">
<div className="container">
<div className="site-footer-grid grid mb-10 grid-auto-180">
<div>
<Logo />
<p
className="site-footer-copy text-secondary text-sm leading-relaxed"
>
VyaparMedia helps Indian brands and influencers run trusted
collaborations with verified profiles, protected payments, and
clearer delivery workflows.
</p>
<div
className="flex gap-3 mt-5"
>
{socialLinks.map((social) => (
<a
key={social.label}
href={social.href}
target="_blank"
rel="noopener noreferrer"
aria-label={social.label}
className="site-social-link flex items-center justify-center text-xs font-extrabold cursor-pointer rounded-sm bg-tertiary border-card text-inherit no-underline w-36 h-36"
>
{social.label}
</a>
))}
</div>
</div>

<FooterColumn title="Platform" links={platformLinks} />
<FooterColumn title="Company" links={companyLinks} />
<FooterColumn title="Legal" links={legalLinks} />
</div>

<div className="divider" />

<div
className="flex justify-between items-center flex-wrap gap-3"
>
<p
className="text-muted text-sm"
>
© 2026 VyaparMedia Technologies Pvt Ltd. All rights reserved.
</p>
<p
className="text-muted text-sm"
>
Where Brands & Creators Build Trusted Business.
</p>
</div>
</div>
</footer>
);
}

function FooterColumn({
title,
links,
}: Readonly<{
title: string;
links: Array<{ label: string; href: string }>;
}>) {
return (
<div>
<h4
className="font-bold mb-4 text-sm"
>
{title}
</h4>
<ul className="p-0 list-none">
{links.map((item) => (
<li key={item.label} className="mb-2">
<Link
href={item.href}
className="site-footer-link text-secondary text-sm"
>
{item.label}
</Link>
</li>
))}
</ul>
</div>
);
}
