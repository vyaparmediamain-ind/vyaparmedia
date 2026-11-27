import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claim Your Invite & Join VyaparMedia — India's Escrow Marketplace",
  description:
    "Join with your invite code for 100% escrow protected deals, 0% creator commission (transparent 7-10% brand fees), instant UPI payouts, and verified DRS™ trust badges.",
  alternates: {
    canonical: "/register",
  },
  openGraph: {
    title: "Claim Your Invite & Join VyaparMedia — India's Escrow Marketplace",
    description:
      "Join with your invite code for 100% escrow protected deals, 0% creator commission (transparent 7-10% brand fees), instant UPI payouts, and verified DRS™ trust badges.",
    url: "/register",
    siteName: "VyaparMedia",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VyaparMedia Creator & Brand Escrow Marketplace",
      },
    ],
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Claim Your Invite & Join VyaparMedia — India's Escrow Marketplace",
    description:
      "Join with your invite code for 100% escrow protected deals, 0% creator commission (transparent 7-10% brand fees), instant UPI payouts, and verified DRS™ trust badges.",
    images: ["/og-image.png"],
  },
};

export default function RegisterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
