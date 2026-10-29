"use client";

import Link from "next/link";
import Logo from "./Logo";
import { PLATFORM_CONFIG } from "@/lib/platform-config";

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
  {
    label: "X (Twitter)",
    href: "https://twitter.com",
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://instagram.com",
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://youtube.com",
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com",
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c.96 0 1.74-.78 1.74-1.74a1.74 1.74 0 0 0-3.48 0c0 .96.78 1.74 1.74 1.74m1.39 9.74v-8.37H5.07v8.37h2.78z"/>
      </svg>
    ),
  },
];

export function Footer() {
  return (
    <footer className="site-footer bg-secondary border-t border-card">
      <div className="container">
        <div className="site-footer-grid grid mb-10 grid-auto-180">
          <div>
            <Logo />
            <p className="site-footer-copy text-muted-foreground text-sm leading-relaxed mt-3">
              VyaparMedia helps Indian brands and influencers run trusted
              collaborations with verified profiles, protected payments, and
              clearer delivery workflows.
            </p>
            <div className="flex gap-2.5 mt-5">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="site-social-link flex items-center justify-center cursor-pointer rounded-lg bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors w-9 h-9 aspect-square"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          <FooterColumn title="Platform" links={platformLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
        </div>

        <div className="divider" />

        <div className="flex justify-between items-center flex-wrap gap-3">
          <p className="text-muted-foreground text-sm">
            © 2026 VyaparMedia Technologies Pvt Ltd. All rights reserved.
          </p>
          <p className="text-muted-foreground text-xs">
            CIN: {PLATFORM_CONFIG.cin} • Registered Office: {PLATFORM_CONFIG.address}
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
      <h3 className="font-bold mb-4 text-xs uppercase tracking-wider text-foreground">
        {title}
      </h3>
      <ul className="p-0 list-none">
        {links.map((item) => (
          <li key={item.label} className="mb-2">
            <Link
              href={item.href}
              className="site-footer-link text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Footer;
