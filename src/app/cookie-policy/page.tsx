"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function CookiePage() {
const lastUpdated = "June 20, 2026";

return (
<div className="flex flex-col min-h-screen">
<Navbar />

<main className="flex-1 pt-20">
<section className="section">
<div className="container max-w-860">
<h1 className="section-title gradient-text mb-3 text-3xl font-extrabold">
Cookie Policy
</h1>
<p className="text-secondary font-semibold mb-10">
Last updated: {lastUpdated}
</p>

<div className="text-secondary grid gap-8 leading-relaxed text-sm">
<section>
<h2 className="terms-heading">1. What cookies do</h2>
<p>
Cookies and similar technologies help VyaparMedia keep users signed in, secure
payments, remember preferences, detect abuse, measure reliability, and improve
the PWA experience. Similar technologies include local storage, session
storage, service worker caches, device identifiers, pixels, SDK storage, and
server logs.
</p>
</section>

<section className="card terms-panel">
<h2 className="terms-heading">2. Types we use</h2>
<ul className="list-disc pl-6 space-y-3">
<li>
<strong>Essential cookies:</strong> authentication, CSRF protection, session
continuity, role-based access, 2FA, OTP verification, and service worker state.
</li>
<li>
<strong>Security cookies:</strong> rate-limit, anti-fraud, device, IP, and
login-risk signals.
</li>
<li>
<strong>Payment cookies:</strong> Razorpay and banking security checks needed
to complete or verify transactions.
</li>
<li>
<strong>Performance cookies:</strong> analytics, error diagnostics, and feature
reliability metrics.
</li>
<li>
<strong>Preference cookies:</strong> remembered settings, UI state, language,
and notification choices.
</li>
<li>
<strong>PWA storage:</strong> cached assets, install state, offline shell
data, notification preferences, and service worker metadata needed for the
installable app experience.
</li>
</ul>
</section>

<section>
<h2 className="terms-heading">3. Your choices</h2>
<p>
You can block or delete cookies in your browser. Essential cookies are required
for login, payments, security, and dashboard access. If you block them, core
platform features may stop working.
</p>
<p>
Non-essential analytics or marketing tools, where enabled, should be used with
the consent controls required by applicable law and provider terms. You can
also reset browser storage or uninstall the PWA to clear local app caches.
</p>
</section>

<section>
<h2 className="terms-heading">4. Third-party cookies</h2>
<p>
Payment, OTP, social-login, KYC, analytics, and support providers may set their
own cookies or local storage when their tools are loaded or used. Their use is
governed by their own privacy and cookie notices in addition to this policy.
</p>
</section>

<section>
<h2 className="terms-heading">5. Contact</h2>
<p>
For cookie or tracking questions, email{" "}
<a href="mailto:privacy@VyaparMedia.in" className="terms-link">privacy@VyaparMedia.in</a>.
</p>
</section>
</div>
</div>
</section>
</main>

<Footer />
</div>
);
}
