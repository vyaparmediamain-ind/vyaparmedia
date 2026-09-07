"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const values = [
  {
    label: "Guaranteed Escrow Safety",
    title: "Protected Capital & Guaranteed Payouts",
    description:
      "Campaign budgets are secured upfront in escrow and released upon verified deliverable approval. Zero risk of non-payment or advance fraud.",
  },
  {
    label: "Institutional Trust & KYC",
    title: "100% Verified Businesses & Creators",
    description:
      "Government DigiLocker KYC, PAN/GSTIN validations, and live social API metrics ensure transparent, high-ROI business relationships.",
  },
  {
    label: "Operational Precision",
    title: "Smart Contracts & Tax Compliance",
    description:
      "Legally binding digital agreements with clear briefs, commercial rights, revision limits, and automated TDS/GST reporting built in.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 pt-20">
        <section className="section bg-secondary">
          <div className="container text-center max-w-840">
            <h1 className="section-title">
              Where Indian Brands & Creators Build <span className="gradient-text">Trusted Business</span>
            </h1>
            <p className="section-subtitle">
              VyaparMedia is India&apos;s premier influencer commerce and escrow marketplace — built to turn viral reach into sustainable, verified business growth.
            </p>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="grid-2 items-center gap-48px">
              <div>
                <h2 className="font-extrabold mb-5 text-3xl">
                  Why VyaparMedia Exists
                </h2>
                <p className="text-secondary mb-4 leading-relaxed">
                  In India&apos;s fast-growing creator economy, collaborations often break down because the foundation is fragmented: unverified reach, delayed payments, broken promises, tax ambiguity, and lack of legal protection.
                </p>
                <p className="text-secondary mb-4 leading-relaxed">
                  VyaparMedia brings institutional trust to every deal. Brands can discover authentic creators, fund escrow-backed campaigns, sign smart contracts, and track verified delivery. Creators gain financial dignity with transparent rate cards, protected escrow, and instant bank payouts.
                </p>
              </div>
              <div className="about-visual-panel">
                <div className="max-w-340">
                  <div className="text-sm font-extrabold mb-3 text-primary-light uppercase">
                    The VyaparMedia Standard
                  </div>
                  <h3 className="mb-4 text-3xl leading-1-2">
                    Brief. Escrow. Verify. Settle.
                  </h3>
                  <p className="text-secondary leading-relaxed">
                    Every collaboration creates an immutable audit trail: approved deliverables, live link tracking, transparent invoicing, and automated tax accounting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section bg-secondary">
          <div className="container">
            <h2 className="section-title">What We Stand For</h2>
            <div className="grid-3">
              {values.map((item) => (
                <article key={item.title} className="card hover-lift">
                  <div className="text-xs font-extrabold mb-3 text-primary-light uppercase">
                    {item.label}
                  </div>
                  <h3 className="text-xl font-extrabold mb-2">
                    {item.title}
                  </h3>
                  <p className="text-secondary leading-relaxed text-sm">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

