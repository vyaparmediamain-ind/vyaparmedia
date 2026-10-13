"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { fetcher } from "@/lib/fetcher";
import { banUser, unbanUser, awardBadgeAction, resolveFraudAppealAction } from "../actions";
import { checkAdminBanEligibility } from "@/lib/action-eligibility";
import { analyzeInfluencerFraudProfile } from "@/lib/social-proof-core";
import Image from "next/image";
import EmptyState from "@/components/ui/EmptyState";
import { Badge, Button, Input, Select, PageContainer, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils-client";
import { formatUserError } from "@/lib/user-messages";
import { useToasts, ToastContainer } from "@/components/ui";
import { logger } from "@/lib/logger-client";
import type { AdminService } from "@/services/admin.service";
import type { Prisma } from "@prisma/client";
import {
  Users,
  Search,
  Award,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";

type AdminUserListElement = Prisma.PromiseReturnType<typeof AdminService.listUsers>["users"][number];
type ListUsersResult = {
  success: boolean;
  data: {
    users: AdminUserListElement[];
    total: number;
  };
};

interface TaxComplianceUser {
  userType: string;
  taxCompliance?: {
    panLast4?: string | null;
    eInvoiceApplicable?: boolean | null;
    status?: string | null;
    gstinLast4?: string | null;
  } | null;
}

function taxStatusLabel(user: TaxComplianceUser) {
  if (user.userType === "ADMIN") return "N/A";
  const tax = user.taxCompliance;
  if (!tax?.panLast4) return "PAN missing";
  if (user.userType === "BRAND" && tax.eInvoiceApplicable) return "E-invoice";
  if (tax.status === "READY") return "Ready";
  return tax.status ? tax.status.toLowerCase().replaceAll("_", " ") : "Pending";
}

function taxStatusTone(user: TaxComplianceUser): "success" | "danger" | "warning" | "ghost" {
  if (user.userType === "ADMIN") return "ghost";
  const tax = user.taxCompliance;
  if (!tax?.panLast4) return "danger";
  if (tax.status === "READY") return "success";
  return "warning";
}

interface AuthenticityAuditModalProps {
  user: AdminUserListElement;
  onClose: () => void;
  onResolveAppeal: (decision: "APPROVE_APPEAL" | "CONFIRM_FLAG", notes: string) => Promise<void>;
  isLoading: boolean;
}

function AuthenticityAuditModal({
  user,
  onClose,
  onResolveAppeal,
  isLoading,
}: AuthenticityAuditModalProps) {
  const [notes, setNotes] = useState("");
  const profile = user.influencerProfile;
  if (!profile) return null;

  const analysis = analyzeInfluencerFraudProfile({
    id: profile.id,
    instagramFollowers: profile.instagramFollowers,
    instagramEngagementRate: profile.instagramEngagementRate,
    youtubeSubscribers: profile.youtubeSubscribers,
    youtubeEngagementRate: profile.youtubeEngagementRate,
    followerAuthenticityScore: profile.followerAuthenticityScore,
    userCreatedAt: user.createdAt,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[calc(90dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Follower Authenticity & Fraud Audit</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Explainable rule-based signals & appeal resolution for {profile.displayName || user.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-lg hover:bg-muted"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Score & Risk Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Authenticity Score</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black text-foreground">{analysis.followerAuthenticityScore}</span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Fraud Risk Tier</span>
            <Badge
              variant={analysis.fraudRiskLevel === "HIGH" ? "danger" : analysis.fraudRiskLevel === "MEDIUM" ? "warning" : "success"}
              className="mt-1 font-bold text-xs"
            >
              {analysis.fraudRiskLevel} RISK
            </Badge>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Account Status</span>
            <Badge
              variant={user.status === "FLAGGED" ? "danger" : user.status === "ACTIVE" ? "success" : "ghost"}
              className="mt-1 font-bold text-xs"
            >
              {user.status}
            </Badge>
          </div>
        </div>

        {/* Channel Metrics & Cross-Platform ER Comparison */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Connected Channels</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-card border border-border space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-foreground">📸 Instagram</span>
                <span className="text-muted-foreground font-mono">
                  {analysis.metrics.instagramFollowers.toLocaleString()} followers
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                <span>Engagement Rate</span>
                <span className="font-semibold text-foreground">
                  {analysis.metrics.instagramEngagementRate.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-foreground">▶️ YouTube</span>
                <span className="text-muted-foreground font-mono">
                  {analysis.metrics.youtubeSubscribers.toLocaleString()} subscribers
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                <span>Engagement Rate</span>
                <span className="font-semibold text-foreground">
                  {analysis.metrics.youtubeEngagementRate.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {analysis.metrics.crossPlatformRatio && analysis.metrics.crossPlatformRatio > 1 && (
            <div className="p-2.5 rounded-lg bg-muted/30 border border-border text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Cross-Platform ER Divergence:</span>
              <span className={`font-mono font-bold ${analysis.metrics.crossPlatformRatio >= 10 ? "text-danger" : analysis.metrics.crossPlatformRatio >= 6 ? "text-warning" : "text-foreground"}`}>
                {analysis.metrics.crossPlatformRatio}x ratio
              </span>
            </div>
          )}
        </div>

        {/* Detected Fraud Signals (Explainability) */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Rule-Based Audit Signals ({analysis.fraudSignals.length})
          </h3>
          {analysis.fraudSignals.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-success/10 border border-success/30 text-xs text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>No anomalous fraud signals detected. All metrics match platform authentic benchmarks.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {analysis.fraudSignals.map((signal, idx) => (
                <div
                  key={`${signal.code}-${idx}`}
                  className="p-3 rounded-xl bg-card border border-border space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-warning" /> {signal.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={signal.severity === "HIGH" ? "danger" : signal.severity === "MEDIUM" ? "warning" : "ghost"}
                        className="text-[9px] uppercase"
                      >
                        {signal.severity}
                      </Badge>
                      <span className="text-[10px] font-mono font-bold text-danger">
                        {signal.impactScore} pts
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {signal.detail}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Creator Submitted Appeal (if present) */}
        {user.activityLogs?.[0] && (
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" /> Creator Appeal Submitted
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {formatDate(user.activityLogs[0].createdAt)}
              </span>
            </div>
            {(() => {
              const meta = user.activityLogs[0].metadata as Record<string, unknown> | null;
              const reason = typeof meta?.reason === "string" ? meta.reason : "No written statement provided";
              const evidenceUrl = typeof meta?.evidenceUrl === "string" ? meta.evidenceUrl : null;
              return (
                <>
                  <p className="text-foreground leading-relaxed italic bg-card/60 p-2 rounded-lg border border-border">
                    "{reason}"
                  </p>
                  {evidenceUrl && (
                    <a
                      href={evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-primary underline inline-flex items-center gap-1 hover:text-primary/80"
                    >
                      <span>View Creator Proof / Evidence Link</span> ↗
                    </a>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Dispute & Appeal Resolution Workflow */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div>
            <h3 className="text-xs font-bold text-foreground">Dispute & Appeal Resolution</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              If creator has submitted valid evidence (e.g. viral post metrics, format transition), you can approve the appeal to reset their flag and recalibrate their score.
            </p>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for decision (e.g., 'Verified genuine viral reel on Instagram, audience shift confirmed')..."
            rows={2}
            className="w-full text-xs p-2.5 rounded-xl bg-muted/30 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
              className="min-h-[40px] px-3 font-semibold text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => onResolveAppeal("CONFIRM_FLAG", notes)}
              disabled={isLoading}
              className="min-h-[40px] px-3 font-bold text-xs cursor-pointer"
            >
              Confirm / Uphold Flag
            </Button>
            <Button
              variant="success"
              onClick={() => onResolveAppeal("APPROVE_APPEAL", notes)}
              disabled={isLoading}
              className="min-h-[40px] px-3 font-bold text-xs cursor-pointer"
            >
              Approve Appeal & Recalibrate
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface UserRowProps {
  readonly user: AdminUserListElement;
  readonly onBan: (id: string) => void;
  readonly onUnban: (id: string) => void;
  readonly onAwardBadge: (e: React.FormEvent<HTMLFormElement>, id: string) => void;
  readonly onInspectFraud: (user: AdminUserListElement) => void;
  readonly isActionLoading?: boolean;
}

function UserRow({ user, onBan, onUnban, onAwardBadge, onInspectFraud, isActionLoading }: UserRowProps) {
  const { data: session } = useSession();
  const banEligibility = checkAdminBanEligibility(session?.user?.id || "", user.id);

  const name =
    user.influencerProfile?.displayName ||
    user.brandProfile?.companyName ||
    (user.userType === "ADMIN" ? user.email?.split("@")[0] : null) ||
    "Unknown user";
  const avatar = user.influencerProfile?.avatar || user.brandProfile?.logo;
  const isBanned = user.status === "BANNED";

  const getStatusVariant = (status: string) => {
    if (status === "ACTIVE") return "success";
    if (status === "BANNED" || status === "SUSPENDED") return "danger";
    if (status === "FLAGGED") return "warning";
    return "ghost";
  };

  return (
    <tr className="hover:bg-muted/20 transition-colors group">
      {/* Identity */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm shrink-0 overflow-hidden relative">
            {avatar ? (
              <Image
                src={avatar}
                alt=""
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm text-foreground truncate max-w-[200px]">
              {name}
            </div>
            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
              {user.email}
            </div>
            {user.badges && user.badges.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1">
                {user.badges.map((b: { badgeId: string }) => (
                  <span
                    key={b.badgeId}
                    className="text-[9px] bg-muted/60 border border-border px-1.5 py-0.2 rounded-md text-muted-foreground font-bold capitalize"
                  >
                    🏆 {b.badgeId.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-5 py-4">
        <Badge variant="primary" className="text-[10px] uppercase font-bold">
          {user.userType}
        </Badge>
      </td>

      {/* Status */}
      <td className="px-5 py-4">
        <Badge variant={getStatusVariant(user.status)} className="text-[10px] uppercase">
          {user.status.toLowerCase().replaceAll("_", " ")}
        </Badge>
      </td>

      {/* Authenticity / Fraud Risk */}
      <td className="px-5 py-4 text-xs">
        {user.userType === "INFLUENCER" && user.influencerProfile ? (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm text-foreground">
                {user.influencerProfile.followerAuthenticityScore ?? 75}
              </span>
              <span className="text-[10px] text-muted-foreground">/100</span>
              <Badge
                variant={
                  user.status === "FLAGGED" || (user.influencerProfile.followerAuthenticityScore ?? 75) < 40
                    ? "danger"
                    : (user.influencerProfile.followerAuthenticityScore ?? 75) < 60
                    ? "warning"
                    : "success"
                }
                className="text-[9px] uppercase px-1.5 py-0"
              >
                {user.status === "FLAGGED"
                  ? "FLAGGED"
                  : (user.influencerProfile.followerAuthenticityScore ?? 75) < 40
                  ? "HIGH RISK"
                  : (user.influencerProfile.followerAuthenticityScore ?? 75) < 60
                  ? "MED RISK"
                  : "GENUINE"}
              </Badge>
            </div>
            <button
              type="button"
              onClick={() => onInspectFraud(user)}
              className="text-[10px] text-primary hover:underline font-semibold mt-0.5 block cursor-pointer"
            >
              Inspect Signals &rarr;
            </button>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Tax */}
      <td className="px-5 py-4 text-xs">
        <Badge variant={taxStatusTone(user)} className="text-[10px]">
          {taxStatusLabel(user)}
        </Badge>
        {user.taxCompliance?.gstinLast4 && (
          <div className="text-muted-foreground text-[10px] mt-0.5 font-mono">
            GST ****{user.taxCompliance.gstinLast4}
          </div>
        )}
      </td>

      {/* Trust */}
      <td className="px-5 py-4 text-center">
        <span className="font-black text-sm text-foreground">
          {user.trustScore}
        </span>
        <span className="text-[10px] text-muted-foreground">/900</span>
      </td>

      {/* Joined */}
      <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(user.createdAt)}
      </td>

      {/* Actions */}
      <td className="px-5 py-4 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          {user.userType !== "ADMIN" && (
            <form onSubmit={(e) => onAwardBadge(e, user.id)} className="inline-flex items-center gap-1.5">
              <input type="hidden" name="userId" value={user.id} />
              <Select
                name="badgeId"
                className="text-xs py-1 min-h-[44px] h-11 max-w-[130px]"
                defaultValue=""
                required
                disabled={Boolean(isActionLoading)}
              >
                <option value="" disabled>Badge...</option>
                <option value="beta_tester" disabled={user.badges?.some((b: { badgeId: string }) => b.badgeId === "beta_tester")}>
                  Beta Tester
                </option>
                <option value="mystery_badge" disabled={user.badges?.some((b: { badgeId: string }) => b.badgeId === "mystery_badge")}>
                  Mystery
                </option>
                <option value="bug_reporter" disabled={user.badges?.some((b: { badgeId: string }) => b.badgeId === "bug_reporter")}>
                  Bug Hunter
                </option>
                <option value="feedback_giver" disabled={user.badges?.some((b: { badgeId: string }) => b.badgeId === "feedback_giver")}>
                  Idea Gen
                </option>
              </Select>
              <Button
                variant="secondary"
                type="submit"
                className="min-h-[44px] min-w-[44px] px-3 font-bold flex items-center justify-center cursor-pointer"
                disabled={Boolean(isActionLoading)}
                aria-label="Award badge"
              >
                <Award className="w-4 h-4" />
              </Button>
            </form>
          )}

          {user.userType !== "ADMIN" && (
            <>
              {user.status === "FLAGGED" && (
                <Button
                  variant="success"
                  onClick={() => onUnban(user.id)}
                  className="min-h-[44px] px-3.5 font-bold cursor-pointer"
                  disabled={Boolean(isActionLoading)}
                >
                  Approve
                </Button>
              )}
              {isBanned ? (
                <Button
                  variant="secondary"
                  onClick={() => onUnban(user.id)}
                  className="min-h-[44px] px-3.5 font-bold cursor-pointer"
                  disabled={Boolean(isActionLoading)}
                >
                  Unban
                </Button>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => onBan(user.id)}
                  className="min-h-[44px] px-3.5 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={Boolean(isActionLoading) || !banEligibility.allowed}
                  title={!banEligibility.allowed ? banEligibility.reason : undefined}
                >
                  Ban
                </Button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [auditUser, setAuditUser] = useState<AdminUserListElement | null>(null);
  const { toasts, showToast, removeToast } = useToasts();
  const limit = 50;

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", String(limit));
  if (search.trim()) queryParams.set("search", search.trim());
  if (type !== "ALL") queryParams.set("type", type);
  if (status !== "ALL") queryParams.set("status", status);

  const { data, error, isLoading, mutate } = useSWR<ListUsersResult>(
    `/api/admin/users?${queryParams.toString()}`,
    fetcher
  );

  const users = data?.data?.users || [];
  const total = data?.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / (limit || 1)));

  const handleBan = async (userId: string) => {
    const banEligibility = checkAdminBanEligibility(session?.user?.id || "", userId);
    if (!banEligibility.allowed) {
      showToast("error", banEligibility.reason || "Cannot ban this user");
      return;
    }
    if (!confirm("Are you sure you want to ban this user?")) return;
    setLoadingAction(userId);
    try {
      await banUser(userId);
      showToast("success", "User banned successfully.");
      mutate();
    } catch (err) {
      logger.error("[AdminUsers] Failed to ban user", { userId, error: String(err) });
      showToast("error", formatUserError(err, "Failed to ban user. Please try again."));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUnban = async (userId: string) => {
    setLoadingAction(userId);
    try {
      await unbanUser(userId);
      showToast("success", "User unbanned successfully.");
      mutate();
    } catch (err) {
      logger.error("[AdminUsers] Failed to unban user", { userId, error: String(err) });
      showToast("error", formatUserError(err, "Failed to unban user. Please try again."));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAwardBadge = async (e: React.FormEvent<HTMLFormElement>, userId: string) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoadingAction(userId);
    try {
      await awardBadgeAction(formData);
      showToast("success", "Badge awarded successfully!");
      mutate();
    } catch (err) {
      logger.error("[AdminUsers] Failed to award badge", { userId, error: String(err) });
      showToast("error", formatUserError(err, "Failed to award badge. Please try again."));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResolveAppeal = async (decision: "APPROVE_APPEAL" | "CONFIRM_FLAG", notes: string) => {
    if (!auditUser) return;
    setLoadingAction(auditUser.id);
    try {
      await resolveFraudAppealAction(auditUser.id, decision, notes);
      showToast("success", decision === "APPROVE_APPEAL" ? "Appeal approved! Profile status restored and score recalibrated." : "Fraud flag confirmed.");
      setAuditUser(null);
      mutate();
    } catch (err) {
      logger.error("[AdminUsers] Failed to resolve appeal", { userId: auditUser.id, decision, error: String(err) });
      showToast("error", formatUserError(err, "Failed to resolve appeal. Please try again."));
    } finally {
      setLoadingAction(null);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`skeleton-user-${i}`}
              className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/40 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-4 w-36 bg-muted rounded" />
                  <div className="h-3 w-48 bg-muted rounded" />
                </div>
              </div>
              <div className="h-6 w-20 bg-muted rounded" />
              <div className="h-6 w-20 bg-muted rounded hidden sm:block" />
              <div className="h-8 w-24 bg-muted rounded" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-8 text-center text-disputed text-sm font-bold">
          Failed to load users from directory.
        </div>
      );
    }

    if (users.length === 0) {
      return (
        <div className="p-8">
          <EmptyState
            emoji="👥"
            title="No Users Found"
            description="Try changing your search keywords or filter criteria."
          />
        </div>
      );
    }

    return (
      <>
        {/* Mobile Card Layout (sm:hidden) */}
        <div className="space-y-3 sm:hidden p-3">
          {users.map((user: AdminUserListElement) => {
            const name =
              user.influencerProfile?.displayName ||
              user.brandProfile?.companyName ||
              (user.userType === "ADMIN" ? user.email?.split("@")[0] : null) ||
              "Unknown user";
            const avatar = user.influencerProfile?.avatar || user.brandProfile?.logo;
            const isBanned = user.status === "BANNED";

            return (
              <div
                key={user.id}
                className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm shrink-0 overflow-hidden relative">
                      {avatar ? (
                        <Image src={avatar} alt="" fill unoptimized className="object-cover" />
                      ) : (
                        name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-foreground truncate">{name}</div>
                      <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="primary" className="text-[10px] uppercase font-bold">
                      {user.userType}
                    </Badge>
                    <Badge variant={user.status === "ACTIVE" ? "success" : user.status === "BANNED" ? "danger" : "warning"} className="text-[10px] uppercase">
                      {user.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-border/60">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground">Tax Status</span>
                    <Badge variant={taxStatusTone(user)} className="text-[10px] mt-0.5">
                      {taxStatusLabel(user)}
                    </Badge>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground">Trust Score</span>
                    <span className="font-black text-sm text-foreground">{user.trustScore}</span>
                    <span className="text-[10px] text-muted-foreground"> /900</span>
                  </div>
                </div>

                {user.userType === "INFLUENCER" && user.influencerProfile && (
                  <div className="flex items-center justify-between pt-1.5 border-t border-border/60 text-xs">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground">Authenticity</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-black text-sm text-foreground">
                          {user.influencerProfile.followerAuthenticityScore ?? 75}/100
                        </span>
                        <Badge
                          variant={
                            user.status === "FLAGGED" || (user.influencerProfile.followerAuthenticityScore ?? 75) < 40
                              ? "danger"
                              : (user.influencerProfile.followerAuthenticityScore ?? 75) < 60
                              ? "warning"
                              : "success"
                          }
                          className="text-[9px] uppercase px-1.5 py-0"
                        >
                          {user.status === "FLAGGED" ? "FLAGGED" : "AUDITED"}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => setAuditUser(user)}
                      className="min-h-[36px] px-2.5 text-xs font-semibold cursor-pointer"
                    >
                      Audit Signals
                    </Button>
                  </div>
                )}

                {user.userType !== "ADMIN" && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    {user.status === "FLAGGED" && (
                      <Button
                        variant="success"
                        onClick={() => handleUnban(user.id)}
                        className="flex-1 min-h-[44px] font-bold text-xs cursor-pointer"
                        disabled={loadingAction === user.id}
                      >
                        Approve
                      </Button>
                    )}
                    {isBanned ? (
                      <Button
                        variant="secondary"
                        onClick={() => handleUnban(user.id)}
                        className="flex-1 min-h-[44px] font-bold text-xs cursor-pointer"
                        disabled={loadingAction === user.id}
                      >
                        Unban
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        onClick={() => handleBan(user.id)}
                        className="flex-1 min-h-[44px] font-bold text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loadingAction === user.id || !checkAdminBanEligibility(session?.user?.id || "", user.id).allowed}
                        title={!checkAdminBanEligibility(session?.user?.id || "", user.id).allowed ? checkAdminBanEligibility(session?.user?.id || "", user.id).reason : undefined}
                      >
                        Ban Account
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop Table (hidden sm:block) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse" aria-label="Platform users">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["User", "Role", "Status", "Authenticity", "Tax Compliance", "Trust", "Joined", "Actions"].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-5 py-3.5 text-xs font-bold text-muted-foreground uppercase tracking-wider"
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user: AdminUserListElement) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isActionLoading={loadingAction === user.id}
                  onBan={handleBan}
                  onUnban={handleUnban}
                  onAwardBadge={handleAwardBadge}
                  onInspectFraud={setAuditUser}
                />
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <PageContainer maxWidth="6xl" className="space-y-6 py-2 sm:py-4">
      <ToastContainer toasts={toasts} onClose={removeToast} />
      {/* Header */}
      <PageHeader
        icon={
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
        }
        title="User Directory"
        subtitle="Search, moderate, award credentials, inspect tax readiness, and review fraud signals."
        actions={
          <div className="px-4 py-2.5 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3 shrink-0">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Matches
              </div>
              <div className="text-sm font-black text-foreground">{total} accounts</div>
            </div>
          </div>
        }
      />

      {/* Filter Toolbar Card */}
      <div className="p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            name="search"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 w-full"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select
            name="type"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-36 min-h-[44px]"
          >
            <option value="ALL">All roles</option>
            <option value="INFLUENCER">Influencers</option>
            <option value="BRAND">Brands</option>
          </Select>

          <Select
            name="status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-44 min-h-[44px]"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING_VERIFICATION">Pending verification</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="BANNED">Banned</option>
            <option value="FLAGGED">Flagged</option>
          </Select>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
        {renderContent()}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground px-1">
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            variant="secondary"
            aria-label="Previous page"
            aria-disabled={page <= 1}
            disabled={page <= 1}
            className="gap-1 font-bold min-h-[44px] px-4 flex-1 sm:flex-initial cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </Button>
          <Button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            variant="secondary"
            aria-label="Next page"
            aria-disabled={page >= totalPages}
            disabled={page >= totalPages}
            className="gap-1 font-bold min-h-[44px] px-4 flex-1 sm:flex-initial cursor-pointer"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <span className="font-medium">
          Page {page} of {totalPages} &bull; Showing {users.length} of {total} accounts
        </span>
      </div>

      {/* Authenticity & Fraud Audit Modal */}
      {auditUser && (
        <AuthenticityAuditModal
          user={auditUser}
          onClose={() => setAuditUser(null)}
          onResolveAppeal={handleResolveAppeal}
          isLoading={loadingAction === auditUser.id}
        />
      )}
    </PageContainer>
  );
}
