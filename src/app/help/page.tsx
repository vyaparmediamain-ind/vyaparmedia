import React from "react";
import { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HelpCenterClient from "@/components/help/HelpCenterClient";

export const metadata: Metadata = {
  title: "Help Center & FAQ | VyaparMedia Escrow Marketplace",
  description:
    "Get instant answers to all questions regarding VyaparMedia escrow security, milestone approvals, creator rate cards, TDS deductions, and dispute arbitration.",
  keywords: [
    "VyaparMedia FAQ",
    "Influencer Escrow Help",
    "Creator Payout Questions",
    "TDS Section 194-O",
    "Escrow Dispute Resolution",
    "India Creator Rate Card Support",
  ],
  openGraph: {
    title: "Help Center & FAQ | VyaparMedia",
    description:
      "Frequently asked questions on milestone escrow, influencer payments, TDS deductions, and dispute mediation.",
    type: "website",
    url: "/help",
  },
};

export default function HelpPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Public Header Navigation */}
      <Navbar />

      {/* Main Knowledge Base Content */}
      <main className="flex-1 pt-20 pb-16">
        <HelpCenterClient />
      </main>

      {/* Public Footer */}
      <Footer />
    </div>
  );
}
