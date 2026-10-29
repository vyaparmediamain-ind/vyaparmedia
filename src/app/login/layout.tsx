import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In to Your Workspace | VyaparMedia",
  description:
    "Sign in to your VyaparMedia account to manage active campaigns, verify deliverable proof, and track live escrow balances.",
  alternates: {
    canonical: "/login",
  },
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
