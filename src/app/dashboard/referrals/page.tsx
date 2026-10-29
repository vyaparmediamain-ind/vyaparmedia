"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useSession } from "next-auth/react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import ReferralList from "@/components/dashboard/referrals/ReferralList";
import { Button, Modal, Skeleton, PageContainer, PageHeader } from "@/components/ui";
import { copyToClipboard } from "@/lib/clipboard";
import { formatCurrency } from "@/lib/utils-client";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  Users,
  Gift,
  Crown,
  Copy,
  CheckCheck,
  Share2,
  Zap,
  TrendingUp,
  Smartphone,
} from "lucide-react";
import StoryShareModal from "@/components/share/StoryShareModal";

interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  tier: {
    name: string;
    label: string;
    feeDiscount: number;
    revenueShare: number;
    min: number;
    commission: number;
  };
  nextTier?: { min: number };
  earnings: number;
  referralCode: string;
}

/* ─────────────────────────── Share Modal ─────────────────────────────────── */

interface ShareModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly referralCode: string;
  readonly referralLink: string;
  readonly onOpenStory?: () => void;
}

function ShareModal({ open, onClose, referralCode, referralLink, onOpenStory }: ShareModalProps) {
  const [linkCopied, setLinkCopied] = useState(false);

  const shareText = `Join me on VyaparMedia — India's most trusted influencer-brand deal platform! Use my referral code ${referralCode} and get started. `;

  const handleCopyLink = useCallback(async () => {
    await copyToClipboard(referralLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  }, [referralLink]);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join VyaparMedia", text: shareText, url: referralLink });
      } catch {
        // user cancelled — no-op
      }
    }
  }, [shareText, referralLink]);

  const whatsappText = shareText + "\n" + referralLink;

  const channels = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      emoji: "💬",
      href: `https://wa.me/?text=${encodeURIComponent(whatsappText)}`,
      style: "bg-verified-muted border-verified-border text-verified hover:bg-verified/20",
    },
    {
      id: "facebook",
      label: "Facebook",
      emoji: "f",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}&quote=${encodeURIComponent(shareText)}`,
      style: "bg-escrow-muted border-escrow-border text-escrow hover:bg-escrow/20",
    },
    {
      id: "telegram",
      label: "Telegram",
      emoji: "✈️",
      href: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`,
      style: "bg-primary/10 border-primary/25 text-primary hover:bg-primary/20",
    },
    {
      id: "twitter",
      label: "X (Twitter)",
      emoji: "✕",
      href: `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(referralLink)}`,
      style: "bg-muted border-border text-foreground hover:bg-muted/80",
    },
    {
      id: "threads",
      label: "Threads",
      emoji: "🧵",
      href: `https://www.threads.net/intent/post?text=${encodeURIComponent(shareText + " " + referralLink)}`,
      style: "bg-muted border-border text-foreground hover:bg-muted/80",
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      emoji: "in",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`,
      style: "bg-escrow-muted border-escrow-border text-escrow hover:bg-escrow/20",
    },
    {
      id: "reddit",
      label: "Reddit",
      emoji: "🤖",
      href: `https://reddit.com/submit?url=${encodeURIComponent(referralLink)}&title=${encodeURIComponent(shareText)}`,
      style: "bg-muted border-border text-foreground hover:bg-muted/80",
    },
  ] as const;

  return (
    <Modal open={open} onClose={onClose} title="Invite Your Network" maxWidth="520px">
      <div className="space-y-5">
        <p className="text-xs text-muted-foreground -mt-2">
          Share your referral link with brands &amp; creators to earn commission.
        </p>

        {/* Instagram & WhatsApp Story Banner */}
        {onOpenStory && (
          <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Instagram &amp; WhatsApp Story</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                9:16 vertical card with invite QR &amp; link sticker
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                onOpenStory();
              }}
              className="shrink-0 text-xs font-bold"
            >
              Open Story Card
            </Button>
          </div>
        )}

        {/* Referral link box */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
              Your Referral Link
            </div>
            <div className="text-sm font-mono text-foreground truncate">{referralLink}</div>
          </div>
          <Button
            variant={linkCopied ? "secondary" : "primary"}
            size="sm"
            onClick={handleCopyLink}
            aria-label="Copy referral link"
            className="shrink-0 gap-1.5 text-xs font-bold"
          >
            {linkCopied ? (
              <>
                <CheckCheck className="w-3.5 h-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </Button>
        </div>

        {/* Share channels */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {channels.map((ch) => (
            <a
              key={ch.id}
              href={ch.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center text-xs font-semibold transition-all hover:-translate-y-0.5 ${ch.style}`}
            >
              <span className="text-lg leading-none">{ch.emoji}</span>
              <span className="whitespace-nowrap">{ch.label}</span>
            </a>
          ))}
        </div>

        {/* Native share (mobile) */}
        {typeof navigator !== "undefined" && "share" in navigator && (
          <Button
            variant="secondary"
            className="w-full gap-2 text-sm font-bold"
            onClick={handleNativeShare}
          >
            <Share2 className="w-4 h-4" />
            Share via Device
          </Button>
        )}
      </div>
    </Modal>
  );
}

/* ─────────────────────────── Tier definition ─────────────────────────────── */

const TIERS = [
  { name: "BRONZE",   label: "Bronze",   min: 10,   reward: "1%",      accent: "border-pending-border  bg-pending-muted  text-pending"  },
  { name: "SILVER",   label: "Silver",   min: 50,   reward: "1.5%",    accent: "border-border          bg-muted          text-muted-foreground" },
  { name: "GOLD",     label: "Gold",     min: 100,  reward: "2%",      accent: "border-pending-border  bg-pending-muted  text-pending"  },
  { name: "PLATINUM", label: "Platinum", min: 500,  reward: "1% GMV",  accent: "border-escrow-border   bg-escrow-muted   text-escrow"   },
  { name: "DIAMOND",  label: "Diamond",  min: 1000, reward: "2% GMV",  accent: "border-verified-border bg-verified-muted text-verified" },
] as const;

/* ─────────────────────────── Main Page ──────────────────────────────────── */

export default function ReferralsPage() {
  const { data: session } = useSession();
  const shouldReduceMotion = useReducedMotion();
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");

  const { data: stats, isLoading: loading } = useSWR<ReferralStats>(
    "/api/gamification/referrals",
    fetcher
  );

  const [origin, setOrigin] = useState("https://vyaparmedia.in");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const referralLink = stats?.referralCode
    ? `${origin}/register?ref=${stats.referralCode}`
    : "";

  const copyCode = useCallback(() => {
    if (stats?.referralCode) {
      copyToClipboard(stats.referralCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  }, [stats]);

  const copyLink = useCallback(() => {
    if (referralLink) {
      copyToClipboard(referralLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }, [referralLink]);

  /* Loading skeleton */
  if (loading || !session) {
    return (
      <DashboardShell user={session?.user}>
        <PageContainer maxWidth="5xl" className="space-y-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      </DashboardShell>
    );
  }

  if (!stats?.tier) {
    return (
      <DashboardShell user={session.user}>
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Gift className="w-10 h-10 text-muted-foreground" />
          <p className="text-base font-semibold text-foreground">Referral data unavailable</p>
          <p className="text-sm text-muted-foreground">Unable to load referral data at this time.</p>
        </div>
      </DashboardShell>
    );
  }

  const nextTierMin = stats.tier.name === "DIAMOND" ? 1000 : (stats.nextTier?.min ?? 10);
  const progress = Math.min((stats.activeReferrals / nextTierMin) * 100, 100);

  return (
    <DashboardShell user={session.user}>
      <PageContainer maxWidth="5xl" className="space-y-6 pt-4 pb-0 sm:py-6">

        {/* ── Page Header ── */}
        <PageHeader
          title="Partner Network"
          icon={
            <div className="w-10 h-10 rounded-xl bg-pending/10 border border-pending-border flex items-center justify-center">
              <Gift className="w-5 h-5 text-pending" />
            </div>
          }
          subtitle="Expand the VyaparMedia ecosystem and build lifetime passive rewards"
          actions={
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                TIERS.find((t) => t.name === stats.tier.name)?.accent ?? "bg-muted border-border text-muted-foreground"
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              {stats.tier.label} Partner
            </span>
          }
          border={false}
        />

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: <Users className="w-5 h-5 text-escrow" />,
              label: "Active Partners",
              value: String(stats.activeReferrals),
              bg: "bg-escrow/10 border-escrow-border",
            },
            {
              icon: <Zap className="w-5 h-5 text-pending" />,
              label: stats.tier.revenueShare > 0 ? "Revenue Share" : "Fee Discount",
              value: stats.tier.revenueShare > 0
                ? `${(stats.tier.revenueShare * 100).toFixed(1).replace(/\.0$/, "")}% GMV`
                : `${stats.tier.feeDiscount}%`,
              bg: "bg-pending/10 border-pending-border",
            },
            {
              icon: <TrendingUp className="w-5 h-5 text-verified" />,
              label: "Total Earnings",
              value: formatCurrency(stats.earnings || 0),
              bg: "bg-verified/10 border-verified-border",
            },
          ].map((kpi, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { delay: i * 0.08 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border shadow-sm"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${kpi.bg}`}>
                {kpi.icon}
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                <p className="text-2xl font-extrabold text-foreground tabular-nums leading-tight">
                  {kpi.value}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Tab Toggle ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(
            [
              { key: "overview", label: "Overview" },
              {
                key: "history",
                label: `Referral History${stats.totalReferrals > 0 ? ` (${stats.totalReferrals})` : ""}`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 border ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">
          {activeTab === "overview" ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: shouldReduceMotion ? 0 : 16 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
              className="space-y-6"
            >
              {/* ── Referral Code Card (CRED-style) ── */}
              <div className="relative overflow-hidden rounded-2xl bg-card border border-primary/30 shadow-sm p-6 text-center">
                {/* Subtle gradient accent strip */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60 rounded-t-2xl" />

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-verified-muted border border-verified-border text-verified text-[11px] font-extrabold uppercase tracking-wider mb-5">
                  <Gift className="w-3 h-3" />
                  Your Unique Invite Code
                </div>

                {/* Large stylized code display */}
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="flex items-center gap-3 px-6 py-4 rounded-xl bg-muted/60 border border-border">
                    <span className="text-3xl font-extrabold tracking-[0.2em] text-foreground font-mono">
                      {stats.referralCode}
                    </span>
                    <button
                      type="button"
                      onClick={copyCode}
                      aria-label="Copy referral code"
                      className={`p-2 rounded-lg transition-all border text-xs font-bold flex items-center gap-1 ${
                        codeCopied
                          ? "bg-verified-muted border-verified-border text-verified"
                          : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                      }`}
                    >
                      {codeCopied ? (
                        <><CheckCheck className="w-4 h-4" /> Copied!</>
                      ) : (
                        <><Copy className="w-4 h-4" /> Copy</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Action row */}
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={copyLink}
                    className="gap-1.5 font-bold text-xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {linkCopied ? "Link Copied!" : "Copy Share Link"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setStoryModalOpen(true)}
                    className="gap-1.5 font-bold text-xs bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Post to Story / Status
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShareOpen(true)}
                    id="share-referral-btn"
                    aria-label="Share referral link"
                    className="gap-1.5 font-bold text-xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share via Socials
                  </Button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Join me on VyaparMedia — India's top brand-influencer deal platform! Use my invite code ${stats.referralCode} to claim benefits: ${referralLink}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold bg-verified text-white hover:bg-verified/90 transition-colors shrink-0 shadow-xs"
                  >
                    <span>💬</span>
                    <span>Invite via WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* ── Milestone Progress (CRED Style) ── */}
              <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Circular Progress Ring */}
                    <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 72 72">
                        <circle
                          cx="36"
                          cy="36"
                          r="30"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="transparent"
                          className="text-muted-foreground"
                        />
                        <circle
                          cx="36"
                          cy="36"
                          r="30"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 30}
                          strokeDashoffset={2 * Math.PI * 30 - (progress / 100) * (2 * Math.PI * 30)}
                          strokeLinecap="round"
                          className="text-primary transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <span className="absolute text-[11px] font-black text-foreground tabular-nums">
                        {Math.round(progress)}%
                      </span>
                    </div>

                    <div>
                      <h2 className="text-sm font-extrabold text-foreground">Tier Unlock Progress</h2>
                      <p className="text-xs text-muted-foreground">
                        {stats.activeReferrals} of {nextTierMin} active referrals required for next tier
                      </p>
                    </div>
                  </div>

                  {/* Pending reward chip */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pending-muted border border-pending-border text-pending text-xs font-bold self-start sm:self-auto">
                    <Zap className="w-3.5 h-3.5" />
                    <span>
                      Next Reward: {TIERS.find((t) => t.min > stats.activeReferrals)?.reward ?? "Maximum Tier Active"}
                    </span>
                  </div>
                </div>

                {/* Progress track */}
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: shouldReduceMotion ? `${progress}%` : 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: shouldReduceMotion ? 0 : 1.2, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-primary to-verified rounded-full"
                  />
                </div>

                {/* Tier cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {TIERS.map((tier, i) => {
                    const isActive = stats.tier.label === tier.label;
                    return (
                      <motion.div
                        key={tier.name}
                        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { delay: i * 0.06 }}
                        className={`text-center p-3 rounded-xl border transition-all ${
                          isActive
                            ? `${tier.accent} shadow-sm ring-1 ring-inset ring-current/20`
                            : "bg-card border-border text-muted-foreground hover:bg-muted/30"
                        }`}
                      >
                        {isActive && (
                          <Crown className="w-3.5 h-3.5 mx-auto mb-1 text-current" />
                        )}
                        <div className="text-xs font-extrabold uppercase tracking-wider">{tier.label}</div>
                        <div className="text-base font-extrabold tabular-nums mt-0.5">{tier.reward}</div>
                        <div className="text-[10px] font-medium opacity-70">{tier.min}+ active</div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* ── Partnership Roadmap ── */}
              <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
                <h2 className="text-sm font-extrabold text-foreground mb-4 text-center">
                  Partnership Roadmap
                </h2>
                <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                  {[
                    {
                      num: "01",
                      title: "Share Your Code",
                      desc: "Deploy your unique code or invite link across your socials and network.",
                      icon: "📢",
                    },
                    {
                      num: "02",
                      title: "Network Activation",
                      desc: "Referrals join and complete their first verified deal on VyaparMedia.",
                      icon: "🤝",
                    },
                    {
                      num: "03",
                      title: "Earn Lifetime Rewards",
                      desc: "Unlock scaling GMV revenue share and permanent platform fee discounts.",
                      icon: "💸",
                    },
                  ].map((step) => (
                    <div
                      key={step.num}
                      className="relative p-5 rounded-xl bg-muted/30 border border-border"
                    >
                      <div className="absolute top-4 right-4 text-3xl font-extrabold text-muted-foreground/20 select-none tabular-nums">
                        {step.num}
                      </div>
                      <div className="text-2xl mb-3">{step.icon}</div>
                      <h3 className="text-sm font-bold text-foreground mb-1">{step.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -16 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
            >
              <ReferralList onShareClick={() => setShareOpen(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </PageContainer>

      {/* Share Modal */}
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        referralCode={stats.referralCode}
        referralLink={referralLink}
        onOpenStory={() => setStoryModalOpen(true)}
      />

      {/* Story Share Modal (9:16 Story Card) */}
      <StoryShareModal
        open={storyModalOpen}
        onClose={() => setStoryModalOpen(false)}
        defaultTab="referral"
        referralCode={stats.referralCode}
        userType={session.user.userType}
        profile={{
          displayName: session.user.name || (session.user.userType === "BRAND" ? "Verified Brand" : "Vyapar Creator"),
          username: session.user.name?.toLowerCase().replace(/[^a-z0-9]/g, "") || (session.user.userType === "BRAND" ? "brand" : "creator"),
          trustScore: session.user.trustScore ?? (session.user.userType === "BRAND" ? 750 : 600),
          userType: session.user.userType,
        }}
      />
    </DashboardShell>
  );
}
