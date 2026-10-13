"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

const CREATORS = [
  {
    name: "Rohan Sharma",
    username: "techbyrohan",
    niche: "Tech",
    followers: "480K",
    engagement: "4.8%",
    drs: 99,
    startingRate: "₹35,000",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop",
    bio: "Unboxing smartphones, smart home gear & consumer AI gadgets.",
  },
  {
    name: "Ananya Mehta",
    username: "stylewithananya",
    niche: "Fashion",
    followers: "240K",
    engagement: "6.2%",
    drs: 98,
    startingRate: "₹25,000",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
    bio: "Sustainable luxury styling, ethnic fusion & bridal couture reels.",
  },
  {
    name: "Vikram Malhotra",
    username: "fitwithvikram",
    niche: "Fitness",
    followers: "320K",
    engagement: "5.1%",
    drs: 97,
    startingRate: "₹28,000",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
    bio: "High-protein nutrition, strength training & sports supplementation.",
  },
  {
    name: "Pooja Hegde",
    username: "delhifoodchronicles",
    niche: "Food",
    followers: "190K",
    engagement: "7.4%",
    drs: 99,
    startingRate: "₹18,000",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&auto=format&fit=crop",
    bio: "Street food discoveries, restaurant openings & quick D2C cooking hacks.",
  },
];

const NICHES = ["All", "Tech", "Fashion", "Fitness", "Food"];

export function CreatorShowcase() {
  const [activeNiche, setActiveNiche] = useState("All");

  const filtered = activeNiche === "All"
    ? CREATORS
    : CREATORS.filter((c) => c.niche === activeNiche);

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
              Explore KYC-verified creators with certified delivery track records.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {NICHES.map((niche) => (
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
              key={creator.username}
              className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between hover:border-primary/50 transition-all shadow-sm hover:shadow-md group"
            >
              <div>
                {/* Header: Avatar + DRS Badge */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-border group-hover:border-primary transition-colors flex-shrink-0">
                    <Image
                      src={creator.avatar}
                      alt={creator.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-verified-muted text-verified border border-verified-border shrink-0 whitespace-nowrap">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {creator.drs}% DRS
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      KYC Verified
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
                <Link href={`/creator/${creator.username}`}>
                  <Button size="sm" variant="secondary" className="text-xs font-semibold">
                    View Profile
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/register?type=brand">
            <Button size="lg" className="font-bold">
              Browse All 5,400+ Creators &rarr;
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
