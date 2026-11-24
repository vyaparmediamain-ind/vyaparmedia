"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  PageContainer,
  PageHeader,
  Button,
  Badge,
  Input,
  Select,
  Modal,
  EmptyState,
  useToasts,
  ToastContainer,
} from "@/components/ui";
import {
  GraduationCap,
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Calendar,
  Percent,
  TrendingUp,
  Clock,
  Phone,
  Mail,
  MapPin,
  Building,
  CreditCard,
  Users,
  Camera,
} from "lucide-react";
import { formatDate } from "@/lib/utils-client";

interface ScoutItem {
  id: string;
  userId: string;
  scoutCode: string;
  fullName: string;
  phone: string;
  city: string;
  state: string;
  college?: string | null;
  panNumber: string;
  aadhaarNumber: string;
  selfieUrl?: string | null;
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  royaltyPercent: number;
  isRoyaltyPaused: boolean;
  royaltyPauseReason?: string | null;
  monthlyQuotaExemptUntil?: string | null;
  streakMonths: number;
  totalRoyaltyEarned: number;
  createdAt: string;
  user?: {
    email: string;
    createdAt: string;
    _count?: {
      referredUsers: number;
    };
  };
}

interface ScoutsResponse {
  success: boolean;
  data: {
    scouts: ScoutItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export default function AdminScoutsPage() {
  const { toasts, showToast, removeToast } = useToasts();
  const [tab, setTab] = useState<"PENDING" | "ALL">("PENDING");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [isMutating, setIsMutating] = useState(false);

  // Modals state
  const [rejectModalScout, setRejectModalScout] = useState<ScoutItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [pauseModalScout, setPauseModalScout] = useState<ScoutItem | null>(null);
  const [pauseReason, setPauseReason] = useState("");

  const [exemptionModalScout, setExemptionModalScout] = useState<ScoutItem | null>(null);
  const [exemptionDays, setExemptionDays] = useState(30);

  const [rateModalScout, setRateModalScout] = useState<ScoutItem | null>(null);
  const [customRate, setCustomRate] = useState(1.0);

  // SWR Query
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: "20",
    ...(tab === "PENDING" ? { status: "PENDING" } : statusFilter !== "ALL" ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
  });

  const { data, error, mutate, isLoading } = useSWR<ScoutsResponse>(
    `/api/admin/scouts?${queryParams.toString()}`,
    fetcher
  );

  const scouts = data?.data?.scouts || [];
  const pagination = data?.data?.pagination;

  const handleAction = async (scoutId: string, payload: Record<string, unknown>, successMessage: string) => {
    setIsMutating(true);
    try {
      const res = await fetch(`/api/admin/scouts/${scoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to process action");
      }

      showToast("success", successMessage);
      mutate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error performing scout action";
      showToast("error", msg);
    } finally {
      setIsMutating(false);
    }
  };

  const confirmApprove = (scout: ScoutItem) => {
    handleAction(scout.id, { action: "APPROVE" }, `Scout ${scout.fullName} approved successfully!`);
  };

  const confirmReject = async () => {
    if (!rejectModalScout) return;
    if (!rejectReason.trim()) {
      showToast("info", "Please enter a rejection reason");
      return;
    }
    await handleAction(
      rejectModalScout.id,
      { action: "REJECT", reason: rejectReason.trim() },
      `Scout application rejected.`
    );
    setRejectModalScout(null);
    setRejectReason("");
  };

  const confirmTogglePause = async () => {
    if (!pauseModalScout) return;
    const nextPause = !pauseModalScout.isRoyaltyPaused;
    await handleAction(
      pauseModalScout.id,
      { action: "TOGGLE_PAUSE", pause: nextPause, reason: pauseReason.trim() || undefined },
      nextPause ? "Royalty stream paused." : "Royalty stream resumed."
    );
    setPauseModalScout(null);
    setPauseReason("");
  };

  const confirmGrantExemption = async () => {
    if (!exemptionModalScout) return;
    await handleAction(
      exemptionModalScout.id,
      { action: "GRANT_EXEMPTION", days: exemptionDays },
      `Exam/Grace pass granted for ${exemptionDays} days.`
    );
    setExemptionModalScout(null);
  };

  const confirmUpdateRate = async () => {
    if (!rateModalScout) return;
    await handleAction(
      rateModalScout.id,
      { action: "UPDATE_ROYALTY_PERCENT", royaltyPercent: customRate },
      `Royalty rate updated to ${customRate}%.`
    );
    setRateModalScout(null);
  };

  return (
    <PageContainer maxWidth="7xl" className="space-y-6 py-2 sm:py-4">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <PageHeader
        icon={
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
        }
        title="Campus Scouts & Regional Partners"
        subtitle="Review 18+ KYC verifications, manage passive 1% lifetime royalties, grant exam quota grace, and inspect network growth."
      />

      {/* Tabs & Filter Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Button
              variant={tab === "PENDING" ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setTab("PENDING");
                setPage(1);
              }}
              className="gap-2"
            >
              <Clock className="w-4 h-4" />
              Pending KYC Queue
            </Button>
            <Button
              variant={tab === "ALL" ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setTab("ALL");
                setPage(1);
              }}
              className="gap-2"
            >
              <Users className="w-4 h-4" />
              All Scouts Directory
            </Button>
          </div>

          {tab === "ALL" && (
            <div className="w-full sm:w-48">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "ALL", label: "All Statuses" },
                  { value: "APPROVED", label: "Approved Only" },
                  { value: "PENDING", label: "Pending Only" },
                  { value: "REJECTED", label: "Rejected Only" },
                ]}
              />
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by Scout name, code, phone, PAN, or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-2xl">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mb-2" />
          <p className="text-sm">Loading scout profiles...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-destructive bg-destructive/10 border border-destructive/20 rounded-2xl">
          Failed to load scouts. Please try refreshing.
        </div>
      ) : scouts.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <EmptyState
            emoji={tab === "PENDING" ? "🎉" : "🔍"}
            title={tab === "PENDING" ? "KYC Queue is Clear!" : "No Scouts Found"}
            description={
              tab === "PENDING"
                ? "There are no pending scout verifications waiting right now."
                : "Try adjusting your search query or status filter."
            }
            guideId="admin-campus-scouts"
        guideLabel="Campus Scouts Governance Guide"
      />
        </div>
      ) : (
        <div className="space-y-4">
          {scouts.map((scout) => {
            const isExempt =
              scout.monthlyQuotaExemptUntil && new Date(scout.monthlyQuotaExemptUntil) > new Date();

            return (
              <div
                key={scout.id}
                className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 hover:border-primary/40 transition-all duration-200"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-base shrink-0">
                      {scout.fullName?.charAt(0)?.toUpperCase() || "S"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-foreground text-base">{scout.fullName}</h3>
                        <Badge
                          variant={
                            scout.verificationStatus === "APPROVED"
                              ? "success"
                              : scout.verificationStatus === "PENDING"
                              ? "warning"
                              : "danger"
                          }
                          className="text-[10px] px-2 py-0.5"
                        >
                          {scout.verificationStatus}
                        </Badge>
                        {scout.isRoyaltyPaused && (
                          <Badge variant="danger" className="text-[10px] px-2 py-0.5">
                            Royalty Paused
                          </Badge>
                        )}
                        {isExempt && (
                          <Badge variant="primary" className="text-[10px] px-2 py-0.5">
                            Exam Pass Active
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="font-mono text-primary font-medium">Code: {scout.scoutCode}</span>
                        <span>Joined: {formatDate(scout.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <div className="text-muted-foreground">Royalty Rate</div>
                      <div className="font-bold text-foreground">{scout.royaltyPercent}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-muted-foreground">Network Size</div>
                      <div className="font-bold text-foreground">
                        {scout.user?._count?.referredUsers || 0} onboarded
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-muted-foreground">Total Royalty</div>
                      <div className="font-bold text-success">
                        ₹{(scout.totalRoyaltyEarned / 100).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-muted/30 p-3.5 rounded-xl border border-border/50">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-foreground truncate">{scout.user?.email || "No email"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-foreground">{scout.phone || "No phone"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-foreground truncate">{scout.city}, {scout.state}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-foreground truncate">{scout.college || "Independent Scout"}</span>
                  </div>
                </div>

                {/* KYC Identity & Selfie Verification Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-card border border-border/70 p-3 rounded-xl">
                  <div className="flex flex-wrap items-center gap-5">
                    {scout.selfieUrl ? (
                      <div className="flex items-center gap-2.5">
                        <a
                          href={scout.selfieUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-primary hover:border-verified transition-colors shrink-0 block"
                          title="Click to view full selfie"
                        >
                          <img
                            src={scout.selfieUrl}
                            alt={`${scout.fullName} selfie`}
                            className="w-full h-full object-cover"
                          />
                        </a>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-verified block">Live Selfie</span>
                          <a
                            href={scout.selfieUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-primary hover:underline font-semibold"
                          >
                            View Photo ↗
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground italic text-[11px]">
                        <Camera className="w-3.5 h-3.5" />
                        <span>No Selfie Uploaded</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-primary" />
                      <div>
                        <span className="text-muted-foreground">PAN: </span>
                        <span className="font-mono font-bold text-foreground">{scout.panNumber || "NOT SUBMITTED"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <div>
                        <span className="text-muted-foreground">Aadhaar (12-Digit): </span>
                        <span className="font-mono font-bold text-foreground">
                          {scout.aadhaarNumber
                            ? `•••• •••• ${scout.aadhaarNumber.slice(-4)}`
                            : "NOT SUBMITTED"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {scout.rejectionReason && (
                    <div className="text-destructive text-xs italic">
                      Prior rejection note: {scout.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {scout.verificationStatus === "PENDING" && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => confirmApprove(scout)}
                        className="gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve KYC
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => {
                          setRejectModalScout(scout);
                          setRejectReason("");
                        }}
                        className="gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject KYC
                      </Button>
                    </>
                  )}

                  {scout.verificationStatus === "APPROVED" && (
                    <>
                      <Button
                        variant={scout.isRoyaltyPaused ? "primary" : "secondary"}
                        size="sm"
                        disabled={isMutating}
                        onClick={() => {
                          setPauseModalScout(scout);
                          setPauseReason("");
                        }}
                        className="gap-1.5 text-xs"
                      >
                        {scout.isRoyaltyPaused ? (
                          <>
                            <PlayCircle className="w-3.5 h-3.5 text-success" />
                            Resume Royalty
                          </>
                        ) : (
                          <>
                            <PauseCircle className="w-3.5 h-3.5 text-warning" />
                            Pause Royalty
                          </>
                        )}
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => {
                          setExemptionModalScout(scout);
                          setExemptionDays(30);
                        }}
                        className="gap-1.5 text-xs"
                      >
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        Grant Exam Grace Pass
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => {
                          setRateModalScout(scout);
                          setCustomRate(scout.royaltyPercent);
                        }}
                        className="gap-1.5 text-xs"
                      >
                        <Percent className="w-3.5 h-3.5 text-primary" />
                        Adjust Royalty Rate
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4 px-2">
              <span className="text-xs text-muted-foreground">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalScout && (
        <Modal
          isOpen={true}
          onClose={() => setRejectModalScout(null)}
          title="Reject Scout Application"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please state why the KYC for <span className="font-semibold text-foreground">{rejectModalScout.fullName}</span> is being rejected. This feedback will be displayed on their verification portal so they can fix and re-submit.
            </p>
            <Input
              placeholder="e.g. Invalid PAN format, Aadhaar blurred or underage (<18)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setRejectModalScout(null)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={isMutating} onClick={confirmReject}>
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Pause Royalty Modal */}
      {pauseModalScout && (
        <Modal
          isOpen={true}
          onClose={() => setPauseModalScout(null)}
          title={pauseModalScout.isRoyaltyPaused ? "Resume Royalty Stream" : "Pause Scout Royalty Stream"}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {pauseModalScout.isRoyaltyPaused
                ? `Resume 1% royalty stream for ${pauseModalScout.fullName}? Future completed deals in their network will credit royalties to their wallet.`
                : `Are you sure you want to pause royalties for ${pauseModalScout.fullName}? No passive deal earnings will credit while paused.`}
            </p>
            {!pauseModalScout.isRoyaltyPaused && (
              <Input
                placeholder="Reason for pausing (optional, e.g. suspicious activity)"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
              />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setPauseModalScout(null)}>
                Cancel
              </Button>
              <Button
                variant={pauseModalScout.isRoyaltyPaused ? "primary" : "danger"}
                disabled={isMutating}
                onClick={confirmTogglePause}
              >
                {pauseModalScout.isRoyaltyPaused ? "Resume Stream" : "Pause Stream"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Grant Exemption Modal */}
      {exemptionModalScout && (
        <Modal
          isOpen={true}
          onClose={() => setExemptionModalScout(null)}
          title="Grant College Exam / Medical Grace Pass"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exempt <span className="font-semibold text-foreground">{exemptionModalScout.fullName}</span> from the monthly 1-onboard active quota rule. Their royalties will not pause even if they do not onboard someone this month.
            </p>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Grace Period Duration
              </label>
              <Select
                value={exemptionDays.toString()}
                onChange={(e) => setExemptionDays(parseInt(e.target.value, 10))}
                options={[
                  { value: "30", label: "30 Days (1 Month Exam Window)" },
                  { value: "60", label: "60 Days (Semester / Summer Break)" },
                  { value: "90", label: "90 Days (Extended Grace Pass)" },
                ]}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setExemptionModalScout(null)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={isMutating} onClick={confirmGrantExemption}>
                Grant Grace Pass
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Update Royalty % Modal */}
      {rateModalScout && (
        <Modal
          isOpen={true}
          onClose={() => setRateModalScout(null)}
          title="Adjust Custom Royalty Rate"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Adjust the lifetime GMV cut for <span className="font-semibold text-foreground">{rateModalScout.fullName}</span>. Standard platform default is 1.0%. Star regional scouts can be promoted to higher tiers.
            </p>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Royalty Percentage (0.1% - 5.0%)
              </label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="5.0"
                value={customRate}
                onChange={(e) => setCustomRate(parseFloat(e.target.value) || 1.0)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setRateModalScout(null)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={isMutating} onClick={confirmUpdateRate}>
                Save Royalty Rate
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
}
