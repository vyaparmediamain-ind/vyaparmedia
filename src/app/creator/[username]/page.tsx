import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getPublicCreatorProfile } from "@/lib/creator-profile";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { InfluencerProfileClient } from "@/components/profile";
import { MessageService } from "@/services/message.service";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";
import { safeJsonLd } from "@/lib/json-ld";

export const dynamic = "force-dynamic";

interface PublicCreatorPageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({
  params,
}: PublicCreatorPageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicCreatorProfile(username);

  if (!profile) {
    return {
      title: "Creator Not Found | VyaparMedia",
      description: "The requested creator profile could not be found.",
    };
  }

  const handle = profile.instagramHandle ? `@${profile.instagramHandle}` : profile.displayName;
  const title = `${profile.displayName} (${handle}) - Verified Creator Portfolio | VyaparMedia`;
  const description = profile.bio
    ? `${profile.bio.slice(0, 150)}... Hire ${profile.displayName} with 100% Escrow Protection on VyaparMedia.`
    : `View verified rates, campaign deliverables, and engagement stats for ${profile.displayName} on VyaparMedia. Guaranteed on-time delivery & 100% escrow safe.`;

  return {
    title,
    description,
    keywords: [
      profile.displayName,
      profile.instagramHandle || "",
      ...profile.categories,
      "Influencer Marketing",
      "Escrow Creator Collaboration",
      "India Creator Rate Card",
    ].filter(Boolean),
    alternates: {
      canonical: `/creator/${encodeURIComponent(username)}`,
    },
    openGraph: {
      title,
      description,
      type: "profile",
      url: `/creator/${encodeURIComponent(username)}`,
      images: profile.avatar ? [{ url: profile.avatar, alt: profile.displayName }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: profile.avatar ? [profile.avatar] : [],
    },
  };
}

export default async function PublicCreatorProfilePage({
  params,
}: PublicCreatorPageProps) {
  const { username } = await params;
  const [session, profile] = await Promise.all([
    auth(),
    getPublicCreatorProfile(username),
  ]);

  if (!profile) {
    notFound();
  }

  const isOwnProfile = session?.user?.id === profile.userId;
  const viewerRole = session?.user?.userType || null;
  const isAuthenticated = Boolean(session?.user);

  let canMessage = false;
  if (session?.user?.id && profile.userId && !isOwnProfile) {
    canMessage = await MessageService.canMessageUser(session.user.id, profile.userId);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Public Navigation Bar */}
      <Navbar />

      {/* Main Public Profile Content */}
      <main className="flex-1 pt-20 pb-16">
        {/* Schema.org ProfilePage & Person Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd({
              "@context": "https://schema.org",
              "@type": "ProfilePage",
              "mainEntity": {
                "@type": "Person",
                "name": profile.displayName,
                "alternateName": profile.instagramHandle ? `@${profile.instagramHandle}` : undefined,
                "description": profile.bio || undefined,
                "image": profile.avatar || undefined,
                "jobTitle": "Content Creator & Influencer",
                "address": {
                  "@type": "PostalAddress",
                  "addressLocality": profile.city || "New Delhi",
                  "addressCountry": "IN",
                },
                "sameAs": [
                  profile.instagramHandle ? `https://instagram.com/${profile.instagramHandle}` : null,
                  profile.youtubeHandle ? `https://youtube.com/@${profile.youtubeHandle}` : null,
                ].filter(Boolean),
                "knowsAbout": profile.categories,
              },
            }),
          }}
        />

        {/* Breadcrumb Navigation & Back Action */}
        <div className="max-w-4xl mx-auto px-4 mb-3 flex items-center justify-between">
          <BackButton fallbackHref="/dashboard/influencers" label="Back to Discovery" />
        </div>

        {/* Trust & Escrow Guarantee Banner */}
        <div className="max-w-4xl mx-auto px-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border border-border text-xs text-muted-foreground shadow-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-verified shrink-0" />
              <span>
                <strong className="text-foreground">VyaparMedia Verified Profile</strong> • All deals protected with 100% Escrow Security
              </span>
            </div>
            {!isAuthenticated && (
              <div className="flex items-center gap-2">
                <Link
                  href={`/login?callbackUrl=/dashboard/deals/new?influencerId=${profile.id}`}
                  className="font-bold text-primary hover:underline flex items-center gap-1 transition-colors"
                >
                  <span>Send Collab Offer</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Profile Component (Media Kit & Showcase) */}
        <InfluencerProfileClient
          profile={profile}
          viewerRole={viewerRole}
          isOwnProfile={isOwnProfile}
          canMessage={canMessage}
        />
      </main>

      {/* Public Footer */}
      <Footer />
    </div>
  );
}
