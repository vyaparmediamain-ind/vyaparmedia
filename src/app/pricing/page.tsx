"use client";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui";

type PricingCardProps = {
title: string;
marker: string;
price: string;
subtitle: string;
description: string;
features: string[];
ctaText: string;
ctaLink: string;
tone: "primary" | "cyan";
delay: number;
isPopular?: boolean;
};

type FAQItemProps = {
question: string;
answer: string;
delay: number;
};

export default function PricingPage() {
return (
<div className="min-h-screen bg-primary text-primary">
<Navbar />

<main
className="overflow-hidden relative pt-30 pb-20"
>
<div className="pricing-page max-w-1040 mx-auto">
<div className="pricing-header text-center">
<motion.h1
initial={{ opacity: 0, y: -20 }}
animate={{ opacity: 1, y: 0 }}
className="pricing-title font-extrabold mb-4"
>
Transparent Pricing
</motion.h1>
<motion.p
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
transition={{ delay: 0.1 }}
className="text-secondary text-lg max-w-720 leading-relaxed mx-auto"
>
Join for free. VyaparMedia earns when a protected collaboration is
successfully completed, verified, and paid out.
</motion.p>
</div>

        <div className="pricing-grid grid">
          <PricingCard
            title="For Creators & Influencers"
            marker="CREATOR"
            price="₹0"
            subtitle="Free forever to join & apply"
            description="Create your verified portfolio, discover brand deals, sign smart contracts, and get 100% guaranteed escrow payouts."
            features={[
              "Verified creator profile & social analytics",
              "Unlimited campaign discovery & applications",
              "100% Upfront escrow payment protection",
              "Legally binding digital smart contracts",
              "Instant bank settlements upon verified delivery",
              "Gamified trust badges & DRS reputation scoring",
            ]}
            ctaText="Join as a Creator"
            ctaLink="/register?type=influencer"
            tone="primary"
            delay={0.2}
          />

          <PricingCard
            title="For Brands & Businesses"
            marker="BRAND"
            price="10%"
            subtitle="flat service fee per completed deal"
            description="Run high-ROI influencer marketing with zero risk. Connect with verified creators, lock escrow securely, and approve content with confidence."
            features={[
              "Unlimited campaign creation & briefs",
              "Government KYC & social fraud verification",
              "Automated smart contracts & revision limits",
              "Secure milestone escrow locking (UPI/Card/NetBanking)",
              "Live post link tracking & engagement metrics",
              "GST-compliant automated invoicing & TDS summaries",
            ]}
            ctaText="Start Brand Campaign"
            ctaLink="/register?type=brand"
            tone="cyan"
            delay={0.3}
            isPopular
          />
        </div>

        <section className="pricing-faq mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-bold text-3xl">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            <FAQItem
              question="Are there any monthly subscription or upfront listing fees?"
              answer="No. Both brands and creators can join and create profiles completely free. There are no recurring monthly charges — fees only apply when an active collaboration is successfully run through VyaparMedia's protected escrow workflow."
              delay={0.4}
            />
            <FAQItem
              question="How does Escrow Payment Protection work?"
              answer="When a brand hires a creator, the agreed campaign budget is deposited into a secure escrow vault. The funds are held safely during content production and are only released to the creator once the brand reviews and approves the deliverable."
              delay={0.5}
            />
            <FAQItem
              question="How are Indian taxes (GST & TDS) handled on VyaparMedia?"
              answer="VyaparMedia is built for Indian business compliance. The platform automatically calculates and separates GST (18%) and Section 194R/194C TDS deductions on deal settlement, providing downloadable tax invoices and TDS statements for your chartered accountant."
              delay={0.6}
            />
            <FAQItem
              question="What happens if a creator fails to deliver or misses the deadline?"
              answer="If a creator fails to submit the agreed content within the contract deadline, or if deliverables do not match the signed brief, the dispute resolution protocol activates. If unfulfilled, escrow funds are safely refunded back to the brand's wallet."
              delay={0.7}
            />
            <FAQItem
              question="When do creators receive their payouts?"
              answer="As soon as the brand approves the final post and automated link verification confirms it is live, escrow funds are instantly credited to the creator's platform wallet and can be withdrawn directly to any verified Indian bank account via IMPS/NEFT."
              delay={0.8}
            />
          </div>
        </section>

<div
className="pricing-contact text-center"
>
<p
className="text-secondary mb-4"
>
Need a custom workflow, enterprise controls, or compliance review?
</p>
<Link
href="/contact"
className="text-primary font-bold no-underline"
>
Contact support
</Link>
</div>
</div>
</main>

<Footer />
</div>
);
}

function PricingCard({
title,
marker,
price,
subtitle,
description,
features,
ctaText,
ctaLink,
tone,
delay,
isPopular,
}: Readonly<PricingCardProps>) {
return (
<motion.article
initial={{ opacity: 0, y: 30 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay, duration: 0.5 }}
className="pricing-card relative overflow-hidden flex flex-col rounded-2xl"
data-tone={tone}
data-popular={Boolean(isPopular)}
>
{isPopular && (
<div
className="pricing-popular-ribbon absolute font-extrabold text-xs uppercase tracking-normal"
>
Most Popular
</div>
)}

<div className="mb-6">
<div
aria-hidden="true"
className="pricing-marker flex items-center justify-center text-lg mb-5 font-extrabold"
>
{marker}
</div>
<h3 className="text-2xl font-extrabold mb-2">
{title}
</h3>
<p
className="text-secondary text-sm leading-relaxed"
>
{description}
</p>
</div>

<div
className="text-center p-5 bg-tertiary rounded-xl border-card mb-7-5"
>
<div
className="pricing-price font-extrabold text-primary"
>
{price}
</div>
<div
className="text-xs font-bold text-secondary uppercase tracking-normal"
>
{subtitle}
</div>
</div>

<ul
className="flex-1 flex flex-col gap-3 p-0 list-none mb-7-5"
>
{features.map((feature) => (
<li
key={feature}
className="pricing-feature flex items-start gap-3 text-sm text-secondary"
>
<svg
aria-hidden="true"
className="pricing-feature-icon flex-shrink-0"
fill="none"
stroke="currentColor"
strokeWidth="3"
viewBox="0 0 24 24"
>
<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
</svg>
{feature}
</li>
))}
</ul>

<Link href={ctaLink} className="w-full">
<Button
className="pricing-card-cta w-full p-4 text-base font-bold cursor-pointer"
data-popular={Boolean(isPopular)}
data-tone={tone}
>
{ctaText}
</Button>
</Link>
</motion.article>
);
}

function FAQItem({ question, answer, delay }: Readonly<FAQItemProps>) {
return (
<motion.div
initial={{ opacity: 0, x: -20 }}
animate={{ opacity: 1, x: 0 }}
transition={{ delay }}
className="overflow-hidden bg-secondary rounded-xl border-card"
>
<details className="cursor-pointer group">
<summary
className="font-semibold flex justify-between items-center gap-4 p-5 list-none"
>
<span>{question}</span>
<svg
aria-hidden="true"
className="faq-chevron group-open:rotate-180"
fill="none"
stroke="currentColor"
strokeWidth="3"
viewBox="0 0 24 24"
>
<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
</svg>
</summary>
<div
className="faq-answer text-secondary text-sm leading-1-6"
>
{answer}
</div>
</details>
</motion.div>
);
}
