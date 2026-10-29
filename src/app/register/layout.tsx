import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Your Free Account — Join as Creator or Brand | VyaparMedia",
  description:
    "Join VyaparMedia today. Protect collaborations with automated escrow, verified audience analytics, DigiLocker KYC, and guaranteed on-time bank settlements.",
  alternates: {
    canonical: "/register",
  },
};

export default function RegisterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
