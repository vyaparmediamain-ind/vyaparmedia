"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import QRCode from "qrcode";
import { BottomSheet, Button } from "@/components/ui";
import { copyToClipboard } from "@/lib/clipboard";
import { logger } from "@/lib/logger-client";
import {
  Download,
  Share2,
  Copy,
  CheckCheck,
  Sparkles,
  Award,
  Link2,
  Shield,
  BadgeCheck,
  ChevronRight,
  Building2,
} from "lucide-react";

export interface StoryShareModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly defaultTab?: "profile" | "referral" | undefined;
  readonly userType?: "BRAND" | "INFLUENCER" | string | undefined;
  readonly profile?: {
    readonly displayName: string;
    readonly username?: string | undefined;
    readonly avatar?: string | null | undefined;
    readonly trustScore?: number | undefined;
    readonly categories?: string[] | undefined;
    readonly city?: string | null | undefined;
    readonly completedDealsCount?: number | undefined;
    readonly isKycVerified?: boolean | undefined;
    readonly companyName?: string | undefined;
    readonly industry?: string | undefined;
    readonly website?: string | undefined;
    readonly userType?: "BRAND" | "INFLUENCER" | string | undefined;
  } | undefined;
  readonly referralCode?: string | undefined;
}

export default function StoryShareModal({
  open,
  onClose,
  defaultTab = "profile",
  userType,
  profile,
  referralCode,
}: Readonly<StoryShareModalProps>) {
  const isBrand = userType === "BRAND" || profile?.userType === "BRAND";

  // Determine available tabs
  const hasProfile = Boolean(profile?.displayName || profile?.companyName);
  const hasReferral = Boolean(referralCode);

  const initialTab =
    defaultTab === "referral" && hasReferral
      ? "referral"
      : hasProfile
      ? "profile"
      : "referral";

  const [activeTab, setActiveTab] = useState<"profile" | "referral">(initialTab);
  const [profileQr, setProfileQr] = useState<string>("");
  const [referralQr, setReferralQr] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [activeProgress, setActiveProgress] = useState(0);

  // Compute URLs
  const origin = typeof window !== "undefined" ? window.location.origin : "https://vyaparmedia.in";
  const profileSlug =
    profile?.username ||
    (isBrand
      ? profile?.companyName?.toLowerCase().replace(/[^a-z0-9]/g, "") || "brand"
      : "creator");

  const profileUrl = isBrand
    ? `${origin}/brand/${encodeURIComponent(profileSlug)}`
    : `${origin}/creator/${encodeURIComponent(profileSlug)}`;

  const referralUrl = referralCode ? `${origin}/register?ref=${encodeURIComponent(referralCode)}` : "";

  const activeUrl = activeTab === "profile" ? profileUrl : referralUrl;

  // Actual DRS Trust Score (Never hardcoded to 850)
  const actualTrustScore = profile?.trustScore ?? (isBrand ? 750 : 600);

  // Perks by role
  const referralPerks = useMemo(
    () =>
      isBrand
        ? [
            "0% fee on first 3 campaigns",
            "Verified Brand Badge",
            "Escrow-secured deliverables",
          ]
        : [
            "0% Commission (Always Free)",
            "Verified Creator Badge",
            "100% Escrow-secured payouts",
          ],
    [isBrand]
  );

  // Generate QR codes on mount or when URLs change
  useEffect(() => {
    let isMounted = true;

    async function generateQRs() {
      try {
        if (profileUrl) {
          const pQr = await QRCode.toDataURL(profileUrl, {
            margin: 1,
            width: 320,
            color: {
              dark: "#0F172A",
              light: "#FFFFFF",
            },
          });
          if (isMounted) setProfileQr(pQr);
        }

        if (referralUrl) {
          const rQr = await QRCode.toDataURL(referralUrl, {
            margin: 1,
            width: 320,
            color: {
              dark: "#0F172A",
              light: "#FFFFFF",
            },
          });
          if (isMounted) setReferralQr(rQr);
        }
      } catch (err) {
        logger.warn("[StoryShareModal] QR code generation failed", { error: String(err) });
      }
    }

    if (open) {
      generateQRs();
    }

    return () => {
      isMounted = false;
    };
  }, [open, profileUrl, referralUrl]);

  // Animate story progress bar when tab changes
  useEffect(() => {
    setActiveProgress(0);
    const interval = setInterval(() => {
      setActiveProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 0.6;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Handle Copy Link
  const handleCopyLink = useCallback(async () => {
    if (!activeUrl) return;
    await copyToClipboard(activeUrl);
    setCopiedLink(true);
    setFeedbackMessage("Link copied! Paste in Instagram's 'Link' sticker.");
    setTimeout(() => {
      setCopiedLink(false);
      setFeedbackMessage(null);
    }, 3500);
  }, [activeUrl]);

  // Rounded rectangle helper for 2D Canvas
  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Helper to load image
  function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // Render Story onto high-res 1080x1920 HTML5 Canvas
  const drawStoryCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // 1. Background gradient (Deep OLED Slate with subtle indigo vibe)
    const bgGradient = ctx.createLinearGradient(0, 0, 1080, 1920);
    bgGradient.addColorStop(0, "#080B11");
    bgGradient.addColorStop(0.35, "#0E1322");
    bgGradient.addColorStop(0.7, "#11172A");
    bgGradient.addColorStop(1, "#07090F");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Ambient Glow orbs for rich depth
    const glow1 = ctx.createRadialGradient(200, 300, 10, 200, 300, 600);
    glow1.addColorStop(0, isBrand ? "rgba(147, 51, 234, 0.22)" : "rgba(59, 130, 246, 0.22)");
    glow1.addColorStop(1, "rgba(59, 130, 246, 0)");
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, 1080, 1000);

    const glow2 = ctx.createRadialGradient(880, 1600, 10, 880, 1600, 650);
    glow2.addColorStop(
      0,
      activeTab === "profile"
        ? isBrand
          ? "rgba(56, 189, 248, 0.18)"
          : "rgba(34, 197, 94, 0.18)"
        : "rgba(168, 85, 247, 0.20)"
    );
    glow2.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 1000, 1080, 920);

    // 3. Platform Brand Header
    ctx.textAlign = "center";
    ctx.fillStyle = "#38BDF8";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("VYAPARMEDIA", 540, 160);

    // Header sub-pill
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    roundRect(ctx, 310, 190, 460, 52, 26);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#E2E8F0";
    ctx.font = "600 22px sans-serif";
    const headerPillText =
      activeTab === "profile"
        ? isBrand
          ? "🛡️ OFFICIAL BRAND PARTNER"
          : "🛡️ 100% ESCROW PROTECTED"
        : isBrand
        ? "🎁 BRAND COLLABORATION INVITE"
        : "🎁 EXCLUSIVE PARTNER INVITE";
    ctx.fillText(headerPillText, 540, 224);

    // 4. Central Hero Card
    ctx.fillStyle = "rgba(18, 24, 38, 0.88)";
    roundRect(ctx, 90, 290, 900, 1340, 48);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (activeTab === "profile") {
      // ── PROFILE STORY CARD ──
      const avatarSize = 220;
      const avatarX = 540;
      const avatarY = 460;

      // Draw avatar ring
      const ringGrad = ctx.createLinearGradient(avatarX - 120, avatarY - 120, avatarX + 120, avatarY + 120);
      if (isBrand) {
        ringGrad.addColorStop(0, "#8B5CF6");
        ringGrad.addColorStop(0.5, "#3B82F6");
        ringGrad.addColorStop(1, "#38BDF8");
      } else {
        ringGrad.addColorStop(0, "#3B82F6");
        ringGrad.addColorStop(0.5, "#8B5CF6");
        ringGrad.addColorStop(1, "#10B981");
      }
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarSize / 2 + 8, 0, Math.PI * 2);
      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = 6;
      ctx.stroke();

      // Draw avatar base
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#1E293B";
      ctx.fill();

      // Monogram initials
      const name = isBrand
        ? profile?.companyName || profile?.displayName || "Brand Partner"
        : profile?.displayName || "Verified Creator";
      const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
      ctx.fillStyle = "#F8FAFC";
      ctx.font = "bold 80px sans-serif";
      ctx.fillText(initials, avatarX, avatarY + 30);

      // Display Name / Brand Name
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 60px sans-serif";
      ctx.fillText(name.length > 22 ? name.slice(0, 21) + "…" : name, 540, 640);

      // Handle or Industry
      ctx.fillStyle = "#94A3B8";
      ctx.font = "500 34px sans-serif";
      const subHandle = isBrand
        ? profile?.industry || `@${profileSlug}`
        : `@${profileSlug}`;
      ctx.fillText(subHandle, 540, 695);

      // Trust Score Badge Pill (Actual DRS Score)
      ctx.fillStyle = "rgba(34, 197, 94, 0.15)";
      roundRect(ctx, 220, 735, 640, 72, 36);
      ctx.fill();
      ctx.strokeStyle = "rgba(34, 197, 94, 0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#4ADE80";
      ctx.font = "bold 30px sans-serif";
      const trustScoreLabel = isBrand
        ? `⭐ ${actualTrustScore}/900 Brand Reliability Score`
        : `⭐ ${actualTrustScore}/900 DRS Trust Score`;
      ctx.fillText(trustScoreLabel, 540, 782);

      // Categories or Tagline
      if (profile?.categories && profile.categories.length > 0) {
        ctx.fillStyle = "#CBD5E1";
        ctx.font = "500 28px sans-serif";
        ctx.fillText(profile.categories.slice(0, 3).join(" • "), 540, 850);
      } else if (isBrand && profile?.city) {
        ctx.fillStyle = "#CBD5E1";
        ctx.font = "500 28px sans-serif";
        ctx.fillText(`Based in ${profile.city} • Open for Collaborations`, 540, 850);
      }

      // Separator line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(180, 890);
      ctx.lineTo(900, 890);
      ctx.stroke();

      // QR Code Box
      if (profileQr) {
        const qrImg = await loadImage(profileQr);
        if (qrImg) {
          ctx.fillStyle = "#FFFFFF";
          roundRect(ctx, 360, 940, 360, 360, 32);
          ctx.fill();
          ctx.drawImage(qrImg, 380, 960, 320, 320);
        }
      }

      // QR CTA Text
      ctx.fillStyle = "#F8FAFC";
      ctx.font = "bold 36px sans-serif";
      const qrCtaHeadline = isBrand
        ? "Scan to Propose Deals & View Campaigns"
        : "Scan to View Rate Card & Media Kit";
      ctx.fillText(qrCtaHeadline, 540, 1370);

      ctx.fillStyle = "#94A3B8";
      ctx.font = "400 28px sans-serif";
      const qrCtaSub = isBrand
        ? "Direct creator collaborations • 100% Escrow Protection"
        : "Direct brand collaborations • Zero broker fees";
      ctx.fillText(qrCtaSub, 540, 1420);

      // Guaranteed badge
      ctx.fillStyle = "#38BDF8";
      ctx.font = "600 26px sans-serif";
      const badgeText = isBrand
        ? "🔒 100% Escrow-Protected Deliverables"
        : "🔒 100% Escrow Guaranteed Payments";
      ctx.fillText(badgeText, 540, 1530);
    } else {
      // ── REFERRAL STORY CARD ──
      ctx.fillStyle = "#F8FAFC";
      ctx.font = "bold 56px sans-serif";
      const referralHeadline = isBrand ? "Partner With Top Creators" : "Join My Creator Network";
      ctx.fillText(referralHeadline, 540, 430);

      ctx.fillStyle = "#94A3B8";
      ctx.font = "400 30px sans-serif";
      const referralSub = isBrand
        ? "Launch high-ROI influencer campaigns on VyaparMedia"
        : "Get exclusive brand deal access on VyaparMedia";
      ctx.fillText(referralSub, 540, 485);

      // Referral Code Prominent Box
      ctx.fillStyle = "rgba(37, 99, 235, 0.15)";
      roundRect(ctx, 190, 540, 700, 200, 36);
      ctx.fill();
      ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "#93C5FD";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("USE INVITE CODE AT SIGNUP", 540, 600);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 76px monospace";
      ctx.fillText(referralCode || "VYAPAR", 540, 685);

      // Value Perks List
      ctx.textAlign = "left";
      ctx.font = "600 30px sans-serif";
      ctx.fillStyle = "#E2E8F0";
      referralPerks.forEach((p, idx) => {
        ctx.fillText(`✦  ${p}`, 230, 810 + idx * 56);
      });
      ctx.textAlign = "center";

      // Separator
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(180, 990);
      ctx.lineTo(900, 990);
      ctx.stroke();

      // QR Code Box
      if (referralQr) {
        const qrImg = await loadImage(referralQr);
        if (qrImg) {
          ctx.fillStyle = "#FFFFFF";
          roundRect(ctx, 360, 1030, 360, 360, 32);
          ctx.fill();
          ctx.drawImage(qrImg, 380, 1050, 320, 320);
        }
      }

      // QR CTA Text
      ctx.fillStyle = "#F8FAFC";
      ctx.font = "bold 36px sans-serif";
      ctx.fillText(isBrand ? "Scan to Claim Brand Bonus" : "Scan to Claim Joining Bonus", 540, 1460);

      ctx.fillStyle = "#94A3B8";
      ctx.font = "400 28px sans-serif";
      ctx.fillText("Or tap the Link Sticker below to get started", 540, 1510);
    }

    // 5. Instagram Link Sticker Simulation (at bottom)
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, 200, 1710, 680, 84, 42);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 30px sans-serif";
    const stickerText =
      activeTab === "profile"
        ? isBrand
          ? `🔗 vyaparmedia.in/brand/${profileSlug}`
          : `🔗 vyaparmedia.in/creator/${profileSlug}`
        : `🔗 vyaparmedia.in/register?ref=${referralCode || ""}`;

    ctx.fillText(
      stickerText.length > 38 ? stickerText.slice(0, 37) + "…" : stickerText,
      540,
      1762
    );

    ctx.fillStyle = "#94A3B8";
    ctx.font = "500 24px sans-serif";
    ctx.fillText("👆 Add Instagram 'Link' sticker here", 540, 1835);

    return canvas;
  }, [
    activeTab,
    isBrand,
    profile,
    profileSlug,
    actualTrustScore,
    referralCode,
    referralPerks,
    profileQr,
    referralQr,
  ]);

  // Handle Download Story Image
  const handleDownloadStory = async () => {
    try {
      setIsGeneratingImage(true);
      const canvas = await drawStoryCanvas();
      if (!canvas) return;

      const dataUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      const filename =
        activeTab === "profile"
          ? isBrand
            ? `vyaparmedia-brand-${profileSlug}-story.png`
            : `vyaparmedia-creator-${profileSlug}-story.png`
          : `vyaparmedia-referral-${referralCode || "invite"}-story.png`;

      downloadLink.href = dataUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      setFeedbackMessage("Story image saved! Upload directly to Instagram or WhatsApp.");
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err) {
      logger.error("[StoryShareModal] Story card download failed", { error: String(err) });
      setFeedbackMessage("Could not generate image. Please try again.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Handle Web Share API
  const handleNativeShare = async () => {
    if (!navigator.share) {
      await handleCopyLink();
      return;
    }

    try {
      setIsGeneratingImage(true);
      const canvas = await drawStoryCanvas();
      if (canvas && navigator.canShare) {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File(
            [blob],
            activeTab === "profile" ? `${profileSlug}-story.png` : "vyaparmedia-invite.png",
            { type: "image/png" }
          );

          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: isBrand
                ? `${profile?.companyName || "Brand"} on VyaparMedia`
                : `${profile?.displayName || "Creator"} on VyaparMedia`,
              text: isBrand
                ? `Connect with ${profile?.companyName || "our brand"} for campaigns on VyaparMedia!`
                : `Collaborate with ${profile?.displayName || "me"} on VyaparMedia (100% Escrow Protected)!`,
              url: activeUrl,
              files: [file],
            });
            return;
          }

          // Fallback to URL-only native share
          await navigator.share({
            title: "VyaparMedia Story",
            url: activeUrl,
          });
        });
      }
    } catch (err) {
      logger.warn("[StoryShareModal] Native share error", { error: String(err) });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Multi-platform Story & Social Share URLs
  const platformShareText =
    activeTab === "profile"
      ? isBrand
        ? `Check out our verified brand profile, active campaigns & reliability score on VyaparMedia! (100% Escrow Protected):`
        : `Check out my verified creator portfolio, rates & trust score on VyaparMedia! (100% Escrow Protected):`
      : isBrand
      ? `Launch high-ROI influencer campaigns on VyaparMedia! Use our invite code ${referralCode || ""} to claim 0% platform fees on your first 3 campaigns:`
      : `Join India's top brand-influencer deal platform! Use my invite code ${referralCode || ""} to get fast-track verification & 100% free escrow payouts:`;

  const whatsAppStatusText =
    activeTab === "profile"
      ? isBrand
        ? `Check out our official brand portfolio & campaigns on VyaparMedia:\n\n${activeUrl}\n\n(100% Escrow-Protected Collaborations)`
        : `Check out my verified creator portfolio, rate card & DRS trust score on VyaparMedia:\n\n${activeUrl}\n\n(100% Escrow Protected Collaborations)`
      : isBrand
      ? `Launch influencer campaigns with verified creators on VyaparMedia!\n\nUse our invite code ${referralCode || ""} to unlock 0% platform fees on your first 3 campaigns:\n\n${activeUrl}`
      : `Join India's leading creator & brand deal network!\n\nUse my invite code ${referralCode || ""} to claim 0% commission & 100% escrow-secured payouts:\n\n${activeUrl}`;

  const whatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsAppStatusText)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(activeUrl)}&quote=${encodeURIComponent(platformShareText)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(activeUrl)}&text=${encodeURIComponent(platformShareText)}`;
  const twitterUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(platformShareText)}&url=${encodeURIComponent(activeUrl)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(activeUrl)}`;
  const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(platformShareText + " " + activeUrl)}`;

  // Social platforms config with clean emojis and labels
  const socials = [
    { label: "WhatsApp", href: whatsAppUrl, emoji: "💬", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20" },
    { label: "Instagram", href: undefined as string | undefined, emoji: "📸", color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20 hover:bg-pink-500/20", onClick: handleDownloadStory },
    { label: "Facebook", href: facebookUrl, emoji: "👥", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20" },
    { label: "Telegram", href: telegramUrl, emoji: "✈️", color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20 hover:bg-sky-500/20" },
    { label: "Threads", href: threadsUrl, emoji: "🧵", color: "text-foreground", bg: "bg-card border-border hover:bg-muted" },
    { label: "X", href: twitterUrl, emoji: "✕", color: "text-foreground", bg: "bg-card border-border hover:bg-muted" },
    { label: "LinkedIn", href: linkedinUrl, emoji: "in", color: "text-blue-300", bg: "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20" },
  ];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxWidth="820px"
      title={
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-primary/20 border border-primary/20 flex items-center justify-center">
            <Share2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-foreground">Share Your Story</h2>
            <p className="text-[11px] text-muted-foreground font-normal">
              Instagram · Facebook · WhatsApp · Telegram · More
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {/* Tab Switcher */}
        {hasProfile && hasReferral && (
          <div className="flex items-center p-1 rounded-2xl bg-muted/50 border border-border overflow-x-auto no-scrollbar flex-nowrap max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 whitespace-nowrap cursor-pointer ${
                activeTab === "profile"
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isBrand ? (
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <Award className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{isBrand ? "Brand Profile" : "Creator Profile"}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("referral")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 whitespace-nowrap cursor-pointer ${
                activeTab === "referral"
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>{isBrand ? "Partner Invite" : "Referral Invite"}</span>
            </button>
          </div>
        )}

        {/* Feedback Banner */}
        {feedbackMessage && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCheck className="w-4 h-4 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Main Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* ── STORY PHONE PREVIEW ── */}
          <div className="md:col-span-5 flex flex-col items-center">
            {/* Phone Bezel */}
            <div className="relative" style={{ width: 232, flexShrink: 0 }}>
              <div
                className="relative rounded-[38px] p-[3.5px]"
                style={{
                  background: "linear-gradient(145deg, #3a3f52 0%, #1c2035 45%, #3a3f52 100%)",
                  boxShadow:
                    "0 0 0 1px rgba(255,255,255,0.07), 0 32px 72px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 48px rgba(59,130,246,0.07)",
                }}
              >
                {/* Screen */}
                <div
                  className="relative rounded-[34.5px] overflow-hidden"
                  style={{
                    aspectRatio: "9/16",
                    background:
                      "linear-gradient(160deg, #080B11 0%, #0E1322 40%, #11172A 75%, #07090F 100%)",
                  }}
                >
                  {/* Notch */}
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center"
                    style={{ width: 80, height: 18, background: "#0a0d16", borderRadius: "0 0 14px 14px" }}
                  >
                    <div className="w-8 h-1 rounded-full" style={{ background: "#1a2030" }} />
                  </div>

                  {/* Ambient glows */}
                  <div
                    className="absolute -top-10 -left-10 w-48 h-48 rounded-full pointer-events-none"
                    style={{
                      background: isBrand
                        ? "radial-gradient(circle, rgba(168,85,247,0.28) 0%, transparent 70%)"
                        : "radial-gradient(circle, rgba(59,130,246,0.28) 0%, transparent 70%)",
                    }}
                  />
                  <div
                    className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full pointer-events-none"
                    style={{
                      background:
                        activeTab === "profile"
                          ? isBrand
                            ? "radial-gradient(circle, rgba(56,189,248,0.22) 0%, transparent 70%)"
                            : "radial-gradient(circle, rgba(34,197,94,0.22) 0%, transparent 70%)"
                          : "radial-gradient(circle, rgba(168,85,247,0.25) 0%, transparent 70%)",
                    }}
                  />

                  {/* Story Progress Bars */}
                  <div className="absolute top-5 left-0 right-0 z-20 flex gap-1 px-3">
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        className="flex-1 h-[2.5px] rounded-full overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.22)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            background: "#fff",
                            width:
                              i === 0
                                ? activeTab === "profile"
                                  ? `${activeProgress}%`
                                  : "100%"
                                : activeTab === "referral"
                                ? `${activeProgress}%`
                                : "0%",
                            transition: "width 0.05s linear",
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Story Header */}
                  <div className="absolute top-9 left-0 right-0 z-20 flex items-center gap-2 px-3">
                    <div
                      className="w-7 h-7 rounded-full p-[2px] flex-shrink-0"
                      style={{
                        background: isBrand
                          ? "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #38BDF8 100%)"
                          : "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #10B981 100%)",
                      }}
                    >
                      <div className="w-full h-full rounded-full bg-[#0E1322] flex items-center justify-center text-white text-[9px] font-black">
                        {activeTab === "profile"
                          ? (isBrand ? profile?.companyName || "B" : profile?.displayName || "C")[0]?.toUpperCase()
                          : "VM"}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-[8.5px] font-bold truncate leading-tight">
                        {activeTab === "profile"
                          ? isBrand
                            ? profile?.companyName || profile?.displayName || "Brand Partner"
                            : profile?.displayName || "Creator Profile"
                          : "VyaparMedia"}
                      </div>
                      <div className="text-white/45 text-[7px] leading-tight">Just now</div>
                    </div>
                    <div className="text-white/55 text-xs font-light">···</div>
                  </div>

                  {/* Story Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pb-14 pt-20 z-10">
                    {activeTab === "profile" ? (
                      <div className="w-full flex flex-col items-center gap-2 text-center">
                        {/* Avatar / Brand Logo with gradient ring */}
                        <div
                          className="w-[58px] h-[58px] rounded-full p-[2.5px]"
                          style={{
                            background: isBrand
                              ? "linear-gradient(135deg, #8B5CF6, #3B82F6, #38BDF8)"
                              : "linear-gradient(135deg, #3B82F6, #8B5CF6, #10B981)",
                            boxShadow: "0 0 18px rgba(59,130,246,0.45)",
                          }}
                        >
                          <div className="w-full h-full rounded-full bg-[#1E293B] flex items-center justify-center text-white text-base font-black">
                            {(
                              (isBrand
                                ? profile?.companyName || profile?.displayName || "B"
                                : profile?.displayName || "C")
                            )
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                        </div>

                        {/* Name + handle */}
                        <div>
                          <div
                            className="text-white text-[12px] font-extrabold leading-tight truncate max-w-[155px]"
                            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}
                          >
                            {isBrand
                              ? profile?.companyName || profile?.displayName || "Verified Brand"
                              : profile?.displayName || "Verified Creator"}
                          </div>
                          <div className="text-white/45 text-[8px] font-medium mt-0.5">
                            {isBrand ? profile?.industry || `@${profileSlug}` : `@${profileSlug}`}
                          </div>
                        </div>

                        {/* Actual DRS Trust badge (no hardcoding) */}
                        <div
                          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8px] font-bold"
                          style={{
                            background: "rgba(34,197,94,0.15)",
                            border: "1px solid rgba(34,197,94,0.35)",
                            color: "#4ADE80",
                          }}
                        >
                          <BadgeCheck className="w-2.5 h-2.5" />
                          {actualTrustScore}/900 DRS
                        </div>

                        {/* Categories / Tagline */}
                        {profile?.categories && profile.categories.length > 0 ? (
                          <div className="text-white/40 text-[7.5px] font-medium">
                            {profile.categories.slice(0, 3).join(" · ")}
                          </div>
                        ) : isBrand && profile?.city ? (
                          <div className="text-white/40 text-[7.5px] font-medium">
                            {profile.city} · Open for Collabs
                          </div>
                        ) : null}

                        <div className="w-3/4 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />

                        {/* QR */}
                        {profileQr ? (
                          <div
                            className="w-[66px] h-[66px] p-1.5 rounded-xl"
                            style={{ background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
                          >
                            <img src={profileQr} alt="Profile QR" className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div
                            className="w-[66px] h-[66px] rounded-xl animate-pulse"
                            style={{ background: "rgba(255,255,255,0.1)" }}
                          />
                        )}

                        <div className="text-white/45 text-[7.5px] font-medium">
                          {isBrand ? "Scan to view campaigns" : "Scan for rate card"}
                        </div>

                        {/* Escrow badge */}
                        <div
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[7.5px] font-bold"
                          style={{
                            background: "rgba(56,189,248,0.12)",
                            border: "1px solid rgba(56,189,248,0.25)",
                            color: "#38BDF8",
                          }}
                        >
                          <Shield className="w-2 h-2" />
                          100% Escrow Protected
                        </div>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col items-center gap-2 text-center">
                        {/* Sparkle icon */}
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(168,85,247,0.3), rgba(59,130,246,0.3))",
                            border: "1px solid rgba(168,85,247,0.4)",
                            boxShadow: "0 0 20px rgba(168,85,247,0.3)",
                          }}
                        >
                          <Sparkles className="w-5 h-5 text-purple-300" />
                        </div>

                        <div>
                          <div
                            className="text-white text-[11px] font-extrabold leading-tight"
                            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}
                          >
                            {isBrand ? "Partner With Top Creators" : "Join My Creator Network"}
                          </div>
                          <div className="text-white/45 text-[8px] mt-0.5">100% Escrow Guaranteed</div>
                        </div>

                        {/* Invite code */}
                        <div
                          className="w-full max-w-[155px] py-2 px-3 rounded-2xl"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(37,99,235,0.25), rgba(168,85,247,0.25))",
                            border: "1.5px solid rgba(168,85,247,0.45)",
                            boxShadow: "0 0 16px rgba(168,85,247,0.2)",
                          }}
                        >
                          <div className="text-purple-300 text-[7px] font-bold tracking-widest uppercase mb-0.5">
                            Invite Code
                          </div>
                          <div className="text-white font-mono text-sm font-black tracking-widest">
                            {referralCode || "VYAPAR"}
                          </div>
                        </div>

                        {/* Perks */}
                        <div className="w-full space-y-1 text-left max-w-[165px]">
                          {referralPerks.map((perk) => (
                            <div key={perk} className="flex items-center gap-1.5">
                              <div className="w-1 h-1 rounded-full bg-purple-400 flex-shrink-0" />
                              <span className="text-white/70 text-[7.5px] font-medium">{perk}</span>
                            </div>
                          ))}
                        </div>

                        <div className="w-3/4 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />

                        {/* QR */}
                        {referralQr ? (
                          <div
                            className="w-[66px] h-[66px] p-1.5 rounded-xl"
                            style={{ background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
                          >
                            <img src={referralQr} alt="Referral QR" className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div
                            className="w-[66px] h-[66px] rounded-xl animate-pulse"
                            style={{ background: "rgba(255,255,255,0.1)" }}
                          />
                        )}
                        <div className="text-white/45 text-[7.5px] font-medium">
                          {isBrand ? "Scan to launch campaigns" : "Scan to claim bonus"}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Instagram Link Sticker Simulation */}
                  <div
                    className="absolute bottom-0 left-0 right-0 z-20 pb-3 pt-10 px-4"
                    style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)" }}
                  >
                    <div
                      className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full mx-auto"
                      style={{
                        background: "rgba(255,255,255,0.96)",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                        maxWidth: 190,
                      }}
                    >
                      <Link2 className="w-2.5 h-2.5 text-gray-800 flex-shrink-0" />
                      <span className="text-gray-900 text-[7.5px] font-bold truncate" style={{ maxWidth: 130 }}>
                        {activeTab === "profile"
                          ? isBrand
                            ? `brand/${profileSlug}`
                            : `creator/${profileSlug}`
                          : `join?ref=${referralCode}`}
                      </span>
                      <ChevronRight className="w-2 h-2 text-gray-600 flex-shrink-0" />
                    </div>
                    <div className="text-center text-white/30 text-[6.5px] mt-1 font-medium">See more</div>
                  </div>
                </div>
              </div>

              {/* Home indicator */}
              <div className="flex justify-center mt-2.5">
                <div className="w-14 h-[3.5px] rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
              </div>
            </div>

            {/* Label below phone */}
            <div className="text-center mt-2.5 space-y-0.5">
              <div className="text-[9.5px] font-extrabold text-muted-foreground uppercase tracking-widest">
                1080 × 1920 · 9:16
              </div>
              <div className="text-[8.5px] text-muted-foreground/55">
                Instagram · Facebook · WhatsApp ready
              </div>
            </div>
          </div>

          {/* ── RIGHT: Actions ── */}
          <div className="md:col-span-7 space-y-4">
            {/* Link Copy Row */}
            <div className="p-3 rounded-2xl bg-muted/40 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Story Link URL
                </span>
                <span className="text-[10px] text-primary font-semibold">For Instagram Link Sticker</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 p-2 rounded-xl bg-card border border-border text-xs font-mono text-foreground truncate">
                  {activeUrl}
                </div>
                <Button
                  variant={copiedLink ? "secondary" : "primary"}
                  size="sm"
                  onClick={handleCopyLink}
                  aria-label="Copy story sticker link"
                  className="shrink-0 gap-1.5 text-xs font-bold"
                >
                  {copiedLink ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
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
            </div>

            {/* Primary Actions */}
            <div className="space-y-2">
              <Button
                variant="primary"
                onClick={handleDownloadStory}
                disabled={isGeneratingImage}
                aria-label="Download high-resolution 9:16 story card"
                className="w-full justify-center gap-2 py-2.5 text-sm font-bold"
              >
                <Download className="w-4 h-4" />
                {isGeneratingImage ? "Generating Story…" : "Download Story Card (1080×1920 PNG)"}
              </Button>

              <button
                type="button"
                onClick={handleNativeShare}
                disabled={isGeneratingImage}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border border-border bg-card hover:bg-muted text-foreground font-bold text-xs transition-all"
              >
                <Share2 className="w-4 h-4 text-primary" />
                Share via System (Snapchat, Instagram, More…)
              </button>
            </div>

            {/* Social Share Grid */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Share Directly
              </span>
              <div className="grid grid-cols-4 gap-2">
                {socials.map((s) =>
                  s.onClick ? (
                    <button
                      key={s.label}
                      type="button"
                      onClick={s.onClick}
                      disabled={isGeneratingImage}
                      className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-2xl border font-bold transition-all ${s.bg}`}
                    >
                      <span className={`text-base leading-none ${s.color}`}>{s.emoji}</span>
                      <span className={`text-[8.5px] font-bold ${s.color}`}>{s.label}</span>
                    </button>
                  ) : (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-2xl border font-bold transition-all ${s.bg}`}
                    >
                      <span className={`text-base leading-none ${s.color}`}>{s.emoji}</span>
                      <span className={`text-[8.5px] font-bold ${s.color}`}>{s.label}</span>
                    </a>
                  )
                )}
              </div>
            </div>

            {/* How-To Guide */}
            <div className="p-3.5 rounded-2xl bg-card border border-border">
              <div className="text-[10px] font-extrabold text-foreground flex items-center gap-1.5 mb-3">
                <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center text-primary text-[9px] font-black">
                  ?
                </div>
                How to post to Instagram Story
              </div>
              <ol className="space-y-2.5">
                {[
                  {
                    n: "1",
                    text: (
                      <>
                        <strong>Download Story Card</strong> — saves to your camera roll.
                      </>
                    ),
                  },
                  {
                    n: "2",
                    text: (
                      <>
                        Open <strong>Instagram</strong> → new Story → select the downloaded card.
                      </>
                    ),
                  },
                  {
                    n: "3",
                    text: (
                      <>
                        Tap <strong>Stickers 😊</strong> → <strong>LINK</strong> → paste your copied URL.
                      </>
                    ),
                  },
                ].map((step) => (
                  <li key={step.n} className="flex items-start gap-2.5 list-none">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 mt-px"
                      style={{
                        background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(168,85,247,0.25))",
                        border: "1px solid rgba(59,130,246,0.3)",
                        color: "#93C5FD",
                      }}
                    >
                      {step.n}
                    </div>
                    <span className="text-[11px] text-muted-foreground leading-relaxed">{step.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
