"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import type { Session } from "next-auth";
import DashboardShell from "@/components/dashboard/DashboardShell";

interface InfluencerProfile {
id: string;
userId: string;
displayName: string;
bio: string | null;
avatar: string | null;
city: string | null;
state: string | null;
instagramHandle: string | null;
instagramFollowers: number | null;
instagramEngagementRate: number | null;
youtubeHandle: string | null;
youtubeSubscribers: number | null;
youtubeEngagementRate: number | null;
categories: string;
languages: string;
minRate: number | null;
maxRate: number | null;
trustScore: number;
totalCompletedDeals: number;
averageRating: number;
isFeatured?: boolean;
}

interface ViewerWallet {
balance: number;
availableBalance: number;
}

interface InfluencerDetailResponse {
influencer?: InfluencerProfile;
viewerWallet?: ViewerWallet;
}

function getYoutubeSubsLabel(subscribers: number | null): string {
if (subscribers === -1) return "Hidden";
if (subscribers) return subscribers.toLocaleString("en-IN");
return "N/A";
}

function getBudgetNotice(canAfford: boolean, minRate: number | null) {
if (!canAfford) {
return {
text: "Your wallet balance is lower than this creator's minimum rate. Consider depositing funds before initiating a deal.",
tone: "danger" as const,
};
}
if (minRate) {
return {
text: `Your wallet balance covers this creator's minimum rate (Rs ${(minRate / 100).toLocaleString("en-IN")}).`,
tone: "success" as const,
};
}
return null;
}

interface InfluencerProfileLayoutProps {
  readonly profile: InfluencerProfile;
  readonly wallet: ViewerWallet | null;
  readonly session: Session | null;
  readonly id: string;
}

function InfluencerProfileLayout({ profile, wallet, session, id }: InfluencerProfileLayoutProps) {
  const availableBalanceStr = wallet
    ? `${(wallet.availableBalance / 100).toLocaleString("en-IN")}`
    : "0";
  const minRateStr = profile.minRate
    ? `${(profile.minRate / 100).toLocaleString("en-IN")}`
    : "Negotiable";

  const canAfford =
    !profile.minRate || (wallet && wallet.availableBalance >= profile.minRate);
  const isBrandOrIndividual = session?.user?.userType === "BRAND";

  const youtubeSubsLabel = getYoutubeSubsLabel(profile.youtubeSubscribers);
  const budgetNotice = getBudgetNotice(Boolean(canAfford), profile.minRate);
  const budgetNoticeText = budgetNotice?.text || "";
  const budgetNoticeTone = budgetNotice?.tone || "success";

  return (
    <DashboardShell user={session?.user}>
      <div className="flex flex-col gap-6 max-w-900 mx-auto">
        {/* Header / Bio */}
        <div className="card flex gap-6 flex-wrap p-8">
          <div className="relative flex items-center justify-center font-extrabold flex-shrink-0 rounded-full text-3xl bg-gradient-primary text-white influencer-avatar overflow-hidden shadow-lg" style={{ width: 80, height: 80 }}>
            {profile.avatar ? (
              <Image
                src={profile.avatar}
                alt={profile.displayName || "Influencer Avatar"}
                fill
                unoptimized
                className="object-cover rounded-full"
              />
            ) : (
              profile.displayName?.[0] || "I"
            )}
          </div>
          <div className="flex-1 influencer-header-copy">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="font-extrabold text-3xl influencer-title">
                  {profile.displayName}
                </h1>
                <div className="text-sm text-secondary mb-3">
                  {profile.city
                    ? ` ${profile.city}, ${profile.state || ""}`
                    : " Global Creator"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-extrabold text-primary">
                  {profile.trustScore}%
                </div>
                <div className="text-muted text-xs uppercase influencer-metric-label">
                  Trust Score
                </div>
              </div>
            </div>

            <p className="mb-5 text-sm text-primary leading-relaxed">
              {profile.bio || "This creator hasn't added a bio yet."}
            </p>

            <div className="flex gap-2 flex-wrap">
              {profile.isFeatured && (
                <span className="text-xs font-extrabold inline-flex items-center gap-1 text-amber rounded-xl uppercase px-2 py-1 bg-amber-15 influencer-featured-chip">
                  Featured Creator
                </span>
              )}
              {profile.categories.split(",").map((cat) => (
                <span
                  key={cat}
                  className="text-xs font-semibold bg-tertiary rounded-xl px-2 py-1"
                >
                  #{cat.trim()}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 influencer-detail-grid">
          {/* Stats */}
          <div className="card stagger-children p-6">
            <h3 className="text-base font-bold mb-5">Audience Reach</h3>

            <div className="flex justify-between border-b border-card mb-4 pb-4">
              <div>
                <div className="text-sm text-secondary">Instagram Followers</div>
                <div className="text-xl font-bold">
                  {profile.instagramFollowers
                    ? profile.instagramFollowers.toLocaleString("en-IN")
                    : "N/A"}
                </div>
                {profile.instagramHandle && (
                  <div className="text-xs text-primary">
                    @{profile.instagramHandle}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-secondary">Engagement</div>
                <div className="text-base font-semibold text-emerald">
                  {profile.instagramEngagementRate
                    ? `${profile.instagramEngagementRate}%`
                    : "N/A"}
                </div>
              </div>
            </div>

            <div className="flex justify-between border-b border-card mb-4 pb-4">
              <div>
                <div className="text-sm text-secondary">YouTube Subs</div>
                <div className="text-xl font-bold">{youtubeSubsLabel}</div>
                {profile.youtubeHandle && (
                  <div className="text-xs text-rose">
                    {profile.youtubeHandle}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-secondary">Engagement</div>
                <div className="text-base font-semibold text-emerald">
                  {profile.youtubeEngagementRate
                    ? `${profile.youtubeEngagementRate}%`
                    : "N/A"}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <div>
                <div className="text-sm text-secondary">Completed Deals</div>
                <div className="text-xl font-bold">
                  {profile.totalCompletedDeals}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-secondary">Rating</div>
                <div className="text-lg font-bold">
                  {profile.averageRating > 0
                    ? ` ${profile.averageRating.toFixed(1)}`
                    : "No reviews"}
                </div>
              </div>
            </div>
          </div>

          {/* Invite & Budget Check */}
          <div className="card p-6 bg-secondary border-card">
            <h3 className="text-base font-bold mb-5">Work Together</h3>

            <div className="p-4 mb-6 rounded-md bg-primary">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-secondary">Estimated Rate / Post</span>
                <span className="text-base font-extrabold">{minRateStr}</span>
              </div>
              {profile.maxRate && (
                <div className="flex justify-between pt-2 influencer-rate-divider">
                  <span className="text-sm text-secondary">Premium Service Code</span>
                  <span className="text-sm font-semibold">
                    Up to {(profile.maxRate / 100).toLocaleString("en-IN")}
                  </span>
                </div>
              )}
            </div>

            {isBrandOrIndividual && wallet && (
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-secondary">Your Available Balance</span>
                  <span
                    className="text-sm font-bold influencer-balance"
                    data-afford={canAfford ? "true" : "false"}
                  >
                    {availableBalanceStr}
                  </span>
                </div>

                {budgetNoticeText && (
                  <div className="influencer-budget-notice" data-tone={budgetNoticeTone}>
                    {budgetNoticeText}
                  </div>
                )}
              </div>
            )}

            {isBrandOrIndividual ? (
              <div className="flex flex-col gap-3">
                <Link
                  href={`/dashboard/campaigns/create?invite=${profile?.id || id}`}
                  className="btn btn-primary text-center text-sm no-underline p-3.5"
                >
                  Create Campaign & Invite
                </Link>

                {!canAfford && (
                  <Link
                    href="/dashboard/wallet"
                    className="block text-center text-sm text-primary font-semibold no-underline"
                  >
                    Deposit to Wallet
                  </Link>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-secondary bg-tertiary rounded-md">
                Log in as a Brand to invite this creator to campaigns.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function InfluencerProfilePage() {
  const { data: session } = useSession();
  const params = useParams();
  const id = params?.id as string;

  const { data, isLoading: loading } = useSWR<InfluencerDetailResponse>(
    id ? `/api/influencers/${id}` : null,
    fetcher
  );

  const profile = data?.influencer || null;
  const wallet = data?.viewerWallet || null;

  if (loading) {
    return (
      <div className="text-center p-10">
        Loading profile...
      </div>
    );
  }
  if (!session) {
    return (
      <div className="text-center p-10">
        Loading session...
      </div>
    );
  }
  if (session.user?.userType !== "BRAND" && session.user?.userType !== "ADMIN") {
    return (
      <DashboardShell user={session.user}>
        <div className="card text-center max-w-680 influencer-access-card">
          <h1 className="text-2xl font-extrabold mb-2">
            Brand access required
          </h1>
          <p className="text-secondary mb-5">
            Creator profiles are available for brand campaign planning.
          </p>
          <Link href="/dashboard/campaigns" className="btn btn-primary">
            Browse Campaigns
          </Link>
        </div>
      </DashboardShell>
    );
  }
  if (!profile) {
    return (
      <DashboardShell user={session.user}>
        <div className="text-center p-10">
          Influencer not found.
        </div>
      </DashboardShell>
    );
  }

  return (
    <InfluencerProfileLayout
      profile={profile}
      wallet={wallet}
      session={session}
      id={id}
    />
  );
}
