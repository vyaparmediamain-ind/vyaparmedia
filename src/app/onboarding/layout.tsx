import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile Setup & Verification | VyaparMedia",
  description:
    "Complete your creator or brand profile to unlock smart escrow deal rooms, verified follower analytics, and guaranteed payouts on VyaparMedia.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
