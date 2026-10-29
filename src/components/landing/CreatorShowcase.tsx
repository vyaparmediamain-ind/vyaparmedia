"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";

export interface CreatorShowcaseItem {
  id: string;
  name: string;
  username: string;
  niche: string;
  followers: string;
  engagement: string;
  drs: number;
  startingRate: string;
  avatar: string;
  bio: string;
  kycVerified: boolean;
}

interface CreatorShowcaseProps {
  creators?: CreatorShowcaseItem[] | undefined;
  totalCount?: string | undefined;
}

const DEFAULT_CREATORS: CreatorShowcaseItem[] = [
  {
    id: "c1",
    name: "Aarav Tech Creator",
    username: "aarav_tech",
    niche: "Tech",
    followers: "120K+",
    engagement: "4.8%",
    drs: 92,
    startingRate: "₹25,000",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop",
    bio: "Unboxing smartphones, smart home gear & consumer AI gadgets with verified escrow delivery.",
    kycVerified: true,
  },
  {
    id: "c2",
    name: "Ananya Mehta",
    username: "stylewithananya",
    niche: "Fashion",
    followers: "140K+",
    engagement: "5.6%",
    drs: 95,
    startingRate: "₹25,000",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
    bio: "Sustainable luxury styling, ethnic fusion & bridal couture reels with guaranteed delivery.",
    kycVerified: true,
  },
  {
    id: "c3",
    name: "Vikram Malhotra",
    username: "fitwithvikram",
    niche: "Fitness",
    followers: "115K+",
    engagement: "5.1%",
    drs: 89,
    startingRate: "₹28,000",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
    bio: "High-protein nutrition, strength training & sports supplementation campaigns.",
    kycVerified: true,
  },
  {
    id: "c4",
    name: "Pooja Sharma",
    username: "poojafoodvlogs",
    niche: "Food",
    followers: "190K+",
    engagement: "6.4%",
    drs: 94,
    startingRate: "₹18,000",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&auto=format&fit=crop",
    bio: "Street food discoveries, restaurant openings & quick D2C cooking hacks.",
    kycVerified: true,
  },
];

export function CreatorShowcase({ creators, totalCount }: CreatorShowcaseProps) {
  const [activeNiche, setActiveNiche] = useState("All");

  const activeCreators = creators && creators.length > 0 ? creators : DEFAULT_CREATORS;

  // Derive unique niches dynamically from available creators
  const niches = [
    "All",
    ...Array.from(new Set(activeCreators.map((c) => c.niche))).filter(Boolean),
  ];

  const filtered = activeNiche === "All"
    ? activeCreators
    : activeCreators.filter((c) => c.niche === activeNiche);

  return (
    <section className="py-20 relative">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-3 shrink-0 whitespace-nowrap">
              Verified Creator Directory
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
              Work with Top DRS-Rated Creators
            </h2>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Explore KYC-verified creators with certified delivery track records on VyaparMedia.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {niches.map((niche) => (
              <button
                key={niche}
                type="button"
                onClick={() => setActiveNiche(niche)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeNiche === niche
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {niche}
              </button>
            ))}
          </div>
        </div>

        {/* Creator Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.map((creator) => (
            <div
              key={creator.id || creator.username}
              className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between hover:border-primary/50 transition-all shadow-sm hover:shadow-md group"
            >
              <div>
                {/* Header: Avatar + DRS Badge */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-border group-hover:border-primary transition-colors flex-shrink-0 bg-primary/10">
                    {creator.avatar ? (
                      <Image
                        src={creator.avatar}
                        alt={creator.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-lg text-primary">
                        {creator.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {creator.drs}% DRS
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {creator.kycVerified ? "KYC Verified" : "Active Creator"}
                    </span>
                  </div>
                </div>

                {/* Name and Niche */}
                <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                  {creator.name}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  @{creator.username} &bull; <span className="font-semibold text-foreground">{creator.niche}</span>
                </p>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
                  {creator.bio}
                </p>

                {/* Metrics Row */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-muted/40 text-xs mb-4">
                  <div>
                    <span className="block text-[10px] text-muted-foreground">Followers</span>
                    <span className="font-bold text-foreground">{creator.followers}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground">Engagement</span>
                    <span className="font-bold text-verified">{creator.engagement}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer: Starting Price & CTA */}
              <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                <div>
                  <span className="block text-[10px] text-muted-foreground">Starts from</span>
                  <span className="font-bold text-xs sm:text-sm text-foreground">{creator.startingRate}</span>
                </div>
                <Button href={`/creator/${encodeURIComponent(creator.username || creator.id)}`} size="sm" variant="secondary" className="text-xs font-semibold">
                  View Profile
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button href="/register?type=brand" size="lg" className="font-bold">
            Browse All {totalCount ? `${totalCount} Creators` : "Verified Creators"} &rarr;
          </Button>
        </div>
      </div>
    </section>
  );
}
