"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Logo from "./Logo";
import { Button } from "@/components/ui";

const primaryLinks = [
{ label: "Features", href: "/#features" },
{ label: "How it Works", href: "/#how-it-works" },
{ label: "Pricing", href: "/pricing" },
];

const mobileLinks = [
...primaryLinks,
{ label: "About", href: "/about" },
{ label: "Blog", href: "/blog" },
{ label: "Contact", href: "/contact" },
];

export default function Navbar() {
const [isScrolled, setIsScrolled] = useState(false);
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

useEffect(() => {
const handleScroll = () => setIsScrolled(window.scrollY > 20);
window.addEventListener("scroll", handleScroll, { passive: true });
return () => window.removeEventListener("scroll", handleScroll);
}, []);

useEffect(() => {
document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
return () => {
document.body.style.overflow = "";
};
}, [isMobileMenuOpen]);

const closeMobile = useCallback(() => setIsMobileMenuOpen(false), []);

return (
<>
<nav className={`navbar glass ${isScrolled ? "navbar-scrolled" : ""}`}>
<div
className="container flex items-center justify-between"
>
<Logo />

<div className="nav-links">
{primaryLinks.map((link) => (
<Link
key={link.label}
href={link.href}
className="nav-link btn-ghost text-sm"
>
{link.label}
</Link>
))}
</div>

<div className="nav-auth-buttons">
<Button href="/login" variant="secondary" size="sm">Login</Button>
<Button href="/register" variant="primary" size="sm">Get Started</Button>
</div>

<button
className={`hamburger ${isMobileMenuOpen ? "active" : ""}`}
onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
aria-label="Toggle menu"
aria-expanded={isMobileMenuOpen}
type="button"
>
<span />
<span />
<span />
</button>
</div>
</nav>

<div
  role="none"
  className={`mobile-nav-overlay ${isMobileMenuOpen ? "active" : ""}`}
  onClick={closeMobile}
/>

<div className={`mobile-nav ${isMobileMenuOpen ? "active" : ""}`}>
{mobileLinks.map((link) => (
<Link key={link.href} href={link.href} onClick={closeMobile}>
{link.label}
</Link>
))}

<div className="mobile-auth">
<Button
href="/login"
variant="secondary"
className="text-center justify-center w-full"
onClick={closeMobile}
>
Login
</Button>
<Button
href="/register"
variant="primary"
className="text-center justify-center w-full"
onClick={closeMobile}
>
Get Started Free
</Button>
</div>
</div>
</>
);
}
