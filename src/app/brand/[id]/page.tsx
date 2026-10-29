import { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPublicBrandProfile } from "@/lib/brand-profile";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BrandProfileClient } from "@/components/brand/BrandProfileClient";
import { BackButton } from "@/components/ui/BackButton";
import { safeJsonLd } from "@/lib/json-ld";

export const dynamic = "force-dynamic";

interface PublicBrandPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PublicBrandPageProps): Promise<Metadata> {
  const { id } = await params;
  let targetId = id;
  if (!targetId || targetId === "undefined" || targetId === "null") {
    const session = await auth();
    if (session?.user?.id && session?.user?.userType === "BRAND") {
      targetId = session.user.id;
    }
  }
  const brand = await getPublicBrandProfile(targetId);

  if (!brand) {
    return {
      title: "Brand Not Found | VyaparMedia",
      description: "The requested brand profile could not be found on VyaparMedia.",
    };
  }

  const title = `${brand.companyName} - Verified Brand Profile & Campaigns | VyaparMedia`;
  const description = brand.description
    ? `${brand.description.slice(0, 150)}... Collaborate with ${brand.companyName} with 100% Escrow Protection on VyaparMedia.`
    : `Explore active creator campaigns, verified escrow deals, and reputation for ${brand.companyName} on VyaparMedia. Guaranteed milestone payouts.`;

  return {
    title,
    description,
    keywords: [
      brand.companyName,
      brand.industry || "Marketing",
      "Brand Profile",
      "Influencer Sponsorships",
      "Escrow Creator Deals",
      "Creator Marketplace",
      "India Influencer Campaigns",
    ].filter(Boolean),
    alternates: {
      canonical: `/brand/${encodeURIComponent(targetId)}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/brand/${encodeURIComponent(targetId)}`,
      images: brand.logo ? [{ url: brand.logo, alt: brand.companyName }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: brand.logo ? [brand.logo] : [],
    },
  };
}

export default async function PublicBrandProfilePage({
  params,
}: PublicBrandPageProps) {
  const { id } = await params;
  const session = await auth();

  let targetId = id;
  if (!targetId || targetId === "undefined" || targetId === "null") {
    if (session?.user?.id && session?.user?.userType === "BRAND") {
      targetId = session.user.id;
    }
  }

  const brand = await getPublicBrandProfile(targetId);

  if (!brand) {
    notFound();
  }

  const isOwnProfile =
    session?.user?.id === brand.userId ||
    (session?.user?.userType === "BRAND" && session?.user?.name === brand.companyName);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vyaparmedia-nine.vercel.app";

  // Schema.org structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.companyName,
    url: brand.website || `${baseUrl}/brand/${encodeURIComponent(targetId || id)}`,
    logo: brand.logo || undefined,
    description: brand.description || undefined,
    address: brand.city || brand.state ? {
      "@type": "PostalAddress",
      addressLocality: brand.city || undefined,
      addressRegion: brand.state || undefined,
      addressCountry: "IN",
    } : undefined,
    aggregateRating: brand.totalReviews > 0 ? {
      "@type": "AggregateRating",
      ratingValue: brand.averageRating,
      reviewCount: brand.totalReviews,
      bestRating: "5",
      worstRating: "1",
    } : undefined,
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Public Navigation */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 pt-20 pb-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
          <BackButton />
        </div>

        <BrandProfileClient brand={brand} isOwnProfile={isOwnProfile} />
      </main>

      {/* Public Footer */}
      <Footer />
    </div>
  );
}
