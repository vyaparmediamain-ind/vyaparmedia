import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator Economy & Compliance Blog | VyaparMedia",
  description:
    "Expert legal, tax, and strategy guides for Indian creators and brands: Section 194-O TDS compliance, GST invoicing, escrow security, fake engagement audits, and campaign ROI.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Creator Economy & Indian Tax Compliance Blog | VyaparMedia",
    description:
      "Deep dives into TDS Section 194-O, influencer contracts, brand escrow security, and creator growth.",
    url: "/blog",
    type: "website",
  },
};

export default function BlogLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
