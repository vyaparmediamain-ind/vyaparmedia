import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal & Regulatory Hub",
  description:
    "Comprehensive legal framework, DPDP compliance, escrow safety mechanisms, Section 194-O TDS documentation, and dispute adjudication guidelines on VyaparMedia.",
  alternates: {
    canonical: "/legal",
  },
  openGraph: {
    title: "Legal & Regulatory Hub | VyaparMedia",
    description:
      "Statutory compliance, Terms of Service, Privacy Policy, and Escrow legal infrastructure for Indian creators and brands.",
    url: "/legal",
    type: "website",
  },
};

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
