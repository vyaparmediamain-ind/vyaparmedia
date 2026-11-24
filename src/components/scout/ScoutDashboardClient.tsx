"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import QRCode from "qrcode";
import { fetcher } from "@/lib/fetcher";
import { formatCurrency } from "@/lib/utils-client";
import { copyToClipboard } from "@/lib/clipboard";
import {
  Users,
  Building2,
  TrendingUp,
  Award,
  Copy,
  Check,
  Share2,
  QrCode,
  Flame,
  Calendar,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MessageCircle,
} from "lucide-react";
import { Button, Modal, Skeleton } from "@/components/ui";
import { FirstRunChecklist } from "@/components/guides/FirstRunChecklist";

interface ScoutDashboardData {
  isRegistered: boolean;
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED" | "NOT_REGISTERED";
  scoutCode: string;
  scoutProfile: {
    fullName: string;
    city: string;
    college: string | null;
    royaltyPercent: number;
    isRoyaltyPaused: boolean;
    streakMonths: number;
    totalRoyaltyEarnedPaise: number;
  };
  monthlyQuota: {
    isMet: boolean;
    reason: string;
    targetCount: number;
    currentMonthNewVerified: number;
    currentMonthDeals: number;
    isExempt: boolean;
    exemptUntil: string | null;
    daysRemaining: number;
  };
  networkStats: {
    totalOnboarded: number;
    verifiedCreators: number;
    pendingCreators: number;
    verifiedBrands: number;
    pendingBrands: number;
  };
  financials: {
    lifetimeRoyaltyPaise: number;
    thisMonthRoyaltyPaise: number;
  };
  shareableLinks: {
    creatorInviteLink: string;
    brandInviteLink: string;
    generalInviteLink: string;
  };
}

interface NetworkItem {
  id: string;
  name: string;
  handle: string | null;
  userType: "CREATOR" | "BRAND";
  joinedAt: string;
  isVerified: boolean;
  status: "VERIFIED" | "PENDING_KYC";
  dealsCompleted: number;
  totalVolumePaise: number;
  nudgeUrl: string;
}

export default function ScoutDashboardClient() {
  const { data: dashResponse, isLoading: dashLoading } = useSWR<{ success: boolean; data: ScoutDashboardData }>(
    "/api/scout/dashboard",
    fetcher
  );

  const { data: netResponse, isLoading: netLoading } = useSWR<{ success: boolean; network: NetworkItem[] }>(
    "/api/scout/network",
    fetcher
  );

  const [activeTab, setActiveTab] = useState<"ALL" | "CREATOR" | "BRAND">("ALL");
  const [copiedLinkType, setCopiedLinkType] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const d = dashResponse?.data;
  const network = netResponse?.network || [];

  useEffect(() => {
    const inviteLink = d?.shareableLinks?.generalInviteLink;
    if (!inviteLink) return;

    let isMounted = true;
    QRCode.toDataURL(inviteLink, {
      margin: 1,
      width: 360,
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch(() => {
        if (isMounted) setQrDataUrl(null);
      });

    return () => {
      isMounted = false;
    };
  }, [d?.shareableLinks?.generalInviteLink]);

  const handleCopy = async (text: string, type: string) => {
    await copyToClipboard(text);
    setCopiedLinkType(type);
    setTimeout(() => setCopiedLinkType(null), 2000);
  };

  if (dashLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!d || !d.scoutProfile) {
    return null;
  }

  const filteredNetwork = network.filter((item) => {
    if (activeTab === "ALL") return true;
    return item.userType === activeTab;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* ── TOP HEADER / IDENTITY ── */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-verified-muted border border-verified-border px-3 py-1 text-xs font-bold text-verified">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified Campus Partner
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {d.scoutProfile.city}
              </span>
              {d.scoutProfile.college && (
                <span className="hidden sm:inline-block rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  {d.scoutProfile.college}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Welcome back, {d.scoutProfile.fullName} 👋
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              You earn <strong className="text-foreground">{d.scoutProfile.royaltyPercent}% Lifetime Passive Royalty</strong> on every completed deal by your referred creators and brands.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setQrModalOpen(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <QrCode className="h-4 w-4" />
              Offline Pitch QR
            </Button>
            <Button
              size="sm"
              onClick={() => setCertModalOpen(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <Award className="h-4 w-4" />
              Ambassador Certificate
            </Button>
          </div>
        </div>

        {/* ── FIRST-RUN ONBOARDING CHECKLIST ── */}
        <FirstRunChecklist role="SCOUT" userId={d.scoutCode || "scout"} className="mt-6" />

        {/* ── MONTHLY ACTIVITY STREAK BANNER ── */}
        <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pending-muted text-pending">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    Monthly Activity Quota: {d.monthlyQuota.isMet ? "Active & Unlocked" : "Action Needed"}
                  </span>
                  {d.monthlyQuota.isMet ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-verified">
                      <CheckCircle2 className="h-3.5 w-3.5" /> 1/1 Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-pending">
                      <Clock className="h-3.5 w-3.5" /> {d.monthlyQuota.daysRemaining} days left
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{d.monthlyQuota.reason}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-foreground">Scout Streak:</span>
              <span className="rounded-lg bg-background border border-border px-2.5 py-1 font-bold text-primary">
                🔥 {d.scoutProfile.streakMonths} Months Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 STAT METRIC CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Lifetime Royalty Earned</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-foreground">
            {formatCurrency(d.financials.lifetimeRoyaltyPaise)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 inline-block">
            Permanent 1% GMV platform cut
          </span>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">This Month's Passive Cash</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-verified-muted text-verified">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-foreground">
            {formatCurrency(d.financials.thisMonthRoyaltyPaise)}
          </div>
          <span className="text-[11px] text-verified mt-1 inline-block">
            Auto-credited on completed deals
          </span>
        </div>

        {/* Metric 3 */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Verified Creators</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-escrow-muted text-escrow">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-foreground">
            {d.networkStats.verifiedCreators}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 inline-block">
            {d.networkStats.pendingCreators} pending KYC
          </span>
        </div>

        {/* Metric 4 */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Verified Brands & Cafes</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pending-muted text-pending">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-foreground">
            {d.networkStats.verifiedBrands}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 inline-block">
            {d.networkStats.pendingBrands} pending verification
          </span>
        </div>
      </div>

      {/* ── SHAREABLE INVITE CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Creator Invite */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-escrow">
                <Users className="h-4 w-4" /> For College & Local Creators
              </span>
              <span className="text-[11px] text-muted-foreground">Scout Code: {d.scoutCode}</span>
            </div>
            <h2 className="mt-2 text-base font-bold text-foreground">Invite Influencers & Content Creators</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Share with local vloggers, reels creators, and college influencers to earn 1% on every deal they close.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(d.shareableLinks.creatorInviteLink, "creator")}
              className="flex-1 gap-1.5 text-xs font-semibold"
            >
              {copiedLinkType === "creator" ? <Check className="h-3.5 w-3.5 text-verified" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedLinkType === "creator" ? "Copied Link!" : "Copy Creator Link"}
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hey! VyaparMedia par creator account bana le aur Instagram connect karle. Yahan 100% Escrow safe deals milti hain: ${d.shareableLinks.creatorInviteLink}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-verified px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-verified/90 transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" /> WhatsApp
            </a>
          </div>
        </div>

        {/* Brand Invite */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                <Building2 className="h-4 w-4" /> For Local Cafes, Gyms & Brands
              </span>
              <span className="text-[11px] text-muted-foreground">Scout Code: {d.scoutCode}</span>
            </div>
            <h2 className="mt-2 text-base font-bold text-foreground">Invite Local Brands & Businesses</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pitch local cafe owners, fitness gyms, and retail stores to run 100% escrow protected influencer marketing.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(d.shareableLinks.brandInviteLink, "brand")}
              className="flex-1 gap-1.5 text-xs font-semibold"
            >
              {copiedLinkType === "brand" ? <Check className="h-3.5 w-3.5 text-verified" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedLinkType === "brand" ? "Copied Link!" : "Copy Brand Link"}
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hello! Apne business/cafe ke promotion ke liye verified local creators hire karein with 100% Escrow security on VyaparMedia: ${d.shareableLinks.brandInviteLink}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-verified px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-verified/90 transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" /> WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* ── NETWORK PIPELINE & LIVE TABLE ── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Your Onboarded Network Pipeline</h3>
            <p className="text-xs text-muted-foreground">
              Monitor verification status and trigger WhatsApp nudges to complete KYC.
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-muted/60 p-1">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                activeTab === "ALL" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
              }`}
            >
              All ({network.length})
            </button>
            <button
              onClick={() => setActiveTab("CREATOR")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                activeTab === "CREATOR" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
              }`}
            >
              Creators ({d.networkStats.verifiedCreators + d.networkStats.pendingCreators})
            </button>
            <button
              onClick={() => setActiveTab("BRAND")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                activeTab === "BRAND" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
              }`}
            >
              Brands ({d.networkStats.verifiedBrands + d.networkStats.pendingBrands})
            </button>
          </div>
        </div>

        {netLoading ? (
          <div className="py-12 text-center">
            <div className="h-6 w-6 animate-spin mx-auto rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredNetwork.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-semibold text-foreground">No partners onboarded in this category yet</p>
            <p className="text-xs mt-1">Share your Scout link with local creators or cafes to start earning 1% royalty.</p>
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-3 font-semibold">Partner Name / Handle</th>
                  <th className="pb-3 font-semibold">Type</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Deals Closed</th>
                  <th className="pb-3 font-semibold">Volume (Paise)</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredNetwork.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3">
                      <p className="font-semibold text-foreground">{item.name}</p>
                      {item.handle && <p className="text-[11px] text-muted-foreground">{item.handle}</p>}
                    </td>
                    <td className="py-3">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
                        {item.userType}
                      </span>
                    </td>
                    <td className="py-3">
                      {item.isVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-verified-muted border border-verified-border px-2 py-0.5 text-[10px] font-bold text-verified">
                          <CheckCircle2 className="h-3 w-3" /> VERIFIED & ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-pending-muted border border-pending-border px-2 py-0.5 text-[10px] font-bold text-pending">
                          <Clock className="h-3 w-3" /> KYC PENDING
                        </span>
                      )}
                    </td>
                    <td className="py-3 font-medium text-foreground">{item.dealsCompleted}</td>
                    <td className="py-3 font-mono text-foreground">{formatCurrency(item.totalVolumePaise)}</td>
                    <td className="py-3 text-right">
                      {!item.isVerified && (
                        <a
                          href={item.nudgeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-verified/10 text-verified hover:bg-verified/20 px-2.5 py-1 text-[11px] font-semibold transition-colors"
                        >
                          <MessageCircle className="h-3 w-3" /> Nudge on WA
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: OFFLINE QR CODE ── */}
      <Modal open={qrModalOpen} onClose={() => setQrModalOpen(false)}>
        <div className="p-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <QrCode className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Your Offline Scout QR Code</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Meeting a cafe or gym owner? Ask them to point their mobile camera at this QR code to register directly under your network.
          </p>

          <div
            className="mx-auto w-52 h-52 border-2 border-primary/30 rounded-2xl p-3 flex flex-col items-center justify-center shadow-inner"
            style={{ background: "#ffffff" }}
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Scout QR Code"
                className="w-44 h-44 rounded-lg object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
                <QrCode className="h-10 w-10 text-muted-foreground animate-pulse" />
                <span>Generating QR...</span>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-muted p-2 font-mono text-xs text-foreground select-all break-all">
            {d?.shareableLinks?.generalInviteLink}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 text-xs font-semibold gap-1.5"
              onClick={() => d?.shareableLinks?.generalInviteLink && handleCopy(d.shareableLinks.generalInviteLink, "qr-link")}
            >
              {copiedLinkType === "qr-link" ? (
                <>
                  <Check className="h-3.5 w-3.5 text-verified" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Link
                </>
              )}
            </Button>
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={`Scout-QR-${d?.scoutCode || "VyaparMedia"}.png`}
                className="flex-1 inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground text-xs font-semibold h-9 px-3 hover:bg-primary/90 transition-colors gap-1.5"
              >
                <QrCode className="h-3.5 w-3.5" />
                Download QR
              </a>
            )}
          </div>

          <Button variant="secondary" className="w-full text-xs font-semibold" onClick={() => setQrModalOpen(false)}>
            Close QR Card
          </Button>
        </div>
      </Modal>

      {/* ── MODAL: AMBASSADOR CERTIFICATE ── */}
      <Modal open={certModalOpen} onClose={() => setCertModalOpen(false)}>
        <div className="p-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-verified-muted text-verified">
            <Award className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Official Campus Talent Scout Certificate</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Issued by VyaparMedia Technologies Pvt Ltd for excellence in verified brand & creator talent acquisition.
          </p>

          <div className="rounded-2xl border-2 border-primary/20 bg-muted/30 p-6 text-left space-y-3">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <span className="font-black text-sm text-foreground tracking-wider">VYAPARMEDIA</span>
              <span className="text-[10px] text-muted-foreground">ID: {d.scoutCode}</span>
            </div>
            <p className="text-xs text-muted-foreground">This certifies that</p>
            <h4 className="text-lg font-extrabold text-foreground">{d.scoutProfile.fullName}</h4>
            <p className="text-xs text-foreground">
              is an accredited <strong className="text-primary">Campus Partner & Talent Scout</strong> representing {d.scoutProfile.city}.
            </p>
            <div className="pt-2 text-[10px] text-muted-foreground">
              Verified Status: <span className="text-verified font-bold">APPROVED & ACTIVE</span> • 18+ Compliant
            </div>
          </div>

          <Button
            className="w-full text-xs font-semibold gap-1.5"
            onClick={() => {
              window.print();
            }}
          >
            <Sparkles className="h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>
      </Modal>
    </div>
  );
}
