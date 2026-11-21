import type { Metadata } from "next";
import { DEFAULT_BRAND_PLATFORM_FEE_PERCENT } from "@/constants";

export const metadata: Metadata = {
  title: `Pricing & Platform Fees — Free for Creators, ${DEFAULT_BRAND_PLATFORM_FEE_PERCENT}% Escrow for Brands`,
  description:
    `Explore VyaparMedia's transparent pricing: 100% free for creators with zero commission cuts. ${DEFAULT_BRAND_PLATFORM_FEE_PERCENT}% standard milestone escrow fee for brands (down to 8% with referral discounts), 1% lifetime Scout royalties, and automated Section 194-O TDS & GST compliance.`,
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Transparent Creator & Brand Pricing | VyaparMedia",
    description:
      "No hidden fees. Free forever for creators. Automated milestone escrow, up to 2% referral discounts, 1% Scout royalties, and legally binding smart contracts for brands.",
    url: "/pricing",
    type: "website",
  },
};

export default function PricingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
