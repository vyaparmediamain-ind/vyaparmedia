"use client";

import { logger } from "@/lib/logger-client";
import { apiClient } from "@/lib/api-client";
import { formatUserError } from "@/lib/user-messages";
import { copyToClipboard } from "@/lib/clipboard";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { fetcher } from "@/lib/fetcher";
import { useSession, signOut } from "next-auth/react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import IndiaTaxCompliancePanel from "@/components/dashboard/settings/IndiaTaxCompliancePanel";
import NotificationPreferencesPanel from "@/components/dashboard/settings/NotificationPreferencesPanel";
import ProfileTab, { type Profile, type User } from "@/components/dashboard/settings/ProfileTab";
import SocialTab, { type SocialConnections } from "@/components/dashboard/settings/SocialTab";
import RatesTab from "@/components/dashboard/settings/RatesTab";
import VerificationTab, { type VerificationData } from "@/components/dashboard/settings/VerificationTab";
import SecurityTab from "@/components/dashboard/settings/SecurityTab";
import AppearanceTab from "@/components/dashboard/settings/AppearanceTab";
import BankAccountManager from "@/components/dashboard/wallet/BankAccountManager";
import { Button, ConfirmationBadge, Skeleton, ToastContainer, ThemeToggle, PageContainer, PageHeader } from "@/components/ui";
import {
  User as UserIcon,
  AtSign,
  BarChart2,
  Landmark,
  ShieldCheck,
  Receipt,
  Bell,
  Lock,
  ChevronRight,
  Settings,
  CheckCircle2,
  Palette,
  LogOut,
  Sparkles,
  ExternalLink,
  AlertCircle,
  TrendingUp,
  Globe,
  Copy,
} from "lucide-react";
import StoryShareModal from "@/components/share/StoryShareModal";

interface TabDef {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  influencerOnly?: boolean;
  selfManaged?: boolean;
}

const ALL_TABS: TabDef[] = [
  { id: "profile",       label: "Profile",            Icon: UserIcon },
  { id: "social",        label: "Social Accounts",    Icon: AtSign,   influencerOnly: true },
  { id: "rates",         label: "Rates",              Icon: BarChart2,   influencerOnly: true },
  { id: "bank",          label: "Bank Accounts",      Icon: Landmark,    selfManaged: true },
  { id: "verification",  label: "KYC & Verification", Icon: ShieldCheck, selfManaged: true },
  { id: "tax",           label: "Tax Compliance",     Icon: Receipt,     selfManaged: true },
  { id: "notifications", label: "Notifications",      Icon: Bell,        selfManaged: true },
  { id: "appearance",    label: "Theme & Display",    Icon: Palette,     selfManaged: true },
  { id: "security",      label: "Security",           Icon: Lock,        selfManaged: true },
];

function getTabSubtitle(tab: string, userType?: string): string {
  switch (tab) {
    case "profile":       return userType === "INFLUENCER" ? "Your public creator profile and personal details" : "Your company profile and brand details";
    case "social":        return "Connect and verify your Instagram and YouTube accounts";
    case "rates":         return "Set your campaign pricing and minimum collaboration rates";
    case "bank":          return "Manage bank accounts and UPI IDs for withdrawals";
    case "verification":  return "Complete KYC to unlock full payout and deal access";
    case "tax":           return "PAN, GST, ITR, and TDS details for India compliance";
    case "notifications": return "Choose how you receive alerts. Critical financial and deal events are delivered even when the app is closed.";
    case "appearance":    return "Customize interface appearance, color mode, and active session";
    case "security":      return "Password, 2FA, and login activity management";
    default:              return "Manage your profile and preferences";
  }
}

export default function SettingsPage() {
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const { data: session, update } = useSession();
  const [activeTab, setActiveTab] = useState<string>("profile");
  const [showSavedBadge, setShowSavedBadge] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; type: "success" | "error" | "info"; message: string }>>([]);
  const toastCounterRef = useRef(0);

  const handleRemoveToast = useCallback((id: string) => {
    if (!isMounted.current) return;
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    toastCounterRef.current += 1;
    const id = `toast-${toastCounterRef.current}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => handleRemoveToast(id), 4000);
  }, [handleRemoveToast]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [badgesCount, setBadgesCount] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [socialConnections, setSocialConnections] = useState<SocialConnections | null>(null);
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleSocialVerified = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setProfile((prev) => {
          if (!prev) return prev;
          if (detail.platform === "instagram") {
            return { ...prev, instagramHandle: detail.handle, instagramFollowers: detail.followers, instagramEngagementRate: detail.engagementRate };
          }
          return { ...prev, youtubeHandle: detail.handle, youtubeSubscribers: detail.followers, youtubeEngagementRate: detail.engagementRate };
        });
        showToast(`${detail.platform.toUpperCase()} successfully verified! Stats linked in real.`, "success");
      }
    };
    window.addEventListener("social-verified", handleSocialVerified);
    return () => window.removeEventListener("social-verified", handleSocialVerified);
  }, [showToast]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    if (tabParam) setActiveTab(tabParam);
    const success = urlParams.get("success");
    const notice = urlParams.get("notice");
    if (notice === "already_linked" || success === "already_linked") {
      showToast("Your social account is already connected and up to date.", "info");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (success === "instagram_connected") {
      showToast("Instagram connected successfully!", "success");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (success === "youtube_connected") {
      showToast("YouTube connected successfully!", "success");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (success === "digilocker_connected") {
      showToast("DigiLocker connected successfully! Verification documents loaded.", "success");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get("error")) {
      const rawError = urlParams.get("error") || "";
      showToast(formatUserError(rawError), "error");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [showToast]);

  const { data: settingsData, isLoading: loading } = useSWR<{
    profile?: Partial<Profile>;
    user?: Partial<User> & { referralCode?: string };
    badges?: unknown[];
    socialConnections?: Partial<SocialConnections>;
  }>("/api/settings", fetcher);

  useEffect(() => {
    if (!settingsData) return;
    if (settingsData.profile) {
      setProfile({ ...settingsData.profile, categories: settingsData.profile.categories || [], languages: settingsData.profile.languages || [] } as Profile);
    }
    setReferralCode(settingsData.user?.referralCode || "");
    setBadgesCount(settingsData.badges?.length || 0);
    if (settingsData.user) setUser(settingsData.user as User);
    if (settingsData.socialConnections) setSocialConnections(settingsData.socialConnections as SocialConnections);
  }, [settingsData]);

  useEffect(() => {
    if (!user?.userType) return;
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    const allowedTabs = [
      "profile",
      ...(user.userType === "INFLUENCER" ? ["social", "rates"] : []),
      "bank", "verification", "tax", "notifications", "appearance", "security",
    ];
    if (requestedTab && allowedTabs.includes(requestedTab)) setActiveTab(requestedTab);
  }, [user?.userType]);

  useEffect(() => {
    if (activeTab === "verification" && !verificationData) {
      apiClient.users.getVerification()
        .then((data) => { if (isMounted.current) setVerificationData(data as VerificationData); })
        .catch((err) => { if (err?.name !== "AbortError") logger.error("[settings] Failed to load verification data:", err); });
    }
  }, [activeTab, verificationData]);

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      await apiClient.settings.save(profile);
      try { await update(); } catch (e) { logger.warn("[settings] Session update error after profile save:", { error: String(e) }); }
      showToast("Profile saved successfully!", "success");
      setShowSavedBadge(true);
      setTimeout(() => { if (isMounted.current) setShowSavedBadge(false); }, 3000);
    } catch (error) {
      logger.error("[settings] Failed to save profile:", error);
      showToast(formatUserError(error, "Failed to save profile. Please check your details and try again."), "error");
    } finally {
      if (isMounted.current) setIsSaving(false);
    }
  };

  const visibleTabs = ALL_TABS.filter((t) => {
    if (t.influencerOnly && user?.userType !== "INFLUENCER") return false;
    return true;
  });

  const activeTabDef = visibleTabs.find((t) => t.id === activeTab);
  const isSelfManaged = activeTabDef?.selfManaged ?? false;

  // Account health metrics calculation
  const isKycVerified = Boolean(
    (session?.user?.verificationLevel && session.user.verificationLevel !== "NONE") ||
    (verificationData?.verificationLevel && verificationData.verificationLevel !== "NONE") ||
    (typeof verificationData?.tier === "number" && verificationData.tier >= 1)
  );

  const trustScore = session?.user?.trustScore ?? verificationData?.trustScore ?? 750;

  const healthScore = useMemo(() => {
    let score = 0;
    if (profile?.displayName) score += 20;
    if (profile?.bio) score += 20;
    if (profile?.city) score += 10;
    if (profile?.profileImage) score += 20;
    if (isKycVerified) score += 30;
    return score;
  }, [profile, isKycVerified]);

  const publicProfileUrl = useMemo(() => {
    const isBrandUser = user?.userType === "BRAND" || session?.user?.userType === "BRAND";
    if (isBrandUser) {
      const brandId =
        (profile as unknown as { id?: string })?.id ||
        user?.id ||
        session?.user?.id ||
        (profile?.displayName ? encodeURIComponent(profile.displayName.trim()) : "") ||
        (user?.name ? encodeURIComponent(user.name.trim()) : "");
      if (!brandId || brandId === "undefined") return null;
      return `/brand/${brandId}`;
    }
    // Only use instagramHandle (slug-safe) — never use displayName/user.name which may have spaces
    const handle = profile?.instagramHandle;
    if (handle) {
      return `/creator/${encodeURIComponent(handle.replace(/^@/, "").toLowerCase())}`;
    }
    const creatorId = (profile as unknown as { id?: string })?.id || user?.id || session?.user?.id;
    if (creatorId) {
      return `/dashboard/influencers/${creatorId}`;
    }
    return null;
  }, [user?.userType, session?.user?.userType, user?.id, session?.user?.id, profile, user?.name]);

  // Loading skeleton
  if (loading) {
    return (
      <DashboardShell user={session?.user || user}>
        <PageContainer maxWidth="7xl" className="py-4 sm:py-6">
          <div className="settings-page-layout">
            <div className="settings-sidebar">
              <div className="settings-sidebar-header">
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>
              <div className="settings-sidebar-nav">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-xl mb-1" />
                ))}
              </div>
            </div>
            <div className="settings-content-area">
              <div className="settings-content-header">
                <Skeleton className="h-7 w-48 rounded-md" />
                <Skeleton className="h-9 w-32 rounded-lg" />
              </div>
              <Skeleton className="h-96 w-full rounded-2xl mt-6" />
            </div>
          </div>
        </PageContainer>
      </DashboardShell>
    );
  }

  if (!profile || !user) {
    return (
      <DashboardShell user={session?.user || user}>
        <PageContainer maxWidth="7xl" className="py-4 sm:py-6">
          <div className="settings-error-state">
            <Settings className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-base font-semibold text-foreground">Failed to load settings</p>
            <p className="text-sm text-muted-foreground mt-1">Please refresh the page to try again.</p>
          </div>
        </PageContainer>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={session?.user || user}>
      <ToastContainer toasts={toasts} onClose={handleRemoveToast} />

      <PageContainer maxWidth="7xl" className="space-y-6 pb-16 animate-fade-in py-4 sm:py-6">
        {/* ── Page Header ── */}
        <PageHeader
          title="Account Settings"
          subtitle="Manage your profile, banking credentials, compliance, notifications, and security."
          actions={
            publicProfileUrl ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    if (typeof window !== "undefined") {
                      const fullUrl = `${window.location.origin}${publicProfileUrl}`;
                      await copyToClipboard(fullUrl);
                      showToast("Public profile link copied to clipboard!", "success");
                    }
                  }}
                  className="gap-1.5 text-xs font-semibold shadow-2xs"
                >
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Copy Profile URL</span>
                </Button>
                <Button
                  href={publicProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 text-xs font-semibold shadow-2xs"
                >
                  <span>Public View</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : undefined
          }
          border={false}
        />

        {/* ── 1. ACCOUNT HEALTH SUMMARY BANNER ─────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl bg-card border border-border shadow-xs text-xs">
          {/* KYC Status Tile */}
          <div className="p-3 rounded-xl bg-muted/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isKycVerified ? "bg-verified-muted text-verified" : "bg-pending-muted text-pending"
              }`}>
                {isKycVerified ? <ShieldCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <span className="font-bold text-foreground block truncate">
                  {isKycVerified ? "KYC Verified" : "KYC Pending"}
                </span>
                <span className="text-[11px] text-muted-foreground block truncate">
                  {isKycVerified ? "Full payout access" : "Action required"}
                </span>
              </div>
            </div>
            {!isKycVerified && (
              <button
                type="button"
                onClick={() => setActiveTab("verification")}
                className="px-2 py-1 rounded-lg bg-primary/10 text-primary font-bold text-[10px] hover:bg-primary/20 transition-colors cursor-pointer shrink-0"
              >
                Verify
              </button>
            )}
          </div>

          {/* DRS Trust Score Tile */}
          <div className="p-3 rounded-xl bg-muted/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-foreground block truncate">
                  DRS Trust: {trustScore} / 900
                </span>
                <span className="text-[11px] text-muted-foreground block truncate">
                  Reputation index (300-900)
                </span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-verified-muted text-verified font-mono shrink-0 whitespace-nowrap">
              Tier 1
            </span>
          </div>

          {/* Profile Completeness Tile */}
          <div className="p-3 rounded-xl bg-muted/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-escrow-muted text-escrow flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-foreground block truncate">
                  {healthScore}% Complete
                </span>
                <span className="text-[11px] text-muted-foreground block truncate">
                  Dossier strength
                </span>
              </div>
            </div>
            <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden border border-border shrink-0">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${healthScore}%` }}
              />
            </div>
          </div>

          {/* Public Profile View (Live on Web) */}
          <div className="p-3 rounded-xl bg-muted/40 flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-foreground block text-xs truncate">
                  Public Profile
                </span>
                <span className="text-[11px] text-muted-foreground block truncate">
                  Live on web
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {publicProfileUrl ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof window !== "undefined") {
                        const fullUrl = `${window.location.origin}${publicProfileUrl}`;
                        await copyToClipboard(fullUrl);
                        showToast("Public profile link copied to clipboard!", "success");
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-card border border-border text-foreground font-semibold text-xs hover:bg-muted transition-all cursor-pointer shadow-2xs shrink-0"
                    title="Copy public profile link to clipboard"
                  >
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Copy Link</span>
                  </button>
                  <Link
                    href={publicProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-card border border-border text-foreground font-bold text-xs hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all cursor-pointer shadow-2xs shrink-0 whitespace-nowrap"
                    title="View public profile on web"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </>
              ) : (
                <span className="text-[11px] text-muted-foreground font-medium">Pending Setup</span>
              )}
            </div>
          </div>
        </div>

        {/* ── 2. SETTINGS MAIN LAYOUT ───────────────────────────────────────── */}
        <div className="settings-page-layout">
          {/* ── Sidebar ── */}
          <aside className="settings-sidebar">
            <div className="settings-sidebar-header">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Settings</span>
            </div>

            <nav className="settings-sidebar-nav" role="tablist" aria-label="Settings sections">
              {visibleTabs.map((tab) => {
                const Icon = tab.Icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className="settings-sidebar-item cursor-pointer"
                    data-active={isActive}
                    id={`settings-tab-${tab.id}`}
                  >
                    <span className="settings-sidebar-item-icon">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="settings-sidebar-item-label">{tab.label}</span>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60 shrink-0" />}
                  </button>
                );
              })}
            </nav>

            {/* Quick theme & logout footer for sidebar (Desktop) */}
            <div className="hidden md:block p-3 border-t border-border mt-auto space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Theme
                </span>
                <ThemeToggle size="sm" />
              </div>

              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20 hover:border-destructive/30 transition-all focus:outline-none cursor-pointer"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>

            {/* Mini profile card */}
            <div className="settings-sidebar-profile">
              <div className="settings-sidebar-avatar">
                {profile.profileImage ? (
                  <img src={profile.profileImage} alt="Profile" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <UserIcon className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{profile.displayName || user.name || "—"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user.email || ""}</p>
              </div>
            </div>
          </aside>

          {/* ── Content area ── */}
          <main
            className="settings-content-area"
            role="tabpanel"
            aria-labelledby={`settings-tab-${activeTab}`}
          >
            <div className="settings-content-header">
              <div>
                <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                  {activeTabDef?.label ?? "Settings"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {getTabSubtitle(activeTab, user.userType)}
                </p>
              </div>

              {!isSelfManaged && (
                <div className="flex items-center gap-3">
                  <ConfirmationBadge show={showSavedBadge} message="Saved" />
                  <Button
                    variant="primary"
                    aria-label={isSaving ? "Saving changes" : "Save Changes"}
                    aria-busy={isSaving}
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? <span className="loading" /> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Save Changes</>}
                  </Button>
                </div>
              )}
            </div>

            <div className="settings-panel-body">
              {activeTab === "profile" && (
                <ProfileTab profile={profile} setProfile={setProfile} user={user} referralCode={referralCode} badgesCount={badgesCount} showToast={showToast} />
              )}
              {activeTab === "social" && (
                <SocialTab profile={profile} setProfile={setProfile} socialConnections={socialConnections} setSocialConnections={setSocialConnections} isSaving={isSaving} setIsSaving={setIsSaving} showToast={showToast} />
              )}
              {activeTab === "rates" && (
                <RatesTab profile={profile} setProfile={setProfile} />
              )}
              {activeTab === "bank" && (
                <div className="max-w-4xl">
                  <BankAccountManager />
                </div>
              )}
              {activeTab === "verification" && (
                <VerificationTab user={user} verificationData={verificationData} setVerificationData={setVerificationData} showToast={showToast} />
              )}
              {activeTab === "tax" && <IndiaTaxCompliancePanel />}
              {activeTab === "notifications" && <NotificationPreferencesPanel />}
              {activeTab === "appearance" && (
                <AppearanceTab user={user} showToast={showToast} />
              )}
              {activeTab === "security" && (
                <SecurityTab user={user} setUser={setUser} isSaving={isSaving} setIsSaving={setIsSaving} showToast={showToast} />
              )}
            </div>
          </main>
        </div>
      </PageContainer>

      {/* Story Share Modal (Public Profile & Referral Story) */}
      <StoryShareModal
        open={storyModalOpen}
        onClose={() => setStoryModalOpen(false)}
        defaultTab={referralCode && !profile?.instagramHandle && user?.userType !== "BRAND" ? "referral" : "profile"}
        referralCode={referralCode}
        userType={user?.userType}
        profile={profile || user ? {
          displayName: profile?.displayName || profile?.companyName || user?.name || (user?.userType === "BRAND" ? "Verified Brand" : "Vyapar Creator"),
          username: user?.userType === "BRAND"
            ? (profile?.companyName?.toLowerCase().replace(/[^a-z0-9]/g, "") || user?.id?.slice(-8) || "brand")
            : (profile?.instagramHandle?.replace(/^@/, "").toLowerCase() || user?.id?.slice(-8) || "creator"),
          avatar: profile?.profileImage,
          trustScore: user?.trustScore ?? (user?.userType === "BRAND" ? 750 : 600),
          categories: profile?.categories,
          city: profile?.city,
          companyName: profile?.companyName,
          industry: profile?.industry,
          website: profile?.website,
          isKycVerified: user?.verificationLevel === "FULL" || user?.verificationLevel === "IDENTITY",
          userType: user?.userType,
        } : undefined}
      />
    </DashboardShell>
  );
}
