import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact & Enterprise Support | VyaparMedia",
  description:
    "Connect with the VyaparMedia team for brand partnerships, creator onboarding assistance, escrow verification, and dispute resolution.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact & Support | VyaparMedia",
    description:
      "24/7 dedicated support for creator deals, brand escrow management, and platform verification.",
    url: "/contact",
    type: "website",
  },
};

export default function ContactLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
