import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
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

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vyaparmedia-nine.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "VyaparMedia — India's Premier Influencer Marketplace & Escrow Platform",
    template: "%s | VyaparMedia",
  },
  description:
    "VyaparMedia is India's most trusted influencer marketplace empowering brands and creators with 100% upfront escrow protection, verified audience metrics, automated Section 194-O TDS compliance, and guaranteed payouts.",
  keywords: [
    "VyaparMedia",
    "influencer marketing india",
    "creator escrow marketplace",
    "brand deals india",
    "verified influencers",
    "secure creator payouts",
    "TDS Section 194-O compliance",
    "smart contract deliverables",
    "micro influencer platform",
    "D2C brand collaborations",
    "DRS trust score",
    "guaranteed creator payouts",
  ],
  authors: [{ name: "VyaparMedia" }],
  creator: "VyaparMedia",
  publisher: "VyaparMedia",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "VyaparMedia",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "VyaparMedia — India's Premier Influencer Marketplace & Escrow Platform",
    description:
      "Where Brands & Creators Build Trusted Business. Smart escrow contracts, verified audience analytics, automated Indian tax compliance, and zero-risk collaborations.",
    url: siteUrl,
    siteName: "VyaparMedia",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "VyaparMedia Influencer & Escrow Marketplace",
      },
    ],
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "VyaparMedia — India's Premier Influencer Marketplace & Escrow Platform",
    description:
      "Scale brand deals with 100% escrow protection, verified DRS™ trust scores, and instant bank payouts.",
    images: ["/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
width: "device-width",
initialScale: 1,
viewportFit: "cover",
themeColor: "#070a13",
};

export default async function RootLayout({
children,
}: Readonly<{
children: React.ReactNode;
}>) {
const headersList = await headers();
const nonce = headersList.get("x-nonce") || undefined;

return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${outfit.variable} ${plusJakartaSans.variable}`}
      data-scroll-behavior="smooth"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${siteUrl}/#organization`,
                  "name": "VyaparMedia",
                  "url": siteUrl,
                  "logo": {
                    "@type": "ImageObject",
                    "url": `${siteUrl}/icon-512.png`,
                    "width": 512,
                    "height": 512,
                  },
                  "description":
                    "India's premier influencer marketplace with smart escrow contracts, verified metrics, and guaranteed payouts.",
                  "sameAs": [
                    "https://instagram.com/vyaparmedia",
                    "https://twitter.com/vyaparmedia",
                    "https://linkedin.com/company/vyaparmedia",
                  ],
                  "contactPoint": {
                    "@type": "ContactPoint",
                    "contactType": "Customer Support",
                    "email": "support@vyaparmedia.in",
                    "availableLanguage": ["English", "Hindi"],
                  },
                },
                {
                  "@type": "WebSite",
                  "@id": `${siteUrl}/#website`,
                  "url": siteUrl,
                  "name": "VyaparMedia",
                  "publisher": {
                    "@id": `${siteUrl}/#organization`,
                  },
                  "inLanguage": "en-IN",
                },
                {
                  "@type": "SoftwareApplication",
                  "@id": `${siteUrl}/#software`,
                  "name": "VyaparMedia Creator Escrow Marketplace",
                  "applicationCategory": "BusinessApplication",
                  "operatingSystem": "Web, iOS, Android (PWA)",
                  "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "INR",
                  },
                },
              ],
            }),
          }}
        />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('beforeinstallprompt', (e) => {
                window.deferredPrompt = e;
                window.dispatchEvent(new CustomEvent('deferredpromptready', { detail: e }));
              });
            `,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
);
}
