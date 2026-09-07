import type { Metadata, Viewport } from "next";
import { Inter, Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
title: "VyaparMedia — Where Brands & Creators Build Trusted Business.",
description:
"VyaparMedia is India's trusted influencer marketplace empowering brands and creators with smart escrow contracts, verified metrics, and guaranteed payouts.",
keywords: [
"VyaparMedia",
"influencer marketing india",
"brand deals",
"creator escrow marketplace",
"verified influencers",
"secure payouts",
],
authors: [{ name: "VyaparMedia" }],
manifest: "/manifest.webmanifest",
appleWebApp: {
capable: true,
title: "VyaparMedia",
statusBarStyle: "black-translucent",
},
formatDetection: {
telephone: false,
},
icons: {
icon: [
{ url: "/icon-192.png", sizes: "192x192", type: "image/png" },
{ url: "/icon-512.png", sizes: "512x512", type: "image/png" },
],
apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
},
openGraph: {
title: "VyaparMedia — Where Brands & Creators Build Trusted Business.",
description:
"Where Brands & Creators Build Trusted Business. Smart escrow contracts, verified audience analytics, and zero-risk collaborations.",
type: "website",
locale: "en_IN",
},
};

export const viewport: Viewport = {
width: "device-width",
initialScale: 1,
viewportFit: "cover",
themeColor: "#070a13",
};

export default function RootLayout({
children,
}: Readonly<{
children: React.ReactNode;
}>) {
return (
<html
  lang="en"
  className={`${inter.variable} ${outfit.variable} ${plusJakartaSans.variable}`}
  data-scroll-behavior="smooth"
>
<head>
<script
  dangerouslySetInnerHTML={{
    __html: `
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.deferredPrompt = e;
        window.dispatchEvent(new CustomEvent('deferredpromptready', { detail: e }));
      });
    `,
  }}
/>
</head>
<body className={inter.className}>
<Providers>{children}</Providers>
</body>
</html>
);
}
